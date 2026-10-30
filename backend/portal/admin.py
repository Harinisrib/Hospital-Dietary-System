"""Portal admin registrations."""
from django.contrib import admin
from portal.models import (
    Patient, Allergy, Ingredient, CrossReactivity, IngredientConfidence,
    Meal, MealPlan, DecisionTrace, SignOff, Order, DeliveryLog, AuditLog,
    Notification,
)


@admin.register(Patient)
class PatientAdmin(admin.ModelAdmin):
    list_display = ['name', 'ward', 'bed_no', 'diagnosis', 'diet_type', 'admitted_on']
    search_fields = ['name', 'diagnosis', 'ward']
    list_filter = ['diet_type', 'ward']


@admin.register(Allergy)
class AllergyAdmin(admin.ModelAdmin):
    list_display = ['patient', 'allergen_family', 'severity', 'recorded_at']
    list_filter = ['severity', 'allergen_family']


@admin.register(Ingredient)
class IngredientAdmin(admin.ModelAdmin):
    list_display = ['name', 'allergen_family', 'source_confidence']
    list_filter = ['allergen_family']
    search_fields = ['name']


@admin.register(CrossReactivity)
class CrossReactivityAdmin(admin.ModelAdmin):
    list_display = ['family_a', 'family_b']


@admin.register(IngredientConfidence)
class IngredientConfidenceAdmin(admin.ModelAdmin):
    list_display = ['ingredient', 'confidence_score', 'last_updated']
    ordering = ['confidence_score']


@admin.register(Meal)
class MealAdmin(admin.ModelAdmin):
    list_display = ['name', 'meal_type', 'diet_tags']
    filter_horizontal = ['ingredients']
    list_filter = ['meal_type']
    search_fields = ['name']


@admin.register(MealPlan)
class MealPlanAdmin(admin.ModelAdmin):
    list_display = ['patient', 'meal', 'planned_date', 'meal_slot', 'status']
    list_filter = ['status', 'meal_slot']
    search_fields = ['patient__name']


@admin.register(DecisionTrace)
class DecisionTraceAdmin(admin.ModelAdmin):
    list_display = ['meal_plan', 'risk_tier', 'risk_score', 'computed_at']
    list_filter = ['risk_tier']


@admin.register(SignOff)
class SignOffAdmin(admin.ModelAdmin):
    list_display = ['meal_plan', 'reviewer_role', 'decision', 'outcome', 'timestamp']
    list_filter = ['decision', 'reviewer_role']


@admin.register(Order)
class OrderAdmin(admin.ModelAdmin):
    list_display = ['tray_code', 'meal_plan', 'kitchen_status', 'created_at']
    list_filter = ['kitchen_status']


@admin.register(DeliveryLog)
class DeliveryLogAdmin(admin.ModelAdmin):
    list_display = ['order', 'cart_id', 'scan_result', 'delivered_at']
    list_filter = ['scan_result']


@admin.register(AuditLog)
class AuditLogAdmin(admin.ModelAdmin):
    list_display = ['timestamp', 'actor_role', 'action', 'entity', 'entity_id']
    list_filter = ['entity', 'actor_role']
    search_fields = ['action']


@admin.register(Notification)
class NotificationAdmin(admin.ModelAdmin):
    list_display  = ['created_at', 'recipient', 'category', 'title', 'is_read']
    list_filter   = ['is_read', 'category']
    search_fields = ['title', 'message', 'recipient__username']
    ordering      = ['-created_at']
    readonly_fields = ['created_at', 'recipient', 'category', 'title', 'message',
                       'link', 'related_entity', 'related_id']
