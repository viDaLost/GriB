"""Дообучение EfficientNetV2-B0 на фото из data/manifest.csv.

    python train.py            # обучение (нужна видеокарта: Colab, Kaggle или своя)
    python train.py --smoke    # быстрый прогон на CPU — проверить, что код работает

Результат: models/gribnik.keras, models/labels.json, models/report.json.
"""

from __future__ import annotations

import argparse
import json
from collections import Counter

import keras
import numpy as np
import tensorflow as tf
from keras import layers

from common import MODELS, ROOT, SERVICE_LABELS, Row, load_species, read_manifest

ARCHITECTURE = "EfficientNetV2B0"


def build_labels(rows: list[Row], min_images: int) -> list[str]:
    """Виды по алфавиту, затем служебные классы. Виды с малым числом фото не обучаем."""
    counts = Counter(r.label for r in rows if r.split == "train")
    species_ids = {s["id"] for s in load_species()}
    unknown = sorted(set(counts) - species_ids - set(SERVICE_LABELS))
    if unknown:
        raise SystemExit(f"В manifest.csv есть метки, которых нет в базе приложения: {unknown}")
    labels = sorted(l for l in counts if l in species_ids and counts[l] >= min_images)
    skipped = sorted(l for l in species_ids if counts.get(l, 0) < min_images)
    if skipped:
        print(f"Мало фото (< {min_images}), вид не попадёт в модель: {', '.join(skipped)}")
    labels += [l for l in SERVICE_LABELS if counts.get(l, 0) >= min_images]
    return labels


def resize_short_side(img: tf.Tensor, target: float) -> tf.Tensor:
    shape = tf.cast(tf.shape(img)[:2], tf.float32)
    new = tf.cast(tf.math.ceil(shape * (target / tf.reduce_min(shape))), tf.int32)
    return tf.image.resize(img, new, antialias=True)


def make_dataset(rows: list[Row], index: dict[str, int], size: int, batch: int, training: bool):
    paths = [str(ROOT / r.path) for r in rows]
    ys = [index[r.label] for r in rows]
    n = len(index)
    ds = tf.data.Dataset.from_tensor_slices((paths, ys))
    if training:
        ds = ds.shuffle(len(paths), reshuffle_each_iteration=True)

    def load(path, y):
        img = tf.cast(tf.io.decode_jpeg(tf.io.read_file(path), channels=3), tf.float32)
        if training:
            img = tf.image.random_crop(resize_short_side(img, size * 1.15), (size, size, 3))
        else:
            # Как в приложении: центральный квадрат, сжатый до размера модели.
            img = tf.image.resize_with_crop_or_pad(resize_short_side(img, size), size, size)
        return img, tf.one_hot(y, n)

    ds = ds.map(load, num_parallel_calls=tf.data.AUTOTUNE).batch(batch)
    if training:
        augment = keras.Sequential(
            [
                layers.RandomFlip("horizontal"),
                layers.RandomRotation(0.08),
                layers.RandomZoom((-0.1, 0.2)),
                layers.RandomContrast(0.2),
                layers.RandomBrightness(0.15, value_range=(0, 255)),
            ]
        )
        ds = ds.map(
            lambda x, y: (tf.clip_by_value(augment(x, training=True), 0, 255), y),
            num_parallel_calls=tf.data.AUTOTUNE,
        )
    return ds.prefetch(tf.data.AUTOTUNE)


def build_model(n: int, size: int, weights: str | None):
    # include_preprocessing=True: модель сама нормирует вход, ей подаются пиксели 0..255.
    base = keras.applications.EfficientNetV2B0(
        include_top=False,
        weights=weights,
        input_shape=(size, size, 3),
        include_preprocessing=True,
        pooling="avg",
    )
    inputs = keras.Input((size, size, 3), name="image")
    x = base(inputs, training=False)  # BatchNorm остаётся в режиме инференса и при дообучении
    x = layers.Dropout(0.3)(x)
    outputs = layers.Dense(n, activation="softmax", name="probs")(x)
    return keras.Model(inputs, outputs), base


def compile_model(model, lr):
    model.compile(
        optimizer=keras.optimizers.Adam(lr),
        loss=keras.losses.CategoricalCrossentropy(label_smoothing=0.1),
        metrics=[
            keras.metrics.CategoricalAccuracy(name="acc"),
            keras.metrics.TopKCategoricalAccuracy(k=3, name="top3"),
        ],
    )


def apply_temperature(probs: np.ndarray, t: float) -> np.ndarray:
    """softmax(logits / T) через вероятности: p^(1/T) с нормировкой (как в приложении)."""
    logp = np.log(np.clip(probs, 1e-9, 1.0)) / t
    logp -= logp.max(axis=1, keepdims=True)
    e = np.exp(logp)
    return e / e.sum(axis=1, keepdims=True)


# Ниже не опускаем: резкое «заострение» сделало бы модель самоувереннее, а это опаснее,
# чем лишняя скромность.
MIN_TEMPERATURE = 0.7


def fit_temperature(probs: np.ndarray, y: np.ndarray) -> float:
    """Температура, при которой вероятности модели честнее всего (минимум NLL на валидации)."""
    best_t, best_nll = 1.0, float("inf")
    for t in np.exp(np.linspace(np.log(MIN_TEMPERATURE), np.log(5.0), 80)):
        p = apply_temperature(probs, float(t))
        nll = float(-np.mean(np.log(np.clip(p[np.arange(len(y)), y], 1e-9, 1.0))))
        if nll < best_nll:
            best_t, best_nll = float(t), nll
    return round(best_t, 4)


def expected_calibration_error(probs: np.ndarray, y: np.ndarray, bins: int = 10) -> float:
    """Насколько «90% уверенности» в среднем расходится с реальной долей верных ответов."""
    conf = probs.max(axis=1)
    correct = probs.argmax(axis=1) == y
    ece = 0.0
    for lo in np.linspace(0, 1, bins, endpoint=False):
        m = (conf > lo) & (conf <= lo + 1 / bins)
        if m.any():
            ece += m.mean() * abs(conf[m].mean() - correct[m].mean())
    return round(float(ece), 4)


def labels_of(rows: list[Row], labels: list[str]) -> np.ndarray:
    return np.array([labels.index(r.label) for r in rows])


def evaluate(model, rows: list[Row], labels: list[str], ds, temperature: float = 1.0) -> dict:
    """Точность на отложенной выборке и, главное, опасные ошибки (после калибровки, как в приложении)."""
    raw = model.predict(ds, verbose=0)
    probs = apply_temperature(raw, temperature)
    y = labels_of(rows, labels)
    order = np.argsort(-probs, axis=1)
    top1 = float(np.mean(order[:, 0] == y))
    top3 = float(np.mean([y[i] in order[i, :3] for i in range(len(y))]))

    edibility = {s["id"]: s["edibility"] for s in load_species()}
    dangerous = {"poisonous", "deadly"}
    safe_looking = {"edible", "conditionally_edible"}
    misses = []
    per_class: dict[str, dict] = {}
    for i, r in enumerate(rows):
        stat = per_class.setdefault(r.label, {"n": 0, "correct": 0})
        stat["n"] += 1
        pred = labels[order[i, 0]]
        stat["correct"] += int(pred == r.label)
        conf = float(probs[i, order[i, 0]])
        if edibility.get(r.label) in dangerous and edibility.get(pred) in safe_looking and conf >= 0.7:
            misses.append({"true": r.label, "predicted": pred, "confidence": round(conf, 3), "photo": r.path})
    for stat in per_class.values():
        stat["recall"] = round(stat["correct"] / stat["n"], 3)

    return {
        "top1": round(top1, 4),
        "top3": round(top3, 4),
        "testImages": len(rows),
        "temperature": temperature,
        "eceBefore": expected_calibration_error(raw, y),
        "eceAfter": expected_calibration_error(probs, y),
        "dangerousConfidentMisses": misses,
        "perClass": dict(sorted(per_class.items(), key=lambda kv: kv[1]["recall"])),
    }


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--image-size", type=int, default=224)
    ap.add_argument("--batch-size", type=int, default=32)
    ap.add_argument("--epochs-head", type=int, default=5, help="эпох обучения только «головы»")
    ap.add_argument("--epochs-finetune", type=int, default=20, help="эпох дообучения всей сети")
    ap.add_argument("--min-images", type=int, default=30, help="минимум фото вида для обучения")
    ap.add_argument("--weights", default="imagenet", help="'imagenet' или 'none'")
    ap.add_argument(
        "--finetune-layers", type=int, default=0,
        help="сколько верхних слоёв сети дообучать (0 — все); на CPU быстрее дообучать только верх",
    )
    ap.add_argument(
        "--danger-weight", type=float, default=2.0,
        help="во сколько раз важнее ошибки на ядовитых видах (лучше лишняя тревога, чем пропуск)",
    )
    ap.add_argument("--smoke", action="store_true", help="крошечный прогон на CPU для проверки кода")
    args = ap.parse_args()
    if args.smoke:
        args.image_size, args.batch_size = 96, 8
        args.epochs_head, args.epochs_finetune, args.min_images = 1, 1, 2
        args.weights = "none"
    weights = None if args.weights == "none" else args.weights

    rows = read_manifest()
    labels = build_labels(rows, args.min_images)
    index = {l: i for i, l in enumerate(labels)}
    rows = [r for r in rows if r.label in index]
    split = {s: [r for r in rows if r.split == s] for s in ("train", "val", "test")}
    print(f"Классов: {len(labels)}; фото: " + ", ".join(f"{s} {len(v)}" for s, v in split.items()))
    if not split["val"] or not split["test"]:
        raise SystemExit("Пустая валидационная или тестовая выборка — скачайте больше фото.")

    size = args.image_size
    train_ds = make_dataset(split["train"], index, size, args.batch_size, training=True)
    val_ds = make_dataset(split["val"], index, size, args.batch_size, training=False)
    test_ds = make_dataset(split["test"], index, size, args.batch_size, training=False)

    counts = Counter(index[r.label] for r in split["train"])
    class_weight = {i: len(split["train"]) / (len(labels) * counts[i]) for i in counts}
    edibility = {s["id"]: s["edibility"] for s in load_species()}
    for label, i in index.items():
        if edibility.get(label) in ("poisonous", "deadly") and i in class_weight:
            class_weight[i] *= args.danger_weight

    MODELS.mkdir(parents=True, exist_ok=True)
    best = MODELS / "gribnik.keras"
    callbacks = [
        keras.callbacks.ModelCheckpoint(best, monitor="val_acc", mode="max", save_best_only=True),
        keras.callbacks.EarlyStopping(monitor="val_acc", mode="max", patience=4, restore_best_weights=True),
    ]

    model, base = build_model(len(labels), size, weights)

    print("\n== Этап 1: обучаем только классификатор ==")
    base.trainable = False
    compile_model(model, 1e-3)
    model.fit(train_ds, validation_data=val_ds, epochs=args.epochs_head, class_weight=class_weight, callbacks=callbacks)

    n_ft = args.finetune_layers
    print(f"\n== Этап 2: дообучаем {'всю сеть' if n_ft <= 0 else f'верхние {n_ft} слоёв'} ==")
    base.trainable = True
    for i, layer in enumerate(base.layers):
        frozen_bottom = n_ft > 0 and i < len(base.layers) - n_ft
        if frozen_bottom or isinstance(layer, layers.BatchNormalization):
            layer.trainable = False
    steps = max(1, len(split["train"]) // args.batch_size) * max(1, args.epochs_finetune)
    compile_model(model, keras.optimizers.schedules.CosineDecay(1e-4, decay_steps=steps))
    model.fit(train_ds, validation_data=val_ds, epochs=args.epochs_finetune, class_weight=class_weight, callbacks=callbacks)
    model.save(best)

    print("\n== Калибровка уверенности на валидации ==")
    val_probs, val_y = model.predict(val_ds, verbose=0), labels_of(split["val"], labels)
    temperature = fit_temperature(val_probs, val_y)
    if expected_calibration_error(apply_temperature(val_probs, temperature), val_y) > expected_calibration_error(val_probs, val_y):
        print(f"Температура {temperature} не улучшила калибровку на валидации — оставляю 1.0")
        temperature = 1.0
    print(f"Температура: {temperature}")
    report = evaluate(model, split["test"], labels, test_ds, temperature)
    report["labels"] = labels
    (MODELS / "labels.json").write_text(json.dumps(labels, ensure_ascii=False, indent=2), encoding="utf-8")
    (MODELS / "report.json").write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
    (MODELS / "config.json").write_text(
        json.dumps({"architecture": ARCHITECTURE, "imageSize": size, "normalization": "raw255"}, indent=2),
        encoding="utf-8",
    )

    print(f"\nТочность на тесте: top-1 {report['top1']:.1%}, top-3 {report['top3']:.1%} ({report['testImages']} фото)")
    misses = report["dangerousConfidentMisses"]
    print(f"Калибровка (ECE): {report['eceBefore']:.3f} → {report['eceAfter']:.3f}")
    print(f"Уверенно принял ядовитый гриб за съедобный: {len(misses)} раз")
    for m in misses[:10]:
        print(f"  {m['true']} → {m['predicted']} ({m['confidence']:.0%})")
    print(f"Модель: {best}")


if __name__ == "__main__":
    main()
