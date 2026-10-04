"""Fit one temperature on validation predictions, without using the test set."""
from __future__ import annotations

import numpy as np


def apply_temperature(probs: np.ndarray, temperature: float) -> np.ndarray:
    if not np.isfinite(temperature) or temperature <= 0:
        raise ValueError('Temperature must be positive and finite')
    logp = np.log(np.clip(probs, 1e-9, 1.0)) / temperature
    logp -= logp.max(axis=1, keepdims=True)
    weights = np.exp(logp)
    return weights / weights.sum(axis=1, keepdims=True)


def expected_calibration_error(probs: np.ndarray, truth: np.ndarray, bins: int = 10) -> float:
    confidence = probs.max(axis=1)
    correct = probs.argmax(axis=1) == truth
    ece = 0.0
    for lo in np.linspace(0, 1, bins, endpoint=False):
        mask = (confidence > lo) & (confidence <= lo + 1 / bins)
        if mask.any():
            ece += mask.mean() * abs(confidence[mask].mean() - correct[mask].mean())
    return round(float(ece), 4)


def negative_log_likelihood(probs: np.ndarray, truth: np.ndarray) -> float:
    return float(-np.mean(np.log(np.clip(probs[np.arange(len(truth)), truth], 1e-9, 1.0))))


def fit_temperature(probs: np.ndarray, truth: np.ndarray) -> float:
    """Minimize validation NLL; allow both overconfidence and underconfidence.

    Increasing confidence is not a safety decision. The exported result must
    still pass all application warning, unknown-image and calibration gates.
    Include T=1 explicitly so a grid cannot force a worse validation NLL.
    """
    if (probs.ndim != 2 or truth.shape != (len(probs),) or not len(probs)
            or not np.isfinite(probs).all() or (probs < 0).any()
            or not np.allclose(probs.sum(axis=1), 1, atol=1e-4)
            or not np.issubdtype(truth.dtype, np.integer)
            or (truth < 0).any() or (truth >= probs.shape[1]).any()):
        raise ValueError('Invalid validation probabilities or labels')
    candidates = sorted(set([1.0, *np.exp(np.linspace(np.log(.2), np.log(5.), 241))]))
    best = min(candidates, key=lambda t: negative_log_likelihood(apply_temperature(probs, t), truth))
    return float(best)
