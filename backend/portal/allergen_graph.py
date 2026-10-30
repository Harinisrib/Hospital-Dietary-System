"""
Allergen Cross-Reactivity Graph Search
------------------------------------------------------------------
Replaces the flat lookup (direct match = 1.0, cross-reactive = 0.5,
no match = 0.0) with a real weighted graph and a BFS shortest-path
search. Allergen families are nodes; documented cross-reactivity
relationships are edges. The further apart two families are in the
graph, the less they contribute to risk — this is "distance-based
risk decay" and it generalizes the old two-level system to handle
any number of hops, using a real, nameable graph algorithm (BFS).
"""

from collections import deque
from typing import Dict, List, Optional, Tuple


# ----------------------------------------------------------------
# 1. THE ALLERGEN GRAPH
# ----------------------------------------------------------------
# Only clinically documented cross-reactivity relationships are used
# as edges. This graph is intentionally sparse and conservative —
# adding an edge here is a clinical claim, not just a data point.

ALLERGEN_GRAPH: Dict[str, List[str]] = {
    "peanut":    ["tree_nut", "soy"],
    "tree_nut":  ["peanut"],
    "soy":       ["peanut", "lupine"],
    "lupine":    ["soy"],
    "dairy":     [],
    "gluten":    [],
    "eggs":      [],
    "fish":      [],
    "sesame":    [],
    # Crustacean cross-reactivity is well documented as a tight cluster
    # (shrimp/crab/lobster/crayfish cross-react with each other broadly)
    "shrimp":    ["crab", "lobster", "crayfish"],
    "crab":      ["shrimp", "lobster", "crayfish"],
    "lobster":   ["shrimp", "crab", "crayfish"],
    "crayfish":  ["shrimp", "crab", "lobster"],
}


# ----------------------------------------------------------------
# 2. CANONICAL FAMILY NORMALIZATION
# ----------------------------------------------------------------

def normalize_family(family: Optional[str]) -> str:
    """
    Normalizes allergen family strings (e.g. handling plural forms and aliases)
    so clinical database terms like 'peanuts' or 'tree_nuts' match graph nodes.
    """
    if not family:
        return ""
    f = str(family).strip().lower()
    if f in ALLERGEN_GRAPH:
        return f

    ALIASES = {
        "peanuts": "peanut",
        "tree_nuts": "tree_nut",
        "treenut": "tree_nut",
        "treenuts": "tree_nut",
        "egg": "eggs",
        "shellfish": "shrimp",
        "crustacean": "shrimp",
        "crustaceans": "shrimp",
        "prawn": "shrimp",
        "prawns": "shrimp",
    }
    return ALIASES.get(f, f)


# ----------------------------------------------------------------
# 3. BFS SHORTEST-PATH SEARCH
# ----------------------------------------------------------------

def shortest_path_distance(graph: Dict[str, List[str]], start: str, target: str) -> Optional[int]:
    """
    Standard Breadth-First Search (BFS) - finds the minimum number of
    hops between two nodes in an unweighted graph. Returns None if
    there is no path at all (the two allergen families are unrelated).
    """
    if start == target:
        return 0

    if start not in graph or target not in graph:
        return None

    visited = {start}
    queue: deque[Tuple[str, int]] = deque([(start, 0)])

    while queue:
        current_node, distance = queue.popleft()

        for neighbor in graph.get(current_node, []):
            if neighbor == target:
                return distance + 1
            if neighbor not in visited:
                visited.add(neighbor)
                queue.append((neighbor, distance + 1))

    return None  # no path exists


# ----------------------------------------------------------------
# 4. DISTANCE-BASED RISK DECAY
# ----------------------------------------------------------------

def cross_reactivity_weight(patient_allergy_family: str,
                            ingredient_family: str) -> Tuple[float, Optional[int]]:
    """
    Converts a hop distance into a risk contribution between 0 and 1.
    - Distance 0 (same family): full risk, 1.0 - this is a direct match.
    - Distance 1 (directly cross-reactive): significant partial risk (0.5).
    - Distance 2+: smaller, decaying risk - still worth flagging for
      review, but clearly less certain than a direct or one-hop match (e.g. 0.333).
    - No path at all: 0.0, no cross-reactivity risk.

    This REPLACES the old two-level system (1.0 direct / 0.5 cross /
    0.0 clean) with a smooth decay function that generalizes to any
    number of hops: risk = 1 / (1 + distance)
    """
    p_node = normalize_family(patient_allergy_family)
    i_node = normalize_family(ingredient_family)

    distance = shortest_path_distance(ALLERGEN_GRAPH, p_node, i_node)

    if distance is None:
        return 0.0, None  # no relationship at all

    weight = 1.0 / (1.0 + distance)
    return round(weight, 3), distance
