"""
Portal models — all 12 tables from the AEARM spec.
"""
from django.db import models
from django.contrib.auth.models import User
from django.utils import timezone


# ─────────────────────────────────────────────
# REFERENCE DATA
# ─────────────────────────────────────────────

class Ingredient(models.Model):
    """Hospital ingredient catalogue with allergen family mapping."""
    name = models.CharField(max_length=200, unique=True)
    allergen_family = models.CharField(max_length=100, blank=True)
    source_confidence = models.FloatField(default=1.0)  # initial confidence

    def __str__(self):
        return f"{self.name} [{self.allergen_family}]"


class CrossReactivity(models.Model):
    """Pairs of allergen families known to cross-react."""
    family_a = models.CharField(max_length=100)
    family_b = models.CharField(max_length=100)

    class Meta:
        unique_together = ('family_a', 'family_b')
        verbose_name_plural = 'Cross reactivities'

    def __str__(self):
        return f"{self.family_a} ↔ {self.family_b}"


class IngredientConfidence(models.Model):
    """
    AEARM Component 3 — adaptive confidence value per ingredient.
    Updated by update_confidence() after every signed-off decision.
    """
    ingredient = models.OneToOneField(
        Ingredient, on_delete=models.CASCADE, related_name='confidence_record'
    )
    confidence_score = models.FloatField(default=1.0)
    last_updated = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"{self.ingredient.name}: {self.confidence_score:.3f}"


class Meal(models.Model):
    """Hospital meal catalogue entry."""
    name = models.CharField(max_length=200)
    description = models.TextField(blank=True)
    meal_type = models.CharField(
        max_length=20,
        choices=[('breakfast', 'Breakfast'), ('lunch', 'Lunch'),
                 ('dinner', 'Dinner'), ('snack', 'Snack')],
        default='lunch',
    )
    diet_tags = models.JSONField(default=list)           # e.g. ["diabetic", "low-sodium"]
    ingredients = models.ManyToManyField(Ingredient, blank=True)
    nutrition_tags = models.JSONField(default=list)      # ["high-protein", "low-fat"]
    image_url = models.CharField(max_length=300, blank=True)

    def __str__(self):
        return self.name


# ─────────────────────────────────────────────
# PATIENT DATA
# ─────────────────────────────────────────────

class Patient(models.Model):
    """Core patient record — written at Stage 1 (Doctor module)."""
    DIET_CHOICES = [
        ('regular', 'Regular'),
        ('diabetic', 'Diabetic-friendly'),
        ('low-sodium', 'Low Sodium'),
        ('renal', 'Renal Diet'),
        ('soft', 'Soft/Pureed'),
        ('liquid', 'Liquid'),
        ('high-protein', 'High Protein'),
        ('vegetarian', 'Vegetarian'),
        ('vegan', 'Vegan'),
    ]
    user = models.OneToOneField(
        User, on_delete=models.SET_NULL, null=True, blank=True,
        related_name='patient_profile'
    )
    name = models.CharField(max_length=200)
    age = models.PositiveIntegerField(null=True, blank=True)
    gender = models.CharField(
        max_length=10,
        choices=[('M', 'Male'), ('F', 'Female'), ('O', 'Other')],
        blank=True,
    )
    ward = models.CharField(max_length=50)
    bed_no = models.CharField(max_length=20)
    diagnosis = models.TextField()
    diet_type = models.CharField(max_length=30, choices=DIET_CHOICES, default='regular')
    admitted_on = models.DateField(default=timezone.now)
    updated_on = models.DateTimeField(auto_now=True)
    updated_by = models.ForeignKey(
        User, on_delete=models.SET_NULL, null=True, blank=True,
        related_name='patients_updated'
    )
    notes = models.TextField(blank=True)

    def __str__(self):
        return f"{self.name} — Ward {self.ward} Bed {self.bed_no}"


class Allergy(models.Model):
    """One row per known allergy for a patient."""
    SEVERITY_CHOICES = [
        ('mild', 'Mild'),
        ('moderate', 'Moderate'),
        ('severe', 'Severe'),
    ]
    patient = models.ForeignKey(Patient, on_delete=models.CASCADE, related_name='allergies')
    allergen_family = models.CharField(max_length=100)
    specific_allergen = models.CharField(max_length=200, blank=True)
    severity = models.CharField(max_length=10, choices=SEVERITY_CHOICES, default='moderate')
    notes = models.TextField(blank=True)
    recorded_by = models.ForeignKey(
        User, on_delete=models.SET_NULL, null=True, blank=True
    )
    recorded_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name_plural = 'Allergies'

    def __str__(self):
        return f"{self.patient.name} — {self.allergen_family} ({self.severity})"


# ─────────────────────────────────────────────
# MEAL PLANNING
# ─────────────────────────────────────────────

class MealPlan(models.Model):
    """A meal assigned to a patient — the trigger for AEARM."""
    STATUS_CHOICES = [
        ('pending', 'Pending AEARM'),
        ('low_risk', 'Low Risk — Auto-approved'),
        ('medium_risk', 'Medium Risk — Dietitian Review'),
        ('high_risk', 'High Risk — Escalated'),
        ('approved', 'Approved'),
        ('rejected', 'Rejected'),
    ]
    patient = models.ForeignKey(Patient, on_delete=models.CASCADE, related_name='meal_plans')
    meal = models.ForeignKey(Meal, on_delete=models.CASCADE)
    planned_date = models.DateField()
    meal_slot = models.CharField(
        max_length=20,
        choices=[('breakfast', 'Breakfast'), ('lunch', 'Lunch'),
                 ('dinner', 'Dinner'), ('snack', 'Snack')],
    )
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending')
    created_by = models.ForeignKey(
        User, on_delete=models.SET_NULL, null=True, blank=True, related_name='meal_plans_created'
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"{self.patient.name} — {self.meal.name} ({self.planned_date} {self.meal_slot})"


class DecisionTrace(models.Model):
    """
    AEARM output stored per MealPlan — used by the explanation engine.
    Written by the AEARM pipeline after Component 2.
    """
    meal_plan = models.OneToOneField(
        MealPlan, on_delete=models.CASCADE, related_name='decision_trace'
    )
    direct_match = models.JSONField(null=True, blank=True)     # (ingredient, family) or null
    cross_match = models.JSONField(null=True, blank=True)      # (ingredient, family) or null
    risk_score = models.FloatField()
    risk_tier = models.CharField(max_length=10)                # Low / Medium / High
    severity_component = models.FloatField()
    confidence_component = models.FloatField()
    cross_component = models.FloatField()
    explanation = models.TextField()
    computed_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"Trace#{self.pk} [{self.risk_tier}] score={self.risk_score:.3f}"


class SignOff(models.Model):
    """
    Record of dietitian/escalated approval — outcome feeds Component 3.
    """
    DECISION_CHOICES = [('approve', 'Approve'), ('reject', 'Reject')]
    OUTCOME_CHOICES = [(1, 'Confirmed Safe'), (0, 'Triggered Reaction')]

    meal_plan = models.ForeignKey(MealPlan, on_delete=models.CASCADE, related_name='sign_offs')
    reviewer = models.ForeignKey(User, on_delete=models.SET_NULL, null=True)
    reviewer_role = models.CharField(max_length=30)
    decision = models.CharField(max_length=10, choices=DECISION_CHOICES)
    outcome = models.IntegerField(choices=OUTCOME_CHOICES, null=True, blank=True)
    override_reason = models.TextField(blank=True)
    timestamp = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"SignOff#{self.pk} {self.decision} by {self.reviewer_role}"


# ─────────────────────────────────────────────
# KITCHEN & DELIVERY
# ─────────────────────────────────────────────

class Order(models.Model):
    """Kitchen-facing confirmed order auto-created when MealPlan is approved."""
    meal_plan = models.OneToOneField(MealPlan, on_delete=models.CASCADE, related_name='order')
    tray_code = models.CharField(max_length=50, unique=True)
    qr_image = models.ImageField(upload_to='qr_codes/', null=True, blank=True)
    kitchen_status = models.CharField(
        max_length=20,
        choices=[('queued', 'Queued'), ('preparing', 'Preparing'),
                 ('ready', 'Ready'), ('dispatched', 'Dispatched')],
        default='queued',
    )
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"Order {self.tray_code} — {self.meal_plan.patient.name}"


class DeliveryLog(models.Model):
    """Batch scan result written at cart-loading time."""
    order = models.ForeignKey(Order, on_delete=models.CASCADE, related_name='delivery_logs')
    cart_id = models.CharField(max_length=50)
    scan_result = models.CharField(
        max_length=20,
        choices=[('matched', 'Matched'), ('mismatch', 'Mismatch'), ('missing', 'Missing')],
    )
    staff_note = models.TextField(blank=True, default='')
    scanned_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True)
    delivered_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"Delivery {self.order.tray_code} — {self.scan_result}"


# ─────────────────────────────────────────────
# AUDIT
# ─────────────────────────────────────────────

class AuditLog(models.Model):
    """Full audit trail — written on every important state change."""
    entity = models.CharField(max_length=50)
    entity_id = models.PositiveIntegerField(null=True, blank=True)
    action = models.CharField(max_length=100)
    actor = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True)
    actor_role = models.CharField(max_length=30, blank=True)
    detail = models.JSONField(default=dict)
    timestamp = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"[{self.timestamp:%Y-%m-%d %H:%M}] {self.actor_role} {self.action} {self.entity}#{self.entity_id}"


# ─────────────────────────────────────────────
# PATIENT FEEDBACK (Direct to Dietitians)
# ─────────────────────────────────────────────

class PatientFeedback(models.Model):
    """Patient meal feedback sent directly to clinical dietitians."""
    meal_plan = models.ForeignKey(MealPlan, on_delete=models.CASCADE, related_name='feedbacks', null=True, blank=True)
    patient = models.ForeignKey(Patient, on_delete=models.CASCADE, related_name='feedbacks')
    rating = models.IntegerField(default=5)  # 1 to 5
    taste_rating = models.CharField(
        max_length=20,
        choices=[('excellent', 'Delicious'), ('good', 'Good'), ('average', 'Average'), ('poor', 'Needs Improvement')],
        default='good',
    )
    tolerance_status = models.CharField(
        max_length=30,
        choices=[
            ('tolerated_well', 'Tolerated Well (No Symptoms)'),
            ('mild_discomfort', 'Mild Discomfort (Fullness/Gas)'),
            ('adverse_reaction', 'Adverse Symptoms / Allergy Sign'),
        ],
        default='tolerated_well',
    )
    comments = models.TextField(blank=True, default='')
    submitted_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"Feedback by {self.patient.name} — {self.rating}★"


# ─────────────────────────────────────────────
# PATIENT CHANGE REQUESTS (Direct to Doctors)
# ─────────────────────────────────────────────

class PatientChangeRequest(models.Model):
    """
    Request submitted by patient from their Patient Portal to the Doctor
    requesting modifications to admission details (diet preference, new allergy,
    bed/ward updates, symptom notes, or personal detail updates).
    """
    STATUS_CHOICES = [
        ('pending', 'Pending Doctor Review'),
        ('approved', 'Approved & Updated'),
        ('rejected', 'Declined'),
        ('resolved', 'Reviewed & Resolved'),
    ]
    CATEGORY_CHOICES = [
        ('diet_preference', 'Diet Preference / Nutritional Need'),
        ('new_allergy', 'Allergy / Food Reaction Alert'),
        ('symptom_condition', 'Health Condition / New Symptom'),
        ('personal_info', 'Personal Info (Name / Age / Bed)'),
        ('other', 'Other Clinical Request'),
    ]
    patient = models.ForeignKey(Patient, on_delete=models.CASCADE, related_name='change_requests')
    category = models.CharField(max_length=40, choices=CATEGORY_CHOICES, default='diet_preference')
    requested_changes = models.TextField(help_text="What the patient wants changed / clinical notes")
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending')
    doctor_response = models.TextField(blank=True, default='')
    reviewed_by = models.ForeignKey(
        User, on_delete=models.SET_NULL, null=True, blank=True,
        related_name='reviewed_patient_requests'
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"Request by {self.patient.name} [{self.category}] — {self.status}"


# ─────────────────────────────────────────────
# IN-APP NOTIFICATIONS
# ─────────────────────────────────────────────

class Notification(models.Model):
    """
    In-app notification delivered to a specific user.
    Created synchronously by the notify() helper in portal/notifications.py
    whenever a meaningful clinical or operational event occurs.
    Polled by the frontend every 30 s via NotificationViewSet.
    """
    CATEGORY_CHOICES = [
        ('patient',    'Patient Activity'),
        ('meal_plan',  'Meal Plan Update'),
        ('sign_off',   'Sign-Off / Review'),
        ('kitchen',    'Kitchen / Order'),
        ('feedback',   'Patient Feedback'),
        ('request',    'Change Request'),
        ('system',     'System / Admin'),
    ]

    recipient      = models.ForeignKey(
        User, on_delete=models.CASCADE, related_name='notifications'
    )
    category       = models.CharField(max_length=20, choices=CATEGORY_CHOICES, default='system')
    title          = models.CharField(max_length=200)
    message        = models.TextField()
    link           = models.CharField(max_length=200, blank=True)   # frontend route, e.g. '/clinical/audit-queue'
    is_read        = models.BooleanField(default=False)
    created_at     = models.DateTimeField(auto_now_add=True)
    related_entity = models.CharField(max_length=50, blank=True)    # e.g. 'MealPlan'
    related_id     = models.PositiveIntegerField(null=True, blank=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        status = 'READ' if self.is_read else 'UNREAD'
        return f"[{status}] {self.recipient.username} — {self.title}"

