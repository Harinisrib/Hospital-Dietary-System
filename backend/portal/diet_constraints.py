"""
Dietary Constraints Composition & Conflict Resolution Engine.

Clinical rationale:
When a patient presents with multiple concurrent diagnoses, dietary requirements
frequently pull in opposite directions (e.g. CKD restricting protein to protect renal function
vs. Post-Cardiac Surgery demanding high protein for tissue recovery).

This module implements:
1. Reference Table: Per-diagnosis nutrient constraints with clinical priority tiers:
   - Tier 0: No specific condition (baseline / regular)
   - Tier 1: Chronic / ongoing management
   - Tier 2: Acute / recovery need
2. The composition-and-conflict-resolution algorithm:
   - Direct agreement -> Strictest constraint applied
   - Priority-based conflict resolution -> Acute (Tier 2) takes precedence over Chronic (Tier 1)
   - Priority tie -> Deliberately does NOT guess; defaults to safe baseline ('normal') and flags for dietitian review.
"""

from typing import Any, Dict, List, Tuple


# ─────────────────────────────────────────────────────────────────────────────
# Step 1: Reference Table (Per-Diagnosis Nutrient Constraints)
# ─────────────────────────────────────────────────────────────────────────────

# Strictness hierarchy: 'restricted' is clinically stricter than 'low'
STRICTNESS_RANK = {
    "normal": 0,
    "low": 1,
    "restricted": 2,
    "high": 1,
}

DIRECTION_CATEGORY = {
    "normal": "baseline",
    "low": "restrictive",
    "restricted": "restrictive",
    "high": "elevated",
}

DIAGNOSIS_CONSTRAINTS_TABLE: Dict[str, Dict[str, Any]] = {
    # Tier 0: Baseline / No specific condition
    "Baseline / Healthy": {
        "sodium": "normal",
        "sugar": "normal",
        "protein": "normal",
        "potassium": "normal",
        "fluid": "normal",
        "priority_tier": 0,
    },

    # Tier 1: Chronic / Ongoing Management
    "Chronic Kidney Disease": {
        "sodium": "restricted",
        "sugar": "normal",
        "protein": "low",
        "potassium": "low",
        "fluid": "restricted",
        "priority_tier": 1,
    },
    "Type 2 Diabetes": {
        "sodium": "normal",
        "sugar": "low",
        "protein": "normal",
        "potassium": "normal",
        "fluid": "normal",
        "priority_tier": 1,
    },
    "Hypertension": {
        "sodium": "low",
        "sugar": "normal",
        "protein": "normal",
        "potassium": "normal",
        "fluid": "normal",
        "priority_tier": 1,
    },
    "Congestive Heart Failure": {
        "sodium": "restricted",
        "sugar": "normal",
        "protein": "normal",
        "potassium": "normal",
        "fluid": "restricted",
        "priority_tier": 1,
    },
    "Liver Cirrhosis": {
        "sodium": "restricted",
        "sugar": "normal",
        "protein": "normal",
        "potassium": "normal",
        "fluid": "low",
        "priority_tier": 1,
    },
    "Nephrotic Syndrome": {
        "sodium": "restricted",
        "sugar": "normal",
        "protein": "normal",
        "potassium": "normal",
        "fluid": "low",
        "priority_tier": 1,
    },
    "Hyperkalemia": {
        "sodium": "normal",
        "sugar": "normal",
        "protein": "normal",
        "potassium": "restricted",
        "fluid": "normal",
        "priority_tier": 1,
    },
    "Chronic Liver Disease (Protein-Intolerant)": {
        "sodium": "low",
        "sugar": "normal",
        "protein": "low",
        "potassium": "normal",
        "fluid": "low",
        "priority_tier": 1,
    },
    "Protein-Energy Malnutrition": {
        "sodium": "normal",
        "sugar": "normal",
        "protein": "high",
        "potassium": "normal",
        "fluid": "normal",
        "priority_tier": 1,
    },

    # Tier 2: Acute / Recovery Need
    "Post-Cardiac Surgery": {
        "sodium": "low",
        "sugar": "normal",
        "protein": "high",
        "potassium": "normal",
        "fluid": "normal",
        "priority_tier": 2,
    },
    "Acute Pancreatitis": {
        "sodium": "normal",
        "sugar": "low",
        "protein": "low",
        "potassium": "normal",
        "fluid": "high",
        "priority_tier": 2,
    },
    "Burn Injury Recovery": {
        "sodium": "normal",
        "sugar": "normal",
        "protein": "high",
        "potassium": "normal",
        "fluid": "high",
        "priority_tier": 2,
    },
    "Sepsis Recovery": {
        "sodium": "normal",
        "sugar": "normal",
        "protein": "high",
        "potassium": "normal",
        "fluid": "normal",
        "priority_tier": 2,
    },
    "Severe Trauma": {
        "sodium": "normal",
        "sugar": "normal",
        "protein": "high",
        "potassium": "normal",
        "fluid": "normal",
        "priority_tier": 2,
    },
    "Post-Operative Gastrointestinal": {
        "sodium": "low",
        "sugar": "normal",
        "protein": "normal",
        "potassium": "normal",
        "fluid": "low",
        "priority_tier": 2,
    },
}


def lookup_diagnosis_constraints(diagnosis: str, table: Dict[str, Dict[str, Any]] = None) -> Dict[str, Any] | None:
    """
    Look up nutrient constraints and priority tier for a given diagnosis name.
    Supports exact matching and normalized case/substring matching.
    """
    if table is None:
        table = DIAGNOSIS_CONSTRAINTS_TABLE

    # Exact match
    if diagnosis in table:
        return table[diagnosis]

    diag_clean = diagnosis.strip().lower()

    # Exact case-insensitive match
    for name, data in table.items():
        if name.lower() == diag_clean:
            return data

    # Substring / keyword match for common clinical variations
    for name, data in table.items():
        if name.lower() in diag_clean or diag_clean in name.lower():
            return data

    return None


def pick_strictest(active_constraints: List[Dict[str, Any]]) -> Dict[str, Any]:
    """
    When all diagnoses agree on direction (e.g., all restrictive like 'low' / 'restricted', or all 'high'),
    pick the constraint driven by:
    1. Highest clinical strictness (e.g. 'restricted' > 'low')
    2. Then highest clinical priority tier (e.g. Tier 2 > Tier 1)
    """
    return max(
        active_constraints,
        key=lambda c: (
            STRICTNESS_RANK.get(c.get("value", "normal"), 0),
            c.get("priority", 0)
        )
    )


# ─────────────────────────────────────────────────────────────────────────────
# Step 2: Composition and Conflict Resolution Algorithm
# ─────────────────────────────────────────────────────────────────────────────

def compose_diet_constraints(
    patient_diagnoses: List[str],
    table: Dict[str, Dict[str, Any]] = None,
) -> Tuple[Dict[str, str], List[str]]:
    """
    Evaluates multi-morbidity diagnoses and composes resolved nutrient constraints.

    Returns:
        final_constraints: Dict of nutrient -> 'restricted' | 'low' | 'normal' | 'high'
        explanation_log: List of human-readable clinical reasoning statements
    """
    if table is None:
        table = DIAGNOSIS_CONSTRAINTS_TABLE

    nutrients = ["sodium", "sugar", "protein", "potassium", "fluid"]
    final_constraints: Dict[str, str] = {}
    explanation_log: List[str] = []

    for nutrient in nutrients:
        # Collect every diagnosis that actually restricts this nutrient
        # ("normal" means that diagnosis has no opinion on it)
        active_constraints = []
        for diagnosis in patient_diagnoses:
            row = lookup_diagnosis_constraints(diagnosis, table)
            if not row:
                continue
            value = row.get(nutrient, "normal")
            if value != "normal":
                active_constraints.append({
                    "diagnosis": diagnosis,
                    "value": value,
                    "priority": row["priority_tier"],
                })

        if not active_constraints:
            final_constraints[nutrient] = "normal"
            continue

        # Check directional categories (restrictive vs elevated)
        distinct_categories = list(dict.fromkeys([
            DIRECTION_CATEGORY.get(c["value"], c["value"]) for c in active_constraints
        ]))

        if len(distinct_categories) == 1:
            # All diagnoses agree on direction — take strictest
            strictest = pick_strictest(active_constraints)
            final_constraints[nutrient] = strictest["value"]
            explanation_log.append(
                f"{nutrient}: set to {strictest['value']}, driven by {strictest['diagnosis']}"
            )
        else:
            # CONFLICT: diagnoses disagree on direction for this nutrient (e.g. restrictive vs elevated)
            highest_priority = max(c["priority"] for c in active_constraints)
            top_candidates = [c for c in active_constraints if c["priority"] == highest_priority]

            diag_list_str = ", ".join([c["diagnosis"] for c in active_constraints])

            if len(top_candidates) == 1:
                winner = top_candidates[0]
                final_constraints[nutrient] = winner["value"]
                explanation_log.append(
                    f"{nutrient}: CONFLICT between {diag_list_str} — "
                    f"resolved to {winner['value']} because {winner['diagnosis']} has higher clinical priority"
                )
            else:
                # Tie in priority — do NOT guess. Default safe, flag for human review.
                final_constraints[nutrient] = "normal"
                explanation_log.append(
                    f"{nutrient}: UNRESOLVED CONFLICT between {diag_list_str} — "
                    f"defaulted to normal, dietitian review required"
                )

    return final_constraints, explanation_log


def evaluate_patient_diagnoses_text(diagnosis_text: str) -> Tuple[Dict[str, str], List[str]]:
    """
    Helper to split a patient's free-text diagnosis field (e.g. comma/semicolon/and separated)
    and compose diet constraints.
    """
    import re
    # Split on commas, semicolons, or ' and '
    tokens = re.split(r'[,;]|\band\b', diagnosis_text, flags=re.IGNORECASE)
    diagnoses = [t.strip() for t in tokens if t.strip()]
    if not diagnoses:
        diagnoses = [diagnosis_text.strip()]
    return compose_diet_constraints(diagnoses)
