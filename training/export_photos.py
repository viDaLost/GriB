"""Фото-эталоны для карточек справочника: по одному фото на вид из скачанных.

    python export_photos.py   # → app/assets/species/*.jpg + app/src/data/speciesPhotos.ts

Берутся фото с лицензиями CC0 / CC BY / CC BY-NC; автор и лицензия выводятся в карточке.
"""

from __future__ import annotations

import json

from PIL import Image

from common import APP, ROOT, SERVICE_LABELS, load_species, read_manifest

OUT_DIR = APP / "assets" / "species"
OUT_TS = APP / "src" / "data" / "speciesPhotos.ts"
SIZE = 480
LICENSE_NAMES = {"cc0": "CC0", "cc-by": "CC BY", "cc-by-nc": "CC BY-NC"}


CANDIDATES = 24  # сколько фото вида оценивать моделью


def typicality(rows, labels: list[str]) -> dict[str, float]:
    """Насколько уверенно модель узнаёт вид на фото: эталон — самое «типичное» фото вида."""
    model_path = APP / "assets" / "model" / "gribnik.tflite"
    if not model_path.exists():
        return {}
    import numpy as np
    import tensorflow as tf

    from export_tflite import preprocess_like_app

    it = tf.lite.Interpreter(model_path=str(model_path))
    it.allocate_tensors()
    inp, out = it.get_input_details()[0], it.get_output_details()[0]
    size = int(inp["shape"][1])
    scores: dict[str, float] = {}
    for r in rows:
        if r.label not in labels:
            continue
        it.set_tensor(inp["index"], preprocess_like_app(ROOT / r.path, size))
        it.invoke()
        scores[r.path] = float(it.get_tensor(out["index"])[0][labels.index(r.label)])
    return scores


def main() -> None:
    species_ids = {s["id"] for s in load_species()}
    rows = [r for r in read_manifest() if r.label in species_ids and r.license in LICENSE_NAMES]
    # Только обучающая выборка — тестовые фото остаются честными.
    rows = [r for r in rows if r.split == "train"]
    by_species: dict[str, list] = {}
    for r in sorted(rows, key=lambda r: r.photo_id):
        by_species.setdefault(r.label, []).append(r)
    candidates = [r for lst in by_species.values() for r in lst[:CANDIDATES]]

    meta_path = APP / "assets" / "model" / "model-meta.json"
    labels = json.loads(meta_path.read_text(encoding="utf-8"))["labels"] if meta_path.exists() else []
    score = typicality(candidates, labels)
    candidates.sort(key=lambda r: -score.get(r.path, 0.0))

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    chosen: dict[str, dict] = {}
    for r in candidates:
        if r.label in chosen or r.label in SERVICE_LABELS:
            continue
        img = Image.open(ROOT / r.path).convert("RGB")
        w, h = img.size
        s = min(w, h)
        img = img.crop(((w - s) // 2, (h - s) // 2, (w - s) // 2 + s, (h - s) // 2 + s))
        img = img.resize((SIZE, SIZE), Image.LANCZOS)
        img.save(OUT_DIR / f"{r.label}.jpg", "JPEG", quality=78, optimize=True)
        chosen[r.label] = {
            "author": r.attribution,
            "license": LICENSE_NAMES[r.license],
            "url": f"https://www.inaturalist.org/observations/{r.observation_id}",
        }

    lines = [
        "// Сгенерировано training/export_photos.py — не редактируйте вручную.",
        "// Фото: iNaturalist, авторы и лицензии указаны в PHOTO_CREDITS.",
        "",
        "export interface PhotoCredit {",
        "  author: string;",
        "  license: string;",
        "  url: string;",
        "}",
        "",
        "export const SPECIES_PHOTOS: Record<string, number> = {",
    ]
    for sid in sorted(chosen):
        lines.append(f"  '{sid}': require('../../assets/species/{sid}.jpg'),")
    lines += ["};", "", f"export const PHOTO_CREDITS: Record<string, PhotoCredit> = {json.dumps(chosen, ensure_ascii=False, indent=2, sort_keys=True)};", ""]
    OUT_TS.write_text("\n".join(lines), encoding="utf-8")
    missing = sorted(species_ids - set(chosen))
    print(f"Фото для карточек: {len(chosen)} видов → {OUT_DIR}")
    if missing:
        print(f"Без фото: {', '.join(missing)}")


if __name__ == "__main__":
    main()
