"""
Post-save signals:
  MealPlan  -> run AEARM pipeline -> write DecisionTrace
  SignOff   -> run update_confidence for each matching ingredient
  MealPlan (approved) -> auto-create Order with tray QR code

  NOTIFICATION TRIGGERS (added Oct 2026):
  MealPlan            -> medium_risk / high_risk / approved / rejected
                         -> notify Dietitian / Kitchen / Patient
  Order               -> dispatched -> notify Patient
  PatientFeedback     -> created -> notify Dietitians
  PatientChangeRequest -> created -> notify Doctors
                          -> approved/rejected -> notify Patient
  DeliveryLog         -> mismatch/missing -> notify Kitchen + Admin
"""
from django.db.models.signals import post_save
from django.dispatch import receiver
from django.db import transaction


@receiver(post_save, sender='portal.MealPlan')
def on_meal_plan_saved(sender, instance, created, **kwargs):
    """Trigger AEARM pipeline when a MealPlan is first created or re-edited."""
    from portal.aearm import run_aearm
    from portal.models import Order, AuditLog
    from portal.utils.qr import generate_tray_code, generate_qr_image
    from portal.notifications import notify

    # Run AEARM only on newly created plans or plans still in pending state
    if created or instance.status == 'pending':
        transaction.on_commit(lambda: run_aearm(instance))

    # ---- Notifications based on status --------------------------------
    patient_name = instance.patient.name
    meal_name    = instance.meal.name
    plan_date    = str(instance.planned_date)
    slot         = instance.meal_slot

    if instance.status == 'medium_risk':
        notify(
            'dietitian',
            'Medium-Risk Plan — ' + patient_name,
            'Meal "' + meal_name + '" (' + slot + ' on ' + plan_date + ') scored Medium risk. '
            'Please review and sign off in the audit queue.',
            category='sign_off',
            link='/clinical/audit-queue',
            related_entity='MealPlan',
            related_id=instance.pk,
        )

    elif instance.status == 'high_risk':
        notify(
            'dietitian',
            'HIGH-RISK Escalation — ' + patient_name,
            'Meal "' + meal_name + '" (' + slot + ' on ' + plan_date + ') scored HIGH risk. '
            'A mandatory written clinical justification is required before approval.',
            category='sign_off',
            link='/clinical/audit-queue',
            related_entity='MealPlan',
            related_id=instance.pk,
        )
        notify(
            'admin',
            'High-Risk Meal Flagged — ' + patient_name,
            'AEARM flagged meal "' + meal_name + '" as HIGH risk for ' + patient_name +
            ' (' + slot + ', ' + plan_date + '). Escalated to dietitian for mandatory review.',
            category='system',
            link='/admin/audit',
            related_entity='MealPlan',
            related_id=instance.pk,
        )

    elif instance.status == 'approved':
        # Notify the patient (only if they have a linked user account)
        try:
            patient_user = instance.patient.user
            if patient_user:
                notify(
                    patient_user,
                    'Your meal is approved!',
                    'Your ' + slot + ' on ' + plan_date + ' ("' + meal_name + '") has been approved '
                    'by the clinical team and will be prepared shortly.',
                    category='meal_plan',
                    link='/patient/menu',
                    related_entity='MealPlan',
                    related_id=instance.pk,
                )
        except Exception:
            pass

    elif instance.status == 'rejected':
        try:
            patient_user = instance.patient.user
            if patient_user:
                notify(
                    patient_user,
                    'Meal Plan Updated',
                    'Your ' + slot + ' plan for ' + plan_date + ' has been revised by the clinical team. '
                    'A safer alternative meal will be assigned shortly.',
                    category='meal_plan',
                    link='/patient/menu',
                    related_entity='MealPlan',
                    related_id=instance.pk,
                )
        except Exception:
            pass

    # Auto-create Order when plan reaches 'approved' status
    if instance.status == 'approved' and not hasattr(instance, '_order_created'):
        instance._order_created = True  # prevent re-entry
        if not Order.objects.filter(meal_plan=instance).exists():
            tray_code = generate_tray_code()
            qr_file = generate_qr_image(tray_code)
            order = Order(meal_plan=instance, tray_code=tray_code)
            order.qr_image.save(qr_file.name, qr_file, save=True)

            AuditLog.objects.create(
                entity='Order',
                entity_id=order.pk,
                action='auto_created_on_approval',
                actor=instance.created_by,
                actor_role='system',
                detail={'tray_code': tray_code},
            )

            # Notify kitchen staff about the new order
            notify(
                'kitchen',
                'New Order — Ward ' + instance.patient.ward,
                'Tray #' + tray_code + ' created for ' + patient_name +
                ' (Bed ' + instance.patient.bed_no + '). '
                'Meal: "' + meal_name + '" (' + slot + ').',
                category='kitchen',
                link='/kitchen/orders',
                related_entity='Order',
                related_id=order.pk,
            )


@receiver(post_save, sender='portal.SignOff')
def on_sign_off_saved(sender, instance, created, **kwargs):
    """
    After a SignOff is recorded:
    1. Update the associated MealPlan status ('approved' or 'rejected').
    2. If approved, trigger Order generation.
    3. If an outcome is recorded (1=safe, 0=reaction), run Component 3 adaptive confidence update.
    """
    if not created:
        return

    from portal.aearm import update_confidence
    from portal.models import AuditLog, Order
    from portal.utils.qr import generate_tray_code, generate_qr_image
    from portal.notifications import notify

    meal_plan = instance.meal_plan

    # 1. Update MealPlan status based on decision
    if instance.decision == 'approve':
        meal_plan.status = 'approved'
    else:
        meal_plan.status = 'rejected'
    meal_plan.save(update_fields=['status'])

    # 2. Auto-create Order with tray QR code on approval if not already created
    if meal_plan.status == 'approved' and not Order.objects.filter(meal_plan=meal_plan).exists():
        tray_code = generate_tray_code()
        qr_file = generate_qr_image(tray_code)
        order = Order(meal_plan=meal_plan, tray_code=tray_code)
        order.qr_image.save(qr_file.name, qr_file, save=True)

        AuditLog.objects.create(
            entity='Order',
            entity_id=order.pk,
            action='auto_created_on_approval',
            actor=instance.reviewer,
            actor_role=instance.reviewer_role or 'dietitian',
            detail={'tray_code': tray_code, 'sign_off_id': instance.pk},
        )

        # Notify kitchen of new order
        notify(
            'kitchen',
            'New Order — Ward ' + meal_plan.patient.ward,
            'Tray #' + tray_code + ' created for ' + meal_plan.patient.name +
            ' (Bed ' + meal_plan.patient.bed_no + '). '
            'Meal: "' + meal_plan.meal.name + '" (' + meal_plan.meal_slot + ').',
            category='kitchen',
            link='/kitchen/orders',
            related_entity='Order',
            related_id=order.pk,
        )

    # 3. If outcome is provided, run Component 3 adaptive confidence update
    if instance.outcome is not None:
        try:
            trace = meal_plan.decision_trace
        except Exception:
            trace = None

        if trace:
            matched_names = []
            if trace.direct_match:
                matched_names.append(trace.direct_match[0])
            if trace.cross_match:
                matched_names.append(trace.cross_match[0])

            for name in matched_names:
                from portal.models import Ingredient
                for ing in Ingredient.objects.filter(name=name):
                    new_score = update_confidence(ing.pk, instance.outcome)
                    AuditLog.objects.create(
                        entity='IngredientConfidence',
                        entity_id=ing.pk,
                        action='confidence_updated',
                        actor=instance.reviewer,
                        actor_role=instance.reviewer_role,
                        detail={
                            'ingredient': name,
                            'outcome': instance.outcome,
                            'new_confidence': new_score,
                        },
                    )


@receiver(post_save, sender='portal.Order')
def on_order_saved(sender, instance, created, **kwargs):
    """Notify patient when their tray is dispatched."""
    if created:
        return  # Only react to status updates, not creation (creation handled above)

    from portal.notifications import notify

    if instance.kitchen_status == 'dispatched':
        try:
            patient_user = instance.meal_plan.patient.user
            if patient_user:
                notify(
                    patient_user,
                    'Your tray is on the way!',
                    'Tray #' + instance.tray_code + ' has been dispatched from the kitchen. '
                    'It should arrive at Ward ' + instance.meal_plan.patient.ward +
                    ', Bed ' + instance.meal_plan.patient.bed_no + ' shortly.',
                    category='kitchen',
                    link='/patient/dashboard',
                    related_entity='Order',
                    related_id=instance.pk,
                )
        except Exception:
            pass


@receiver(post_save, sender='portal.PatientFeedback')
def on_feedback_submitted(sender, instance, created, **kwargs):
    """Notify all dietitians when a patient submits meal feedback."""
    if not created:
        return

    from portal.notifications import notify

    tolerance_label = {
        'tolerated_well':  'Tolerated Well',
        'mild_discomfort': 'Mild Discomfort',
        'adverse_reaction': 'Adverse Reaction',
    }.get(instance.tolerance_status, instance.tolerance_status)

    comment_part = ('Comment: ' + instance.comments) if instance.comments else ''

    notify(
        'dietitian',
        'Feedback — ' + instance.patient.name,
        instance.patient.name + ' rated their meal ' + str(instance.rating) + ' stars '
        '(' + instance.taste_rating + '). Tolerance: ' + tolerance_label + '. ' + comment_part,
        category='feedback',
        link='/clinical/feedback',
        related_entity='PatientFeedback',
        related_id=instance.pk,
    )

    # If adverse reaction -- also alert admin
    if instance.tolerance_status == 'adverse_reaction':
        notify(
            'admin',
            'Adverse Reaction Reported — ' + instance.patient.name,
            'Patient ' + instance.patient.name + ' reported an adverse reaction after a meal. '
            'Dietitian review is required. Check Patient Feedback for details.',
            category='system',
            link='/admin/audit',
            related_entity='PatientFeedback',
            related_id=instance.pk,
        )


@receiver(post_save, sender='portal.PatientChangeRequest')
def on_change_request_saved(sender, instance, created, **kwargs):
    """
    - On creation  -> notify all doctors.
    - On status update -> notify the patient if they have a linked user account.
    """
    from portal.notifications import notify

    if created:
        category_label = dict(instance.CATEGORY_CHOICES).get(instance.category, instance.category)
        notify(
            'doctor',
            'Patient Request — ' + instance.patient.name,
            instance.patient.name + ' submitted a change request: "' + category_label + '". '
            'Please review and respond in the Patients section.',
            category='request',
            link='/doctor/patients',
            related_entity='PatientChangeRequest',
            related_id=instance.pk,
        )
    else:
        # Status update -- inform the patient
        if instance.status in ('approved', 'rejected', 'resolved'):
            try:
                patient_user = instance.patient.user
                if patient_user:
                    status_label = {
                        'approved': 'approved',
                        'rejected': 'declined',
                        'resolved': 'reviewed and resolved',
                    }.get(instance.status, instance.status)
                    doctor_note = ('Doctor note: ' + instance.doctor_response) if instance.doctor_response else ''
                    notify(
                        patient_user,
                        'Your Request Has Been ' + instance.status.capitalize(),
                        'Your change request has been ' + status_label + ' by your doctor. ' + doctor_note,
                        category='request',
                        link='/patient/dashboard',
                        related_entity='PatientChangeRequest',
                        related_id=instance.pk,
                    )
            except Exception:
                pass


@receiver(post_save, sender='portal.DeliveryLog')
def on_delivery_log_saved(sender, instance, created, **kwargs):
    """Notify kitchen staff and admin about scan mismatches or missing trays."""
    if not created:
        return

    from portal.notifications import notify

    if instance.scan_result in ('mismatch', 'missing'):
        issue     = 'Mismatch' if instance.scan_result == 'mismatch' else 'Missing Tray'
        tray_code = instance.order.tray_code
        cart_id   = instance.cart_id

        notify(
            'kitchen',
            'Scan ' + issue + ' — Tray #' + tray_code,
            'Cart ' + cart_id + ' scan result: ' + instance.scan_result.upper() +
            ' for tray #' + tray_code +
            ' (' + instance.order.meal_plan.patient.name + '). '
            'Please verify the cart contents.',
            category='kitchen',
            link='/kitchen/orders',
            related_entity='DeliveryLog',
            related_id=instance.pk,
        )
        notify(
            'admin',
            'Delivery ' + issue + ' — Cart ' + cart_id,
            'Batch scan detected ' + instance.scan_result + ' for tray #' + tray_code +
            ' on cart ' + cart_id + '. '
            'Kitchen has been alerted. Check the Delivery Log for details.',
            category='system',
            link='/admin/delivery',
            related_entity='DeliveryLog',
            related_id=instance.pk,
        )
