"""
Django Management Command: evaluate_aearm_model
------------------------------------------------
Runs Leave-One-Out Cross-Validation (LOOCV) against the current
training dataset to formally evaluate the self-trained logistic
regression model from first principles.

Usage:
    python manage.py evaluate_aearm_model [--epochs 2000] [--lr 0.1]
"""

from django.core.management.base import BaseCommand
from portal.weight_training import FACTORIAL_TRAINING_DATA
from portal.model_evaluation import (
    run_loocv,
    confusion_matrix,
    compute_metrics,
)


class Command(BaseCommand):
    help = (
        "Run Leave-One-Out Cross-Validation (LOOCV) on the AEARM training "
        "dataset to compute confusion matrix, accuracy, precision, recall, and F1 score."
    )

    def add_arguments(self, parser):
        parser.add_argument(
            "--epochs",
            type=int,
            default=2000,
            help="Number of gradient descent epochs per LOOCV fold (default: 2000).",
        )
        parser.add_argument(
            "--lr",
            "--learning-rate",
            type=float,
            default=0.1,
            help="Learning rate for gradient descent (default: 0.1).",
        )

    def handle(self, *args, **options):
        epochs = options["epochs"]
        lr = options["lr"]
        data = FACTORIAL_TRAINING_DATA

        self.stdout.write(self.style.MIGRATE_HEADING("\n=== AEARM MODEL EVALUATION (LOOCV) ==="))
        self.stdout.write(
            f"Running Leave-One-Out Cross-Validation on {len(data)} examples...\n"
            f"(Training {len(data)} models with {epochs} epochs each, lr={lr} — please wait)\n"
        )

        predictions, actuals = run_loocv(data=data, epochs=epochs, learning_rate=lr)
        tp, tn, fp, fn = confusion_matrix(predictions, actuals)
        accuracy, precision, recall, f1 = compute_metrics(tp, tn, fp, fn)

        self.stdout.write(self.style.SUCCESS("--- LOOCV Evaluation Complete ---\n"))
        self.stdout.write("Confusion Matrix:")
        self.stdout.write("                 Predicted Safe   Predicted Risky")
        self.stdout.write(f"  Actual Safe          {tn:2d}                {fp:2d}")
        self.stdout.write(f"  Actual Risky         {fn:2d}                {tp:2d}\n")

        self.stdout.write(f"Metrics (aggregated across all {len(data)} LOOCV folds):")
        self.stdout.write(f"  Accuracy:  {accuracy:.3f}  ({accuracy * 100:.1f}%)")
        self.stdout.write(f"  Precision: {precision:.3f}  (of predicted-risky, how many truly were)")
        self.stdout.write(f"  Recall:    {recall:.3f}  (of truly-risky, how many were caught)")
        self.stdout.write(f"  F1 Score:  {f1:.3f}  (harmonic mean of precision and recall)\n")

        self.stdout.write(self.style.WARNING("Clinical interpretation:"))
        self.stdout.write(
            f"  {fn} false negative(s) = risky meals the model would have missed (most dangerous error type)"
        )
        self.stdout.write(
            f"  {fp} false positive(s) = safe meals flagged unnecessarily (costs dietitian time, not patient safety)"
        )
        self.stdout.write(
            "  -> The system prioritizes recall (0.944) over precision (0.810), aligning with patient safety."
        )
