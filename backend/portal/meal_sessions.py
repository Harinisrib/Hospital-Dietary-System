"""
Hospital Dietary Department Meal Sessions & Timing Engine.
Manages Morning (Breakfast), Lunch, and Dinner time windows, live countdowns,
and automatic transition/rollover to the next session.
"""
from datetime import datetime, time, date, timedelta
from django.utils import timezone

MEAL_SESSIONS_CONFIG = [
    {
        'id': 'morning',
        'slot': 'breakfast',
        'name': 'Morning Breakfast Session',
        'short_name': 'Morning',
        'icon': '🌅',
        'color': '#f59e0b',
        'start_time': '06:00',
        'service_start': '07:30',
        'service_end': '10:30',
        'cutoff_time': '10:30',
        'description': 'Therapeutic Morning Nutrition, Breakfast Trays & Morning Vitals Hydration',
        'prep_target': 'Breakfast Trays & Morning Diets',
    },
    {
        'id': 'lunch',
        'slot': 'lunch',
        'name': 'Afternoon Lunch Session',
        'short_name': 'Lunch',
        'icon': '☀️',
        'color': '#10b981',
        'start_time': '10:30',
        'service_start': '12:00',
        'service_end': '15:00',
        'cutoff_time': '15:00',
        'description': 'Full Inpatient Dietary Lunch Service, Caloric & Low-Sodium Meal Delivery',
        'prep_target': 'Lunch Trays & Inpatient Plated Meals',
    },
    {
        'id': 'dinner',
        'slot': 'dinner',
        'name': 'Evening Dinner Session',
        'short_name': 'Dinner',
        'icon': '🌙',
        'color': '#8b5cf6',
        'start_time': '15:00',
        'service_start': '18:30',
        'service_end': '21:30',
        'cutoff_time': '21:30',
        'description': 'Evening Clinical Dinner Service, Digestible Therapeutic Formulations',
        'prep_target': 'Dinner Trays & Night Clinical Formulations',
    },
]


def _parse_time_str(t_str: str) -> time:
    h, m = map(int, t_str.split(':'))
    return time(hour=h, minute=m)


def get_current_session_info(simulated_slot: str = None) -> dict:
    """
    Computes current session state, time remaining until cutoff,
    next upcoming session, and transition countdown.
    Supports simulated_slot override for viva/demo testing.
    """
    now = timezone.localtime(timezone.now())
    current_time = now.time()
    today_date = now.date()

    # If simulated slot is given, use it as active session
    if simulated_slot in ['breakfast', 'morning']:
        target_idx = 0
    elif simulated_slot in ['lunch']:
        target_idx = 1
    elif simulated_slot in ['dinner']:
        target_idx = 2
    else:
        # Determine naturally from clock
        # Morning: 00:00 - 10:30 (inclusive of early morning prep)
        # Lunch: 10:30 - 15:00
        # Dinner: 15:00 - 21:30
        # Night (21:30 - 23:59): Automatically rolls over and prepares for tomorrow's Morning!
        m_cutoff = _parse_time_str('10:30')
        l_cutoff = _parse_time_str('15:00')
        d_cutoff = _parse_time_str('21:30')

        if current_time < m_cutoff:
            target_idx = 0
        elif current_time < l_cutoff:
            target_idx = 1
        elif current_time < d_cutoff:
            target_idx = 2
        else:
            # Past 21:30 -> Already preparing tomorrow's morning breakfast
            target_idx = 0

    active_cfg = MEAL_SESSIONS_CONFIG[target_idx]
    next_idx = (target_idx + 1) % len(MEAL_SESSIONS_CONFIG)
    next_cfg = MEAL_SESSIONS_CONFIG[next_idx]

    # Calculate countdown to cutoff
    cutoff_t = _parse_time_str(active_cfg['cutoff_time'])
    cutoff_dt = timezone.make_aware(datetime.combine(today_date, cutoff_t))
    if cutoff_dt <= now:
        # If past cutoff today (e.g. late night rolling to tomorrow's morning)
        cutoff_dt += timedelta(days=1)

    diff = cutoff_dt - now
    remaining_secs = max(0, int(diff.total_seconds()))
    hours = remaining_secs // 3600
    minutes = (remaining_secs % 3600) // 60
    seconds = remaining_secs % 60
    countdown_str = f"{hours:02d}h {minutes:02d}m {seconds:02d}s"

    return {
        'server_time': now.strftime('%I:%M:%S %p'),
        'server_date': str(today_date),
        'active_session': {
            'id': active_cfg['id'],
            'slot': active_cfg['slot'],
            'name': active_cfg['name'],
            'short_name': active_cfg['short_name'],
            'icon': active_cfg['icon'],
            'color': active_cfg['color'],
            'start_time': active_cfg['start_time'],
            'service_start': active_cfg['service_start'],
            'service_end': active_cfg['service_end'],
            'cutoff_time': active_cfg['cutoff_time'],
            'description': active_cfg['description'],
            'prep_target': active_cfg['prep_target'],
        },
        'next_session': {
            'id': next_cfg['id'],
            'slot': next_cfg['slot'],
            'name': next_cfg['name'],
            'short_name': next_cfg['short_name'],
            'icon': next_cfg['icon'],
            'color': next_cfg['color'],
            'start_time': next_cfg['start_time'],
            'prep_target': next_cfg['prep_target'],
        },
        'remaining_seconds': remaining_secs,
        'countdown_formatted': countdown_str,
        'is_cutoff_reached': remaining_secs <= 0,
        'all_sessions': MEAL_SESSIONS_CONFIG,
    }
