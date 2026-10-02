"""Validation metrics used for checkpoint selection, not tuned on the test set."""
import keras
import tensorflow as tf

@keras.saving.register_keras_serializable(package='Gribnik')
class MacroRecall(keras.metrics.Metric):
    def __init__(self, classes, name='macro_recall', **kwargs):
        super().__init__(name=name, **kwargs)
        self.classes = classes
        self.correct = self.add_weight(shape=(classes,), name='correct', initializer='zeros')
        self.total = self.add_weight(shape=(classes,), name='total', initializer='zeros')
    def update_state(self, y_true, y_pred, sample_weight=None):
        truth = tf.argmax(y_true, axis=-1, output_type=tf.int32)
        pred = tf.argmax(y_pred, axis=-1, output_type=tf.int32)
        self.total.assign_add(tf.math.bincount(truth, minlength=self.classes, maxlength=self.classes, dtype=tf.float32))
        self.correct.assign_add(tf.math.bincount(tf.boolean_mask(truth, truth == pred), minlength=self.classes, maxlength=self.classes, dtype=tf.float32))
    def result(self):
        present = tf.cast(self.total > 0, tf.float32)
        return tf.math.divide_no_nan(tf.reduce_sum(tf.math.divide_no_nan(self.correct, self.total)), tf.reduce_sum(present))
    def reset_state(self):
        self.correct.assign(tf.zeros_like(self.correct)); self.total.assign(tf.zeros_like(self.total))
    def get_config(self): return {**super().get_config(), 'classes': self.classes}

@keras.saving.register_keras_serializable(package='Gribnik')
class DangerousAsEdibleRate(keras.metrics.Metric):
    def __init__(self, dangerous, edible, name='dangerous_as_edible_rate', **kwargs):
        super().__init__(name=name, **kwargs)
        self.dangerous, self.edible = list(dangerous), list(edible)
        self.misses = self.add_weight(name='misses', initializer='zeros')
        self.total = self.add_weight(name='total', initializer='zeros')
    def update_state(self, y_true, y_pred, sample_weight=None):
        true_danger = tf.reduce_any(tf.cast(y_true, tf.bool) & tf.constant(self.dangerous, dtype=tf.bool), axis=-1)
        pred = tf.argmax(y_pred, axis=-1, output_type=tf.int32)
        missed = true_danger & tf.gather(tf.constant(self.edible, dtype=tf.bool), pred) & (tf.reduce_max(y_pred, axis=-1) >= .7)
        self.misses.assign_add(tf.reduce_sum(tf.cast(missed, tf.float32)))
        self.total.assign_add(tf.reduce_sum(tf.cast(true_danger, tf.float32)))
    def result(self): return tf.math.divide_no_nan(self.misses, self.total)
    def reset_state(self): self.misses.assign(0); self.total.assign(0)
    def get_config(self): return {**super().get_config(), 'dangerous': self.dangerous, 'edible': self.edible}
