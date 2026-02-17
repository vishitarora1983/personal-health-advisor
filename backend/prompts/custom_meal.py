"""
Prompts for custom meal entry — analyzing user-described dishes.

These prompts guide the AI to return full nutritional info for a meal
described in natural language (e.g., "chicken biryani with raita").
"""

from typing import Dict, Any, Optional


CUSTOM_MEAL_JSON_SCHEMA = {
    "type": "object",
    "properties": {
        "meal": {
            "type": "object",
            "properties": {
                "dish_name": {"type": "string"},
                "description": {"type": "string"},
                "cuisine": {"type": "string"},
                "portion_size": {
                    "type": "string",
                    "description": "Exact quantities using cups/bowls/grams/pieces (e.g., '1 bowl (300g)', '2 rotis + 1 cup dal'). NEVER vague '1 serving'."
                },
                "calories": {"type": "number"},
                "protein": {"type": "number"},
                "carbs": {"type": "number"},
                "fats": {"type": "number"},
                "fiber": {"type": "number"},
                "sodium": {"type": "number"},
                "sugar": {"type": "number"},
                "prep_time": {"type": "integer"}
            },
            "required": [
                "dish_name", "description", "cuisine", "portion_size",
                "calories", "protein", "carbs", "fats", "fiber",
                "prep_time"
            ]
        },
        "warnings": {
            "type": "array",
            "items": {"type": "string"},
            "description": "Dietary warnings (allergens, diet conflicts). Empty array if none."
        }
    },
    "required": ["meal", "warnings"]
}


def build_custom_meal_prompt(
    description: str,
    meal_type: str,
    profile,
    nutrition_targets: Optional[Dict[str, Any]] = None
) -> str:
    """
    Build the user prompt for analyzing a user-described custom meal.

    Args:
        description: Free-text meal description from the user
        meal_type: The meal slot being replaced (breakfast, lunch, dinner, snack)
        profile: UserProfile ORM object
        nutrition_targets: Optional calculated nutrition targets for portion guidance

    Returns:
        str: Complete user prompt for custom meal analysis
    """
    # Meal type calorie share (approximate % of daily total)
    meal_shares = {
        "breakfast": 25,
        "lunch": 35,
        "dinner": 30,
        "snack": 10,
    }
    share_pct = meal_shares.get(meal_type, 25)

    # Build target guidance if nutrition_targets available
    target_text = ""
    if nutrition_targets:
        daily_cal = nutrition_targets.get("target_calories", 2000)
        meal_cal = round(daily_cal * share_pct / 100)
        target_text = f"""
## Portion Sizing Guidance
- This meal slot ({meal_type}) is ~{share_pct}% of the daily calorie budget
- Target for this slot: ~{meal_cal} kcal (from {daily_cal} kcal daily total)
- Size the TOTAL portion to hit this target as closely as reasonable for the dish described
- If the dish is inherently lighter or heavier, adjust portion size accordingly"""

    # Parse profile constraints
    allergies = profile.allergies_list if hasattr(profile, 'allergies_list') else []
    allergies_text = ""
    if allergies:
        allergies_text = f"\n- **ALLERGENS TO CHECK**: {', '.join(allergies)}"

    foods_to_avoid = ""
    if profile.foods_to_avoid:
        foods_to_avoid = f"\n- **Foods to avoid**: {profile.foods_to_avoid}"

    prompt = f"""Analyze the following user-described meal and return complete nutritional information:

## User's Meal Description
"{description}"

## Meal Slot
- **Type**: {meal_type}

## User Profile
- **Diet Type**: {profile.diet_type}
- **Household Size**: {profile.household_size}{allergies_text}{foods_to_avoid}
- **Cooking Skill**: {profile.cooking_skill}
- **Max Cook Time**: {profile.max_cook_time} minutes
{target_text}

## Instructions
1. **Identify the dish**: Clean up the name, determine cuisine
2. **Calculate TOTAL portion**: Size for {profile.household_size} person(s) total. portion_size must use exact quantities with grams (e.g., "1 bowl (300g)", "2 rotis + 1 cup dal (350g total)")
3. **Calculate TOTAL nutrition**: All calorie and macro values are for the TOTAL portion ({profile.household_size} person(s))
4. **Estimate prep time**: Realistic prep + cook time in minutes
5. **Check dietary warnings**: Flag if the dish conflicts with the user's diet type ({profile.diet_type}), allergens, or foods to avoid. Include specific warnings like "This dish contains eggs — conflicts with vegan diet" or "Contains peanuts — listed allergen". Return empty array [] if no conflicts.

Return a JSON object with this EXACT structure:
{{
  "meal": {{
    "dish_name": "Properly Capitalized Dish Name",
    "description": "Brief 1-sentence description of the dish",
    "cuisine": "Indian/Italian/etc.",
    "portion_size": "exact quantities with grams",
    "calories": 0,
    "protein": 0,
    "carbs": 0,
    "fats": 0,
    "fiber": 0,
    "sodium": 0,
    "sugar": 0,
    "prep_time": 0
  }},
  "warnings": []
}}

Do NOT include "ingredients" or "recipe_brief" — recipes are generated separately.
NEVER use vague portions like "1 serving". Always include gram weights."""

    return prompt
