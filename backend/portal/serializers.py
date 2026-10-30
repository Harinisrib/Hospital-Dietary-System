"""DRF serializers for all portal models."""
from rest_framework import serializers
from django.contrib.auth.models import User
from portal.models import (
    Patient, Allergy, Ingredient, CrossReactivity, IngredientConfidence,
    Meal, MealPlan, DecisionTrace, SignOff, Order, DeliveryLog, AuditLog,
    PatientFeedback, PatientChangeRequest, Notification,
)


# ── Auth ──────────────────────────────────────────────────────────────────────

class UserSerializer(serializers.ModelSerializer):
    role = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = ['id', 'username', 'first_name', 'last_name', 'email', 'role']

    def get_role(self, obj):
        groups = list(obj.groups.values_list('name', flat=True))
        return groups[0] if groups else 'unknown'


# ── Reference data ────────────────────────────────────────────────────────────

class IngredientSerializer(serializers.ModelSerializer):
    confidence_score = serializers.SerializerMethodField()
    severity_tier = serializers.SerializerMethodField()

    class Meta:
        model = Ingredient
        fields = ['id', 'name', 'allergen_family', 'source_confidence', 'confidence_score', 'severity_tier']

    def get_confidence_score(self, obj):
        if hasattr(obj, 'confidence_record'):
            return round(obj.confidence_record.confidence_score, 3)
        return round(obj.source_confidence, 3)

    def get_severity_tier(self, obj):
        high_risk_families = {'peanuts', 'tree_nuts', 'shellfish', 'fish'}
        med_risk_families = {'dairy', 'eggs', 'gluten', 'soy', 'sesame'}
        fam = (obj.allergen_family or '').lower()
        if fam in high_risk_families:
            return 'High'
        elif fam in med_risk_families:
            return 'Medium'
        elif fam:
            return 'Low'
        return 'Neutral'


class CrossReactivitySerializer(serializers.ModelSerializer):
    class Meta:
        model = CrossReactivity
        fields = '__all__'


class IngredientConfidenceSerializer(serializers.ModelSerializer):
    ingredient_name = serializers.ReadOnlyField(source='ingredient.name')

    class Meta:
        model = IngredientConfidence
        fields = ['id', 'ingredient', 'ingredient_name', 'confidence_score', 'last_updated']


class MealSerializer(serializers.ModelSerializer):
    ingredients = IngredientSerializer(many=True, read_only=True)
    ingredient_ids = serializers.PrimaryKeyRelatedField(
        queryset=Ingredient.objects.all(), many=True, write_only=True,
        source='ingredients'
    )

    class Meta:
        model = Meal
        fields = ['id', 'name', 'description', 'meal_type', 'diet_tags',
                  'nutrition_tags', 'image_url', 'ingredients', 'ingredient_ids']


# ── Patient data ──────────────────────────────────────────────────────────────

class AllergySerializer(serializers.ModelSerializer):
    patient_name = serializers.ReadOnlyField(source='patient.name')

    class Meta:
        model = Allergy
        fields = ['id', 'patient', 'patient_name', 'allergen_family', 'specific_allergen',
                  'severity', 'notes', 'recorded_at']
        read_only_fields = ['recorded_at']


class PatientChangeRequestSerializer(serializers.ModelSerializer):
    patient_name = serializers.ReadOnlyField(source='patient.name')
    patient_ward = serializers.ReadOnlyField(source='patient.ward')
    patient_bed = serializers.ReadOnlyField(source='patient.bed_no')
    current_diet_type = serializers.ReadOnlyField(source='patient.diet_type')
    reviewed_by_name = serializers.ReadOnlyField(source='reviewed_by.get_full_name')

    class Meta:
        model = PatientChangeRequest
        fields = ['id', 'patient', 'patient_name', 'patient_ward', 'patient_bed',
                  'current_diet_type', 'category', 'requested_changes', 'status',
                  'doctor_response', 'reviewed_by', 'reviewed_by_name',
                  'created_at', 'updated_at']
        read_only_fields = ['patient', 'created_at', 'updated_at', 'reviewed_by']


class PatientSerializer(serializers.ModelSerializer):
    allergies = AllergySerializer(many=True, read_only=True)
    change_requests = PatientChangeRequestSerializer(many=True, read_only=True)
    admitted_by_name = serializers.ReadOnlyField(source='updated_by.get_full_name')
    age = serializers.IntegerField(required=False, allow_null=True)

    class Meta:
        model = Patient
        fields = ['id', 'name', 'age', 'gender', 'ward', 'bed_no', 'diagnosis',
                  'diet_type', 'admitted_on', 'updated_on', 'notes', 'allergies',
                  'change_requests', 'admitted_by_name']
        read_only_fields = ['admitted_on', 'updated_on']

    def to_internal_value(self, data):
        data = data.copy() if hasattr(data, 'copy') else dict(data)
        if data.get('age') == '' or data.get('age') is None:
            data['age'] = None
        return super().to_internal_value(data)


class PatientListSerializer(serializers.ModelSerializer):
    """Lighter serializer for list views."""
    allergy_count = serializers.SerializerMethodField()

    class Meta:
        model = Patient
        fields = ['id', 'name', 'ward', 'bed_no', 'diagnosis', 'diet_type',
                  'admitted_on', 'allergy_count']

    def get_allergy_count(self, obj):
        return obj.allergies.count()


# ── Meal planning ─────────────────────────────────────────────────────────────

class DecisionTraceSerializer(serializers.ModelSerializer):
    class Meta:
        model = DecisionTrace
        fields = ['id', 'direct_match', 'cross_match', 'risk_score', 'risk_tier',
                  'severity_component', 'confidence_component', 'cross_component',
                  'explanation', 'computed_at']


class SignOffSerializer(serializers.ModelSerializer):
    reviewer_name = serializers.ReadOnlyField(source='reviewer.get_full_name')

    class Meta:
        model = SignOff
        fields = ['id', 'meal_plan', 'reviewer', 'reviewer_name', 'reviewer_role',
                  'decision', 'outcome', 'override_reason', 'timestamp']
        read_only_fields = ['timestamp', 'reviewer', 'reviewer_role', 'reviewer_name']

    def to_internal_value(self, data):
        data = data.copy() if hasattr(data, 'copy') else dict(data)
        outcome_val = data.get('outcome')
        if outcome_val == 'safe' or outcome_val == 1 or outcome_val == '1':
            data['outcome'] = 1
        elif outcome_val == 'reaction' or outcome_val == 0 or outcome_val == '0':
            data['outcome'] = 0
        else:
            data['outcome'] = None
        return super().to_internal_value(data)


class PatientFeedbackSerializer(serializers.ModelSerializer):
    patient_name = serializers.ReadOnlyField(source='patient.name')
    patient_ward = serializers.ReadOnlyField(source='patient.ward')
    patient_bed = serializers.ReadOnlyField(source='patient.bed_no')
    meal_name = serializers.ReadOnlyField(source='meal_plan.meal.name')
    meal_slot = serializers.ReadOnlyField(source='meal_plan.meal_slot')
    planned_date = serializers.ReadOnlyField(source='meal_plan.planned_date')

    class Meta:
        model = PatientFeedback
        fields = ['id', 'meal_plan', 'patient', 'patient_name', 'patient_ward', 'patient_bed',
                  'meal_name', 'meal_slot', 'planned_date', 'rating', 'taste_rating',
                  'tolerance_status', 'comments', 'submitted_at']
        read_only_fields = ['patient', 'submitted_at']


class MealPlanSerializer(serializers.ModelSerializer):
    patient_name = serializers.ReadOnlyField(source='patient.name')
    patient_ward = serializers.ReadOnlyField(source='patient.ward')
    patient_bed = serializers.ReadOnlyField(source='patient.bed_no')
    meal_name = serializers.ReadOnlyField(source='meal.name')
    meal_description = serializers.ReadOnlyField(source='meal.description')
    meal_diet_tags = serializers.ReadOnlyField(source='meal.diet_tags')
    meal_nutrition_tags = serializers.ReadOnlyField(source='meal.nutrition_tags')
    meal_type = serializers.ReadOnlyField(source='meal.meal_type')
    meal_ingredients = serializers.SerializerMethodField()
    decision_trace = DecisionTraceSerializer(read_only=True)
    feedbacks = PatientFeedbackSerializer(many=True, read_only=True)

    def get_meal_ingredients(self, obj):
        if obj.meal:
            return [ing.name for ing in obj.meal.ingredients.all()]
        return []

    class Meta:
        model = MealPlan
        fields = ['id', 'patient', 'patient_name', 'patient_ward', 'patient_bed',
                  'meal', 'meal_name', 'meal_description', 'meal_diet_tags',
                  'meal_nutrition_tags', 'meal_type', 'meal_ingredients',
                  'planned_date', 'meal_slot', 'status',
                  'created_at', 'updated_at', 'decision_trace', 'feedbacks']
        read_only_fields = ['status', 'created_at', 'updated_at']


# ── Kitchen & delivery ────────────────────────────────────────────────────────

class OrderSerializer(serializers.ModelSerializer):
    patient_name = serializers.ReadOnlyField(source='meal_plan.patient.name')
    ward = serializers.ReadOnlyField(source='meal_plan.patient.ward')
    bed_no = serializers.ReadOnlyField(source='meal_plan.patient.bed_no')
    patient_diet_type = serializers.ReadOnlyField(source='meal_plan.patient.diet_type')
    patient_diagnosis = serializers.ReadOnlyField(source='meal_plan.patient.diagnosis')
    patient_id = serializers.ReadOnlyField(source='meal_plan.patient.id')
    meal_id = serializers.ReadOnlyField(source='meal_plan.meal.id')
    meal_name = serializers.ReadOnlyField(source='meal_plan.meal.name')
    meal_slot = serializers.ReadOnlyField(source='meal_plan.meal_slot')
    meal_diet_tags = serializers.ReadOnlyField(source='meal_plan.meal.diet_tags')
    meal_nutrition_tags = serializers.ReadOnlyField(source='meal_plan.meal.nutrition_tags')
    allergies = serializers.SerializerMethodField()
    ingredients = serializers.SerializerMethodField()
    planned_date = serializers.ReadOnlyField(source='meal_plan.planned_date')
    qr_image_url = serializers.SerializerMethodField()

    class Meta:
        model = Order
        fields = ['id', 'meal_plan', 'tray_code', 'kitchen_status',
                  'patient_id', 'patient_name', 'ward', 'bed_no', 'patient_diet_type',
                  'patient_diagnosis', 'meal_id', 'meal_name', 'meal_slot', 'meal_diet_tags',
                  'meal_nutrition_tags', 'allergies', 'ingredients',
                  'planned_date', 'qr_image_url', 'created_at']

    def get_allergies(self, obj):
        try:
            return [
                {
                    'allergen_family': a.allergen_family,
                    'specific_allergen': a.specific_allergen,
                    'severity': a.severity,
                }
                for a in obj.meal_plan.patient.allergies.all()
            ]
        except Exception:
            return []

    def get_ingredients(self, obj):
        try:
            return [i.name for i in obj.meal_plan.meal.ingredients.all()]
        except Exception:
            return []

    def get_qr_image_url(self, obj):
        request = self.context.get('request')
        if obj.qr_image and request:
            return request.build_absolute_uri(obj.qr_image.url)
        return None


class DeliveryLogSerializer(serializers.ModelSerializer):
    tray_code = serializers.ReadOnlyField(source='order.tray_code')
    patient_name = serializers.ReadOnlyField(source='order.meal_plan.patient.name')

    class Meta:
        model = DeliveryLog
        fields = ['id', 'order', 'tray_code', 'patient_name', 'cart_id',
                  'scan_result', 'staff_note', 'delivered_at']
        read_only_fields = ['delivered_at']


# ── Audit ─────────────────────────────────────────────────────────────────────

class AuditLogSerializer(serializers.ModelSerializer):
    actor_name = serializers.ReadOnlyField(source='actor.get_full_name')

    class Meta:
        model = AuditLog
        fields = ['id', 'entity', 'entity_id', 'action', 'actor', 'actor_name',
                  'actor_role', 'detail', 'timestamp']


# ── Notifications ───────────────────────────────────────────────────

class NotificationSerializer(serializers.ModelSerializer):
    """
    Serializer for in-app notifications.
    `time_ago` is a human-readable relative timestamp (e.g. '2 min ago').
    """
    time_ago = serializers.SerializerMethodField()

    class Meta:
        model = Notification
        fields = [
            'id', 'category', 'title', 'message', 'link',
            'is_read', 'created_at', 'time_ago',
            'related_entity', 'related_id',
        ]
        read_only_fields = ['created_at', 'time_ago']

    def get_time_ago(self, obj):
        from django.utils import timezone
        import math
        delta = timezone.now() - obj.created_at
        seconds = int(delta.total_seconds())
        if seconds < 60:
            return 'just now'
        elif seconds < 3600:
            m = seconds // 60
            return f'{m} min ago'
        elif seconds < 86400:
            h = seconds // 3600
            return f'{h} hr ago'
        else:
            d = seconds // 86400
            return f'{d} day{"s" if d > 1 else ""} ago'
