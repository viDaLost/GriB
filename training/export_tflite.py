"""Экспорт обученной модели в TFLite и установка в приложение.

    python export_tflite.py                 # → app/assets/model + app/src/ml/modelAsset.ts
    python export_tflite.py --out-dir /tmp/x  # только файлы модели, приложение не трогаем

Веса квантуются в int8 (модель в ~4 раза меньше), вход и выход остаются float32.
"""

from __future__ import annotations

import argparse
import json
import tempfile
from datetime import datetime, timezone
from pathlib import Path

import keras
import numpy as np
import tensorflow as tf
from PIL import Image

from common import (
    APP_MODEL_ASSET_TS,
    APP_MODEL_DIR,
    MODELS,
    ROOT,
    SERVICE_LABELS,
    load_species,
    read_manifest,
)

MODEL_ASSET_TS = """// Сгенерировано training/export_tflite.py — не редактируйте вручную.
import meta from '../../assets/model/model-meta.json';
import type { ModelMeta } from './modelMeta';

// eslint-disable-next-line @typescript-eslint/no-require-imports
export const MODEL_SOURCE: number | null = require('../../assets/model/gribnik.tflite');
export const MODEL_META: ModelMeta | null = meta as ModelMeta;
"""

try:  # новый интерпретатор LiteRT, если установлен (pip install ai-edge-litert)
    from ai_edge_litert.interpreter import Interpreter
except ImportError:
    Interpreter = tf.lite.Interpreter


def convert(model: keras.Model, quantize: bool) -> bytes:
    with tempfile.TemporaryDirectory() as tmp:
        model.export(tmp, format="tf_saved_model", verbose=False)
        converter = tf.lite.TFLiteConverter.from_saved_model(tmp)
        if quantize:
            converter.optimizations = [tf.lite.Optimize.DEFAULT]
        return converter.convert()


def preprocess_like_app(path: Path, size: int) -> np.ndarray:
    """Ровно как в приложении: центральный квадрат → size×size → RGB 0..255."""
    img = Image.open(path).convert("RGB")
    w, h = img.size
    s = min(w, h)
    left, top = (w - s) // 2, (h - s) // 2
    img = img.crop((left, top, left + s, top + s)).resize((size, size), Image.BILINEAR)
    return np.asarray(img, dtype=np.float32)[None]


def verify(model: keras.Model, tflite: bytes, size: int, labels: list[str], limit: int = 32) -> float:
    """Сверяем ответы TFLite и исходной модели на тестовых фото."""
    interpreter = Interpreter(model_content=tflite)
    interpreter.allocate_tensors()
    inp = interpreter.get_input_details()[0]
    out = interpreter.get_output_details()[0]
    assert list(inp["shape"]) == [1, size, size, 3], inp["shape"]
    assert inp["dtype"] == np.float32 and out["dtype"] == np.float32
    assert out["shape"][-1] == len(labels), "число выходов не совпадает с числом меток"

    rows = [r for r in read_manifest() if r.split == "test" and r.label in labels][:limit]
    agree, max_diff = 0, 0.0
    for r in rows:
        x = preprocess_like_app(ROOT / r.path, size)
        ref = model.predict(x, verbose=0)[0]
        interpreter.set_tensor(inp["index"], x)
        interpreter.invoke()
        got = interpreter.get_tensor(out["index"])[0]
        agree += int(np.argmax(ref) == np.argmax(got))
        max_diff = max(max_diff, float(np.max(np.abs(ref - got))))
    rate = agree / len(rows) if rows else 1.0
    print(f"Проверка TFLite на {len(rows)} фото: совпадение top-1 {rate:.0%}, макс. расхождение {max_diff:.3f}")
    return rate


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--out-dir", type=Path, default=None, help="куда положить модель вместо приложения")
    ap.add_argument("--float", action="store_true", help="без квантования весов")
    args = ap.parse_args()

    labels: list[str] = json.loads((MODELS / "labels.json").read_text(encoding="utf-8"))
    config = json.loads((MODELS / "config.json").read_text(encoding="utf-8"))
    report = json.loads((MODELS / "report.json").read_text(encoding="utf-8"))
    species_ids = {s["id"] for s in load_species()}
    missing = [l for l in labels if l not in species_ids and l not in SERVICE_LABELS]
    if missing:
        raise SystemExit(f"Метки модели отсутствуют в базе приложения: {missing}")

    model = keras.models.load_model(MODELS / "gribnik.keras")
    size = int(config["imageSize"])
    tflite = convert(model, quantize=not args.float)
    if verify(model, tflite, size, labels) < 0.9:
        raise SystemExit("TFLite-модель заметно расходится с исходной — экспорт остановлен.")

    out_dir = args.out_dir or APP_MODEL_DIR
    out_dir.mkdir(parents=True, exist_ok=True)
    (out_dir / "gribnik.tflite").write_bytes(tflite)
    now = datetime.now(timezone.utc)
    meta = {
        "version": now.strftime("%Y.%m.%d-%H%M"),
        "createdAt": now.isoformat(timespec="seconds"),
        "architecture": config["architecture"],
        "input": {"size": size, "dtype": "float32", "normalization": config["normalization"]},
        "labels": labels,
        "temperature": report.get("temperature", 1.0),
        "metrics": {"top1": report["top1"], "top3": report["top3"], "testImages": report["testImages"]},
    }
    (out_dir / "model-meta.json").write_text(json.dumps(meta, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"Модель: {out_dir / 'gribnik.tflite'} ({len(tflite) / 1e6:.1f} МБ), классов: {len(labels)}")

    if args.out_dir is None:
        APP_MODEL_ASSET_TS.write_text(MODEL_ASSET_TS, encoding="utf-8")
        print(f"Приложение подключено к модели: {APP_MODEL_ASSET_TS}")


if __name__ == "__main__":
    main()
