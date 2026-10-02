"""Общие пути и константы пайплайна обучения."""

from __future__ import annotations

import csv
import hashlib
import json
import os
from dataclasses import dataclass
from pathlib import Path

ROOT = Path(__file__).resolve().parent
REPO = ROOT.parent
APP = REPO / "app"
SPECIES_DIR = APP / "src" / "data" / "species"
SPECIES_FILES = ["dangerous.json", "tubular.json", "gilled.json", "other.json"]

DATA = Path(os.environ.get("GRIBNIK_DATA_DIR", ROOT / "data"))
RAW = DATA / "raw"  # RAW/<метка>/<photo_id>.jpg
CACHE = DATA / "cache"  # ответы iNaturalist, чтобы докачивать без повторных запросов
MANIFEST = DATA / "manifest.csv"
MODELS = Path(os.environ.get("GRIBNIK_MODELS_DIR", ROOT / "models"))

APP_MODEL_DIR = APP / "assets" / "model"
APP_MODEL_ASSET_TS = APP / "src" / "ml" / "modelAsset.ts"

# Служебные классы — должны совпадать с app/src/ml/decision.ts
NOT_MUSHROOM = "__not_mushroom__"
OTHER_FUNGUS = "__other_fungus__"
SERVICE_LABELS = [NOT_MUSHROOM, OTHER_FUNGUS]

MANIFEST_FIELDS = [
    "label",
    "path",
    "observation_id",
    "photo_id",
    "license",
    "attribution",
    "url",
    "split",
    "taxon_id",
    "observed_on",
    "observer_id",
    "place",
    "source_quality",
    "image_sha256",
]


def load_species() -> list[dict]:
    species: list[dict] = []
    for name in SPECIES_FILES:
        species += json.loads((SPECIES_DIR / name).read_text(encoding="utf-8"))
    return species


def split_for(observation_id: str) -> str:
    """Детерминированное разбиение по наблюдению: фото одного гриба не попадут в разные выборки."""
    h = int(hashlib.sha1(observation_id.encode()).hexdigest(), 16) % 100
    if h < 10:
        return "test"
    if h < 20:
        return "val"
    return "train"


@dataclass
class Row:
    label: str
    path: str
    observation_id: str
    photo_id: str
    license: str
    attribution: str
    url: str
    split: str
    taxon_id: str = ""
    observed_on: str = ""
    observer_id: str = ""
    place: str = ""
    source_quality: str = ""
    image_sha256: str = ""


def read_manifest() -> list[Row]:
    with MANIFEST.open(encoding="utf-8", newline="") as f:
        return [Row(**r) for r in csv.DictReader(f)]


def write_manifest(rows: list[Row]) -> None:
    MANIFEST.parent.mkdir(parents=True, exist_ok=True)
    with MANIFEST.open("w", encoding="utf-8", newline="") as f:
        w = csv.DictWriter(f, fieldnames=MANIFEST_FIELDS)
        w.writeheader()
        for r in rows:
            w.writerow(r.__dict__)
