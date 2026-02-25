"""
Cuisine-specific prompt library — data-driven per-cuisine rules injected into
LLM prompts when matching cuisines are selected.

Pure data + functions module (no ORM/IO dependencies).

Usage:
    from prompts.cuisine_library import build_cuisine_guidance, get_forbidden_items
    guidance = build_cuisine_guidance(["indian", "punjabi"])
    forbidden = get_forbidden_items(["indian"])
"""

from dataclasses import dataclass, field
from typing import Dict, FrozenSet, List, Set, Tuple


@dataclass(frozen=True)
class CuisineRuleSet:
    """Immutable container for per-cuisine generation rules."""
    display_name: str
    applicable_cuisines: FrozenSet[str]
    forbidden_items: Tuple[str, ...] = ()
    meal_type_restrictions: Dict[str, Tuple[str, ...]] = field(default_factory=dict)
    avoid_guidance: Tuple[str, ...] = ()
    prefer_guidance: Tuple[str, ...] = ()
    cooking_style_hints: Tuple[str, ...] = ()
    unit_vocabulary: Tuple[Tuple[str, str], ...] = ()


# ---------------------------------------------------------------------------
# Default unit vocabulary — universally understood units used as fallback
# when no cuisine-specific units are configured.
# ---------------------------------------------------------------------------

_DEFAULT_UNITS: Tuple[Tuple[str, str], ...] = (
    ("cup", "~240 ml / 1 standard measuring cup"),
    ("bowl", "~250 ml volume"),
    ("piece", "1 discrete item (fillet, patty, bread slice, etc.)"),
    ("plate", "1 standard dinner plate (~300 g)"),
    ("glass", "250 ml liquid"),
)


# ---------------------------------------------------------------------------
# Cuisine group constants
# ---------------------------------------------------------------------------

INDIAN_FAMILY_CUISINES = frozenset({
    "indian", "punjabi", "gujarati", "south_indian", "south indian",
    "rajasthani", "bengali", "maharashtrian",
})

# ---------------------------------------------------------------------------
# Rule set instances
# ---------------------------------------------------------------------------

INDIAN_COMMON_RULES = CuisineRuleSet(
    display_name="Indian (common)",
    applicable_cuisines=INDIAN_FAMILY_CUISINES,
    forbidden_items=(
        "chutney", "pickle", "achar", "papad", "pappadam", "papadum",
        "mukhwas",
    ),
    meal_type_restrictions={
        "breakfast": (
            "grilled chicken", "kebab", "biryani", "tikka",
            "tandoori chicken", "mutton", "butter chicken",
        ),
    },
    avoid_guidance=(
        "deep-fried items for every meal",
        "excessive ghee in every dish",
    ),
    prefer_guidance=(
        "raita or salad as sides instead of chutneys/pickles",
        "dal as a protein-rich side",
        "whole grains (brown rice, whole wheat roti, millets)",
    ),
    cooking_style_hints=(
        "thali-style structure: 1 protein + 1 carb + 1 vegetable/side",
    ),
    unit_vocabulary=(
        ("katori", "~150 ml cooked volume (standard serving cup)"),
        ("bowl", "~250 ml volume"),
        ("roti", "1 whole flatbread (~35 g)"),
        ("cup", "~240 ml"),
        ("piece", "1 discrete item (bread slice, fillet, etc.)"),
        ("glass", "250 ml liquid"),
    ),
)

PUNJABI_RULES = CuisineRuleSet(
    display_name="Punjabi",
    applicable_cuisines=frozenset({"punjabi"}),
    meal_type_restrictions={
        "breakfast": ("butter chicken", "chole bhature"),
    },
    prefer_guidance=(
        "makki di roti with sarson ka saag",
        "rajma, chole, lassi",
        "tandoori preparations",
    ),
    avoid_guidance=(
        "cream-heavy gravies for every meal",
    ),
)

CHINESE_RULES = CuisineRuleSet(
    display_name="Chinese",
    applicable_cuisines=frozenset({"chinese"}),
    prefer_guidance=(
        "stir-fry, steamed dishes, wok techniques",
        "balanced soy-ginger-garlic flavour base",
    ),
    avoid_guidance=(
        "deep-fried items for every meal",
    ),
    unit_vocabulary=(
        ("bowl", "~250 ml volume"),
        ("cup", "~240 ml"),
        ("piece", "1 discrete item (dumpling, spring roll, etc.)"),
        ("plate", "1 standard dinner plate (~300 g)"),
        ("glass", "250 ml liquid"),
    ),
)

ITALIAN_RULES = CuisineRuleSet(
    display_name="Italian",
    applicable_cuisines=frozenset({"italian"}),
    prefer_guidance=(
        "olive oil, fresh herbs, tomato-based sauces",
        "pasta al dente, risotto, bruschetta",
    ),
    avoid_guidance=(
        "heavy cream sauces for every meal",
    ),
    unit_vocabulary=(
        ("bowl", "~250 ml volume"),
        ("piece", "1 discrete item (bread slice, fillet, etc.)"),
        ("cup", "~240 ml"),
        ("plate", "1 standard dinner plate (~300 g)"),
        ("glass", "250 ml liquid"),
    ),
)

MEXICAN_RULES = CuisineRuleSet(
    display_name="Mexican",
    applicable_cuisines=frozenset({"mexican"}),
    prefer_guidance=(
        "beans, fresh salsa, grilled proteins",
        "corn tortillas, avocado, lime",
    ),
    avoid_guidance=(
        "excessive sour cream and cheese in every dish",
    ),
    unit_vocabulary=(
        ("bowl", "~250 ml volume"),
        ("piece", "1 discrete item (taco, quesadilla, etc.)"),
        ("cup", "~240 ml"),
        ("tortilla", "1 corn/flour tortilla (~40 g)"),
        ("glass", "250 ml liquid"),
    ),
)

JAPANESE_RULES = CuisineRuleSet(
    display_name="Japanese",
    applicable_cuisines=frozenset({"japanese"}),
    prefer_guidance=(
        "miso soup, steamed rice, grilled fish",
        "seasonal vegetables, tofu, noodles",
    ),
    unit_vocabulary=(
        ("bowl", "~250 ml volume"),
        ("piece", "1 discrete item (sushi piece, fillet, etc.)"),
        ("cup", "~240 ml"),
        ("glass", "250 ml liquid"),
    ),
)

THAI_RULES = CuisineRuleSet(
    display_name="Thai",
    applicable_cuisines=frozenset({"thai"}),
    prefer_guidance=(
        "lemongrass, coconut milk, fresh herbs",
        "balanced sweet-sour-salty-spicy flavours",
    ),
    unit_vocabulary=(
        ("bowl", "~250 ml volume"),
        ("cup", "~240 ml"),
        ("piece", "1 discrete item (spring roll, satay stick, etc.)"),
        ("plate", "1 standard dinner plate (~300 g)"),
        ("glass", "250 ml liquid"),
    ),
)

MEDITERRANEAN_RULES = CuisineRuleSet(
    display_name="Mediterranean",
    applicable_cuisines=frozenset({"mediterranean"}),
    prefer_guidance=(
        "olive oil, grilled fish, whole grains",
        "legumes, fresh vegetables, herbs",
    ),
    unit_vocabulary=(
        ("cup", "~240 ml"),
        ("bowl", "~250 ml volume"),
        ("piece", "1 discrete item (fillet, bread slice, etc.)"),
        ("plate", "1 standard dinner plate (~300 g)"),
        ("glass", "250 ml liquid"),
    ),
)

AMERICAN_RULES = CuisineRuleSet(
    display_name="American",
    applicable_cuisines=frozenset({"american"}),
    meal_type_restrictions={
        "breakfast": ("steak", "burger", "ribs", "pulled pork"),
    },
    prefer_guidance=(
        "lean proteins, whole grains, fresh produce",
    ),
    avoid_guidance=(
        "processed items for every meal",
    ),
    unit_vocabulary=(
        ("cup", "~240 ml / 1 standard US cup"),
        ("bowl", "~250 ml volume"),
        ("piece", "1 discrete item (patty, fillet, slice, etc.)"),
        ("slice", "1 slice (~60 g)"),
        ("plate", "1 standard dinner plate (~300 g)"),
        ("glass", "250 ml liquid"),
    ),
)

MIDDLE_EASTERN_RULES = CuisineRuleSet(
    display_name="Middle Eastern",
    applicable_cuisines=frozenset({"middle_eastern", "middle eastern"}),
    prefer_guidance=(
        "hummus, tahini, grilled meats",
        "fresh herbs, legumes, flatbreads",
    ),
    unit_vocabulary=(
        ("bowl", "~250 ml volume"),
        ("piece", "1 discrete item (falafel, pita, etc.)"),
        ("cup", "~240 ml"),
        ("plate", "1 standard dinner plate (~300 g)"),
        ("glass", "250 ml liquid"),
    ),
)

KOREAN_RULES = CuisineRuleSet(
    display_name="Korean",
    applicable_cuisines=frozenset({"korean"}),
    prefer_guidance=(
        "fermented foods (kimchi, doenjang)",
        "balanced banchan, rice-based meals",
    ),
    unit_vocabulary=(
        ("bowl", "~250 ml volume"),
        ("cup", "~240 ml"),
        ("piece", "1 discrete item (pancake, dumpling, etc.)"),
        ("plate", "1 standard dinner plate (~300 g)"),
        ("glass", "250 ml liquid"),
    ),
)

# Master registry — order doesn't matter; get_active_rules scans all.
_ALL_RULE_SETS: List[CuisineRuleSet] = [
    INDIAN_COMMON_RULES,
    PUNJABI_RULES,
    CHINESE_RULES,
    ITALIAN_RULES,
    MEXICAN_RULES,
    JAPANESE_RULES,
    THAI_RULES,
    MEDITERRANEAN_RULES,
    AMERICAN_RULES,
    MIDDLE_EASTERN_RULES,
    KOREAN_RULES,
]


# ---------------------------------------------------------------------------
# Public helpers
# ---------------------------------------------------------------------------

def get_active_rules(selected_cuisines: List[str]) -> List[CuisineRuleSet]:
    """Return all CuisineRuleSets whose applicable_cuisines overlap with selection."""
    if not selected_cuisines:
        return []
    selected = frozenset(c.lower().strip() for c in selected_cuisines)
    return [rs for rs in _ALL_RULE_SETS if rs.applicable_cuisines & selected]


def get_forbidden_items(selected_cuisines: List[str]) -> Set[str]:
    """Return lowercase globally-forbidden keywords for the content filter's blanket scan."""
    items: Set[str] = set()
    for rs in get_active_rules(selected_cuisines):
        items.update(item.lower() for item in rs.forbidden_items)
    return items


def get_meal_type_restrictions(selected_cuisines: List[str]) -> Dict[str, Set[str]]:
    """Return per-meal-type forbidden keywords merged across all active cuisines.

    Example: {"breakfast": {"grilled chicken", "steak", "kebab", ...}}
    """
    merged: Dict[str, Set[str]] = {}
    for rs in get_active_rules(selected_cuisines):
        for meal_type, items in rs.meal_type_restrictions.items():
            if meal_type not in merged:
                merged[meal_type] = set()
            merged[meal_type].update(item.lower() for item in items)
    return merged


def build_unit_guidance(selected_cuisines: List[str]) -> str:
    """Build a Markdown unit vocabulary section for LLM prompt injection.

    Merges unit vocabularies from all active cuisine rule sets (union,
    deduplicated by unit name — first description wins). Falls back to
    _DEFAULT_UNITS when no cuisine-specific units are configured.

    Args:
        selected_cuisines: Lowercase cuisine names selected by the user.

    Returns:
        str: Formatted Markdown section listing allowed units.
    """
    active = get_active_rules(selected_cuisines)

    # Collect units from active rule sets (deduplicated, preserving first description)
    seen: Dict[str, str] = {}
    for rs in active:
        for unit_name, description in rs.unit_vocabulary:
            if unit_name not in seen:
                seen[unit_name] = description

    # Fall back to universal defaults when no cuisine-specific units were found
    if not seen:
        for unit_name, description in _DEFAULT_UNITS:
            seen[unit_name] = description

    lines = [f"  - {name:10s} {desc}" for name, desc in seen.items()]
    return (
        "## Unit Vocabulary\n\n"
        "Every component unit MUST be one of:\n"
        + "\n".join(lines)
    )


def build_cuisine_guidance(selected_cuisines: List[str]) -> str:
    """Build a Markdown cuisine-specific rules section for LLM prompt injection.

    Returns "" if no cuisines selected or no rules match.
    """
    active = get_active_rules(selected_cuisines)
    if not active:
        return ""

    sections: List[str] = []
    sections.append("## Cuisine-Specific Rules")

    # Global forbidden items (all meal types)
    all_forbidden: Set[str] = set()
    for rs in active:
        all_forbidden.update(rs.forbidden_items)
    if all_forbidden:
        items = ", ".join(sorted(all_forbidden))
        sections.append(
            f"**FORBIDDEN in ALL meals (NEVER include as a dish, side, or component)**: "
            f"{items}"
        )

    # Per-meal-type restrictions
    merged_restrictions = get_meal_type_restrictions(selected_cuisines)
    for meal_type in sorted(merged_restrictions):
        items = ", ".join(sorted(merged_restrictions[meal_type]))
        sections.append(
            f"**{meal_type.upper()}**: NEVER include {items}"
        )

    # Avoid guidance
    all_avoid: List[str] = []
    for rs in active:
        all_avoid.extend(rs.avoid_guidance)
    if all_avoid:
        avoid_lines = "\n".join(f"  - {a}" for a in dict.fromkeys(all_avoid))
        sections.append(f"**Avoid**:\n{avoid_lines}")

    # Prefer guidance
    all_prefer: List[str] = []
    for rs in active:
        all_prefer.extend(rs.prefer_guidance)
    if all_prefer:
        prefer_lines = "\n".join(f"  - {p}" for p in dict.fromkeys(all_prefer))
        sections.append(f"**Prefer**:\n{prefer_lines}")

    # Cooking style hints
    all_hints: List[str] = []
    for rs in active:
        all_hints.extend(rs.cooking_style_hints)
    if all_hints:
        hint_lines = "\n".join(f"  - {h}" for h in dict.fromkeys(all_hints))
        sections.append(f"**Cooking style**:\n{hint_lines}")

    # Unit vocabulary — dynamic per-cuisine unit set
    sections.append(build_unit_guidance(selected_cuisines))

    return "\n\n".join(sections)
