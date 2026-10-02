"""Синтетический набор для проверки кода обучения без интернета.

Рисует простые картинки нескольких классов и пишет data/manifest.csv.
Модель на таких данных бесполезна — только для теста train.py и export_tflite.py.

    python make_synthetic.py && python train.py --smoke && python export_tflite.py --out-dir /tmp/smoke
"""

from __future__ import annotations

import random
import os

from PIL import Image, ImageDraw

from common import NOT_MUSHROOM, OTHER_FUNGUS, RAW, ROOT, Row, split_for, write_manifest

CLASSES = {
    "boletus-edulis": (120, 80, 40),
    "amanita-muscaria": (220, 30, 30),
    "cantharellus-cibarius": (240, 180, 20),
    NOT_MUSHROOM: (40, 140, 40),
    OTHER_FUNGUS: (150, 150, 150),
}


def main(per_class: int = 30) -> None:
    rnd = random.Random(0)
    rows: list[Row] = []
    for label, color in CLASSES.items():
        for i in range(per_class):
            img = Image.new("RGB", (160, 120), (rnd.randint(0, 80),) * 3)
            d = ImageDraw.Draw(img)
            jitter = tuple(max(0, min(255, c + rnd.randint(-25, 25))) for c in color)
            x, y = rnd.randint(20, 60), rnd.randint(10, 40)
            d.ellipse((x, y, x + 70, y + 50), fill=jitter)
            path = RAW / label / f"syn{i}.jpg"
            path.parent.mkdir(parents=True, exist_ok=True)
            img.save(path, "JPEG")
            obs = f"{label}-{i}"
            rows.append(Row(label, os.path.relpath(path, ROOT), obs, f"syn-{label}-{i}", "cc0", "synthetic", "", split_for(obs)))
    write_manifest(rows)
    print(f"Синтетический набор: {len(rows)} картинок")


if __name__ == "__main__":
    main()
