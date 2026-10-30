"""
notify() — central helper for creating in-app Notifications.

Usage:
  # Target a specific user
  notify(user_instance, 'Title', 'Message body', category='meal_plan', link='/clinical/audit-queue')

  # Target ALL users with a given role ('doctor', 'dietitian', 'kitchen', 'patient', 'admin')
  notify('kitchen', 'New Order', 'Tray #ABC001 queued', category='kitchen', link='/kitchen/orders')

Design note: All notifications are written synchronously during the request
that triggers them. No Celery/Redis required — this is intentional to stay
within the FYP's zero-infrastructure constraint.
"""
from django.contrib.auth.models import User, Group


def notify(
    recipient_or_role,
    title,
    message,
    category='system',
    link='',
    related_entity='',
    related_id=None,
):
    """
    Create one or more Notification rows.

    Args:
        recipient_or_role: A User instance  → single notification for that user.
                           A str (role name) → one notification per user in that group.
        title:             Short summary (≤ 200 chars).
        message:           Full explanatory text.
        category:          One of the CATEGORY_CHOICES keys: 'patient', 'meal_plan',
                           'sign_off', 'kitchen', 'feedback', 'request', 'system'.
        link:              Frontend route to navigate to when the notification is clicked,
                           e.g. '/clinical/audit-queue' or '/kitchen/orders'.
        related_entity:    Model name string, e.g. 'MealPlan', 'Order'. Optional.
        related_id:        PK of the related object. Optional.

    Returns:
        List of created Notification instances.
    """
    # Late import to avoid circular dependencies at module load time
    from portal.models import Notification

    # Resolve recipients
    if isinstance(recipient_or_role, User):
        recipients = [recipient_or_role]
    elif isinstance(recipient_or_role, str):
        try:
            group = Group.objects.get(name=recipient_or_role)
            recipients = list(group.user_set.all())
        except Group.DoesNotExist:
            recipients = []
    else:
        # Fallback: if iterable of users was passed
        try:
            recipients = list(recipient_or_role)
        except TypeError:
            recipients = []

    if not recipients:
        return []

    # Bulk-create for efficiency when targeting a whole role group
    notifications = [
        Notification(
            recipient=user,
            category=category,
            title=title,
            message=message,
            link=link,
            is_read=False,
            related_entity=related_entity,
            related_id=related_id,
        )
        for user in recipients
    ]

    return Notification.objects.bulk_create(notifications)
