"""Дообучение EfficientNetV2-B0 на фото из data/manifest.csv.

    python train.py            # обучение (нужна видеокарта: Colab, Kaggle или своя)
    python train.py --smoke    # быстрый прогон на CPU — проверить, что код работает

Обучение на CPU можно разбить на несколько запусков (так делает GitHub Actions — у задачи
лимит 6 часов):

    python train.py --deadline <unix-время> --no-finalize   # учит, пока успевает, сохраняет состояние
    python train.py --resume --deadline <...> --no-finalize  # продолжает с той же эпохи
    python train.py --finalize-only                          # калибровка и отчёт по лучшей модели

Результат: models/gribnik.keras, models/labels.json, models/report.json.
"""

from __future__ import annotations

import argparse
import json
import time
from collections import Counter

import keras
import numpy as np
import tensorflow as tf
from keras import layers

from data_quality import dataset_fingerprint, audit_rows
from quality_metrics import MacroRecall, DangerousAsEdibleRate

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
            # Разный масштаб: гриб то крупно, то целиком с окружением — как снимают в лесу.
            scale = tf.random.uniform([], 1.0, 1.4)
            img = tf.image.random_crop(resize_short_side(img, size * scale), (size, size, 3))
            img = tf.image.random_saturation(img / 255.0, 0.85, 1.15) * 255.0
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


def compile_model(model, lr, labels):
    edibility = {s['id']: s['edibility'] for s in load_species()}
    dangerous = [edibility.get(l) in {'poisonous', 'deadly'} for l in labels]
    edible = [edibility.get(l) in {'edible', 'conditionally_edible'} for l in labels]
    model.compile(
        optimizer=keras.optimizers.Adam(lr),
        loss=keras.losses.CategoricalCrossentropy(label_smoothing=0.1),
        metrics=[
            keras.metrics.CategoricalAccuracy(name="acc"),
            keras.metrics.TopKCategoricalAccuracy(k=3, name="top3"),
            MacroRecall(len(labels)), DangerousAsEdibleRate(dangerous, edible),
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
MIN_TEMPERATURE = 1.0


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


STATE = MODELS / "state.json"
CHECKPOINT = MODELS / "checkpoint.keras"


def load_state() -> dict:
    return json.loads(STATE.read_text()) if STATE.exists() else {"phase": "head", "epoch": 0, "best": -1.0, "sinceBest": 0}


def save_state(state: dict) -> None:
    STATE.write_text(json.dumps(state, indent=2))


class Progress(keras.callbacks.Callback):
    """После каждой эпохи: сохраняет состояние для продолжения, лучшую модель и следит за временем."""

    def __init__(self, state: dict, best_path, deadline: float | None, patience: int):
        super().__init__()
        self.state, self.best_path, self.deadline, self.patience = state, best_path, deadline, patience
        self.started = time.time()

    def on_epoch_begin(self, epoch, logs=None):
        self.started = time.time()
        self.interrupted = False

    def on_train_batch_end(self, batch, logs=None):
        # The first fine-tuning epoch can be much slower than a head epoch. Leave
        # time for validation and upload even before its duration is known.
        if self.deadline and time.time() + 1800 > self.deadline:
            self.interrupted = True
            self.state['outOfTime'] = True
            self.model.stop_training = True

    def on_epoch_end(self, epoch, logs=None):
        metrics = logs or {}
        val = float(metrics.get('val_acc', 0))
        macro = float(metrics.get('val_macro_recall', val))
        danger_rate = float(metrics.get('val_dangerous_as_edible_rate', 0))
        quality = .5 * val + .5 * macro - 2 * danger_rate
        s = self.state
        # A partially processed epoch is repeated next time, with learned weights
        # and optimizer state retained. It must not count as a complete epoch.
        s["epoch"] = epoch if self.interrupted else epoch + 1
        if quality > s['best']:
            s['best'], s['bestValAccuracy'], s['bestMacroRecall'], s['bestDangerRate'], s['sinceBest'] = quality, val, macro, danger_rate, 0
            self.model.save(self.best_path)
        else:
            s["sinceBest"] += 1
        self.model.save(CHECKPOINT)
        save_state(s)
        duration = time.time() - self.started
        print(f"  эпоха {epoch + 1}: val_acc {val:.4f} macro {macro:.4f}, danger {danger_rate:.4f}, качество {quality:.4f} (лучшее {s['best']:.4f}), {duration / 60:.1f} мин", flush=True)
        if self.interrupted:
            print('  эпоха прервана до лимита времени; следующий этап повторит её с сохранёнными весами')
        elif s["sinceBest"] >= self.patience:
            print("  точность не растёт — этап завершён")
            s["stalled"] = True
            self.model.stop_training = True
        elif self.deadline and time.time() + duration * 1.15 + 300 > self.deadline:
            print("  до конца отведённого времени эпоха не успеет — сохраняю и останавливаюсь")
            s["outOfTime"] = True
            self.model.stop_training = True


def find_base(model):
    return next(l for l in model.layers if isinstance(l, keras.Model))


def unfreeze(base, n_ft: int) -> None:
    base.trainable = True
    for i, layer in enumerate(base.layers):
        frozen_bottom = n_ft > 0 and i < len(base.layers) - n_ft
        if frozen_bottom or isinstance(layer, layers.BatchNormalization):
            layer.trainable = False


def finalize(model, split, labels, val_ds, test_ds, size) -> None:
    print("\n== Калибровка уверенности на валидации ==")
    val_probs, val_y = model.predict(val_ds, verbose=0), labels_of(split["val"], labels)
    temperature = fit_temperature(val_probs, val_y)
    if expected_calibration_error(apply_temperature(val_probs, temperature), val_y) > expected_calibration_error(val_probs, val_y):
        print(f"Температура {temperature} не улучшила калибровку на валидации — оставляю 1.0")
        temperature = 1.0
    print(f"Температура: {temperature}")
    report = evaluate(model, split["test"], labels, test_ds, temperature)
    report['labels'] = labels
    report['datasetFingerprint'] = dataset_fingerprint([r for group in split.values() for r in group])
    report['unsupportedSpecies'] = [s['id'] for s in load_species() if s['id'] not in labels]
    report['limitedValidation'] = [l for l in labels if report['perClass'].get(l, {}).get('n', 0) < 20]
    report['macroRecall'] = round(float(np.mean([s['recall'] for s in report['perClass'].values()])), 4)
    if STATE.exists():
        report["training"] = load_state()
    (MODELS / "labels.json").write_text(json.dumps(labels, ensure_ascii=False, indent=2), encoding="utf-8")
    (MODELS / "report.json").write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
    (MODELS / "config.json").write_text(
        json.dumps({"architecture": ARCHITECTURE, "imageSize": size, "normalization": "raw255", "smoke": load_state().get("smoke", False)}, indent=2),
        encoding="utf-8",
    )

    print(f"\nТочность на тесте: top-1 {report['top1']:.1%}, top-3 {report['top3']:.1%} ({report['testImages']} фото)")
    misses = report["dangerousConfidentMisses"]
    print(f"Калибровка (ECE): {report['eceBefore']:.3f} → {report['eceAfter']:.3f}")
    print(f"Уверенно принял ядовитый гриб за съедобный: {len(misses)} раз")
    for m in misses[:10]:
        print(f"  {m['true']} → {m['predicted']} ({m['confidence']:.0%})")


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
    ap.add_argument("--init-model", help="предыдущая Keras-модель для переноса грибного обучения")
    ap.add_argument("--init-labels", help="JSON с labels предыдущей модели")
    ap.add_argument("--threads", type=int, default=4)
    ap.add_argument("--patience", type=int, default=6, help="эпох без улучшения до остановки этапа")
    ap.add_argument("--deadline", type=float, help="unix-время, к которому нужно остановиться и сохраниться")
    ap.add_argument("--resume", action="store_true", help="продолжить с сохранённого состояния models/state.json")
    ap.add_argument("--no-finalize", action="store_true", help="не делать калибровку и отчёт (их сделает --finalize-only)")
    ap.add_argument("--finalize-only", action="store_true", help="только калибровка и отчёт по лучшей модели")
    ap.add_argument("--smoke", action="store_true", help="крошечный прогон на CPU для проверки кода")
    args = ap.parse_args()
    if args.smoke:
        args.image_size, args.batch_size = 96, 8
        args.epochs_head, args.epochs_finetune, args.min_images = 1, 1, 2
        args.weights = "none"
    tf.config.threading.set_intra_op_parallelism_threads(args.threads)
    tf.config.threading.set_inter_op_parallelism_threads(2)
    keras.utils.set_random_seed(42)
    weights = None if args.weights == "none" else args.weights

    rows = read_manifest()
    audit_rows(rows)
    labels = build_labels(rows, args.min_images)
    index = {l: i for i, l in enumerate(labels)}
    rows = [r for r in rows if r.label in index]
    split = {s: [r for r in rows if r.split == s] for s in ("train", "val", "test")}
    print(f"Классов: {len(labels)}; фото: " + ", ".join(f"{s} {len(v)}" for s, v in split.items()))
    if not split["val"] or not split["test"]:
        raise SystemExit("Пустая валидационная или тестовая выборка — скачайте больше фото.")

    fingerprint = dataset_fingerprint(rows)
    size = args.image_size
    train_ds = make_dataset(split["train"], index, size, args.batch_size, training=True)
    val_ds = make_dataset(split["val"], index, size, args.batch_size, training=False)
    test_ds = make_dataset(split["test"], index, size, args.batch_size, training=False)

    MODELS.mkdir(parents=True, exist_ok=True)
    best = MODELS / "gribnik.keras"
    if args.finalize_only:
        state = load_state()
        if state.get('labels') != labels or state.get('datasetFingerprint') != fingerprint:
            raise SystemExit('Данные отличаются от сохранённого обучения; калибровка остановлена.')
        size = state.get('imageSize', size)
        if size != args.image_size:
            raise SystemExit('Для финализации нужен исходный --image-size')
        finalize(keras.models.load_model(best, compile=False), split, labels, val_ds, test_ds, size)
        return

    counts = Counter(index[r.label] for r in split["train"])
    class_weight = {i: min(4.0, max(.5, (len(split["train"]) / (len(labels) * counts[i])) ** .5)) for i in counts}
    edibility = {s["id"]: s["edibility"] for s in load_species()}
    for label, i in index.items():
        if edibility.get(label) in ("poisonous", "deadly") and i in class_weight:
            class_weight[i] *= args.danger_weight

    state = load_state() if args.resume else {"phase": "head", "epoch": 0, "best": -1.0, "sinceBest": 0}
    if args.resume and state.get("labels") not in (None, labels):
        raise SystemExit("Набор классов изменился с прошлого запуска — продолжить обучение нельзя.")
    if args.resume and state.get('datasetFingerprint') != fingerprint:
        raise SystemExit('Состав или фотографии датасета изменились; продолжать старую модель нельзя.')
    if args.resume and state.get('imageSize') != size:
        raise SystemExit('Размер изображения изменился; продолжение остановлено.')
    state['labels'], state['datasetFingerprint'], state['imageSize'] = labels, fingerprint, size
    state['smoke'] = args.smoke
    settings = {'epochsHead': args.epochs_head, 'epochsFinetune': args.epochs_finetune,
                'finetuneLayers': args.finetune_layers, 'dangerWeight': args.danger_weight,
                'batchSize': args.batch_size}
    if args.resume and state.get('settings') != settings:
        raise SystemExit('Параметры обучения изменились; продолжение остановлено.')
    state['settings'] = settings
    state['requestedHeadEpochs'], state['requestedFinetuneEpochs'] = args.epochs_head, args.epochs_finetune
    if args.resume and not CHECKPOINT.exists():
        raise SystemExit('Нет контрольной точки для продолжения обучения.')
    state.pop("outOfTime", None)
    if args.resume and CHECKPOINT.exists():
        print(f"Продолжаю: этап {state['phase']}, эпоха {state['epoch']}")
        model = keras.models.load_model(CHECKPOINT)
        base = find_base(model)
    else:
        model, base = build_model(len(labels), size, None if args.init_model else weights)
        if args.init_model:
            if not args.init_labels:
                raise SystemExit('--init-model требует --init-labels')
            old = keras.models.load_model(args.init_model, compile=False)
            base.set_weights(find_base(old).get_weights())
            old_meta = json.loads(open(args.init_labels).read())
            old_labels = old_meta['labels'] if isinstance(old_meta, dict) else old_meta
            old_w, old_b = old.get_layer('probs').get_weights()
            new_w, new_b = model.get_layer('probs').get_weights()
            for j, label in enumerate(labels):
                if label in old_labels:
                    k = old_labels.index(label)
                    new_w[:, j], new_b[j] = old_w[:, k], old_b[k]
            model.get_layer('probs').set_weights([new_w, new_b])
            state['initialization'] = 'previous mushroom model'
            print('Перенесены грибные признаки и общие классы предыдущей модели.')
        base.trainable = False
        compile_model(model, 3e-4, labels)

    def run(epochs: int) -> None:
        progress = Progress(state, best, args.deadline, args.patience)
        if state["epoch"] < epochs:
            if args.deadline and time.time() + 1800 > args.deadline:
                model.save(CHECKPOINT); save_state(state)
                state['outOfTime'] = True
                return
            model.fit(train_ds, validation_data=val_ds, initial_epoch=state["epoch"], epochs=epochs,
                      class_weight=class_weight, callbacks=[progress], verbose=2)

    if state["phase"] == "head":
        print("\n== Этап 1: обучаем только классификатор ==")
        run(args.epochs_head)
        if state.get("outOfTime"):
            return
        state.update(phase="finetune", epoch=0, sinceBest=0, stalled=False)
        n_ft = args.finetune_layers
        print(f"\n== Этап 2: дообучаем {'всю сеть' if n_ft <= 0 else f'верхние {n_ft} слоёв'} ==")
        # Лучшая модель «головы» — отправная точка дообучения.
        model = keras.models.load_model(best)
        base = find_base(model)
        unfreeze(base, n_ft)
        steps = max(1, len(split["train"]) // args.batch_size) * max(1, args.epochs_finetune)
        compile_model(model, keras.optimizers.schedules.CosineDecay(5e-5, decay_steps=steps), labels)
        model.save(CHECKPOINT)
        save_state(state)

    if state["phase"] == "finetune":
        if not state.get("stalled"):
            run(args.epochs_finetune)
        if state.get("outOfTime"):
            return
        state["phase"] = "done"
        save_state(state)

    print(f"Обучение завершено, лучшее качество {state['best']:.4f}")
    if not args.no_finalize:
        finalize(keras.models.load_model(best, compile=False), split, labels, val_ds, test_ds, size)


if __name__ == "__main__":
    main()
