"""Portal URL routes — all namespaced under /api/"""
from django.urls import path, include
from rest_framework.routers import DefaultRouter
from portal import views

router = DefaultRouter()
router.register(r'patients', views.PatientViewSet, basename='patient')
router.register(r'allergies', views.AllergyViewSet, basename='allergy')
router.register(r'ingredients', views.IngredientViewSet, basename='ingredient')
router.register(r'ingredient-confidences', views.IngredientConfidenceViewSet, basename='ingredientconfidence')
router.register(r'meals', views.MealViewSet, basename='meal')
router.register(r'meal-plans', views.MealPlanViewSet, basename='mealplan')
router.register(r'sign-offs', views.SignOffViewSet, basename='signoff')
router.register(r'patient-menu', views.PatientMenuViewSet, basename='patientmenu')
router.register(r'orders', views.OrderViewSet, basename='order')
router.register(r'delivery-logs', views.DeliveryLogViewSet, basename='deliverylog')
router.register(r'audit-logs', views.AuditLogViewSet, basename='auditlog')
router.register(r'patient-feedback', views.PatientFeedbackViewSet, basename='patientfeedback')
router.register(r'patient-requests', views.PatientChangeRequestViewSet, basename='patientrequest')
router.register(r'notifications', views.NotificationViewSet, basename='notification')

urlpatterns = [
    path('auth/login/', views.login_view),
    path('auth/logout/', views.logout_view),
    path('auth/me/', views.me_view),
    path('auth/patient-directory/', views.public_patient_directory_view),
    path('analytics/', views.analytics_view),
    path('meal-sessions/current/', views.meal_sessions_view),
    path('diet-constraints/evaluate/', views.evaluate_diet_constraints_view),
    path('patient-profile/', views.patient_profile_view),
    path('', include(router.urls)),
]
