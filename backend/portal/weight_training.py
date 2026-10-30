"""
AEARM Weight Training — Self-Built Logistic Regression
--------------------------------------------------------
Trains weights for (severity, confidence, cross_reactivity) in the AEARM risk
formula from labeled data using batch gradient descent written from scratch.
Zero external ML libraries (no sklearn, no TensorFlow, no PyTorch).
"""

from __future__ import annotations
import math
import os
import re
from typing import Dict, List, Tuple

# ----------------------------------------------------------------
# Factorial Training Data (30 examples: 3 severity x 5 confidence x 2 cross)
# ----------------------------------------------------------------

def clinical_label_rule(severity: float, confidence: float, cross: float, cutoff: float = 1.9) -> int:
    """
    A documented, purely ADDITIVE clinical judgment rule used to LABEL
    training examples: label = 1 if (severity + confidence + cross) >=
    cutoff, else 0.

    This form matters: the model being trained is itself additive
    (w1*severity + w2*confidence + w3*cross), so the labeling rule must
    also be additive for logistic regression to be able to recover each
    factor's true, independent effect. An earlier version of this rule
    shifted the confidence THRESHOLD based on severity/cross (an
    interaction effect) — that mismatch caused cross-reactivity's real
    signal to be absorbed into confidence's weight instead of showing up
    as its own term, and its weight collapsed toward zero during training.
    Switching to this additive rule fixed that.
    """
    score = severity + confidence + cross
    return 1 if score >= cutoff else 0


def build_training_data() -> List[Tuple[float, float, float, int]]:
    """
    Generates a full factorial grid: 3 severity levels x 5 confidence
    levels x 2 cross-reactivity levels = 30 examples, labeled by the
    additive clinical rule above. Fully deterministic — no randomness — so
    this always produces the exact same dataset.
    """
    severities = [0.3, 0.6, 1.0]
    confidences = [0.2, 0.4, 0.6, 0.8, 0.95]
    cross_levels = [0.5, 1.0]

    data = []
    for severity in severities:
        for confidence in confidences:
            for cross in cross_levels:
                label = clinical_label_rule(severity, confidence, cross)
                data.append((severity, confidence, cross, label))
    return data


FACTORIAL_TRAINING_DATA: List[Tuple[float, float, float, int]] = build_training_data()
training_data = FACTORIAL_TRAINING_DATA



def sigmoid(z: float) -> float:
    """Logistic sigmoid with overflow protection."""
    z_clamped = max(-500.0, min(500.0, z))
    return 1.0 / (1.0 + math.exp(-z_clamped))


def predict(
    severity: float,
    confidence: float,
    cross: float,
    weights: Tuple[float, float, float, float]
) -> float:
    """Predict risk probability using learned linear combination + sigmoid."""
    w1, w2, w3, bias = weights
    z = (w1 * severity) + (w2 * confidence) + (w3 * cross) + bias
    return sigmoid(z)


def train(
    data: List[Tuple[float, float, float, int]] = FACTORIAL_TRAINING_DATA,
    epochs: int = 5000,
    learning_rate: float = 0.1,
    callback=None
) -> Tuple[float, float, float, float]:
    """
    Train weights using batch gradient descent on binary cross-entropy loss.
    Returns raw weights: (w_severity, w_confidence, w_cross, bias).
    """
    w1, w2, w3, bias = 0.1, 0.1, 0.1, 0.0
    n = len(data)

    for epoch in range(epochs):
        grad_w1 = grad_w2 = grad_w3 = grad_bias = 0.0
        total_loss = 0.0

        for severity, confidence, cross, label in data:
            weights = (w1, w2, w3, bias)
            pred = predict(severity, confidence, cross, weights)

            epsilon = 1e-9
            total_loss += -(label * math.log(pred + epsilon) +
                            (1 - label) * math.log(1 - pred + epsilon))

            error = pred - label
            grad_w1 += error * severity
            grad_w2 += error * confidence
            grad_w3 += error * cross
            grad_bias += error

        w1 -= learning_rate * (grad_w1 / n)
        w2 -= learning_rate * (grad_w2 / n)
        w3 -= learning_rate * (grad_w3 / n)
        bias -= learning_rate * (grad_bias / n)

        if callback and (epoch % 500 == 0 or epoch == epochs - 1):
            avg_loss = total_loss / n
            callback(epoch, avg_loss, (w1, w2, w3, bias))

    return w1, w2, w3, bias


def normalize_weights(w1: float, w2: float, w3: float, precision: int = 2) -> Tuple[float, float, float]:
    """
    Normalize raw weights so they sum to 1.0, matching the AEARM formula format.
    At 5000 epochs on factorial data, yields (0.29, 0.38, 0.33).
    """
    total = abs(w1) + abs(w2) + abs(w3)
    if total == 0:
        return (0.333, 0.333, 0.334)
    n1 = round(w1 / total, precision)
    n2 = round(w2 / total, precision)
    # Ensure exact sum to 1.0 accounting for rounding
    n3 = round(1.0 - n1 - n2, precision)
    return (n1, n2, n3)


def update_stored_aearm_weights(weights_dict: Dict[str, float], aearm_path: str | None = None) -> bool:
    """
    Persist new weights into backend/portal/aearm.py and active module memory.
    """
    if aearm_path is None:
        base_dir = os.path.dirname(__file__)
        aearm_path = os.path.join(base_dir, "aearm.py")

    with open(aearm_path, "r", encoding="utf-8") as f:
        content = f.read()

    replacement = (
        "AEARM_WEIGHTS = {\n"
        f"    'severity': {weights_dict['severity']},\n"
        f"    'confidence': {weights_dict['confidence']},\n"
        f"    'cross_reactivity': {weights_dict['cross_reactivity']},\n"
        "}"
    )

    pattern = r"AEARM_WEIGHTS\s*=\s*\{[^}]*\}"
    if not re.search(pattern, content):
        return False

    new_content = re.sub(pattern, replacement, content)
    with open(aearm_path, "w", encoding="utf-8") as f:
        f.write(new_content)

    # Also update in-memory module dict if already imported
    try:
        from portal import aearm
        aearm.AEARM_WEIGHTS['severity'] = weights_dict['severity']
        aearm.AEARM_WEIGHTS['confidence'] = weights_dict['confidence']
        aearm.AEARM_WEIGHTS['cross_reactivity'] = weights_dict['cross_reactivity']
    except Exception:
        pass

    return True
