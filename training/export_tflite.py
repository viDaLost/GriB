"""Экспорт обученной модели в TFLite и установка в приложение.

    python export_tflite.py                 # → app/assets/model + app/src/ml/modelAsset.ts
    python export_tflite.py --out-dir /tmp/x  # только файлы модели, приложение не трогаем

Динамическое квантование весов; вход и выход остаются float32. Если точность
ухудшилась, используется float32. Для публикации проверяется вся тестовая выборка.
"""

from __future__ import annotations

import argparse
import json
import shutil
import subprocess
import tempfile
from datetime import datetime, timezone
from pathlib import Path

import keras
import numpy as np
import tensorflow as tf
from calibration import expected_calibration_error
from image_preprocessing import preprocess_like_app, predict_images

from static_batch import make_static
from common import (
    APP_MODEL_ASSET_TS,
    APP_MODEL_DIR,
    MODELS,
    ROOT,
    SERVICE_LABELS,
    load_species,
    read_manifest,
)
from promotion import summarize, publication_reasons

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
        # Фиксированный размер пакета = 1: иначе LiteRT.js в браузере не принимает вход.
        return make_static(converter.convert())


def interpreter_for(tflite: bytes, size: int, labels: list[str]):
    interpreter = Interpreter(model_content=tflite, num_threads=4)
    interpreter.allocate_tensors()
    inp = interpreter.get_input_details()[0]
    out = interpreter.get_output_details()[0]
    assert list(inp["shape"]) == [1, size, size, 3], inp["shape"]
    assert inp["dtype"] == np.float32 and out["dtype"] == np.float32
    assert out["shape"][-1] == len(labels), "число выходов не совпадает с числом меток"

    return interpreter, inp['index'], out['index']


def predict_tflite(tflite, rows, size, labels):
    interpreter, inp, out = interpreter_for(tflite, size, labels)
    probabilities = []
    for i, r in enumerate(rows):
        interpreter.set_tensor(inp, preprocess_like_app(ROOT / r.path, size))
        interpreter.invoke()
        probabilities.append(interpreter.get_tensor(out)[0])
        if (i + 1) % 500 == 0: print(f'TFLite: {i + 1}/{len(rows)}', flush=True)
    return np.asarray(probabilities)


def predict_reference(model, rows, size):
    return predict_images(model, [ROOT / r.path for r in rows], size)


def decisions(rows, labels, probabilities, name):
    source, result = MODELS / f'{name}-predictions.json', MODELS / f'{name}-decisions.json'
    source.write_text(json.dumps({'labels': labels, 'samples': [
        {'truth': r.label, 'probabilities': p.tolist()} for r, p in zip(rows, probabilities)]}))
    subprocess.run(['node', str(ROOT / 'evaluate_decisions.ts'), str(source), str(result)], check=True)
    source.unlink()
    return json.loads(result.read_text())


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--out-dir", type=Path, default=None, help="куда положить модель вместо приложения")
    ap.add_argument("--float", action="store_true", help="без квантования весов")
    args = ap.parse_args()
    tf.config.threading.set_intra_op_parallelism_threads(4)
    tf.config.threading.set_inter_op_parallelism_threads(2)

    labels: list[str] = json.loads((MODELS / "labels.json").read_text(encoding="utf-8"))
    config = json.loads((MODELS / "config.json").read_text(encoding="utf-8"))
    if config.get('smoke') and args.out_dir is None:
        raise SystemExit('Синтетическая модель не может заменить модель приложения. Используйте --out-dir.')
    report = json.loads((MODELS / "report.json").read_text(encoding="utf-8"))
    species_ids = {s["id"] for s in load_species()}
    missing = [l for l in labels if l not in species_ids and l not in SERVICE_LABELS]
    if missing:
        raise SystemExit(f"Метки модели отсутствуют в базе приложения: {missing}")

    model = keras.models.load_model(MODELS / "gribnik.keras", compile=False)
    size = int(config["imageSize"])
    rows = [r for r in read_manifest() if r.split == 'test' and r.label in labels]
    if not rows: raise SystemExit('Нет тестовых фото; экспорт остановлен.')
    ref = predict_reference(model, rows, size)
    reference, _ = summarize(ref, rows, labels, report.get('temperature', 1.0))
    tflite = convert(model, quantize=not args.float)
    got = predict_tflite(tflite, rows, size, labels)
    candidate, probabilities = summarize(got, rows, labels, report.get('temperature', 1.0))
    agreement = float(np.mean(ref.argmax(axis=1) == got.argmax(axis=1)))
    quantized = not args.float
    if (agreement < .98 or candidate['top1'] + .005 < reference['top1']
        or candidate['macroRecall'] + .01 < reference['macroRecall']
        or len(candidate['dangerousConfidentMisses']) > len(reference['dangerousConfidentMisses'])):
        if args.float: raise SystemExit('Float32 TFLite расходится с Keras; экспорт остановлен.')
        print('Динамическое квантование ухудшило ответы — проверяю float32.')
        tflite = convert(model, quantize=False)
        got = predict_tflite(tflite, rows, size, labels)
        candidate, probabilities = summarize(got, rows, labels, report.get('temperature', 1.0))
        agreement = float(np.mean(ref.argmax(axis=1) == got.argmax(axis=1)))
        quantized = False
    if (agreement < .98 or candidate['top1'] + .005 < reference['top1']
        or candidate['macroRecall'] + .01 < reference['macroRecall']
        or len(candidate['dangerousConfidentMisses']) > len(reference['dangerousConfidentMisses'])):
        raise SystemExit('TFLite ухудшает ответы Keras на тестовых фото; экспорт остановлен.')
    index = {label: i for i, label in enumerate(labels)}
    candidate['eceBefore'] = expected_calibration_error(got, np.array([index[r.label] for r in rows]))
    candidate['decisions'] = decisions(rows, labels, probabilities, 'candidate')
    report.update(candidate)
    report['tflite'] = {'quantization': 'dynamic-range' if quantized else 'float32',
                        'top1Agreement': round(agreement, 4), 'verifiedImages': len(rows), 'keras': reference}
    report['limitedValidation'] = [l for l in labels if candidate['perClass'].get(l, {}).get('n', 0) < 20]

    reasons = []
    if args.out_dir is None:
        previous = json.loads((APP_MODEL_DIR / 'model-meta.json').read_text())
        mask = np.array([r.label in previous['labels'] for r in rows])
        shared = [r for r in rows if r.label in previous['labels']]
        if not shared: raise SystemExit('Нет общей тестовой выборки с предыдущей моделью.')
        old_raw = predict_tflite((APP_MODEL_DIR / 'gribnik.tflite').read_bytes(), shared,
                                 previous['input']['size'], previous['labels'])
        baseline, old_p = summarize(old_raw, shared, previous['labels'], previous.get('temperature', 1))
        overlap, shared_p = summarize(got[mask], shared, labels, report.get('temperature', 1))
        baseline['decisions'] = decisions(shared, previous['labels'], old_p, 'baseline')
        overlap['decisions'] = decisions(shared, labels, shared_p, 'overlap')
        reasons = publication_reasons(candidate, baseline, overlap, labels, previous['labels'])
        report['promotion'] = {'passed': not reasons, 'reasons': reasons,
                               'baselineVersion': previous['version'], 'baseline': baseline, 'candidateShared': overlap}
    else:
        report['promotion'] = {'passed': False, 'reasons': ['Evaluation-only export; application unchanged']}
    (MODELS / 'report.json').write_text(json.dumps(report, ensure_ascii=False, indent=2))
    np.savez_compressed(MODELS / 'holdout-predictions.npz', probabilities=got, reference=ref,
                        labels=np.array(labels), truth=np.array([r.label for r in rows]))

    out_dir = args.out_dir or MODELS / 'candidate'
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
        "metrics": {"top1": report["top1"], "top3": report["top3"], "testImages": report["testImages"],
                    "macroRecall": report['macroRecall']},
        "perClass": report['perClass'],
        "limitedValidation": report['limitedValidation'],
        "datasetFingerprint": report['datasetFingerprint'],
        "quantization": report['tflite']['quantization'],
    }
    (out_dir / "model-meta.json").write_text(json.dumps(meta, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"Модель: {out_dir / 'gribnik.tflite'} ({len(tflite) / 1e6:.1f} МБ), классов: {len(labels)}")

    if args.out_dir is None:
        if reasons:
            raise SystemExit('Модель сохранена как кандидат; приложение не заменено:\n' + '\n'.join(reasons))
        APP_MODEL_DIR.mkdir(parents=True, exist_ok=True)
        for name in ['gribnik.tflite', 'model-meta.json']: shutil.copy2(out_dir / name, APP_MODEL_DIR / name)
        APP_MODEL_ASSET_TS.write_text(MODEL_ASSET_TS, encoding="utf-8")
        print(f"Приложение подключено к модели: {APP_MODEL_ASSET_TS}")


if __name__ == "__main__":
    main()
