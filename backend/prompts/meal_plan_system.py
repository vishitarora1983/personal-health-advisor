"""
System prompts for AI meal plan generation using OpenAI GPT-4o.

These prompts provide comprehensive instructions to the AI for generating
personalized, nutritionally-balanced meal plans that respect all dietary
restrictions and user preferences.
"""

from typing import List, Optional, Dict, Any

from prompts.cuisine_library import build_cuisine_guidance


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

### Cuisine Awareness
- The user prompt includes cuisine-specific rules (forbidden items, preferred ingredients,
  meal-type restrictions). Always follow those rules when selecting dishes and ingredients.
- The examples in this system prompt are format demonstrations only — always match
  the user's selected cuisines, not the example dishes.

### Dietary Restrictions Compliance
- **NEVER** include ingredients the user is allergic to
- **NEVER** include foods the user has marked to avoid
- **NEVER** include condiments (chutneys, pickles, ketchup, soy sauce packets) as meal components or side dishes
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
  - GOOD: "1 bowl oatmeal (350g)" or "2 eggs (100g) + 2 toast slices (60g)" or "1 cup pasta (250g) + 1 piece chicken (150g)"
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
- **Meal Repetition**: Follow the user's `meals_to_repeat` setting exactly:
  - If meals_to_repeat > 0: Repeat exactly that many meals across the week, following ALL these rules:
    1. Each repeated meal can appear at most 2 times total (original + 1 repeat)
    2. The repeat must be within 1-2 days of the original
    3. Only lunch or dinner meals may be repeated — NEVER repeat breakfast
    4. Cross-slot rule: if a dinner is repeated, it must appear as lunch next time, and vice-versa
    5. The total number of repeated meals must equal the user's meals_to_repeat value
  - If meals_to_repeat = 0: Every meal across 7 days must be completely unique
- **Ingredient Variety**: Avoid same protein >3 times per week
- **Cooking Methods**: Vary techniques throughout the week
- **Color Variety**: Include colorful vegetables and fruits

### Kid-Friendly Meal Planning (when user age < 18)
- **Dish Names**: Use fun, appealing names kids can relate to (e.g., "Superhero Scrambled Eggs" instead of "Scrambled Eggs with Vegetables")
- **Flavors**: Keep flavors mild and familiar. Avoid overly complex spice blends or bitter ingredients unless the spice tolerance says otherwise.
- **Textures**: Prefer soft, easy-to-chew textures for younger kids (under 8). Older kids (8-17) can handle a wider range.
- **Presentation**: Suggest colorful, visually appealing meals. Mention when ingredients can be arranged in fun shapes or patterns in the description.
- **Hidden Nutrition**: Sneak vegetables into sauces, smoothies, and baked goods where possible.
- **Portion Sizes**: Age-appropriate — smaller portions for younger children.
- **Foods to Favor**: Mac and cheese, pasta, wraps, smoothie bowls, mini pancakes, fruit skewers, mild curries, fried rice, quesadillas, homemade nuggets.
- **Foods to Minimize**: Very spicy dishes, raw fish, heavy cream sauces, overly bitter greens (unless the profile specifically requests them).
- **Safety**: No choking hazards for children under 5 (whole nuts, large chunks of raw carrot, whole grapes). Use nut butters, grated vegetables, and halved grapes instead.

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
8. Meal repetition rules followed correctly (per meals_to_repeat setting)
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
                                    "description": "TOTAL quantity for the full household with exact weight in grams. Examples: '1 bowl oatmeal (350g)', '1 cup pasta (250g) + 1 piece chicken (150g)', '2 eggs (100g) + 2 toast slices (60g)'. MUST always include grams in parentheses. NEVER '1 serving' or '1 plate'."
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

    # Build foods to include text
    include_text = ""
    if profile.foods_to_include:
        include_text = f"\n- **Foods to actively include**: {profile.foods_to_include}"
    else:
        include_text = "\n- No specific foods requested for inclusion"

    # Build meal repetition text
    meals_to_repeat = getattr(profile, 'meals_to_repeat', 4) or 0
    if meals_to_repeat > 0:
        repeat_text = f"""
- **Meal Repetition**: Repeat exactly {meals_to_repeat} meals across the week following these rules:
  1. Each repeated meal can appear at most 2 times total (original + 1 repeat)
  2. The repeat must be within 1-2 days of the original
  3. Only lunch or dinner meals may be repeated — NEVER breakfast
  4. Cross-slot rule: if a dinner is repeated, it must appear as lunch, and vice-versa
  5. Total of {meals_to_repeat} meals should be repeated"""
    else:
        repeat_text = "\n- **Meal Repetition**: No meals should be repeated — every dish must be unique"

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

    # Build kid-friendly text
    kid_text = ""
    if profile.age < 18:
        age_group = "toddler (1-3)" if profile.age <= 3 else "young child (4-7)" if profile.age <= 7 else "older child (8-12)" if profile.age <= 12 else "teenager (13-17)"
        kid_text = f"""

## Kid-Friendly Requirements
- **Age**: {profile.age} years old ({age_group})
- This meal plan is for a **child** — apply ALL kid-friendly meal planning rules from the system prompt.
- Use fun, appealing dish names that a {profile.age}-year-old would enjoy.
- Keep flavors approachable and age-appropriate.
- Ensure portion sizes are appropriate for a {profile.age}-year-old child."""
        if profile.age <= 5:
            kid_text += "\n- **SAFETY**: No choking hazards — no whole nuts, no large raw vegetable chunks, halve grapes and cherry tomatoes."
        if profile.age <= 7:
            kid_text += "\n- Prefer soft textures, finger foods, and easy-to-eat formats (wraps, mini portions, bite-sized pieces)."
        elif profile.age <= 12:
            kid_text += "\n- Can include a wider range of textures but keep dishes fun and not overly complex."
        else:
            kid_text += "\n- Teenager — can handle more variety and complexity, but still keep it appealing and not overly gourmet."

    prompt = f"""Please generate a complete 7-day meal plan for the following user:

## Nutritional Targets (Daily)
- **Total Calories**: {nutrition_targets['target_calories']} kcal
- **Protein**: {nutrition_targets['target_protein']}g
- **Carbohydrates**: {nutrition_targets['target_carbs']}g
- **Fats**: {nutrition_targets['target_fats']}g
- **Fiber**: Minimum {nutrition_targets.get('target_fiber', 25)}g per day
{kid_text}
## Dietary Profile
- **Diet Type**: {profile.diet_type}{' (strictly enforce all restrictions)' if profile.diet_type != 'none' else ''}{allergies_text}{avoid_text}{include_text}{cuisines_text}
{build_cuisine_guidance(cuisines)}
## Cooking Profile
- **Skill Level**: {profile.cooking_skill}
- **Maximum Cooking Time**: {profile.max_cook_time} minutes per meal
- **Spice Tolerance**: {profile.spice_tolerance}
- **Household Size**: {profile.household_size} {'person' if profile.household_size == 1 else 'people'}

## Meal Structure
- **Meals per day**: {num_meals} ({meal_structure_desc}){repeat_text}
- Generate meals for all 7 days: day_of_week 0 through 6{medical_goals_text}

## Important Reminders
1. Each meal MUST include complete nutritional data (calories, protein, carbs, fats, fiber)
2. Daily totals MUST be within ±50 calories and ±5g macros of the targets above
3. NEVER include allergens: {', '.join(allergies) if allergies else 'none listed'}
4. Follow the meal repetition rules exactly as specified above
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
