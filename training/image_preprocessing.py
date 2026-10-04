"""One image path for calibration and export: the application's central crop."""
from pathlib import Path

import numpy as np
from PIL import Image


def preprocess_like_app(path: Path, size: int) -> np.ndarray:
    with Image.open(path) as source:
        img = source.convert('RGB')
        width, height = img.size
        side = min(width, height)
        left, top = (width - side) // 2, (height - side) // 2
        img = img.crop((left, top, left + side, top + side)).resize((size, size), Image.Resampling.BILINEAR)
        return np.asarray(img, dtype=np.float32)[None]


def predict_images(model, paths, size: int, batch_size: int = 32) -> np.ndarray:
    paths = list(paths)
    if not paths:
        raise ValueError('Cannot predict an empty image set')
    batches = []
    for i in range(0, len(paths), batch_size):
        images = np.concatenate([preprocess_like_app(path, size) for path in paths[i:i + batch_size]])
        batches.append(model(images, training=False).numpy())
    return np.concatenate(batches)
