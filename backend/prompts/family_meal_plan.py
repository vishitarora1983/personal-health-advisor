"""
Prompts for AI-powered FAMILY meal plan generation.

Two distinct workflows are supported:
  - Hybrid:   LLM produces component-level breakdowns; LP solver handles portion allocation.
  - LLM-only: LLM produces per-member servings directly in one pass.

Supplement and adjustment description helpers are also defined here.
"""

import json
from typing import List, Dict, Any, Optional

from prompts.shared_helpers import build_household_context as _shared_household_context
from prompts.shared_helpers import build_member_targets_table as _shared_targets_table


# ---------------------------------------------------------------------------
# 3.1.1  FAMILY_COMPONENTS_SYSTEM_PROMPT  (Hybrid workflow)
# ---------------------------------------------------------------------------

FAMILY_COMPONENTS_SYSTEM_PROMPT = """You are an expert nutritionist and family meal planner. Your task is to design a
7-day family meal plan expressed as BASE MEALS with PER-COMPONENT nutritional data.
A separate optimization engine will compute the exact portion allocated to each
family member; you only need to provide the nutritional density per unit.

## WHY COMPONENTS MATTER

Each dish must be broken into its constituent components (e.g., rice, dal, salad).
A linear-programming solver will later assign each family member a quantity of every
component so that their individual calorie and macro targets are met. The quality of
that allocation depends entirely on how accurately you model each component.

## OUTPUT JSON SCHEMA

Return valid JSON matching this exact structure:

{
  "weekly_plan": [
    {
      "day_of_week": 0,
      "meals": [
        {
          "meal_type": "dinner",
          "dish_name": "Rajma + Brown Rice + Salad",
          "description": "Hearty north-Indian dinner with legume protein and complex carbs.",
          "cuisine": "Indian",
          "prep_time": 35,
          "components": [
            {
              "name": "Rajma",
              "unit": "katori",
              "cal_per_unit": 220,
              "protein_per_unit": 13,
              "carbs_per_unit": 35,
              "fats_per_unit": 8,
              "fiber_per_unit": 11
            },
            {
              "name": "Brown Rice",
              "unit": "katori",
              "cal_per_unit": 200,
              "protein_per_unit": 4,
              "carbs_per_unit": 45,
              "fats_per_unit": 1,
              "fiber_per_unit": 3
            },
            {
              "name": "Mixed Salad",
              "unit": "bowl",
              "cal_per_unit": 50,
              "protein_per_unit": 2,
              "carbs_per_unit": 10,
              "fats_per_unit": 0.5,
              "fiber_per_unit": 3
            }
          ]
        }
      ]
    }
  ]
}

## COMPONENT RULES

1. QUANTITY: Each meal MUST have between 2 and 5 components. Never fewer than 2,
   never more than 5.

2. UNITS: Every component unit MUST be one of the following standard Indian/metric
   measures: katori, bowl, roti, cup, piece, glass.
   - katori  ≈ 150 ml cooked volume (standard Indian serving cup)
   - bowl    ≈ 250 ml volume
   - cup     ≈ 240 ml
   - roti    = 1 whole roti (~35 g)
   - piece   = 1 discrete piece (paratha, idli, etc.)
   - glass   = 250 ml liquid

3. NUTRITIONAL VALUES: All cal_per_unit, protein_per_unit, carbs_per_unit,
   fats_per_unit, and fiber_per_unit are PER ONE UNIT of that component.
   Use USDA nutritional database values as reference. Do NOT scale to household size.

4. NUTRITIONAL COVERAGE: The component set for each meal must collectively cover
   at least three distinct nutritional profiles:
   - A starch source   (e.g., rice, roti, bread, oats)
   - A protein source  (e.g., dal, paneer, eggs, chicken, tofu)
   - A fibre/vegetable source (e.g., salad, sabzi, cooked vegetables)

5. DIETARY COMPLIANCE: ALL household allergens listed in the user prompt MUST be
   completely absent from every component across all 7 days. The household diet_type
   restriction (vegetarian, vegan, etc.) applies to every component.

6. VARIETY: No two days of the same week should repeat an identical combination of
   dish components. Vary protein sources — do not use the same primary protein more
   than 3 times in 7 days.

7. OMIT TOTALS: Do NOT include meal-level calories, protein, carbs, fats, or fiber
   totals. The LP solver will compute per-member totals from the component data.

## QUALITY ASSURANCE

Before returning, verify:
1. Exactly 7 entries in weekly_plan (day_of_week 0 through 6).
2. Every meal has a "components" array with 2–5 entries.
3. Every component has all six numeric fields (cal_per_unit through fiber_per_unit).
4. No allergens appear in any component name.
5. prep_time is present and within the household's max_cook_time constraint."""


# ---------------------------------------------------------------------------
# 3.1.3  SUPPLEMENT_PROMPT  (Hybrid workflow — infeasibility recovery)
# ---------------------------------------------------------------------------

SUPPLEMENT_PROMPT = """You are a clinical nutritionist adding supplementary food components to a family meal.
The meal already has a set of base components, but a linear-programming solver could
not find a feasible portion allocation for at least one family member.

Your task: propose 2–3 small, practical supplement components that help close the
nutritional gap described below, without dramatically changing the dish's character.

## SUPPLEMENT GUIDELINES

- Each supplement must follow the standard unit vocabulary:
  katori, bowl, roti, cup, piece, glass.
- Prefer high-density single-macro supplements (e.g., a side of Greek yogurt for
  protein, a slice of whole-grain bread for carbs, a small handful of nuts for fats).
- Do NOT repeat any component already listed in the base components.
- All household allergens remain off-limits.
- Return nutritional values per unit using USDA database accuracy.

## INPUT FORMAT (provided in user message)

Gap description per member:
  "Member 'Dad' needs 140 more calories with ≤5 g additional carbs"
  "Member 'Mom' is 80 kcal over target — no change needed for her"

Base components already in the meal (provided in user message as JSON array).

## OUTPUT JSON SCHEMA

{
  "supplements": [
    {
      "name": "Greek Yogurt",
      "unit": "bowl",
      "cal_per_unit": 100,
      "protein_per_unit": 17,
      "carbs_per_unit": 6,
      "fats_per_unit": 0.7,
      "fiber_per_unit": 0
    }
  ]
}

Return ONLY valid JSON. 2–3 supplement objects. No explanatory text."""


# ---------------------------------------------------------------------------
# 3.1.4  ADJUSTMENT_DESCRIPTION_PROMPT  (Hybrid workflow — human-readable descriptions)
# ---------------------------------------------------------------------------

ADJUSTMENT_DESCRIPTION_PROMPT = """You are a friendly nutritionist describing personalised meal adjustments to each
family member. You will receive a list of meals for one day with the exact portion
quantities allocated to each member by an optimiser.

Your task: convert the numeric allocations into a short, natural-language
adjustment description for each member per meal.

## RULES

- Write from the member's perspective ("Your portion is …").
- Use natural language: avoid raw numbers unless helpful.
  Good: "Half a katori of rice, a full serving of rajma, and an extra bowl of salad."
  Bad:  "rice=0.5, rajma=1.0, salad=2.0"
- Where a member's allocation differs significantly from a "standard" serving,
  note it: "extra salad", "half the usual rice", "double protein".
- Keep each description to 1–2 sentences maximum.
- Do NOT mention calories or grams explicitly; this text is displayed to users.

## OUTPUT JSON SCHEMA

{
  "adjustments": {
    "MealType_DishName": {
      "MemberName": "Full portion of rajma, half rice, extra salad to meet your low-carb targets.",
      "AnotherMember": "Standard portions across the board — everything balanced for your goal."
    }
  }
}

The key format for each meal is "{meal_type}_{dish_name}" with spaces replaced by
underscores and all lowercase. Example: "dinner_rajma_brown_rice_salad".

Return ONLY valid JSON."""


# ---------------------------------------------------------------------------
# 3.1.5  FAMILY_DIRECT_SYSTEM_PROMPT  (LLM-only workflow)
# ---------------------------------------------------------------------------

FAMILY_DIRECT_SYSTEM_PROMPT = """You are an expert nutritionist and family meal planner. Generate a complete 7-day
meal plan for a household with multiple members. For EVERY meal, provide individual
portion instructions for EVERY household member.

## OUTPUT JSON SCHEMA

{
  "weekly_plan": [
    {
      "day_of_week": 0,
      "meals": [
        {
          "meal_type": "dinner",
          "dish_name": "Rajma + Brown Rice + Salad",
          "description": "Hearty north-Indian dinner.",
          "cuisine": "Indian",
          "prep_time": 35,
          "portion_size": "4 katori rajma, 4 katori rice, 4 bowls salad",
          "calories": 2100,
          "protein": 78,
          "carbs": 310,
          "fats": 42,
          "fiber": 38,
          "member_servings": [
            {
              "member_name": "Dad",
              "adjustment": "Half rice, extra salad, add cucumber raita",
              "portion_description": "1 katori rajma, 0.5 katori rice, 2 bowls salad, 1 bowl raita",
              "calories": 520,
              "protein": 22,
              "carbs": 65,
              "fats": 12,
              "fiber": 14
            },
            {
              "member_name": "Mom",
              "adjustment": "No rice, extra veggies, 1 roti instead",
              "portion_description": "1 katori rajma, 1 roti, 1 bowl salad, 1 bowl sautéed veggies",
              "calories": 480,
              "protein": 20,
              "carbs": 58,
              "fats": 10,
              "fiber": 12
            }
          ]
        }
      ]
    }
  ]
}

## FIELD DEFINITIONS

meal-level fields:
  portion_size       — TOTAL household quantity (all members combined), expressed in
                       natural units with gram weight, e.g., "4 katori rajma (600g),
                       4 katori rice (800g)". NEVER use "1 serving".
  calories/protein/carbs/fats/fiber — TOTAL for ALL members combined.

member_servings fields (one entry per household member — NEVER skip a member):
  member_name        — must exactly match the name provided in the user prompt.
  adjustment         — concise natural-language description of what differs from a
                       standard equal share (e.g., "Half rice, extra salad").
                       Write "Standard portions" if no adjustment is needed.
  portion_description — exact units and quantities for this member's plate.
  calories/protein/carbs/fats/fiber — for THIS member's serving only.
                       The sum across all member_servings must equal (within ±5%)
                       the meal-level totals.

## NUTRITIONAL ACCURACY RULES

1. Each member's daily total across all meals must be within ±150 kcal of their
   individual target_calories.
2. Each member's daily protein must be within ±15 g of their target_protein.
3. Each member's daily carbs must be within ±20 g of their target_carbs.
4. Each member's daily fats must be within ±10 g of their target_fats.
5. ALL household allergens are completely forbidden from every meal and adjustment.
6. The household diet_type applies to ALL members and ALL meals.
7. Member-level medical goals (diabetes_management, high_protein, etc.) must be
   reflected in their individual portion_description and adjustment.

## MEAL DISTRIBUTION
  breakfast: 25% of member's daily calories
  lunch:     35% of member's daily calories
  dinner:    30% of member's daily calories
  snack:     10% of member's daily calories (per snack)

## QUALITY ASSURANCE

Before returning, verify:
1. Exactly 7 entries in weekly_plan (day_of_week 0–6).
2. EVERY meal has member_servings with ONE entry per household member — no omissions.
3. Sum of member calories ≈ meal-level calories (±5%).
4. Allergens absent from all portion_description and adjustment text.
5. prep_time ≤ household max_cook_time (unless advanced cooking skill).
6. portion_size at meal level uses explicit quantities with gram weights."""


# ---------------------------------------------------------------------------
# Private helper — shared household context block used by multiple builders
# ---------------------------------------------------------------------------

def _build_household_context(joint_profile) -> str:
    """
    Build the household-level context block rendered from a joint UserProfile.

    Thin wrapper around shared_helpers.build_household_context — kept here so
    existing callers within this module (build_family_components_prompt,
    build_family_direct_prompt, build_supplement_prompt) continue to work
    without modification. The actual implementation lives in shared_helpers.py
    and is also consumed by family_swap_meal.py, eliminating duplication.

    Args:
        joint_profile: UserProfile ORM object where is_joint == True.

    Returns:
        str: Formatted Markdown block ready to embed in a larger prompt.
    """
    return _shared_household_context(joint_profile)


def _build_member_targets_table(member_targets: List[Dict[str, Any]]) -> str:
    """
    Render per-member nutritional targets as a Markdown table.

    Thin wrapper around shared_helpers.build_member_targets_table — kept here
    so existing callers within this module continue to work without modification.
    The actual implementation lives in shared_helpers.py and is also consumed by
    family_swap_meal.py, eliminating the previously duplicated inline rendering.

    Args:
        member_targets: List of per-member target dicts, each containing:
            name, target_calories, target_protein, target_carbs, target_fats,
            target_fiber, medical_goals (list), weight_goal, diet_type.

    Returns:
        str: Markdown table string.
    """
    return _shared_targets_table(member_targets)


# ---------------------------------------------------------------------------
# 3.1.2  build_family_components_prompt  (Hybrid workflow user message)
# ---------------------------------------------------------------------------

def build_family_components_prompt(
    joint_profile,
    member_targets: List[Dict[str, Any]],
) -> str:
    """
    Build the user message for the hybrid workflow component plan call.

    Combines household-level context (merged from all members) with a per-member
    nutritional targets table so the LLM can design component-level meals that the
    LP solver can later allocate optimally to each member.

    Args:
        joint_profile:   UserProfile ORM object (is_joint == True). Contains merged
                         household constraints (diet_type, allergies, cuisines, etc.).
        member_targets:  List of per-member target dicts. Each dict has:
                           name (str), target_calories (int), target_protein (int),
                           target_carbs (int), target_fats (int), target_fiber (int),
                           medical_goals (List[str]), weight_goal (str), diet_type (str).

    Returns:
        str: Complete user message to send alongside FAMILY_COMPONENTS_SYSTEM_PROMPT.
    """
    household_ctx = _build_household_context(joint_profile)
    targets_table = _build_member_targets_table(member_targets)

    meals_per_day = joint_profile.meals_per_day_list if hasattr(joint_profile, "meals_per_day_list") else ["breakfast", "lunch", "dinner"]
    snacks = getattr(joint_profile, "snacks_per_day", 0) or 0
    total_meals = len(meals_per_day) + snacks
    meal_types_str = ", ".join(meals_per_day)
    if snacks > 0:
        meal_types_str += f" + {snacks} snack(s)"

    prompt = f"""{household_ctx}

## Per-Member Nutritional Targets

{targets_table}

## Meal Structure

Generate exactly {total_meals} meal(s) per day: {meal_types_str}.
Every day (day_of_week 0 through 6) must have all {total_meals} meal(s).

Generate a 7-day family component plan now. Return ONLY valid JSON."""

    return prompt


# ---------------------------------------------------------------------------
# 3.1.3 (builder)  build_supplement_prompt
# ---------------------------------------------------------------------------

def build_supplement_prompt(
    base_components: List[Dict],
    gap: Dict[str, str],
    joint_profile,
) -> str:
    """
    Build the user message for the supplement call.

    Called when PortionOptimizer returns feasible=False for a meal, providing
    context on what nutritional gaps exist and what components are already present
    so the LLM can suggest practical additions that close the gap.

    Args:
        base_components: Component list already in the meal (name, unit, cal_per_unit,
                         protein_per_unit, carbs_per_unit, fats_per_unit, fiber_per_unit).
        gap:             Dict mapping member name to gap description string produced by
                         PortionOptimizer when the LP is infeasible.
        joint_profile:   UserProfile ORM object (joint profile) used for allergy /
                         diet_type context.

    Returns:
        str: User message to send alongside SUPPLEMENT_PROMPT.
    """
    # Format gap descriptions
    gap_lines = "\n".join(
        f"- Member '{member}': {description}"
        for member, description in gap.items()
    )

    # Serialize existing components as compact JSON
    components_json = json.dumps(base_components, indent=2)

    # Safety context
    allergies = joint_profile.allergies_list if hasattr(joint_profile, "allergies_list") else []
    allergen_text = (
        f"ALLERGENS STILL FORBIDDEN: {', '.join(allergies)}"
        if allergies
        else "No allergens reported"
    )
    diet_type = getattr(joint_profile, "diet_type", "none")

    prompt = f"""## Gap Descriptions

{gap_lines}

## Base Components (already in this meal — do NOT repeat these)

{components_json}

## Household Safety Constraints

- Diet type: {diet_type} — supplements must comply
- {allergen_text}

Suggest 2–3 supplement components that close the gaps above. Return ONLY valid JSON."""

    return prompt


# ---------------------------------------------------------------------------
# 3.1.4 (builder)  build_adjustment_description_prompt
# ---------------------------------------------------------------------------

def build_adjustment_description_prompt(
    meals_with_allocations: List[Dict],
    member_targets: List[Dict],
) -> str:
    """
    Build the user message for the adjustment description call.

    After the LP solver has produced numeric allocations for all meals in a day,
    this prompt asks the LLM to convert those allocations into friendly,
    natural-language descriptions for each member's plate.

    Args:
        meals_with_allocations: List of meal dicts, each containing:
            meal_type (str), dish_name (str), components (list),
            allocations (dict: {member_name: {component_name: units}}).
            Only meals where "allocations" key is present should be included.
        member_targets: Per-member target metadata; used for name, weight_goal,
                        and medical_goals context shown to the LLM.

    Returns:
        str: User message listing all allocations formatted as readable tables.
    """
    # Build member context summary (weight goals, medical goals)
    member_ctx_lines = []
    for m in member_targets:
        goals = m.get("medical_goals", [])
        goals_str = f" | Goals: {', '.join(goals)}" if goals else ""
        member_ctx_lines.append(
            f"- {m.get('name', 'Unknown')}: weight_goal={m.get('weight_goal', 'maintain')}{goals_str}"
        )
    member_ctx = "\n".join(member_ctx_lines)

    # Format each meal's allocations as a readable table
    meal_blocks = []
    for meal in meals_with_allocations:
        allocations = meal.get("allocations", {})
        if not allocations:
            continue

        meal_type = meal.get("meal_type", "meal")
        dish_name = meal.get("dish_name", "unknown")
        components = meal.get("components", [])

        # Build unit lookup for natural phrasing
        unit_map = {c["name"]: c.get("unit", "unit") for c in components}

        member_lines = []
        for member_name, comp_allocs in allocations.items():
            parts = []
            for comp_name, units in comp_allocs.items():
                unit = unit_map.get(comp_name, "unit")
                parts.append(f"{comp_name} {units} {unit}")
            member_lines.append(f"  {member_name}: {', '.join(parts)}")

        block = f"Meal: {meal_type} — {dish_name}\n" + "\n".join(member_lines)
        meal_blocks.append(block)

    meals_text = "\n\n".join(meal_blocks) if meal_blocks else "No meals with allocations provided."

    prompt = f"""## Member Context

{member_ctx}

## Meal Allocations (LP Solver Output)

{meals_text}

Convert each member's numeric allocation into a natural-language adjustment description.
Return ONLY valid JSON."""

    return prompt


# ---------------------------------------------------------------------------
# 3.1.6  build_family_direct_prompt  (LLM-only workflow user message)
# ---------------------------------------------------------------------------

def build_family_direct_prompt(
    joint_profile,
    member_targets: List[Dict[str, Any]],
    feedback: List[str] = None,
) -> str:
    """
    Build the user message for the LLM-only workflow full-week generation call.

    Identical household context and per-member table as build_family_components_prompt,
    but with a closing instruction that asks for per-member servings rather than
    component breakdowns. Supports an optional feedback parameter for retry calls
    when the validator finds that a previous attempt was nutritionally off-target.

    Args:
        joint_profile:   UserProfile ORM object (is_joint == True).
        member_targets:  List of per-member target dicts.
        feedback:        Optional list of validator warning strings from a previous
                         failed attempt. When provided and non-empty, a corrections
                         section is appended asking the LLM to fix the issues.

    Returns:
        str: Complete user message to send alongside FAMILY_DIRECT_SYSTEM_PROMPT.
    """
    household_ctx = _build_household_context(joint_profile)
    targets_table = _build_member_targets_table(member_targets)

    meals_per_day = joint_profile.meals_per_day_list if hasattr(joint_profile, "meals_per_day_list") else ["breakfast", "lunch", "dinner"]
    snacks = getattr(joint_profile, "snacks_per_day", 0) or 0
    total_meals = len(meals_per_day) + snacks
    meal_types_str = ", ".join(meals_per_day)
    if snacks > 0:
        meal_types_str += f" + {snacks} snack(s)"

    n_members = len(member_targets)

    prompt = f"""{household_ctx}

## Per-Member Nutritional Targets

{targets_table}

## Meal Structure

Generate exactly {total_meals} meal(s) per day: {meal_types_str}.
Every day (day_of_week 0 through 6) must have all {total_meals} meal(s).

Generate a complete 7-day family meal plan now. Every meal must include a \
`member_servings` array with exactly {n_members} entries (one per member listed above). \
Return ONLY valid JSON."""

    # Append feedback section for retry calls — instructs the LLM to address
    # specific nutritional deviations flagged by FamilyPlanValidator.
    if feedback:
        feedback_lines = "\n".join(f"- {w}" for w in feedback)
        prompt += f"""

## CORRECTIONS REQUIRED (from previous attempt — fix these)

{feedback_lines}

Regenerate the complete 7-day plan addressing all corrections above."""

    return prompt
