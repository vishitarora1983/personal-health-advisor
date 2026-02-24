"""
Prompts for swapping a single meal in a family (joint profile) meal plan.

Branches on workflow:
  - hybrid:    returns components (same schema as FAMILY_COMPONENTS_SYSTEM_PROMPT
               but for a single meal).
  - llm_only:  returns member_servings directly.
"""

from typing import List, Dict, Any, Optional

from prompts.shared_helpers import build_member_targets_table as _build_member_targets_table

# Meal-type share of daily calories — must stay in sync with portion_optimizer.py.
_MEAL_CAL_DISTRIBUTION = {
    "breakfast": 0.25,
    "lunch":     0.35,
    "dinner":    0.30,
    "snack":     0.10,
}


# ---------------------------------------------------------------------------
# 3.2.1  FAMILY_SWAP_COMPONENTS_SYSTEM_PROMPT  (Hybrid workflow)
# ---------------------------------------------------------------------------

FAMILY_SWAP_COMPONENTS_SYSTEM_PROMPT = """You are an expert nutritionist and family meal planner. Your task is to generate
a SINGLE replacement meal for a family, expressed as BASE COMPONENTS with per-unit
nutritional data. A separate LP solver will allocate exact portions to each member.

## OUTPUT JSON SCHEMA

Return valid JSON matching this exact structure:

{
  "meal": {
    "meal_type": "dinner",
    "dish_name": "Dal Makhani + Jeera Rice + Cucumber Raita",
    "description": "Creamy slow-cooked black lentils with aromatic jeera rice and cooling raita.",
    "cuisine": "Indian",
    "prep_time": 30,
    "components": [
      {"name": "Dal Makhani",     "unit": "katori", "grams_per_unit": 200, "cal_per_unit": 250, "protein_per_unit": 11,
       "carbs_per_unit": 32, "fats_per_unit": 10, "fiber_per_unit": 8},
      {"name": "Jeera Rice",      "unit": "katori", "grams_per_unit": 180, "cal_per_unit": 190, "protein_per_unit": 3,
       "carbs_per_unit": 42, "fats_per_unit": 2,  "fiber_per_unit": 1},
      {"name": "Cucumber Raita",  "unit": "bowl",   "grams_per_unit": 200, "cal_per_unit": 80,  "protein_per_unit": 5,
       "carbs_per_unit": 8,  "fats_per_unit": 3,  "fiber_per_unit": 1}
    ]
  }
}

## COMPONENT RULES

1. COMPONENT DECOMPOSITION — COMPOSITE vs STANDALONE:
   • COMPOSITE dishes (ingredients mixed inseparably: biryani, pulao, fried rice,
     khichdi, pasta, pizza, burger, upma, poha, pav bhaji, dosa batter, sandwich,
     wrap) → model as ONE component. Macros reflect the combined dish per unit.
     ✓  "Chicken Biryani" — 1 katori = rice + chicken + spices together, ~320 cal
     ✗  "Biryani Rice" + "Chicken Pieces" — WRONG, artificially splits inseparable dish

   • STANDALONE dishes (served side-by-side, independently portionable: dal, rice,
     roti, sabzi, salad, raita, chutney, soup) → model as SEPARATE components.
     ✓  Rajma (katori) + Brown Rice (katori) + Mixed Salad (bowl) — 3 components

2. QUANTITY: The meal MUST have between 1 and 5 components. Never fewer than 1,
   never more than 5. A composite dish like biryani or masala oats may be the sole
   component if it is nutritionally complete on its own.

3. UNITS: Every component unit MUST be one of the following standard Indian/metric
   measures: katori, bowl, roti, cup, piece, glass.
   - katori  ≈ 150 ml cooked volume (standard Indian serving cup)
   - bowl    ≈ 250 ml volume
   - cup     ≈ 240 ml
   - roti    = 1 whole roti (~35 g)
   - piece   = 1 discrete piece (paratha, idli, etc.)
   - glass   = 250 ml liquid

4. GRAMS PER UNIT: grams_per_unit is the weight in grams of one unit as served.
   Typical values: rice katori ~180g, dal katori ~200g, roti ~35g, bowl ~230g,
   cup ~240g, piece ~50g (varies by food), glass ~250g.

5. NUTRITIONAL VALUES: All numeric fields are PER ONE UNIT of that component.
   Use USDA nutritional database values as reference.

6. NUTRITIONAL COVERAGE: The component set must collectively cover at least:
   - A starch source   (e.g., rice, roti, bread)
   - A protein source  (e.g., dal, paneer, eggs, chicken, tofu)
   - A fibre/vegetable source (e.g., salad, sabzi, raita)

7. DIETARY COMPLIANCE: ALL household allergens MUST be completely absent.
   The household diet_type restriction applies to every component.

8. VARIETY: The new meal must be different from the meal being replaced and
   must not duplicate any other meals on the same day.

9. OMIT TOTALS: Do NOT include meal-level calories, protein, carbs, fats, or fiber
   totals. The LP solver will compute per-member totals.

## QUALITY ASSURANCE

Before returning, verify:
1. Exactly one "meal" object at the top level.
2. The meal has a "components" array with 1–5 entries.
3. Every component has all seven numeric fields (grams_per_unit, cal_per_unit through fiber_per_unit).
4. No allergens appear in any component name.
5. prep_time is within the household's max_cook_time constraint.
6. The dish is different from the meal being replaced.
7. Composite dishes (biryani, pulao, fried rice, khichdi, pasta, pizza, etc.)
   appear as a SINGLE component — never artificially split into sub-ingredients.

Return ONLY valid JSON."""


# ---------------------------------------------------------------------------
# 3.2.2  FAMILY_SWAP_DIRECT_SYSTEM_PROMPT  (LLM-only workflow)
# ---------------------------------------------------------------------------

FAMILY_SWAP_DIRECT_SYSTEM_PROMPT = """You are an expert nutritionist and family meal planner. Your task is to generate
a SINGLE replacement meal for a family household with individual per-member servings.

## OUTPUT JSON SCHEMA

Return valid JSON matching this exact structure:

{
  "meal": {
    "meal_type": "dinner",
    "dish_name": "Dal Makhani + Jeera Rice + Cucumber Raita",
    "description": "Creamy slow-cooked black lentils with aromatic jeera rice and cooling raita.",
    "cuisine": "Indian",
    "prep_time": 30,
    "portion_size": "3 katori dal, 3 katori rice, 3 bowls raita",
    "calories": 1560,
    "protein": 57,
    "carbs": 246,
    "fats": 45,
    "fiber": 30,
    "member_servings": [
      {
        "member_name": "Dad",
        "adjustment": "Extra dal, half rice",
        "portion_description": "1.5 katori Dal Makhani (~300g), 0.5 katori Jeera Rice (~90g), 1 bowl Raita (~200g)",
        "calories": 580,
        "protein": 22,
        "carbs": 70,
        "fats": 18,
        "fiber": 11
      }
    ]
  }
}

## FIELD DEFINITIONS

meal-level fields:
  portion_size        — TOTAL household quantity (all members combined), expressed in
                        natural units with gram weights.
  calories/protein/carbs/fats/fiber — TOTAL for ALL members combined.

member_servings fields (one entry per household member — NEVER skip a member):
  member_name         — must exactly match the name provided in the user prompt.
  adjustment          — concise natural-language description of what differs from a
                        standard equal share. Write "Standard portions" if no
                        adjustment is needed.
  portion_description — exact units and quantities for this member's plate.
                        ALWAYS include approximate gram weight per item in parentheses,
                        e.g., "1 katori Rajma (~220g), 0.5 katori Rice (~90g), 2 bowls Salad (~400g)".

  COMPOSITE vs STANDALONE in portion_description:
    Composite dishes (biryani, pulao, pizza, pasta, etc.) → describe as a single
    item: "1.5 katori Chicken Biryani (~375g), 1 bowl Raita (~200g)"
    NOT: "1 katori Biryani Rice (~180g), 2 pieces Chicken (~100g), 1 bowl Raita (~200g)"
    Only list items separately when they are independently portioned on the plate.

  calories/protein/carbs/fats/fiber — for THIS member's serving only.
                        Sum across all member_servings must equal (within ±5%)
                        the meal-level totals.

## NUTRITIONAL ACCURACY RULES

1. Each member's calories for this meal must be consistent with their individual
   target_calories and the meal type's calorie distribution percentage.
2. ALL household allergens are completely forbidden.
3. The household diet_type applies to ALL members.
4. Member-level medical goals must be reflected in their individual portion.

## QUALITY ASSURANCE

Before returning, verify:
1. Exactly one "meal" object at the top level.
2. member_servings has exactly one entry per household member — no omissions.
3. Sum of member calories ≈ meal-level calories (±5%).
4. Allergens absent from all portion_description and adjustment text.
5. prep_time ≤ household max_cook_time.
6. The dish is different from the meal being replaced.

Return ONLY valid JSON."""


# ---------------------------------------------------------------------------
# 3.2.3  build_family_swap_prompt  (user message for both workflows)
# ---------------------------------------------------------------------------

def build_family_swap_prompt(
    meal: Dict[str, Any],
    day_meals: List[Dict[str, Any]],
    joint_profile,
    member_targets: List[Dict],
    workflow: str,
    reason: Optional[str] = None,
) -> str:
    """
    Build the user message for a family meal swap.

    The system prompt is chosen by the caller based on workflow:
      hybrid   → FAMILY_SWAP_COMPONENTS_SYSTEM_PROMPT
      llm_only → FAMILY_SWAP_DIRECT_SYSTEM_PROMPT

    Args:
        meal:           The meal being replaced (dict with meal_type, dish_name,
                        calories, protein, carbs, fats, cuisine, etc.).
        day_meals:      All other meals for the same day (to avoid duplication).
        joint_profile:  Joint UserProfile ORM object.
        member_targets: Per-member nutrition target dicts, each containing:
                          name, target_calories, target_protein, target_carbs,
                          target_fats, target_fiber, medical_goals, weight_goal.
        workflow:       Controls what the LLM must output:
                          "hybrid"   → return components
                          "llm_only" → return member_servings
        reason:         Optional user-supplied reason for the swap. Shown verbatim
                        to the LLM as a preference to honor.

    Returns:
        str: User message to send alongside the appropriate system prompt.
    """
    # -----------------------------------------------------------------------
    # Section 1: Meal being replaced
    # -----------------------------------------------------------------------
    meal_type = meal.get("meal_type", "meal")
    dish_name = meal.get("dish_name", "unknown")

    # Show existing nutritional summary only for llm_only (hybrid doesn't use totals)
    if workflow == "llm_only":
        existing_macros = (
            f"  - Calories: {meal.get('calories', 0)} kcal\n"
            f"  - Protein: {meal.get('protein', 0)}g | "
            f"Carbs: {meal.get('carbs', 0)}g | "
            f"Fats: {meal.get('fats', 0)}g"
        )
    else:
        existing_macros = "  (LP solver will compute per-member totals from component data)"

    # -----------------------------------------------------------------------
    # Section 2: Other meals today to avoid duplication
    # -----------------------------------------------------------------------
    other_dish_names = [
        m.get("dish_name", "")
        for m in day_meals
        if m.get("dish_name") and m.get("dish_name") != dish_name
    ]
    if other_dish_names:
        other_meals_text = "\n".join(f"  - {d}" for d in other_dish_names)
    else:
        other_meals_text = "  (no other meals planned for this day)"

    # -----------------------------------------------------------------------
    # Section 3: Optional swap reason
    # -----------------------------------------------------------------------
    reason_section = ""
    if reason and reason.strip():
        reason_section = (
            f"\n## Swap Reason\n\n"
            f"User reason: {reason.strip()}. "
            f"Honor this preference while meeting the nutritional targets below.\n"
        )

    # -----------------------------------------------------------------------
    # Section 4: Household constraints (diet, allergies, cuisines, cook time)
    # -----------------------------------------------------------------------
    allergies = joint_profile.allergies_list if hasattr(joint_profile, "allergies_list") else []
    cuisines = joint_profile.cuisines_list if hasattr(joint_profile, "cuisines_list") else []

    allergen_text = (
        f"**ALLERGENS (NEVER include)**: {', '.join(allergies)}"
        if allergies
        else "No household allergens"
    )
    cuisine_text = (
        f"**Cuisines (ALL meals MUST come from these cuisines ONLY)**: {', '.join(cuisines)}"
        if cuisines
        else "No specific cuisine restriction — use variety"
    )

    # -----------------------------------------------------------------------
    # Section 5: Per-member targets table
    # Delegated to shared_helpers.build_member_targets_table so the format is
    # identical to the weekly-plan prompts and never diverges between the two.
    # -----------------------------------------------------------------------
    targets_table = _build_member_targets_table(member_targets)

    # -----------------------------------------------------------------------
    # Section 6: Per-meal calorie targets (helps the LLM size portions correctly)
    # -----------------------------------------------------------------------
    # Snacks share a fixed 10% budget; compute correct per-slot fraction.
    SNACK_TOTAL = 0.10
    num_snacks = sum(
        1 for dm in day_meals if (dm.get("meal_type") or "") == "snack"
    )
    if meal_type == "snack" and num_snacks > 0:
        meal_frac = SNACK_TOTAL / num_snacks
    else:
        meal_frac = _MEAL_CAL_DISTRIBUTION.get(meal_type, 0.30)
    per_meal_lines = []
    for m in member_targets:
        per_meal_cal = round(m["target_calories"] * meal_frac)
        per_meal_lines.append(f"  - {m['name']}: ~{per_meal_cal} kcal for this {meal_type}")
    per_meal_targets_text = "\n".join(per_meal_lines)

    # -----------------------------------------------------------------------
    # Section 7: Workflow-specific output instruction
    # -----------------------------------------------------------------------
    n_members = len(member_targets)
    if workflow == "hybrid":
        output_instruction = (
            "Return a single `meal` object with a `components` array "
            "(1–5 components, each with cal_per_unit, protein_per_unit, "
            "carbs_per_unit, fats_per_unit, fiber_per_unit, and unit)."
        )
    else:
        output_instruction = (
            f"Return a single `meal` object with a `member_servings` array "
            f"containing exactly {n_members} entries "
            f"(one per member listed above — do not skip any member)."
        )

    # -----------------------------------------------------------------------
    # Assemble final prompt
    # -----------------------------------------------------------------------
    prompt = f"""## Meal Being Replaced

- **Type**: {meal_type}
- **Current dish**: {dish_name}
- **Cuisine**: {meal.get('cuisine', 'unknown')}
{existing_macros}

## Other Meals on This Day (avoid duplication)

{other_meals_text}
{reason_section}
## Household Constraints

- **Diet type**: {getattr(joint_profile, 'diet_type', 'none')} — applies to all components
- {allergen_text}
- {cuisine_text}
- **Max cook time**: {getattr(joint_profile, 'max_cook_time', 45)} minutes
- **Cooking skill**: {getattr(joint_profile, 'cooking_skill', 'intermediate')}
- **Spice tolerance**: {getattr(joint_profile, 'spice_tolerance', 'medium')}

## Per-Member Nutritional Targets

{targets_table}

## Per-Meal Calorie Targets (for this {meal_type} slot — {round(meal_frac * 100)}% of daily)

{per_meal_targets_text}

IMPORTANT: Each member's calories for this meal MUST be close to the per-meal
target listed above. Do NOT use their full daily calorie target for a single meal.

## Output Requirement

{output_instruction}

Return ONLY valid JSON."""

    return prompt
