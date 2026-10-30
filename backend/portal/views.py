"""
Portal API views — role-gated endpoints for every module.
"""
from rest_framework import viewsets, status, permissions
from rest_framework.decorators import action, api_view, permission_classes
from rest_framework.response import Response
from rest_framework.authtoken.models import Token
from django.contrib.auth import authenticate
from django.contrib.auth.models import User, Group
from django.db.models import Count, Q
from django.utils import timezone

from portal.models import (
    Patient, Allergy, Ingredient, CrossReactivity, IngredientConfidence,
    Meal, MealPlan, DecisionTrace, SignOff, Order, DeliveryLog, AuditLog,
    PatientFeedback, PatientChangeRequest, Notification,
)
from portal.serializers import (
    UserSerializer, PatientSerializer, PatientListSerializer, AllergySerializer,
    IngredientSerializer, CrossReactivitySerializer, IngredientConfidenceSerializer,
    MealSerializer, MealPlanSerializer, DecisionTraceSerializer,
    SignOffSerializer, OrderSerializer, DeliveryLogSerializer, AuditLogSerializer,
    PatientFeedbackSerializer, PatientChangeRequestSerializer, NotificationSerializer,
)
from portal.aearm import run_aearm, route_for_signoff


# ─────────────────────────────────────────────────────────────────────────────
# Permission helpers
# ─────────────────────────────────────────────────────────────────────────────

def has_role(user, *roles):
    return user.groups.filter(name__in=roles).exists()


class RolePermission(permissions.BasePermission):
    required_roles = []

    def has_permission(self, request, view):
        return request.user.is_authenticated and has_role(request.user, *self.required_roles)


def make_role_permission(*roles):
    return type('RP', (RolePermission,), {'required_roles': list(roles)})


DoctorPerm = make_role_permission('doctor', 'admin')
# Role consolidation (Oct 2026): 5-role system — admin, doctor, dietitian, kitchen, patient.
# senior_reviewer merged into dietitian (dietitian now handles all risk tiers).
# delivery/porter merged into kitchen.
# admin retained in ClinicalPerm for batch-planner testing only; SignOffViewSet.create()
# still blocks admin from approving individual meals (audit-only constraint preserved).
DietitianPerm = make_role_permission('dietitian', 'admin')
ClinicalPerm  = make_role_permission('dietitian', 'admin')
KitchenPerm   = make_role_permission('kitchen', 'admin')
PatientPerm   = make_role_permission('patient', 'admin')
AdminPerm     = make_role_permission('admin')
AnyStaffPerm  = make_role_permission('doctor', 'dietitian', 'kitchen', 'admin')


# ─────────────────────────────────────────────────────────────────────────────
# Auth
# ─────────────────────────────────────────────────────────────────────────────

@api_view(['POST'])
@permission_classes([permissions.AllowAny])
def login_view(request):
    raw_username = str(request.data.get('username') or '').strip()
    raw_password = str(request.data.get('password') or '').strip()

    if not raw_username or not raw_password:
        return Response({'detail': 'Username and password are required.'}, status=status.HTTP_400_BAD_REQUEST)

    # 1. Direct Django authenticate
    user = authenticate(username=raw_username, password=raw_password)

    # 2. Case-insensitive or name-based lookup
    if not user:
        matched_user = User.objects.filter(
            Q(username__iexact=raw_username) |
            Q(last_name__iexact=raw_username) |
            Q(first_name__icontains=raw_username)
        ).first()

        if matched_user:
            # Name candidates (last_name, username, or clean tokens from first_name)
            name_candidates = [
                matched_user.last_name.lower(),
                matched_user.username.lower(),
            ]
            if matched_user.first_name:
                tokens = [t.lower().strip('(),.') for t in matched_user.first_name.split()]
                name_candidates.extend([t for t in tokens if t not in ['dr', 'dr.', 'system', 'chief', 'senior', 'head', 'inpatient']])

            pwd_clean = raw_password.lower()
            if (pwd_clean in name_candidates) or matched_user.check_password(raw_password) or matched_user.check_password(pwd_clean):
                user = matched_user

    # 3. Patient record lookup for bedside authentication
    if not user:
        clean_name = raw_username.strip()
        clean_lower = clean_name.lower()
        patient = None

        # a) Check if username has patient_X or patientX
        if clean_lower.startswith('patient_') or clean_lower.startswith('patient'):
            digits = ''.join(c for c in clean_lower if c.isdigit())
            if digits:
                patient = Patient.objects.filter(id=int(digits)).first()

        # b) Check if numeric ID
        if not patient and clean_name.isdigit():
            patient = Patient.objects.filter(id=int(clean_name)).first()

        # c) Check by patient name, bed number, or username
        if not patient:
            patient = Patient.objects.filter(
                Q(name__iexact=clean_name) |
                Q(name__icontains=clean_name) |
                Q(bed_no__iexact=clean_name)
            ).first()

        if patient:
            first_name_token = patient.name.split()[0].lower() if patient.name else ''
            pwd_clean = raw_password.lower().strip()
            valid_passwords = [
                first_name_token,
                patient.name.lower(),
                f"patient{patient.id}",
                f"patient_{patient.id}",
            ]
            if (pwd_clean in valid_passwords) or (first_name_token and (pwd_clean.startswith(first_name_token) or first_name_token.startswith(pwd_clean))):
                if patient.user:
                    user = patient.user
                else:
                    patient_group, _ = Group.objects.get_or_create(name='patient')
                    u_uname = f"patient{patient.id}"
                    user, _ = User.objects.get_or_create(
                        username=u_uname,
                        defaults={
                            'first_name': patient.name,
                            'last_name': 'Patient'
                        }
                    )
                    user.set_password(first_name_token)
                    user.groups.add(patient_group)
                    user.save()
                    patient.user = user
                    patient.save(update_fields=['user'])

    if user:
        token, _ = Token.objects.get_or_create(user=user)
        groups = list(user.groups.values_list('name', flat=True))
        role = groups[0] if groups else 'patient'

        # If patient, attach patient profile id
        patient_id = None
        if hasattr(user, 'patient_profile') and user.patient_profile:
            patient_id = user.patient_profile.id
            role = 'patient'

        return Response({
            'token': token.key,
            'user': {
                'id': user.pk,
                'patient_id': patient_id,
                'username': user.username,
                'full_name': user.get_full_name() or user.first_name or user.username,
                'role': role,
                'groups': groups,
            }
        })
    return Response(
        {'detail': 'Invalid credentials. Please verify your username and password (password is your name, e.g. rajan, priya, senthil, ramesh, aarthi, admin).'},
        status=status.HTTP_401_UNAUTHORIZED
    )


@api_view(['POST'])
def logout_view(request):
    try:
        request.user.auth_token.delete()
    except Exception:
        pass
    return Response({'detail': 'Logged out'})


@api_view(['GET'])
def me_view(request):
    return Response(UserSerializer(request.user).data)


@api_view(['GET'])
@permission_classes([permissions.AllowAny])
def public_patient_directory_view(request):
    """
    Public directory of admitted inpatients for bedside terminal login and bed selection.
    Returns all admitted patients across hospital wards.
    """
    patients = Patient.objects.all().order_by('ward', 'bed_no').values(
        'id', 'name', 'ward', 'bed_no', 'diet_type', 'diagnosis'
    )
    diet_format_map = {
        'diabetic': 'Diabetic-Friendly',
        'renal': 'Renal Diet',
        'low-sodium': 'Low Sodium',
        'soft': 'Soft / Pureed',
        'liquid': 'Liquid Diet',
        'high-protein': 'High Protein',
        'regular': 'Regular Diet',
        'vegetarian': 'Vegetarian',
        'vegan': 'Vegan',
    }
    data = []
    for p in patients:
        first_token = p['name'].split()[0].lower() if p['name'] else ''
        data.append({
            'id': p['id'],
            'role': 'patient',
            'fullName': p['name'],
            'ward': f"Ward {p['ward']}",
            'bedNo': f"Bed {p['bed_no']}",
            'dietType': diet_format_map.get(p['diet_type'], p['diet_type'].title()),
            'diagnosis': p['diagnosis'],
            'username': f"patient_{p['id']}",
            'namePassword': first_token,
            'icon': '🏥',
        })
    return Response(data)


# ─────────────────────────────────────────────────────────────────────────────
# Doctor Module — Patient & Allergy CRUD
# ─────────────────────────────────────────────────────────────────────────────

class PatientViewSet(viewsets.ModelViewSet):
    queryset = Patient.objects.all().order_by('-admitted_on')

    def get_permissions(self):
        if self.action in ['list', 'retrieve']:
            return [AnyStaffPerm()]
        return [DoctorPerm()]

    def get_serializer_class(self):
        if self.action == 'list':
            return PatientListSerializer
        return PatientSerializer

    def get_queryset(self):
        qs = super().get_queryset()
        ward = self.request.query_params.get('ward')
        search = self.request.query_params.get('search')
        if ward:
            qs = qs.filter(ward=ward)
        if search:
            qs = qs.filter(Q(name__icontains=search) | Q(diagnosis__icontains=search))
        return qs

    def perform_create(self, serializer):
        patient = serializer.save(updated_by=self.request.user)
        AuditLog.objects.create(
            entity='Patient', entity_id=patient.pk,
            action='created', actor=self.request.user, actor_role='doctor',
            detail={'ward': patient.ward, 'diagnosis': patient.diagnosis[:80]},
        )

    def perform_update(self, serializer):
        patient = serializer.save(updated_by=self.request.user)
        AuditLog.objects.create(
            entity='Patient', entity_id=patient.pk,
            action='updated', actor=self.request.user, actor_role='doctor',
            detail={'diet_type': patient.diet_type},
        )

    @action(detail=True, methods=['get'])
    def diet_constraints(self, request, pk=None):
        """Evaluate multi-morbidity nutrient constraints for this patient."""
        from portal.diet_constraints import evaluate_patient_diagnoses_text
        patient = self.get_object()
        constraints, logs = evaluate_patient_diagnoses_text(patient.diagnosis)
        return Response({
            'patient_id': patient.pk,
            'patient_name': patient.name,
            'diagnosis': patient.diagnosis,
            'constraints': constraints,
            'explanation_log': logs,
        })


class AllergyViewSet(viewsets.ModelViewSet):
    serializer_class = AllergySerializer

    def get_permissions(self):
        if self.action in ['list', 'retrieve']:
            return [AnyStaffPerm()]
        return [DoctorPerm()]

    def get_queryset(self):
        patient_id = self.request.query_params.get('patient')
        qs = Allergy.objects.all()
        if patient_id:
            qs = qs.filter(patient_id=patient_id)
        return qs

    def perform_create(self, serializer):
        allergy = serializer.save(recorded_by=self.request.user)
        AuditLog.objects.create(
            entity='Allergy', entity_id=allergy.pk,
            action='recorded', actor=self.request.user, actor_role='doctor',
            detail={'allergen_family': allergy.allergen_family, 'severity': allergy.severity},
        )


# ─────────────────────────────────────────────────────────────────────────────
# Reference Data
# ─────────────────────────────────────────────────────────────────────────────

class IngredientViewSet(viewsets.ModelViewSet):
    permission_classes = [AnyStaffPerm]
    serializer_class = IngredientSerializer
    queryset = Ingredient.objects.select_related('confidence_record').all().order_by('name')


class IngredientConfidenceViewSet(viewsets.ModelViewSet):
    permission_classes = [AnyStaffPerm]
    serializer_class = IngredientConfidenceSerializer
    queryset = IngredientConfidence.objects.select_related('ingredient').all().order_by('confidence_score')


class MealViewSet(viewsets.ModelViewSet):
    permission_classes = [AnyStaffPerm]
    serializer_class = MealSerializer
    queryset = Meal.objects.all().prefetch_related('ingredients')

    def get_queryset(self):
        qs = super().get_queryset()
        diet_tag = self.request.query_params.get('diet_tag')
        meal_type = self.request.query_params.get('meal_type')
        search = self.request.query_params.get('search')
        if diet_tag:
            qs = qs.filter(diet_tags__contains=[diet_tag])
        if meal_type:
            qs = qs.filter(meal_type=meal_type)
        if search:
            qs = qs.filter(name__icontains=search)
        return qs


# ─────────────────────────────────────────────────────────────────────────────
# Dietitian Module — Meal Planning + AEARM + Sign-off
# ─────────────────────────────────────────────────────────────────────────────

class MealPlanViewSet(viewsets.ModelViewSet):
    permission_classes = [ClinicalPerm]
    serializer_class = MealPlanSerializer
    queryset = MealPlan.objects.select_related(
        'patient', 'meal', 'decision_trace'
    ).all().order_by('-created_at')

    def get_queryset(self):
        qs = super().get_queryset()
        patient_id = self.request.query_params.get('patient')
        status_filter = self.request.query_params.get('status')
        tier = self.request.query_params.get('tier')
        date = self.request.query_params.get('date')
        meal_slot = self.request.query_params.get('meal_slot')
        if patient_id:
            qs = qs.filter(patient_id=patient_id)
        if status_filter:
            qs = qs.filter(status=status_filter)
        if tier:
            qs = qs.filter(decision_trace__risk_tier=tier)
        if date:
            qs = qs.filter(planned_date=date)
        if meal_slot:
            qs = qs.filter(meal_slot=meal_slot)
        return qs

    def perform_create(self, serializer):
        groups = list(self.request.user.groups.values_list('name', flat=True))
        role = groups[0] if groups else 'system'
        plan = serializer.save(created_by=self.request.user, status='pending')
        AuditLog.objects.create(
            entity='MealPlan', entity_id=plan.pk,
            action='created', actor=self.request.user, actor_role=role,
            detail={'patient_id': plan.patient_id, 'meal_id': plan.meal_id},
        )
        # AEARM runs via signal after commit

    def perform_update(self, serializer):
        groups = list(self.request.user.groups.values_list('name', flat=True))
        role = groups[0] if groups else 'dietitian'
        plan = serializer.save()
        AuditLog.objects.create(
            entity='MealPlan', entity_id=plan.pk,
            action='updated', actor=self.request.user, actor_role=role,
            detail={'meal_id': plan.meal_id, 'status': plan.status},
        )


    @action(detail=True, methods=['post'])
    def rerun_aearm(self, request, pk=None):
        """Manually re-run the AEARM pipeline on an existing plan."""
        plan = self.get_object()
        result = run_aearm(plan)
        return Response({
            'status': 'AEARM re-run complete',
            'tier': result['tier'],
            'score': result['score'],
            'explanation': result['explanation'],
            'route': result['route'],
        })

    @action(detail=False, methods=['post'])
    def auto_assign_patient(self, request):
        """AI Auto-Assignment for a single patient."""
        from portal.aearm import auto_assign_patient
        patient_id = request.data.get('patient_id')
        planned_date = request.data.get('planned_date') or timezone.localdate()
        meal_slot = request.data.get('meal_slot', 'lunch')
        if not patient_id:
            return Response({'detail': 'patient_id is required'}, status=400)
        try:
            patient = Patient.objects.get(pk=patient_id)
        except Patient.DoesNotExist:
            return Response({'detail': 'Patient not found'}, status=404)

        plan = auto_assign_patient(patient, planned_date, meal_slot, user=request.user)
        return Response(MealPlanSerializer(plan, context={'request': request}).data)

    @action(detail=False, methods=['post'])
    def auto_assign_all(self, request):
        """
        Autonomous AI Hospital Batch Planner:
        Scans all admitted inpatients across all wards.
        Automatically evaluates and assigns meals matching diagnosis & allergy profiles.
        Auto-approves safe meals to kitchen; flags high-risk conflicts for Senior Reviewer audit!
        """
        from portal.aearm import auto_assign_patient
        planned_date = request.data.get('planned_date') or timezone.localdate()
        slots = request.data.get('slots', ['breakfast', 'lunch', 'dinner'])
        ward = request.data.get('ward')

        patients = Patient.objects.all()
        if ward:
            patients = patients.filter(ward=ward)

        # FIX 1 (batch reporting bug): All three AEARM outcome statuses are now counted
        # separately. 'flagged_for_audit' is kept as a combined medium+high total for
        # backward compatibility with any frontend code that reads it.
        assigned_plans = []
        for patient in patients:
            for slot in slots:
                plan = auto_assign_patient(patient, planned_date, slot, user=request.user)
                if plan:
                    assigned_plans.append(plan)

        auto_approved = 0
        flagged_medium_risk = 0
        flagged_high_risk = 0

        for plan in assigned_plans:
            if plan.status == 'approved':
                auto_approved += 1
            elif plan.status == 'medium_risk':
                flagged_medium_risk += 1
            elif plan.status == 'high_risk':
                flagged_high_risk += 1

        return Response({
            'message': f'AI Batch Assignment complete for {patients.count()} patients across {len(slots)} meal slots.',
            'date': str(planned_date),
            'total_assigned': len(assigned_plans),
            'auto_approved': auto_approved,
            'flagged_medium_risk': flagged_medium_risk,
            'flagged_high_risk': flagged_high_risk,
            'flagged_for_audit': flagged_medium_risk + flagged_high_risk,
        })

    @action(detail=False, methods=['post'])
    def recommend(self, request):
        """Preview AI recommendations for a patient."""
        from portal.aearm import recommend_safest_meal
        patient_id = request.data.get('patient_id')
        meal_slot = request.data.get('meal_slot', 'lunch')
        if not patient_id:
            return Response({'detail': 'patient_id is required'}, status=400)
        try:
            patient = Patient.objects.get(pk=patient_id)
        except Patient.DoesNotExist:
            return Response({'detail': 'Patient not found'}, status=404)

        optimal, ranked = recommend_safest_meal(patient, meal_slot)
        return Response({
            'optimal': {
                'id': optimal['meal'].id,
                'name': optimal['meal'].name,
                'score': optimal['score'],
                'tier': optimal['tier'],
                'has_diet_match': optimal['has_diet_match'],
                'explanation': optimal['explanation'],
            } if optimal else None,
            'ranked': [
                {
                    'id': r['meal'].id,
                    'name': r['meal'].name,
                    'score': r['score'],
                    'tier': r['tier'],
                    'has_diet_match': r['has_diet_match'],
                    'avg_confidence': r['avg_confidence'],
                    'explanation': r['explanation'],
                }
                for r in ranked[:8]
            ]
        })

    @action(detail=False, methods=['get'])
    def signoff_queue(self, request):
        """Flagged plans needing clinical audit / sign-off."""
        qs = self.get_queryset().filter(
            Q(status__in=['high_risk', 'medium_risk', 'pending']) |
            Q(decision_trace__risk_tier__in=['High', 'Medium'])
        ).exclude(
            status__in=['approved', 'rejected']
        ).order_by('-decision_trace__risk_score')
        serializer = self.get_serializer(qs, many=True)
        return Response(serializer.data)

    @action(detail=False, methods=['get'])
    def patient_today(self, request):
        """Today's meal plans for all patients."""
        today = timezone.localdate()
        qs = self.get_queryset().filter(planned_date=today)
        serializer = self.get_serializer(qs, many=True)
        return Response(serializer.data)


class SignOffViewSet(viewsets.ModelViewSet):
    permission_classes = [DietitianPerm]
    serializer_class = SignOffSerializer
    queryset = SignOff.objects.all().order_by('-timestamp')

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        groups = list(request.user.groups.values_list('name', flat=True))
        is_dietitian = 'dietitian' in groups

        # Admin cannot approve or edit individual meals (Section 2)
        if 'admin' in groups and not is_dietitian:
            return Response(
                {'detail': 'Administrators cannot approve or edit individual meals. Auditing only.'},
                status=status.HTTP_403_FORBIDDEN
            )

        meal_plan = serializer.validated_data.get('meal_plan')
        decision = serializer.validated_data.get('decision')
        override_reason = serializer.validated_data.get('override_reason', '').strip()

        tier = getattr(getattr(meal_plan, 'decision_trace', None), 'risk_tier', None)
        if tier is None:
            tier = 'High' if meal_plan.status == 'high_risk' else 'Medium' if meal_plan.status == 'medium_risk' else 'Low'

        # Section 4.3: Mandatory written justification for High-risk approval
        if tier == 'High' and decision == 'approve' and not override_reason:
            return Response(
                {'detail': 'Mandatory written clinical justification is required to approve a High-risk meal.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        role = groups[0] if groups else 'dietitian'
        sign_off = serializer.save(reviewer=request.user, reviewer_role=role)

        # Update MealPlan status explicitly
        meal_plan.status = 'approved' if decision == 'approve' else 'rejected'
        meal_plan.save(update_fields=['status'])

        AuditLog.objects.create(
            entity='SignOff', entity_id=sign_off.pk,
            action=sign_off.decision, actor=request.user, actor_role=role,
            detail={
                'meal_plan_id': sign_off.meal_plan_id,
                'override_reason': sign_off.override_reason,
            },
        )
        headers = self.get_success_headers(serializer.data)
        return Response(serializer.data, status=status.HTTP_201_CREATED, headers=headers)

    def perform_update(self, serializer):
        sign_off = serializer.save()
        groups = list(self.request.user.groups.values_list('name', flat=True))
        role = groups[0] if groups else 'dietitian'
        AuditLog.objects.create(
            entity='SignOff', entity_id=sign_off.pk,
            action='updated', actor=self.request.user, actor_role=role,
            detail={
                'meal_plan_id': sign_off.meal_plan_id,
                'outcome': sign_off.outcome,
            },
        )

    @action(detail=False, methods=['get'])
    def my_history(self, request):
        qs = SignOff.objects.filter(reviewer=request.user).order_by('-timestamp')
        serializer = self.get_serializer(qs, many=True)
        return Response(serializer.data)


# ─────────────────────────────────────────────────────────────────────────────
# Patient Module — Approved Today's Menu & Clinical Feedback
# ─────────────────────────────────────────────────────────────────────────────

class PatientMenuViewSet(viewsets.ReadOnlyModelViewSet):
    permission_classes = [PatientPerm]
    serializer_class = MealPlanSerializer

    def get_queryset(self):
        user = self.request.user
        today = timezone.localdate()
        try:
            patient = user.patient_profile
        except (Patient.DoesNotExist, AttributeError):
            patient = Patient.objects.first()
            if not patient:
                return MealPlan.objects.none()

        # Strictly show TODAY's approved meals for the 3 daily sessions (Breakfast, Lunch, Dinner)
        qs = MealPlan.objects.filter(
            patient=patient, status='approved', planned_date=today
        ).select_related('meal', 'decision_trace').prefetch_related('feedbacks', 'meal__ingredients')

        # Fallback to latest planned date if today has not been generated yet
        if not qs.exists():
            latest_date = MealPlan.objects.filter(patient=patient, status='approved').order_by('-planned_date').values_list('planned_date', flat=True).first()
            if latest_date:
                qs = MealPlan.objects.filter(
                    patient=patient, status='approved', planned_date=latest_date
                ).select_related('meal', 'decision_trace').prefetch_related('feedbacks', 'meal__ingredients')

        return qs


@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def patient_profile_view(request):
    """
    Returns the comprehensive admission profile of the patient (entered by doctor during admission),
    including admission diagnosis, allergies, diet type, ward/bed, doctor notes,
    and change requests history.
    """
    user = request.user
    patient = getattr(user, 'patient_profile', None)
    if not patient:
        patient_id = request.query_params.get('patient_id')
        if patient_id and has_role(user, 'doctor', 'dietitian', 'admin'):
            patient = Patient.objects.filter(id=patient_id).first()
        else:
            patient = Patient.objects.first()

    if not patient:
        return Response({'detail': 'No patient record found'}, status=404)

    serializer = PatientSerializer(patient, context={'request': request})
    return Response(serializer.data)


class PatientChangeRequestViewSet(viewsets.ModelViewSet):
    """
    Endpoint for patients to request changes to their admission/diet details,
    and for doctors to review, approve, or decline them.
    """
    serializer_class = PatientChangeRequestSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        qs = PatientChangeRequest.objects.select_related('patient', 'reviewed_by').all().order_by('-created_at')

        # If user is staff (doctor, admin, dietitian)
        if has_role(user, 'doctor', 'admin', 'dietitian'):
            status_filter = self.request.query_params.get('status')
            patient_id = self.request.query_params.get('patient')
            category = self.request.query_params.get('category')
            if status_filter:
                qs = qs.filter(status=status_filter)
            if patient_id:
                qs = qs.filter(patient_id=patient_id)
            if category:
                qs = qs.filter(category=category)
            return qs

        # If patient user:
        patient = getattr(user, 'patient_profile', None) or Patient.objects.first()
        if patient:
            return qs.filter(patient=patient)
        return PatientChangeRequest.objects.none()

    def perform_create(self, serializer):
        user = self.request.user
        patient = getattr(user, 'patient_profile', None)
        if not patient:
            patient_id = self.request.data.get('patient_id')
            if patient_id:
                patient = Patient.objects.filter(id=patient_id).first()
            if not patient:
                patient = Patient.objects.first()

        req = serializer.save(patient=patient, status='pending')
        AuditLog.objects.create(
            entity='PatientChangeRequest',
            entity_id=req.pk,
            action='patient_request_submitted',
            actor=user,
            actor_role='patient',
            detail={
                'patient_id': patient.id if patient else None,
                'patient_name': patient.name if patient else 'Unknown',
                'category': req.category,
                'requested_changes': req.requested_changes[:100],
            },
        )

    @action(detail=True, methods=['patch', 'post'])
    def doctor_review(self, request, pk=None):
        """Doctor action to approve, reject, or resolve a patient change request."""
        if not has_role(request.user, 'doctor', 'admin'):
            return Response({'detail': 'Only doctors can review and action patient requests.'}, status=403)

        change_req = self.get_object()
        new_status = request.data.get('status', 'resolved')
        doctor_response = request.data.get('doctor_response', '')
        apply_diet_type = request.data.get('apply_diet_type')

        if new_status not in ['approved', 'rejected', 'resolved']:
            return Response({'detail': 'Invalid status. Choose approved, rejected, or resolved.'}, status=400)

        change_req.status = new_status
        change_req.doctor_response = doctor_response
        change_req.reviewed_by = request.user
        change_req.save(update_fields=['status', 'doctor_response', 'reviewed_by', 'updated_at'])

        # If doctor approves and provides an updated diet type, update patient record
        if new_status == 'approved' and apply_diet_type:
            patient = change_req.patient
            old_diet = patient.diet_type
            patient.diet_type = apply_diet_type
            patient.updated_by = request.user
            patient.save(update_fields=['diet_type', 'updated_by', 'updated_on'])
            AuditLog.objects.create(
                entity='Patient',
                entity_id=patient.id,
                action='diet_updated_via_request',
                actor=request.user,
                actor_role='doctor',
                detail={'old_diet': old_diet, 'new_diet': apply_diet_type, 'request_id': change_req.id},
            )

        AuditLog.objects.create(
            entity='PatientChangeRequest',
            entity_id=change_req.pk,
            action=f'request_{new_status}_by_doctor',
            actor=request.user,
            actor_role='doctor',
            detail={'status': new_status, 'doctor_response': doctor_response},
        )

        return Response(PatientChangeRequestSerializer(change_req).data)


class PatientFeedbackViewSet(viewsets.ModelViewSet):
    """Patient feedback endpoint — submitted by patients and reviewed by dietitians."""
    serializer_class = PatientFeedbackSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        qs = PatientFeedback.objects.select_related('patient', 'meal_plan__meal').all().order_by('-submitted_at')
        if has_role(user, 'dietitian', 'doctor', 'admin'):
            tolerance = self.request.query_params.get('tolerance')
            patient_id = self.request.query_params.get('patient')
            if tolerance:
                qs = qs.filter(tolerance_status=tolerance)
            if patient_id:
                qs = qs.filter(patient_id=patient_id)
            return qs

        patient = getattr(user, 'patient_profile', None) or Patient.objects.first()
        if patient:
            return qs.filter(patient=patient)
        return PatientFeedback.objects.none()

    def perform_create(self, serializer):
        user = self.request.user
        patient = getattr(user, 'patient_profile', None)
        if not patient:
            meal_plan = serializer.validated_data.get('meal_plan')
            patient = meal_plan.patient if meal_plan else Patient.objects.first()
        fb = serializer.save(patient=patient)
        AuditLog.objects.create(
            entity='PatientFeedback',
            entity_id=fb.pk,
            action='patient_feedback_submitted',
            actor=self.request.user,
            actor_role='patient',
            detail={
                'meal_plan_id': fb.meal_plan_id,
                'patient_id': patient.id,
                'rating': fb.rating,
                'tolerance_status': fb.tolerance_status,
                'comments': fb.comments,
            },
        )


# ─────────────────────────────────────────────────────────────────────────────
# Kitchen Module — Order queue + batch scan
# ─────────────────────────────────────────────────────────────────────────────

class OrderViewSet(viewsets.ModelViewSet):
    permission_classes = [KitchenPerm]
    serializer_class = OrderSerializer
    queryset = Order.objects.select_related(
        'meal_plan__patient', 'meal_plan__meal'
    ).prefetch_related(
        'meal_plan__patient__allergies', 'meal_plan__meal__ingredients'
    ).all().order_by('meal_plan__planned_date', 'created_at')

    def get_queryset(self):
        qs = super().get_queryset()
        ks = self.request.query_params.get('kitchen_status')
        date = self.request.query_params.get('date')
        ward = self.request.query_params.get('ward')
        meal_slot = self.request.query_params.get('meal_slot')
        meal_id = self.request.query_params.get('meal_id')
        if ks:
            qs = qs.filter(kitchen_status=ks)
        if date:
            qs = qs.filter(meal_plan__planned_date=date)
        if ward:
            qs = qs.filter(meal_plan__patient__ward=ward)
        if meal_slot:
            qs = qs.filter(meal_plan__meal_slot=meal_slot)
        if meal_id:
            qs = qs.filter(meal_plan__meal_id=meal_id)
        return qs

    @action(detail=True, methods=['patch'])
    def update_status(self, request, pk=None):
        order = self.get_object()
        new_status = request.data.get('kitchen_status')
        allowed = ['queued', 'preparing', 'ready', 'dispatched']
        if new_status not in allowed:
            return Response({'detail': 'Invalid status'}, status=400)
        order.kitchen_status = new_status
        order.save(update_fields=['kitchen_status'])
        AuditLog.objects.create(
            entity='Order', entity_id=order.pk,
            action=f'status_changed_to_{new_status}',
            actor=request.user, actor_role='kitchen',
            detail={'tray_code': order.tray_code},
        )
        return Response(OrderSerializer(order, context={'request': request}).data)

    @action(detail=False, methods=['patch', 'post'])
    def bulk_update_status(self, request):
        """Batch update kitchen status for multiple orders simultaneously."""
        order_ids = request.data.get('order_ids', [])
        new_status = request.data.get('kitchen_status')
        allowed = ['queued', 'preparing', 'ready', 'dispatched']
        if new_status not in allowed:
            return Response({'detail': f'Invalid status. Allowed: {allowed}'}, status=400)
        if not order_ids or not isinstance(order_ids, list):
            return Response({'detail': 'Valid order_ids list is required'}, status=400)

        orders = Order.objects.filter(id__in=order_ids)
        count = orders.update(kitchen_status=new_status)
        AuditLog.objects.create(
            entity='Order', entity_id=None,
            action=f'bulk_status_changed_to_{new_status}',
            actor=request.user, actor_role='kitchen',
            detail={'count': count, 'order_ids': order_ids, 'status': new_status},
        )
        return Response({
            'message': f'Successfully updated {count} orders to {new_status.upper()}',
            'updated_count': count,
            'kitchen_status': new_status,
        })

    @action(detail=False, methods=['get'])
    def bulk_summary(self, request):
        """
        Aggregated summary of meal items, total portion counts, and patient listings.
        Designed for kitchen chefs to plan batch cooking and identify all recipient patients.
        """
        qs = self.get_queryset()
        summary_map = {}
        for order in qs:
            meal = order.meal_plan.meal
            slot = order.meal_plan.meal_slot
            key = f"{meal.id}_{slot}"
            if key not in summary_map:
                summary_map[key] = {
                    'meal_id': meal.id,
                    'meal_name': meal.name,
                    'meal_type': meal.meal_type,
                    'meal_slot': slot,
                    'diet_tags': meal.diet_tags,
                    'ingredients': [i.name for i in meal.ingredients.all()],
                    'total_portions': 0,
                    'status_counts': {'queued': 0, 'preparing': 0, 'ready': 0, 'dispatched': 0},
                    'patients': [],
                    'order_ids': [],
                }
            item = summary_map[key]
            item['total_portions'] += 1
            st = order.kitchen_status
            if st in item['status_counts']:
                item['status_counts'][st] += 1
            item['order_ids'].append(order.id)
            patient = order.meal_plan.patient
            item['patients'].append({
                'order_id': order.id,
                'tray_code': order.tray_code,
                'kitchen_status': order.kitchen_status,
                'patient_id': patient.id,
                'patient_name': patient.name,
                'ward': patient.ward,
                'bed_no': patient.bed_no,
                'diet_type': patient.diet_type,
                'diagnosis': patient.diagnosis,
                'allergies': [
                    {'family': a.allergen_family, 'severity': a.severity}
                    for a in patient.allergies.all()
                ],
            })

        items = list(summary_map.values())
        items.sort(key=lambda x: x['total_portions'], reverse=True)
        return Response({
            'total_items_to_cook': len(items),
            'total_meal_portions': sum(i['total_portions'] for i in items),
            'items': items,
        })


class DeliveryLogViewSet(viewsets.ModelViewSet):
    permission_classes = [KitchenPerm]
    serializer_class = DeliveryLogSerializer
    queryset = DeliveryLog.objects.select_related('order__meal_plan__patient', 'order__meal_plan__meal').order_by('-delivered_at')

    def get_queryset(self):
        qs = super().get_queryset()
        cart = self.request.query_params.get('cart_id')
        res = self.request.query_params.get('scan_result')
        if cart:
            qs = qs.filter(cart_id__icontains=cart)
        if res:
            qs = qs.filter(scan_result=res)
        return qs

    def perform_create(self, serializer):
        log = serializer.save(scanned_by=self.request.user)
        AuditLog.objects.create(
            entity='DeliveryLog', entity_id=log.pk,
            action='batch_scan', actor=self.request.user, actor_role='kitchen',
            detail={'tray_code': log.order.tray_code, 'result': log.scan_result},
        )

    @action(detail=False, methods=['post'])
    def batch_scan(self, request):
        """
        High-performance batch scan endpoint:
        Receives tray_codes, cart_id, optional ward, and optional staff_note.
        Matches each tray against dispatched kitchen orders, records delivery logs,
        and enforces staff accountability for any discrepancies.
        """
        raw_tray_codes = request.data.get('tray_codes', [])
        cart_id = request.data.get('cart_id', 'CART-001')
        staff_note = request.data.get('staff_note', '').strip()
        ward = request.data.get('ward', None)

        # Normalize and preserve order of scanned tray codes
        scanned_codes = []
        seen = set()
        for c in raw_tray_codes:
            clean = str(c).strip().upper()
            if clean and clean not in seen:
                seen.add(clean)
                scanned_codes.append(clean)

        # 1. Query dispatched orders
        today = timezone.localdate()
        dispatched_qs = Order.objects.filter(kitchen_status='dispatched')
        if dispatched_qs.filter(meal_plan__planned_date=today).exists():
            dispatched_qs = dispatched_qs.filter(meal_plan__planned_date=today)

        if ward and ward.upper() != 'ALL':
            dispatched_qs = dispatched_qs.filter(meal_plan__patient__ward=ward)

        dispatched_orders = list(
            dispatched_qs.select_related('meal_plan__patient', 'meal_plan__meal')
        )
        expected_map = {o.tray_code.upper(): o for o in dispatched_orders}
        expected_codes = set(expected_map.keys())

        # 2. Look up any other orders that exist by tray code (to differentiate wrong status vs unknown barcode)
        other_orders_map = {
            o.tray_code.upper(): o
            for o in Order.objects.filter(tray_code__in=scanned_codes)
            .select_related('meal_plan__patient', 'meal_plan__meal')
        }

        results = []
        logs_to_create = []

        for code in scanned_codes:
            order = expected_map.get(code)
            if order:
                scan_result = 'matched'
                reason = 'Verified ready for ward bedside delivery'
            elif code in other_orders_map:
                order = other_orders_map[code]
                scan_result = 'mismatch'
                reason = f"Order status is '{order.kitchen_status}' (not dispatched) or belongs to different ward"
            else:
                order = None
                scan_result = 'mismatch'
                reason = 'Barcode does not match any registered meal order'

            results.append({
                'tray_code': code,
                'result': scan_result,
                'order_id': order.pk if order else None,
                'patient_name': order.meal_plan.patient.name if order else 'Unknown',
                'ward': order.meal_plan.patient.ward if order else '—',
                'bed_number': (getattr(order.meal_plan.patient, 'bed_no', '—')) if order else '—',
                'meal_name': order.meal_plan.meal.name if order else '—',
                'reason': reason,
            })

            if order:
                note = staff_note if (staff_note and scan_result != 'matched') else ''
                logs_to_create.append(DeliveryLog(
                    order=order,
                    cart_id=cart_id,
                    scan_result=scan_result,
                    scanned_by=request.user,
                    staff_note=note,
                ))

        # 3. Check for missing trays (only when a specific ward is selected)
        scanned_set = set(scanned_codes)
        missing_count = 0
        if ward and ward.upper() != 'ALL':
            missing_codes = expected_codes - scanned_set
            missing_count = len(missing_codes)
            for code in sorted(missing_codes):
                order = expected_map[code]
                results.append({
                    'tray_code': code,
                    'result': 'missing',
                    'order_id': order.pk,
                    'patient_name': order.meal_plan.patient.name,
                    'ward': order.meal_plan.patient.ward,
                    'bed_number': getattr(order.meal_plan.patient, 'bed_no', '—'),
                    'meal_name': order.meal_plan.meal.name,
                    'reason': f"Expected tray for Ward {ward} not scanned in this cart",
                })
                logs_to_create.append(DeliveryLog(
                    order=order,
                    cart_id=cart_id,
                    scan_result='missing',
                    scanned_by=request.user,
                    staff_note=staff_note or '',
                ))

        # 4. Fast bulk insert
        if logs_to_create:
            DeliveryLog.objects.bulk_create(logs_to_create, batch_size=250)

        matched_count = sum(1 for r in results if r['result'] == 'matched')
        missing_count = sum(1 for r in results if r['result'] == 'missing')
        mismatch_count = sum(1 for r in results if r['result'] == 'mismatch')

        AuditLog.objects.create(
            entity='DeliveryLog', entity_id=None,
            action='batch_scan_complete', actor=request.user, actor_role='kitchen',
            detail={
                'cart_id': cart_id,
                'ward': ward or 'ALL',
                'scanned': len(scanned_codes),
                'matched': matched_count,
                'missing': missing_count,
                'mismatch': mismatch_count,
                'staff_note': staff_note or '',
            },
        )

        return Response({
            'results': results,
            'summary': {
                'total_expected': len(expected_codes),
                'scanned': len(scanned_codes),
                'matched': matched_count,
                'missing': missing_count,
                'mismatch': mismatch_count,
                'cart_id': cart_id,
                'ward': ward or 'ALL',
            }
        })


# ─────────────────────────────────────────────────────────────────────────────
# Admin Module — Audit log + analytics
# ─────────────────────────────────────────────────────────────────────────────

class AuditLogViewSet(viewsets.ReadOnlyModelViewSet):
    permission_classes = [AdminPerm]
    serializer_class = AuditLogSerializer
    queryset = AuditLog.objects.all().order_by('-timestamp')

    def get_queryset(self):
        qs = super().get_queryset()
        entity = self.request.query_params.get('entity')
        role = self.request.query_params.get('role')
        search = self.request.query_params.get('search')
        if entity:
            qs = qs.filter(entity=entity)
        if role:
            qs = qs.filter(actor_role=role)
        if search:
            qs = qs.filter(action__icontains=search)
        return qs


@api_view(['GET'])
@permission_classes([AdminPerm])
def analytics_view(request):
    """Admin analytics — risk distribution, override counts, ward patterns."""
    from django.db.models import Avg

    risk_dist = (
        DecisionTrace.objects
        .values('risk_tier')
        .annotate(count=Count('id'))
        .order_by('risk_tier')
    )

    override_count = SignOff.objects.filter(decision='approve').count()
    rejected_count = SignOff.objects.filter(decision='reject').count()

    ward_risk = (
        MealPlan.objects
        .values('patient__ward')
        .annotate(
            high=Count('id', filter=Q(decision_trace__risk_tier='High')),
            medium=Count('id', filter=Q(decision_trace__risk_tier='Medium')),
            low=Count('id', filter=Q(decision_trace__risk_tier='Low')),
        )
        .order_by('patient__ward')
    )

    avg_score = DecisionTrace.objects.aggregate(avg=Avg('risk_score'))['avg'] or 0

    low_confidence = IngredientConfidence.objects.filter(
        confidence_score__lt=0.5
    ).select_related('ingredient').values('ingredient__name', 'confidence_score')

    return Response({
        'risk_distribution': list(risk_dist),
        'override_count': override_count,
        'rejected_count': rejected_count,
        'ward_risk': list(ward_risk),
        'avg_risk_score': round(avg_score, 3),
        'low_confidence_ingredients': list(low_confidence),
        'total_meal_plans': MealPlan.objects.count(),
        'total_patients': Patient.objects.count(),
        'total_orders': Order.objects.count(),
    })


@api_view(['GET', 'POST'])
@permission_classes([AnyStaffPerm])
def evaluate_diet_constraints_view(request):
    """
    Step 1 & Step 2 Reference Table and Composition Engine Endpoint.
    GET: returns reference table and viva demo case
    POST: accepts diagnoses list or comma-separated text, returns resolved constraints and reasoning
    """
    from portal.diet_constraints import (
        DIAGNOSIS_CONSTRAINTS_TABLE, compose_diet_constraints,
        evaluate_patient_diagnoses_text
    )
    if request.method == 'GET':
        demo_constraints, demo_logs = compose_diet_constraints(
            ["Chronic Kidney Disease", "Post-Cardiac Surgery"]
        )
        return Response({
            'reference_table': DIAGNOSIS_CONSTRAINTS_TABLE,
            'viva_demo_case': {
                'diagnoses': ["Chronic Kidney Disease", "Post-Cardiac Surgery"],
                'constraints': demo_constraints,
                'explanation_log': demo_logs,
                'rationale': (
                    "When two diagnoses give contradictory nutrient requirements with equal clinical priority, "
                    "the system deliberately does not guess — it defaults to the safe baseline and flags it for the dietitian, "
                    "because silently picking one chronic condition over another without clinical judgment is exactly "
                    "the kind of hidden decision a healthcare system should never make automatically."
                ),
            }
        })

    # POST
    diagnoses = request.data.get('diagnoses')
    diagnosis_text = request.data.get('diagnosis')
    if diagnoses and isinstance(diagnoses, list):
        constraints, logs = compose_diet_constraints(diagnoses)
    elif diagnosis_text:
        constraints, logs = evaluate_patient_diagnoses_text(diagnosis_text)
    else:
        return Response({'detail': 'Provide diagnoses list or diagnosis string'}, status=400)

    return Response({
        'constraints': constraints,
        'explanation_log': logs,
    })


@api_view(['GET', 'POST'])
@permission_classes([permissions.IsAuthenticated])
def meal_sessions_view(request):
    """
    Session timing, live countdown, and transition endpoint.
    GET: returns current session status, remaining time, next session details.
    POST: allows switching or simulating session for demo / testing.
    """
    from portal.meal_sessions import get_current_session_info
    simulated_slot = request.data.get('slot') if request.method == 'POST' else request.query_params.get('slot')
    data = get_current_session_info(simulated_slot=simulated_slot)
    return Response(data)


# ───────────────────────────────────────────────────────────────────────────
# Notifications
# ───────────────────────────────────────────────────────────────────────────

class NotificationViewSet(viewsets.ReadOnlyModelViewSet):
    """
    Endpoints:
      GET  /api/notifications/              — list own notifications (newest first, paginated)
      GET  /api/notifications/unread_count/ — { count: N }  (polled every 30 s by frontend)
      POST /api/notifications/{id}/mark_read/    — mark single notification read
      POST /api/notifications/mark_all_read/     — mark ALL notifications read
    """
    serializer_class = NotificationSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        """Each user sees only their own notifications."""
        return Notification.objects.filter(recipient=self.request.user)

    @action(detail=False, methods=['get'], url_path='unread_count')
    def unread_count(self, request):
        """Lightweight endpoint polled every 30 s for the bell badge."""
        count = Notification.objects.filter(recipient=request.user, is_read=False).count()
        return Response({'count': count})

    @action(detail=True, methods=['post'], url_path='mark_read')
    def mark_read(self, request, pk=None):
        """Mark a single notification as read."""
        notif = self.get_object()
        if not notif.is_read:
            notif.is_read = True
            notif.save(update_fields=['is_read'])
        return Response({'status': 'ok'})

    @action(detail=False, methods=['post'], url_path='mark_all_read')
    def mark_all_read(self, request):
        """Mark ALL unread notifications for this user as read."""
        updated = Notification.objects.filter(
            recipient=request.user, is_read=False
        ).update(is_read=True)
        return Response({'marked': updated})
