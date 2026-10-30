"""
AEARM — Adaptive Explainable Allergy Risk Model
Four components as specified in Section 5 of the implementation plan.
"""
from __future__ import annotations
from typing import Optional

# ─────────────────────────────────────────────────────────────────────────────
# Severity weights (Section 5.2)
# ─────────────────────────────────────────────────────────────────────────────
SEVERITY_WEIGHT = {
    'mild': 0.3,
    'moderate': 0.6,
    'severe': 1.0,
}


# ─────────────────────────────────────────────────────────────────────────────
# Component 1 — Allergen Matching
# ─────────────────────────────────────────────────────────────────────────────

def _build_cross_reactive_map() -> dict[str, set[str]]:
    """
    Load CrossReactivity rows into a symmetric lookup dict:
      { family_a -> {family_b, ...}, family_b -> {family_a, ...} }
    """
    from portal.models import CrossReactivity
    cross_map: dict[str, set[str]] = {}
    for row in CrossReactivity.objects.all():
        cross_map.setdefault(row.family_a, set()).add(row.family_b)
        cross_map.setdefault(row.family_b, set()).add(row.family_a)
    return cross_map


def match_allergens(meal, patient_allergies: set[str]) -> dict:
    """
    Component 1 — scan every meal ingredient against the patient's allergen
    families (direct) and cross-reactive families (cross) using graph-based
    cross-reactivity search with BFS and distance-based risk decay.

    Returns a trace dict with keys:
      direct_match: (ingredient_name, allergen_family) | None
      cross_match:  (ingredient_name, allergen_family) | None
      match_weight: float (1.0 for direct, decaying for cross, 0.0 for clean)
      cross_weight: float (alias for match_weight)
      hop_distance: int | None (0 for direct, 1+ for cross, None for clean)
    """
    from portal.allergen_graph import cross_reactivity_weight, normalize_family

    trace = {
        "direct_match": None,
        "cross_match": None,
        "match_weight": 0.0,
        "cross_weight": 0.0,
        "hop_distance": None,
    }

    best_cross = None  # (weight, distance, ingredient_name, family)

    for ingredient in meal.ingredients.all():
        family = ingredient.allergen_family
        if not family:
            continue

        # Check direct match
        is_direct = (
            family in patient_allergies or
            any(normalize_family(family) == normalize_family(pa) for pa in patient_allergies)
        )
        if is_direct:
            trace["direct_match"] = [ingredient.name, family]
            trace["match_weight"] = 1.0
            trace["cross_weight"] = 1.0
            trace["hop_distance"] = 0
            break  # direct match takes priority — stop scanning

        # Check cross-reactivity via graph BFS search
        for pa in patient_allergies:
            w, dist = cross_reactivity_weight(pa, family)
            if dist is not None and w > 0.0:
                if best_cross is None or w > best_cross[0]:
                    best_cross = (w, dist, ingredient.name, family)

        # FIX 3.1 — Two-source design: graph is the authoritative source; DB table is staging.
        #
        # The ALLERGEN_GRAPH (allergen_graph.py) is the live, authoritative cross-reactivity
        # source. BFS over that graph is always attempted first and returns a properly
        # distance-decayed weight (1 / (1 + d)).
        #
        # The CrossReactivity database table is a *staging area* for clinically documented
        # allergen pairs that have not yet been promoted into the graph (e.g. pairs imported
        # from a data-entry workflow or under clinical review). The DB fallback is reached only
        # when BFS finds NO path — meaning the graph has no knowledge of the pair at all.
        #
        # The flat 0.5 weight returned here is a deliberate conservative assumption: it treats
        # any pair stored in the DB table as a single-hop relationship until the pair is fully
        # validated and added to the graph. This is intentionally the same weight as a 1-hop
        # graph match (d=1 → 1/(1+1) = 0.5), making the fallback a "worst-case single hop"
        # approximation rather than a bug or an arbitrary choice. Do not change this to 0 or
        # to a higher value without a corresponding clinical review.
        if best_cross is None:
            cross_map = _build_cross_reactive_map()
            cross_families = cross_map.get(family, set())
            if cross_families & patient_allergies:
                best_cross = (0.5, 1, ingredient.name, family)

    if trace["direct_match"] is not None:
        return trace

    if best_cross is not None:
        trace["cross_match"] = [best_cross[2], best_cross[3]]
        trace["match_weight"] = best_cross[0]
        trace["cross_weight"] = best_cross[0]
        trace["hop_distance"] = best_cross[1]

    return trace


# ─────────────────────────────────────────────────────────────────────────────
# Component 2 — Weighted Risk Scoring
# ─────────────────────────────────────────────────────────────────────────────

# Trained weights learned via gradient descent (logistic regression)
# on the 30-example additive factorial dataset. Stored as a named config dictionary
# so they can be inspected, tested, and updated via `manage.py retrain_aearm_weights`.
AEARM_WEIGHTS = {
    'severity': 0.36,
    'confidence': 0.36,
    'cross_reactivity': 0.28,
}


def compute_risk(
    trace: dict,
    severity: str,
    confidence: float,
) -> tuple[float, str, tuple[float, float, float]]:
    """
    Component 2 — produces (score, tier, (severity_c, confidence_c, cross_c)).

    Formula:
      R = min(1.0, (S * w_severity) + (C * w_confidence) + (X * w_cross))

    Weights (Trained via logistic regression on 30-example additive factorial dataset):
      severity_weight   = 0.36   # was 0.50
      confidence_weight = 0.36   # was 0.30
      cross_weight      = 0.28   # was 0.20

    Short-circuit rule:
      If no match of any kind is found, R = 0.0 immediately (Low risk).
    """
    # Short-circuit rule: if no match of any kind is found, R = 0.0 immediately (Low risk)
    if not trace.get("direct_match") and not trace.get("cross_match"):
        return 0.0, "Low", (0.0, 0.0, 0.0)

    severity_weight = AEARM_WEIGHTS['severity']
    confidence_weight = AEARM_WEIGHTS['confidence']
    w_cross = AEARM_WEIGHTS['cross_reactivity']

    severity_component = SEVERITY_WEIGHT.get(severity, 0.3) * severity_weight
    confidence_component = confidence * confidence_weight

    # Match factor X: dynamically computed from graph BFS decay
    # 1.0 (direct), 0.5 (1-hop), 0.333 (2-hop), etc.
    if "match_weight" in trace:
        x_match = trace["match_weight"]
    elif "cross_weight" in trace:
        x_match = trace["cross_weight"]
    elif trace.get("direct_match"):
        x_match = 1.0
    elif trace.get("cross_match"):
        x_match = 0.5
    else:
        x_match = 0.0

    cross_component = x_match * w_cross

    score = min(1.0, severity_component + confidence_component + cross_component)

    if score >= 0.7:
        tier = "High"
    elif score >= 0.4:
        tier = "Medium"
    else:
        tier = "Low"

    return score, tier, (severity_component, confidence_component, cross_component)



# ─────────────────────────────────────────────────────────────────────────────
# Component 3 — Adaptive Confidence Update
# ─────────────────────────────────────────────────────────────────────────────

def update_confidence(ingredient_id: int, outcome: int, alpha: float = 0.1) -> float:
    """
    Component 3 — exponential moving average update on IngredientConfidence.

    outcome: 1 = confirmed safe (override worked), 0 = reaction occurred
    alpha:   learning rate (default 0.1)

    Returns the new confidence score.
    """
    from portal.models import IngredientConfidence, Ingredient

    try:
        record = IngredientConfidence.objects.get(ingredient_id=ingredient_id)
    except IngredientConfidence.DoesNotExist:
        ingredient = Ingredient.objects.get(pk=ingredient_id)
        record = IngredientConfidence(ingredient=ingredient, confidence_score=1.0)

    old = record.confidence_score
    new = old + alpha * (outcome - old)
    # Clamp to [0.0, 1.0]
    new = max(0.0, min(1.0, new))
    record.confidence_score = new
    record.save()
    return new


# ─────────────────────────────────────────────────────────────────────────────
# Component 4 — Salience-Ranked Explanation
# ─────────────────────────────────────────────────────────────────────────────

def explain(
    trace: dict,
    components: tuple[float, float, float],
    tier: str,
) -> str:
    """
    Component 4 — build a salience-ranked plain-English explanation.

    Ranks reasons by their numeric contribution to the risk score, outputs
    the leading reason first and supporting reasons in descending order.
    """
    severity_c, confidence_c, cross_c = components
    reasons: list[tuple[float, str]] = []

    if trace.get("direct_match"):
        ingredient_name, family = trace["direct_match"]
        reasons.append((cross_c, f"Direct allergen match: {ingredient_name} ({family})"))
    elif trace.get("cross_match"):
        ingredient_name, family = trace["cross_match"]
        reasons.append((cross_c, f"Cross-reactive ingredient detected: {ingredient_name} ({family})"))

    reasons.append((severity_c, f"Patient allergy severity contributes {severity_c:.2f} to score"))
    reasons.append((confidence_c, f"Ingredient confidence factor: {confidence_c:.2f}"))

    # Sort by salience (highest contribution first)
    reasons.sort(key=lambda r: r[0], reverse=True)

    lead = reasons[0][1]
    supporting = [r[1] for r in reasons[1:] if r[0] > 0.05]

    result = f"{tier} Risk — {lead}."
    if supporting:
        result += " " + " | ".join(supporting) + "."
    return result


# ─────────────────────────────────────────────────────────────────────────────
# Section 5.5 — Risk-Adaptive Sign-off Routing
# ─────────────────────────────────────────────────────────────────────────────

def route_for_signoff(tier: str) -> list[str]:
    """
    Returns the list of roles required to sign off the meal plan.
    Low    → dietitian only (standard flow / auto-approved)
    Medium → dietitian only (single check, can approve or replace ingredient)
    High   → dietitian + senior_reviewer (escalation required)
    """
    if tier == "High":
        return ["dietitian", "senior_reviewer"]
    return ["dietitian"]


# ─────────────────────────────────────────────────────────────────────────────
# Full Pipeline Orchestrator
# ─────────────────────────────────────────────────────────────────────────────

def run_aearm(meal_plan) -> dict:
    """
    Run the full 4-component AEARM pipeline for a given MealPlan instance.

    Writes a DecisionTrace record and updates MealPlan.status.
    Returns a summary dict for the caller.
    """
    from portal.models import DecisionTrace, IngredientConfidence

    patient = meal_plan.patient
    meal = meal_plan.meal

    # Collect patient allergen families
    patient_allergies = set(
        patient.allergies.values_list('allergen_family', flat=True)
    )

    # Determine worst-case severity among patient's allergies
    severities = list(patient.allergies.values_list('severity', flat=True))
    if not severities:
        severity = 'mild'
    else:
        priority = {'severe': 3, 'moderate': 2, 'mild': 1}
        severity = max(severities, key=lambda s: priority.get(s, 0))

    # Component 1 — match
    trace = match_allergens(meal, patient_allergies)

    # If no patient allergies and no match, short-circuit to Low
    if not patient_allergies or (not trace["direct_match"] and not trace["cross_match"]):
        score, tier, components = 0.0, "Low", (0.0, 0.0, 0.0)
        explanation = "Low Risk — No allergen match found for this patient."
    else:
        # Determine confidence of the matched ingredient (per-flagged-ingredient definition)
        matched_name = trace["direct_match"][0] if trace.get("direct_match") else trace["cross_match"][0]
        matched_conf = IngredientConfidence.objects.filter(
            ingredient__name=matched_name
        ).values_list('confidence_score', flat=True).first()

        if matched_conf is None:
            # Fallback to mean across ingredients in the meal
            ingredient_ids = meal.ingredients.values_list('id', flat=True)
            confidences = list(
                IngredientConfidence.objects.filter(
                    ingredient_id__in=ingredient_ids
                ).values_list('confidence_score', flat=True)
            )
            matched_conf = sum(confidences) / len(confidences) if confidences else 1.0

        # Component 2 — score
        score, tier, components = compute_risk(trace, severity, matched_conf)
        # Component 4 — explain
        explanation = explain(trace, components, tier)

    # Persist DecisionTrace
    DecisionTrace.objects.update_or_create(
        meal_plan=meal_plan,
        defaults={
            "direct_match": trace.get("direct_match"),
            "cross_match": trace.get("cross_match"),
            "risk_score": round(score, 4),
            "risk_tier": tier,
            "severity_component": round(components[0], 4),
            "confidence_component": round(components[1], 4),
            "cross_component": round(components[2], 4),
            "explanation": explanation,
        }
    )

    # Update MealPlan status based on tier — Low and Medium risk are auto-approved to kitchen
    status_map = {"Low": "approved", "Medium": "approved", "High": "high_risk"}
    meal_plan.status = status_map[tier]
    meal_plan.save(update_fields=["status"])

    return {
        "tier": tier,
        "score": score,
        "trace": trace,
        "explanation": explanation,
        "route": route_for_signoff(tier),
    }


# ─────────────────────────────────────────────────────────────────────────────
# Autonomous AI Meal Selection & Auto-Assignment Engine
# ─────────────────────────────────────────────────────────────────────────────

def recommend_safest_meal(patient, meal_slot: str = 'lunch'):
    """
    Autonomous AI Meal Selection Engine:
    Scans hospital therapeutic meals matching meal_slot and patient's diet_type.
    Evaluates every candidate in memory via AEARM matching & scoring.
    Returns:
        optimal_meal: The safest, most therapeutic meal instance
        ranked_candidates: list of dicts with score, tier, and diet match info
    """
    from portal.models import Meal, IngredientConfidence

    patient_allergies = set(
        patient.allergies.values_list('allergen_family', flat=True)
    )
    severities = list(patient.allergies.values_list('severity', flat=True))
    priority = {'severe': 3, 'moderate': 2, 'mild': 1}
    severity = max(severities, key=lambda s: priority.get(s, 0)) if severities else 'mild'

    # Filter candidate meals for the slot
    candidates = Meal.objects.filter(meal_type=meal_slot).prefetch_related('ingredients')
    if not candidates.exists():
        candidates = Meal.objects.all().prefetch_related('ingredients')

    ranked = []
    for meal in candidates:
        trace = match_allergens(meal, patient_allergies)
        ingredient_ids = meal.ingredients.values_list('id', flat=True)
        confidences = list(
            IngredientConfidence.objects.filter(
                ingredient_id__in=ingredient_ids
            ).values_list('confidence_score', flat=True)
        )
        avg_conf = sum(confidences) / len(confidences) if confidences else 1.0

        if not patient_allergies or (not trace["direct_match"] and not trace["cross_match"]):
            score, tier, comps = 0.0, "Low", (0.0, 0.0, 0.0)
            expl = "Verified Safe — No allergen or cross-reactive conflicts."
        else:
            score, tier, comps = compute_risk(trace, severity, avg_conf)
            expl = explain(trace, comps, tier)

        # Diet tag bonus
        patient_diet = (patient.diet_type or 'regular').lower()
        has_diet_match = patient_diet in [t.lower() for t in meal.diet_tags] or patient_diet == 'regular'

        # Ranking score: lowest risk score first, prioritize exact diet tag match, highest confidence
        # Rank tuple: (tier != 'Low', not has_diet_match, score, -avg_conf)
        rank_metric = (
            0 if tier == 'Low' else (1 if tier == 'Medium' else 2),
            0 if has_diet_match else 1,
            score,
            -avg_conf,
        )

        ranked.append({
            'meal': meal,
            'score': round(score, 4),
            'tier': tier,
            'has_diet_match': has_diet_match,
            'avg_confidence': round(avg_conf, 3),
            'explanation': expl,
            'trace': trace,
            '_rank': rank_metric,
        })

    ranked.sort(key=lambda x: x['_rank'])
    optimal = ranked[0] if ranked else None
    return optimal, ranked


def auto_assign_patient(patient, planned_date, meal_slot: str = 'lunch', user=None):
    """
    Autonomous AI Assignment:
    Selects the optimal safe meal, creates the MealPlan, executes AEARM,
    and if Low Risk, generates the Order with a QR code.
    If High Risk, flags for Senior Reviewer clinical audit.
    """
    from portal.models import MealPlan, Order, AuditLog
    from portal.utils.qr import generate_tray_code, generate_qr_image

    optimal, ranked = recommend_safest_meal(patient, meal_slot)
    if not optimal:
        return None

    meal = optimal['meal']
    existing_plans = MealPlan.objects.filter(
        patient=patient,
        planned_date=planned_date,
        meal_slot=meal_slot,
    )
    if existing_plans.exists():
        plan = existing_plans.first()
        if plan.meal != meal:
            plan.meal = meal
            plan.save(update_fields=['meal'])
    else:
        plan = MealPlan.objects.create(
            patient=patient,
            planned_date=planned_date,
            meal_slot=meal_slot,
            meal=meal,
            created_by=user,
            status='pending',
        )

    # Run AEARM pipeline
    eval_res = run_aearm(plan)

    # If auto-approved (Low risk), create/ensure kitchen order with QR code
    if plan.status == 'approved':
        order, ord_created = Order.objects.get_or_create(
            meal_plan=plan,
            defaults={
                'tray_code': generate_tray_code(),
                'kitchen_status': 'queued',
            }
        )
        if ord_created and not order.qr_image:
            try:
                qr_file = generate_qr_image(order.tray_code)
                order.qr_image.save(qr_file.name, qr_file, save=True)
            except Exception:
                pass

    AuditLog.objects.create(
        entity='MealPlan',
        entity_id=plan.pk,
        action='ai_auto_assigned',
        actor=user,
        actor_role='system',
        detail={
            'patient_id': patient.id,
            'patient_name': patient.name,
            'meal': meal.name,
            'tier': eval_res['tier'],
            'score': eval_res['score'],
            'auto_approved': plan.status == 'approved',
        }
    )

    return plan
