"""
Django Management Command: retrain_aearm_weights
-------------------------------------------------
Manually triggers logistic regression training on the factorial clinical
dataset to learn explainable risk weights for AEARM.

Usage:
    python manage.py retrain_aearm_weights [--epochs 5000] [--lr 0.1] [--yes]
"""

from django.core.management.base import BaseCommand
from portal.aearm import AEARM_WEIGHTS
from portal.weight_training import (
    FACTORIAL_TRAINING_DATA,
    train,
    normalize_weights,
    update_stored_aearm_weights,
)


class Command(BaseCommand):
    help = (
        "Manually retrain AEARM risk weights via gradient descent "
        "on the factorial clinical dataset (deliberate manual action only)."
    )

    def add_arguments(self, parser):
        parser.add_argument(
            "--epochs",
            type=int,
            default=5000,
            help="Number of training epochs (default: 5000).",
        )
        parser.add_argument(
            "--lr",
            "--learning-rate",
            type=float,
            default=0.1,
            help="Learning rate for gradient descent (default: 0.1).",
        )
        parser.add_argument(
            "--yes",
            "-y",
            action="store_true",
            help="Automatically confirm and apply newly learned weights without interactive prompt.",
        )

    def handle(self, *args, **options):
        epochs = options["epochs"]
        lr = options["lr"]
        auto_yes = options["yes"]

        self.stdout.write(self.style.MIGRATE_HEADING("\n=== AEARM WEIGHT RETRAINING (MANUAL AUDIT ACTION) ==="))
        self.stdout.write(
            f"Training dataset: {len(FACTORIAL_TRAINING_DATA)} factorial clinical scenarios.\n"
            f"Hyperparameters: {epochs} epochs | Learning Rate: {lr}\n"
        )

        def log_progress(epoch, loss, weights):
            w1, w2, w3, bias = weights
            self.stdout.write(
                f"  Epoch {epoch:4d} | Loss: {loss:.4f} | w1={w1:.3f} w2={w2:.3f} w3={w3:.3f} bias={bias:.3f}"
            )

        w1, w2, w3, bias = train(
            data=FACTORIAL_TRAINING_DATA,
            epochs=epochs,
            learning_rate=lr,
            callback=log_progress,
        )

        n_sev, n_conf, n_cross = normalize_weights(w1, w2, w3, precision=2)

        self.stdout.write(self.style.SUCCESS("\n--- Training Complete ---"))
        self.stdout.write(f"Raw Learned Weights:\n"
                          f"  w1 (severity)         = {w1:.4f}\n"
                          f"  w2 (confidence)       = {w2:.4f}\n"
                          f"  w3 (cross-reactivity) = {w3:.4f}\n"
                          f"  bias                  = {bias:.4f}\n")

        self.stdout.write("Normalized Weights (sums to 1.0):")
        self.stdout.write(f"  severity_weight   = {n_sev:.2f}")
        self.stdout.write(f"  confidence_weight = {n_conf:.2f}")
        self.stdout.write(f"  cross_weight      = {n_cross:.2f}\n")

        self.stdout.write("Current Stored AEARM_WEIGHTS:")
        self.stdout.write(f"  severity          = {AEARM_WEIGHTS.get('severity'):.2f}")
        self.stdout.write(f"  confidence        = {AEARM_WEIGHTS.get('confidence'):.2f}")
        self.stdout.write(f"  cross_reactivity  = {AEARM_WEIGHTS.get('cross_reactivity'):.2f}\n")

        new_weights = {
            "severity": n_sev,
            "confidence": n_conf,
            "cross_reactivity": n_cross,
        }

        if auto_yes:
            confirm = True
        else:
            self.stdout.write(
                self.style.WARNING(
                    "Confirmation required: Automatic retraining after real-time events is intentionally disabled "
                    "to preserve clinical stability."
                )
            )
            choice = input("Do you want to overwrite stored AEARM_WEIGHTS with these newly learned values? [y/N]: ")
            confirm = choice.strip().lower() in ("y", "yes")

        if confirm:
            success = update_stored_aearm_weights(new_weights)
            if success:
                self.stdout.write(
                    self.style.SUCCESS(
                        f"Successfully updated AEARM_WEIGHTS in portal/aearm.py to: {new_weights}"
                    )
                )
            else:
                self.stdout.write(
                    self.style.ERROR("Failed to write updated weights to portal/aearm.py.")
                )
        else:
            self.stdout.write(
                self.style.NOTICE("Retraining aborted. Stored AEARM_WEIGHTS remain unchanged.")
            )
