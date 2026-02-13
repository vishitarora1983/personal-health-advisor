"""
System prompts for AI meal plan generation using OpenAI GPT-4o.

These prompts provide comprehensive instructions to the AI for generating
personalized, nutritionally-balanced meal plans that respect all dietary
restrictions and user preferences.
"""

from typing import List, Optional, Dict, Any


# Main system prompt for full weekly meal plan generation
SYSTEM_PROMPT = """You are an expert nutritionist and meal planner with deep knowledge of nutrition science, culinary arts, and dietary health. Your role is to create personalized, practical, and delicious meal plans.

## CRITICAL RULES

### Nutritional Requirements
- Each meal MUST include complete and accurate nutritional information: calories, protein, carbs, fats, fiber
- Daily total calories MUST be within ±50 calories of the target
- Daily macros MUST be within ±5g of targets (protein, carbs, fats)
- Use USDA nutritional database standards for accuracy
- Account for cooking methods (oil, butter, etc.) in calorie calculations

### Meal Distribution Guidelines
- **Breakfast**: 25% of daily calories
- **Lunch**: 35% of daily calories
- **Dinner**: 30% of daily calories
- **Snacks**: 10% of daily calories (split evenly across number of snacks)

### Dietary Restrictions Compliance
- **NEVER** include ingredients the user is allergic to
- **NEVER** include foods the user has marked to avoid
- Respect diet type strictly:
  - `vegetarian`: No meat, poultry, fish, seafood
  - `vegan`: No animal products (meat, dairy, eggs, honey)
  - `pescatarian`: No meat or poultry, fish/seafood OK
  - `keto`: Very low carb (<50g/day), high fat (70% calories), moderate protein
  - `paleo`: No grains, legumes, dairy, processed foods
  - `mediterranean`: Focus on olive oil, fish, vegetables, whole grains

### Cooking Complexity
- **Beginner**:
  - Maximum 8 ingredients per recipe
  - Simple techniques (baking, boiling, pan-frying)
  - Prep time 50% of max_cook_time
- **Intermediate**:
  - Up to 12 ingredients
  - Moderate techniques (sautéing, roasting, marinating)
  - Prep time can use full max_cook_time
- **Advanced**:
  - No ingredient limit
  - Complex techniques allowed
  - Can exceed max_cook_time slightly if justified

### Recipe Quality Standards
- **CRITICAL: Portion sizes MUST be exact with weight in grams**. Every portion_size MUST include total grams in parentheses.
  - GOOD: "2 rotis (120g) + 1 cup dal (250g)" or "1 bowl oatmeal (350g)" or "2 eggs (100g) + 2 toast slices (60g)"
  - BAD: "1 serving", "1 plate", "1 portion", "a bowl of..." — these are NEVER acceptable
- For households with multiple people, portion_size is the TOTAL for the entire household. Always state the total weight.
- Ingredients must include specific quantities and units
- Recipe brief must be 2-4 sentences with clear, actionable steps
- Prep time must not exceed user's max_cook_time (unless advanced skill)

### Spice Tolerance
- `mild`: No hot peppers, minimal spices
- `medium`: Moderate spices, some heat OK
- `hot`: Full heat levels allowed

### Variety and Diversity
- **No Repeated Dishes**: Every meal across 7 days must be unique
- **Ingredient Variety**: Avoid same protein >3 times per week
- **Cooking Methods**: Vary techniques throughout the week
- **Color Variety**: Include colorful vegetables and fruits

### Medical Goal Adjustments

**diabetes_management**:
- Low glycemic index foods (<55 GI)
- Limit simple carbs and refined sugars
- Complex carbs with fiber (whole grains, legumes)
- Pair carbs with protein/fat for steady blood sugar
- Avoid: white bread, white rice, sugary drinks
- Favor: steel-cut oats, quinoa, beans, non-starchy vegetables

**heart_health**:
- Sodium limit: <1500mg per day total
- Saturated fat: <7% of total calories
- High fiber: minimum 30g per day
- Omega-3 rich foods: salmon, walnuts, flaxseed
- Avoid: processed meats, fried foods, high-sodium canned goods
- Favor: olive oil, nuts, whole grains, leafy greens

**high_protein**:
- Protein should be 30-35% of total calories
- Include lean protein at every meal
- Protein-rich snacks
- Favor: chicken breast, fish, lean beef, eggs, legumes, tofu

**muscle_building**:
- Protein: 1.6-2.2g per kg body weight
- Adequate carbs for energy (40-50% of calories)
- Leucine-rich foods: whey, chicken, fish, eggs
- Favor: whole eggs, salmon, Greek yogurt, lean meats

## OUTPUT FORMAT

You MUST return valid JSON matching the provided schema exactly. The JSON must be:
- Properly formatted with correct syntax
- Include all required fields
- Use correct data types (numbers for nutritional values, not strings)
- Have no additional fields beyond the schema
- Be parseable by standard JSON parsers

## QUALITY ASSURANCE

Before returning, verify:
1. All 7 days present (day_of_week 0 through 6)
2. Each day has correct number of meals based on user's meals_per_day
3. Daily calorie totals within ±50 of target
4. Daily macro totals within ±5g of targets
5. No allergens in any ingredient list
6. All diet type restrictions honored
7. Prep times within limits
8. All dishes unique (no duplicates)
9. All required JSON fields present and correctly typed
10. Recipe briefs clear and actionable
"""


# JSON schema for weekly meal plan structured output
MEAL_PLAN_JSON_SCHEMA = {
    "type": "object",
    "properties": {
        "weekly_plan": {
            "type": "array",
            "description": "Array of 7 daily plans (day_of_week 0 to 6)",
            "items": {
                "type": "object",
                "properties": {
                    "day_of_week": {
                        "type": "integer",
                        "description": "0=Day 1, 1=Day 2, ..., 6=Day 7",
                        "minimum": 0,
                        "maximum": 6
                    },
                    "meals": {
                        "type": "array",
                        "description": "All meals for this day",
                        "items": {
                            "type": "object",
                            "properties": {
                                "meal_type": {
                                    "type": "string",
                                    "description": "breakfast, lunch, dinner, or snack"
                                },
                                "dish_name": {
                                    "type": "string",
                                    "description": "Name of the dish"
                                },
                                "description": {
                                    "type": "string",
                                    "description": "Brief description or serving suggestion"
                                },
                                "cuisine": {
                                    "type": "string",
                                    "description": "Cuisine type (e.g., Indian, Italian)"
                                },
                                "portion_size": {
                                    "type": "string",
                                    "description": "TOTAL quantity for the full household with exact weight in grams. Examples: '1 bowl oatmeal (350g)', '2 rotis (120g) + 1 cup dal (250g)', '6 oz chicken breast (170g) + 1 cup rice (200g)'. MUST always include grams in parentheses. NEVER '1 serving' or '1 plate'."
                                },
                                "calories": {
                                    "type": "number",
                                    "description": "Total calories"
                                },
                                "protein": {
                                    "type": "number",
                                    "description": "Protein in grams"
                                },
                                "carbs": {
                                    "type": "number",
                                    "description": "Carbohydrates in grams"
                                },
                                "fats": {
                                    "type": "number",
                                    "description": "Fats in grams"
                                },
                                "fiber": {
                                    "type": "number",
                                    "description": "Fiber in grams"
                                },
                                "prep_time": {
                                    "type": "integer",
                                    "description": "Preparation time in minutes"
                                }
                            },
                            "required": [
                                "meal_type", "dish_name", "cuisine", "portion_size",
                                "calories", "protein", "carbs", "fats", "fiber",
                                "prep_time"
                            ]
                        }
                    }
                },
                "required": ["day_of_week", "meals"]
            }
        }
    },
    "required": ["weekly_plan"]
}


def build_user_prompt(profile, nutrition_targets: Dict[str, Any]) -> str:
    """
    Build the user prompt for meal plan generation.

    This dynamically constructs a detailed prompt based on the user's profile
    and calculated nutrition targets.

    Args:
        profile: UserProfile ORM object with dietary preferences
        nutrition_targets: Dict with target_calories, target_protein, target_carbs, target_fats

    Returns:
        str: Complete user prompt for the AI
    """
    # Parse JSON fields from profile
    medical_goals = profile.medical_goals_list if hasattr(profile, 'medical_goals_list') else []
    allergies = profile.allergies_list if hasattr(profile, 'allergies_list') else []
    cuisines = profile.cuisines_list if hasattr(profile, 'cuisines_list') else []
    meals_per_day = profile.meals_per_day_list if hasattr(profile, 'meals_per_day_list') else []

    # Build cuisines text
    cuisines_text = ""
    if cuisines and len(cuisines) > 0:
        cuisines_text = f"\n- **CUISINES (ALL meals MUST be from these cuisines ONLY)**: {', '.join(cuisines)}"
    else:
        cuisines_text = "\n- No specific cuisine preferences (use variety)"

    # Build allergies text
    allergies_text = ""
    if allergies and len(allergies) > 0:
        allergies_text = f"\n- **ALLERGIES (NEVER INCLUDE)**: {', '.join(allergies)}"
    else:
        allergies_text = "\n- No allergies reported"

    # Build foods to avoid text
    avoid_text = ""
    if profile.foods_to_avoid:
        avoid_text = f"\n- **Foods to avoid**: {profile.foods_to_avoid}"
    else:
        avoid_text = "\n- No specific foods to avoid"

    # Build medical goals text
    medical_goals_text = ""
    if medical_goals and len(medical_goals) > 0:
        medical_goals_text = f"\n- **Medical goals**: {', '.join(medical_goals)}"
        medical_goals_text += "\n  Apply the medical goal adjustments specified in the system prompt."

    # Determine meal structure
    num_meals = len(meals_per_day) + profile.snacks_per_day
    meal_structure_desc = f"{', '.join(meals_per_day)}"
    if profile.snacks_per_day > 0:
        meal_structure_desc += f" + {profile.snacks_per_day} snack(s)"

    prompt = f"""Please generate a complete 7-day meal plan for the following user:

## Nutritional Targets (Daily)
- **Total Calories**: {nutrition_targets['target_calories']} kcal
- **Protein**: {nutrition_targets['target_protein']}g
- **Carbohydrates**: {nutrition_targets['target_carbs']}g
- **Fats**: {nutrition_targets['target_fats']}g
- **Fiber**: Minimum {nutrition_targets.get('target_fiber', 25)}g per day

## Dietary Profile
- **Diet Type**: {profile.diet_type}{' (strictly enforce all restrictions)' if profile.diet_type != 'none' else ''}{allergies_text}{avoid_text}{cuisines_text}

## Cooking Profile
- **Skill Level**: {profile.cooking_skill}
- **Maximum Cooking Time**: {profile.max_cook_time} minutes per meal
- **Spice Tolerance**: {profile.spice_tolerance}
- **Household Size**: {profile.household_size} {'person' if profile.household_size == 1 else 'people'}

## Meal Structure
- **Meals per day**: {num_meals} ({meal_structure_desc})
- Generate meals for all 7 days: day_of_week 0 through 6{medical_goals_text}

## Important Reminders
1. Each meal MUST include complete nutritional data (calories, protein, carbs, fats, fiber)
2. Daily totals MUST be within ±50 calories and ±5g macros of the targets above
3. NEVER include allergens: {', '.join(allergies) if allergies else 'none listed'}
4. All meals must be unique across the 7 days
5. **ALL nutritional values (calories, protein, carbs, fats, fiber) are the TOTAL for {profile.household_size} {'person' if profile.household_size == 1 else 'people combined'}**
6. **Portion sizes MUST be the TOTAL quantity for {profile.household_size} {'person' if profile.household_size == 1 else 'people'}, always including weight in grams** (e.g., "2 bowls oatmeal (700g total)" for 2 people, or "1 bowl oatmeal (350g)" for 1 person). NEVER use vague terms like "1 serving".
7. Do NOT include "ingredients" or "recipe_brief" — recipes are generated separately

Please generate the complete 7-day meal plan now as a JSON object with this exact structure:
{{
  "weekly_plan": [
    {{
      "day_of_week": 0,
      "meals": [
        {{
          "meal_type": "breakfast",
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
      ]
    }}
  ]
}}

Do NOT include "ingredients" or "recipe_brief" fields — recipes are generated separately on demand.

The top-level key MUST be "weekly_plan" containing an array of exactly 7 day objects."""

    return prompt
