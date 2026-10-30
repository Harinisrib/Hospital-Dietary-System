"""
AEARM Model Evaluation — Leave-One-Out Cross-Validation (LOOCV)
------------------------------------------------------------------
Proper evaluation methodology for the self-trained logistic regression
model. With only 30 labeled examples, a single train/test split would
waste too much data and give an unstable estimate. Leave-One-Out
Cross-Validation (LOOCV) is the standard, named technique for small
datasets: train on all but one example, test on the held-out one,
repeat for every example, then aggregate the results.

No external ML library is used — this is the same from-scratch
logistic regression as weight_training.py, just wrapped in a
proper evaluation loop.
"""

from typing import List, Tuple, Optional
from portal.weight_training import (
    FACTORIAL_TRAINING_DATA,
    train,
    predict,
)


def classify(severity: float, confidence: float, cross: float,
             weights: Tuple[float, float, float, float],
             threshold: float = 0.5) -> int:
    """Predict binary class (1 = Risky, 0 = Safe) based on threshold."""
    prob = predict(severity, confidence, cross, weights)
    return 1 if prob >= threshold else 0


def run_loocv(data: Optional[List[Tuple[float, float, float, int]]] = None,
              epochs: int = 2000,
              learning_rate: float = 0.1) -> Tuple[List[int], List[int]]:
    """
    For each example i: train on every OTHER example, then predict on i.
    This gives an unbiased estimate of how the model performs on data
    it has never seen, which is the whole point of evaluation.
    """
    if data is None:
        data = FACTORIAL_TRAINING_DATA

    n = len(data)
    predictions: List[int] = []
    actuals: List[int] = []

    for i in range(n):
        train_set = data[:i] + data[i + 1:]
        test_severity, test_confidence, test_cross, test_label = data[i]

        w1, w2, w3, bias = train(train_set, epochs=epochs,
                                  learning_rate=learning_rate)
        weights = (w1, w2, w3, bias)

        pred_label = classify(test_severity, test_confidence, test_cross,
                               weights)

        predictions.append(pred_label)
        actuals.append(test_label)

    return predictions, actuals


def confusion_matrix(predictions: List[int], actuals: List[int]) -> Tuple[int, int, int, int]:
    """
    Computes confusion matrix counts from first principles:
    Returns (TP, TN, FP, FN).
    """
    tp = sum(1 for p, a in zip(predictions, actuals) if p == 1 and a == 1)
    tn = sum(1 for p, a in zip(predictions, actuals) if p == 0 and a == 0)
    fp = sum(1 for p, a in zip(predictions, actuals) if p == 1 and a == 0)
    fn = sum(1 for p, a in zip(predictions, actuals) if p == 0 and a == 1)
    return tp, tn, fp, fn


def compute_metrics(tp: int, tn: int, fp: int, fn: int) -> Tuple[float, float, float, float]:
    """
    Computes accuracy, precision, recall, and F1 score from first principles
    without any external ML library, with division-by-zero protection.
    """
    n = tp + tn + fp + fn
    accuracy = (tp + tn) / n if n > 0 else 0.0
    precision = tp / (tp + fp) if (tp + fp) > 0 else 0.0
    recall = tp / (tp + fn) if (tp + fn) > 0 else 0.0
    f1 = (2 * precision * recall / (precision + recall)
          if (precision + recall) > 0 else 0.0)
    return accuracy, precision, recall, f1
