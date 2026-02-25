"""
Prompts for single meal swapping functionality.

These prompts guide the AI to generate a suitable replacement for a meal
while maintaining nutritional similarity and avoiding duplication.
"""

from typing import List, Dict, Any, Optional

from prompts.cuisine_library import build_cuisine_guidance


# JSON schema for single meal swap
SWAP_MEAL_JSON_SCHEMA = {
    "type": "object",
    "properties": {
        "meal": {
            "type": "object",
            "properties": {
                "meal_type": {"type": "string"},
                "dish_name": {"type": "string"},
                "description": {"type": "string"},
                "cuisine": {"type": "string"},
                "portion_size": {"type": "string", "description": "Exact quantities using cups/bowls/grams/pieces (e.g., '1 bowl (300g)', '1 cup pasta (250g) + 1 piece chicken (150g)'). NEVER vague '1 serving'."},
                "calories": {"type": "number"},
                "protein": {"type": "number"},
                "carbs": {"type": "number"},
                "fats": {"type": "number"},
                "fiber": {"type": "number"},
                "prep_time": {"type": "integer"}
            },
            "required": [
                "meal_type", "dish_name", "cuisine", "portion_size",
                "calories", "protein", "carbs", "fats", "fiber",
                "prep_time"
            ]
        }
    },
    "required": ["meal"]
}


def build_swap_prompt(
    current_meal: Dict[str, Any],
    day_meals: List[Dict[str, Any]],
    profile,
    reason: Optional[str] = None
) -> str:
    """
    Build the user prompt for swapping a single meal.

    Args:
        current_meal: The meal being replaced (dict with meal data)
        day_meals: All other meals for this day (to avoid duplication)
        profile: UserProfile ORM object
        reason: Optional user-provided reason for swap

    Returns:
        str: Complete user prompt for meal swap
    """
    # Get other meals for the day (excluding current meal)
    other_meal_names = [
        m.get('dish_name', '')
        for m in day_meals
        if m.get('id') != current_meal.get('id') and m.get('dish_name')
    ]

    # Build reason text
    reason_text = ""
    if reason and reason.strip():
        reason_text = f"\n\n**User's reason for swap**: {reason.strip()}\nPlease honor this preference while maintaining nutritional similarity."

    # Parse profile allergies and cuisines
    allergies = profile.allergies_list if hasattr(profile, 'allergies_list') else []
    allergies_text = ""
    if allergies and len(allergies) > 0:
        allergies_text = f"\n- **NEVER INCLUDE THESE ALLERGENS**: {', '.join(allergies)}"

    cuisines = profile.cuisines_list if hasattr(profile, 'cuisines_list') else []
    cuisines_text = ""
    if cuisines and len(cuisines) > 0:
        cuisines_text = f"\n- **CUISINES (meal MUST be from these cuisines ONLY)**: {', '.join(cuisines)}"

    # Other meals text
    other_meals_text = "- (none)" if not other_meal_names else "\n".join([f"- {name}" for name in other_meal_names])

    prompt = f"""Please generate a replacement for the following meal:

## Meal Being Replaced
- **Type**: {current_meal.get('meal_type', 'unknown')}
- **Current Dish**: {current_meal.get('dish_name', 'unknown')}
- **Cuisine**: {current_meal.get('cuisine', 'unknown')}
- **Calories**: {current_meal.get('calories', 0)} kcal
- **Protein**: {current_meal.get('protein', 0)}g
- **Carbs**: {current_meal.get('carbs', 0)}g
- **Fats**: {current_meal.get('fats', 0)}g

## Other Meals Planned for This Day
{other_meals_text}

**DO NOT duplicate any of these dishes or use overly similar ingredients.**

## Replacement Requirements
1. **Nutritional Match**: Target the same calories (±50) and macros (±5g) as the meal being replaced
2. **Completely Different**: Different dish name, different main ingredients, ideally different cuisine
3. **Same Meal Type**: Must be a {current_meal.get('meal_type', 'unknown')}
4. **No Duplication**: Must not match any other meals planned for this day
5. **NEVER** include condiments (chutneys, pickles, ketchup, soy sauce packets) as meal components or side dishes

## User Constraints
- **Diet Type**: {profile.diet_type}{allergies_text}{cuisines_text}
{build_cuisine_guidance(cuisines)}
- **Cooking Skill**: {profile.cooking_skill}
- **Max Cook Time**: {profile.max_cook_time} minutes
- **Household Size**: {profile.household_size}{reason_text}

Return a JSON object with this EXACT structure (use these exact field names):
{{
  "meal": {{
    "meal_type": "{current_meal.get('meal_type', 'breakfast')}",
    "dish_name": "...",
    "description": "...",
    "cuisine": "...",
    "portion_size": "...",
    "calories": 0,
    "protein": 0,
    "carbs": 0,
    "fats": 0,
    "fiber": 0,
    "prep_time": 0
  }}
}}

Do NOT include "ingredients" or "recipe_brief" — recipes are generated separately."""

    return prompt
