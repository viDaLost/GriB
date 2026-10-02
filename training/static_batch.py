"""Фиксирует размер пакета = 1 во всех тензорах модели TFLite.

Keras/SavedModel экспортирует вход как [-1, 224, 224, 3]. Android-рантайм это прощает,
а LiteRT.js в браузере требует точного совпадения формы. Веса не меняются — только
метаданные формы, поэтому ответы модели остаются прежними (это проверяется).

    python static_batch.py ../app/assets/model/gribnik.tflite   # исправить файл на месте
"""

from __future__ import annotations

import sys
from pathlib import Path

import numpy as np
import tensorflow as tf
from tensorflow.lite.tools import flatbuffer_utils


def make_static(tflite: bytes) -> bytes:
    model = flatbuffer_utils.read_model_from_bytearray(bytearray(tflite))
    for sg in model.subgraphs:
        for t in sg.tensors:
            sig = t.shapeSignature
            if sig is not None and -1 in list(sig):
                t.shapeSignature = None  # без сигнатуры форма берётся из shape — уже [1, …]
    return bytes(flatbuffer_utils.convert_object_to_bytearray(model))


def same_outputs(a: bytes, b: bytes, runs: int = 3) -> float:
    """Максимальное расхождение ответов двух моделей на случайных входах."""
    def run(model: bytes, x: np.ndarray) -> np.ndarray:
        it = tf.lite.Interpreter(model_content=model)
        it.allocate_tensors()
        it.set_tensor(it.get_input_details()[0]["index"], x)
        it.invoke()
        return it.get_tensor(it.get_output_details()[0]["index"])

    shape = tf.lite.Interpreter(model_content=b).get_input_details()[0]["shape"]
    rng = np.random.default_rng(0)
    diff = 0.0
    for _ in range(runs):
        x = rng.uniform(0, 255, size=shape).astype(np.float32)
        diff = max(diff, float(np.max(np.abs(run(a, x) - run(b, x)))))
    return diff


if __name__ == "__main__":
    path = Path(sys.argv[1])
    original = path.read_bytes()
    fixed = make_static(original)
    d = same_outputs(original, fixed)
    if d > 1e-5:
        raise SystemExit(f"Ответы изменились (расхождение {d}) — файл не перезаписан.")
    path.write_bytes(fixed)
    print(f"Готово: {path} — размер пакета зафиксирован, расхождение ответов {d:.1e}")
