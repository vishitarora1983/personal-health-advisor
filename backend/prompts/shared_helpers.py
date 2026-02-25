"""
Shared prompt-building helpers for family meal plan prompts.

Both family_meal_plan.py and family_swap_meal.py need to render:
  - A household-level context block (diet, allergies, cuisines, cooking constraints)
  - A per-member nutritional targets Markdown table

Centralising these here keeps the rendering logic in one place, eliminating the
previously duplicated inline table-building code in family_swap_meal.py.

Importers:
  from prompts.shared_helpers import build_household_context, build_member_targets_table
"""

from typing import List, Dict, Any

from prompts.cuisine_library import build_cuisine_guidance


def build_household_context(joint_profile) -> str:
    """
    Build the household-level context block rendered from a joint UserProfile.

    Produces a consistent Markdown section covering diet_type, allergies, cuisines,
    cooking constraints, and food preferences that is shared across all family
    prompt builders. Handles empty lists gracefully.

    Args:
        joint_profile: UserProfile ORM object where is_joint == True.

    Returns:
        str: Formatted Markdown block ready to embed in a larger prompt.
    """
    allergies = joint_profile.allergies_list if hasattr(joint_profile, "allergies_list") else []
    cuisines = joint_profile.cuisines_list if hasattr(joint_profile, "cuisines_list") else []
    meals_per_day = (
        joint_profile.meals_per_day_list
        if hasattr(joint_profile, "meals_per_day_list")
        else ["breakfast", "lunch", "dinner"]
    )

    # Allergy clause — most critical safety constraint
    if allergies:
        allergen_text = (
            f"**ALLERGENS (MUST NEVER APPEAR in any component, ingredient, or dish)**: "
            f"{', '.join(allergies)}"
        )
    else:
        allergen_text = "No household allergens reported"

    # Cuisine clause
    if cuisines:
        cuisine_text = (
            f"**CUISINES (ALL meals MUST come from these cuisines ONLY)**: "
            f"{', '.join(cuisines)}"
        )
    else:
        cuisine_text = "No specific cuisine restriction — use a variety of cuisines"

    # Foods to avoid
    foods_avoid = getattr(joint_profile, "foods_to_avoid", None)
    avoid_text = f"- **Foods to avoid**: {foods_avoid}" if foods_avoid else "- No foods to avoid"

    # Foods to include
    foods_include = getattr(joint_profile, "foods_to_include", None)
    include_text = (
        f"- **Foods to actively include**: {foods_include}"
        if foods_include
        else "- No specific inclusion preferences"
    )

    # Meal structure
    snacks = getattr(joint_profile, "snacks_per_day", 0) or 0
    meal_types_str = ", ".join(meals_per_day)
    if snacks > 0:
        meal_types_str += f" + {snacks} snack(s)"

    context = f"""## Household Constraints

- **Diet type**: {getattr(joint_profile, 'diet_type', 'none')} — applies to ALL members and ALL meals
- {allergen_text}
- {cuisine_text}
- **Cooking skill**: {getattr(joint_profile, 'cooking_skill', 'intermediate')}
- **Max cook time**: {getattr(joint_profile, 'max_cook_time', 45)} minutes — ALL prep_time values must respect this
- **Spice tolerance**: {getattr(joint_profile, 'spice_tolerance', 'medium')}
- **Meals per day**: {meal_types_str}
{avoid_text}
{include_text}"""

    # Inject cuisine-specific rules (do's/don'ts) when matching cuisines are selected
    cuisine_guidance = build_cuisine_guidance(cuisines)
    if cuisine_guidance:
        context += "\n\n" + cuisine_guidance

    return context


def build_member_targets_table(member_targets: List[Dict[str, Any]]) -> str:
    """
    Render per-member nutritional targets as a Markdown table.

    Used by both the weekly plan prompt (family_meal_plan.py) and the single-meal
    swap prompt (family_swap_meal.py) so the table format is identical in both
    contexts and never diverges.

    Args:
        member_targets: List of per-member target dicts, each containing:
            name, target_calories, target_protein, target_carbs, target_fats,
            target_fiber, medical_goals (list), weight_goal, diet_type.

    Returns:
        str: Markdown table string suitable for embedding in an LLM prompt.
    """
    header = (
        "| Member | Daily Calories | Protein (g) | Carbs (g) | "
        "Fats (g) | Fiber (g) | Medical Goals | Weight Goal |"
    )
    separator = "|---|---|---|---|---|---|---|---|"

    rows = []
    for m in member_targets:
        goals = m.get("medical_goals", [])
        goals_str = ", ".join(goals) if goals else "none"
        rows.append(
            f"| {m.get('name', 'Unknown')} "
            f"| {m.get('target_calories', 0)} "
            f"| {m.get('target_protein', 0)} "
            f"| {m.get('target_carbs', 0)} "
            f"| {m.get('target_fats', 0)} "
            f"| {m.get('target_fiber', 25)} "
            f"| {goals_str} "
            f"| {m.get('weight_goal', 'maintain')} |"
        )

    return "\n".join([header, separator] + rows)
