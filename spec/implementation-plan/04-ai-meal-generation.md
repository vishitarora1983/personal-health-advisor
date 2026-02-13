# 04 — AI Meal Plan Generation (Phase 3)

## Overview

This is the core feature of the AI Personal Meal Planner. It uses OpenAI GPT-4o with structured JSON output to generate personalized 7-day meal plans based on user profile, nutrition targets, dietary restrictions, and cooking preferences.

The AI generates complete meal plans with:
- Exact nutritional information per meal
- Full ingredient lists with quantities
- Recipe instructions
- Respect for dietary restrictions, allergies, and preferences
- Appropriate cooking complexity based on skill level
- Variety across the week

**Estimated Development Time:** 2-3 weeks

**Critical Dependencies:** Phase 1 (User Profile) and Phase 2 (Nutrition Calculator) must be complete.

---

## Backend Implementation

### 1. OpenAI Service Configuration

**File:** `backend/config/settings.py`

Add to existing settings:

```python
import os
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    # ... existing settings ...

    # OpenAI Configuration
    OPENAI_API_KEY: str = os.getenv("OPENAI_API_KEY", "")
    OPENAI_MODEL: str = "gpt-4o"
    OPENAI_TEMPERATURE: float = 0.7
    OPENAI_MAX_TOKENS: int = 16000
    OPENAI_TIMEOUT: int = 60  # seconds
    OPENAI_MAX_RETRIES: int = 2

    class Config:
        env_file = ".env"
        case_sensitive = True

settings = Settings()
```

**Environment Variables (.env):**

```bash
OPENAI_API_KEY=sk-...your-key-here...
```

---

### 2. System Prompts

**File:** `backend/prompts/meal_plan_system.py`

```python
"""
System prompts for AI meal plan generation.
These prompts guide the AI to produce high-quality, personalized meal plans.
"""

MEAL_PLAN_SYSTEM_PROMPT = """You are an expert nutritionist and meal planner with deep knowledge of nutrition science, culinary arts, and dietary health. Your role is to create personalized, practical, and delicious meal plans that are:

1. **Nutritionally Balanced**: Meet the user's specific daily calorie and macronutrient targets with precision
2. **Respectful of Constraints**: Honor all dietary restrictions, allergies, foods to avoid, and diet type requirements
3. **Skill-Appropriate**: Match the user's cooking skill level and time constraints
4. **Varied and Interesting**: Provide diverse meals across the week with no repeated dishes
5. **Practical**: Use ingredients available at standard grocery stores
6. **Properly Portioned**: Account for household size and individual serving needs

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
  - `gluten_free`: No wheat, barley, rye, or gluten-containing ingredients
  - `dairy_free`: No milk, cheese, yogurt, butter, cream

### Cooking Complexity
- **Beginner**:
  - Maximum 8 ingredients per recipe
  - Simple cooking techniques (baking, boiling, pan-frying)
  - Common ingredients only
  - Clear, simple steps
  - Prep time should be 50% of max_cook_time
- **Intermediate**:
  - Up to 12 ingredients
  - Moderate techniques (sautéing, roasting, marinating)
  - Some specialty ingredients OK
  - Prep time can use full max_cook_time
- **Advanced**:
  - No ingredient limit
  - Complex techniques allowed (sous vide, fermentation, etc.)
  - Specialty ingredients encouraged
  - Can exceed max_cook_time slightly if justified

### Recipe Quality Standards
- **Portion Sizes**: Always specify exact portions (e.g., "1 cup cooked rice (200g)", "6 oz grilled chicken breast (170g)")
- **Ingredients**: Include specific quantities and units (metric or imperial based on region)
- **Recipe Brief**: Provide 2-4 sentences with key cooking steps in logical order
- **Prep Time**: Must not exceed user's max_cook_time (unless skill level is advanced)
- **Spice Tolerance**:
  - `mild`: No hot peppers, minimal spices
  - `medium`: Moderate spices, some heat OK
  - `hot`: Full heat levels allowed
  - `very_hot`: Include spicy cuisines and hot peppers

### Variety and Diversity
- **No Repeated Dishes**: Every meal across the 7 days must be unique
- **Cuisine Variety**: If user has preferred cuisines, distribute them across the week
- **Ingredient Variety**: Avoid using the same protein or main ingredient more than 3 times per week
- **Cooking Methods**: Vary cooking techniques throughout the week
- **Color Variety**: Include colorful vegetables and fruits for nutritional diversity

### Medical Goal Adjustments

When user has specific medical goals, apply these additional constraints:

- **diabetes_management**:
  - Low glycemic index foods (<55 GI)
  - Limit simple carbs and refined sugars
  - Complex carbs with fiber (whole grains, legumes)
  - Steady blood sugar: pair carbs with protein/fat
  - Avoid: white bread, white rice, sugary drinks, candy
  - Favor: steel-cut oats, quinoa, beans, non-starchy vegetables

- **heart_health**:
  - Sodium limit: <1500mg per day total
  - Saturated fat: <7% of total calories
  - Trans fat: 0g
  - High fiber: minimum 30g per day
  - Omega-3 rich foods: salmon, walnuts, flaxseed, chia seeds
  - Avoid: processed meats, fried foods, high-sodium canned goods
  - Favor: olive oil, nuts, whole grains, leafy greens

- **high_protein**:
  - Protein should be 30-35% of total calories (higher than standard)
  - Include lean protein at every meal
  - Protein-rich snacks: Greek yogurt, nuts, protein smoothies
  - Favor: chicken breast, fish, lean beef, eggs, legumes, tofu

- **muscle_building**:
  - Protein: 1.6-2.2g per kg body weight
  - Post-workout nutrition: protein + carbs within 2 hours
  - Adequate carbs for energy (40-50% of calories)
  - Leucine-rich foods: whey, chicken, fish, eggs
  - Caloric surplus if appropriate (consult user's targets)
  - Favor: whole eggs, salmon, Greek yogurt, lean meats, sweet potatoes

- **weight_loss**:
  - High satiety foods: high fiber, high protein, high water content
  - Avoid: calorie-dense foods without nutritional value
  - Favor: vegetables, lean proteins, whole grains, fruits
  - Volume eating: large portions of low-calorie foods

- **gut_health**:
  - Prebiotic foods: onions, garlic, asparagus, bananas
  - Probiotic foods: yogurt, kefir, sauerkraut, kimchi
  - High fiber: minimum 30g per day
  - Fermented foods throughout the week
  - Avoid: highly processed foods, artificial sweeteners

## OUTPUT FORMAT

You MUST return a valid JSON object that exactly matches the schema provided. The JSON must be:
- Properly formatted with correct syntax
- Include all required fields
- Use correct data types (numbers for nutritional values, not strings)
- Have no additional fields beyond the schema
- Be parseable by standard JSON parsers

## QUALITY ASSURANCE

Before returning your response, verify:
1. All 7 days are present (Monday=0 through Sunday=6)
2. Each day has the correct number of meals based on user's meals_per_day
3. Daily calorie totals are within ±50 of the target
4. Daily macro totals are within ±5g of targets
5. No allergens appear in any ingredient list
6. All diet type restrictions are honored
7. Prep times are within limits
8. All dishes are unique (no duplicates)
9. All required JSON fields are present and correctly typed
10. Recipe briefs are clear and actionable

Remember: This meal plan will directly impact the user's health and wellbeing. Accuracy and personalization are paramount."""

# System prompt for single meal swaps
SWAP_SYSTEM_PROMPT = """You are an expert nutritionist generating a replacement meal for a user's meal plan.

Your task is to create a SINGLE meal that:
1. Has similar nutritional values to the meal being replaced (within ±50 calories, ±5g macros)
2. Is completely different from the meal being replaced (different dish, different cuisine if possible)
3. Does NOT duplicate any other meals planned for the same day
4. Respects all user dietary restrictions, allergies, and preferences
5. Matches the same meal type (breakfast, lunch, dinner, or snack)
6. Fits within the user's cooking skill level and time constraints

If the user provided a reason for swapping (e.g., "want something lighter", "different cuisine"), honor that preference while maintaining nutritional similarity.

Return a valid JSON object matching the single meal schema provided."""

# System prompt for regenerating a single day
REGENERATE_DAY_SYSTEM_PROMPT = """You are an expert nutritionist regenerating all meals for a single day in a user's weekly meal plan.

Your task is to create ALL meals for this specific day that:
1. Meet the user's daily calorie and macro targets
2. Are completely different from meals on other days of the week (variety across the week)
3. Respect all user dietary restrictions, allergies, and preferences
4. Follow the same meal distribution and quality standards as a full weekly plan
5. Fit within the user's cooking skill level and time constraints
6. Provide variety in cuisine, cooking methods, and ingredients

Context: You will be provided with meals from other days in the week. Ensure your generated meals are sufficiently different to provide weekly variety.

Return a valid JSON object with all meals for this single day matching the schema provided."""


def build_user_prompt(profile, nutrition_targets) -> str:
    """
    Build the user prompt for meal plan generation.

    This dynamically constructs a detailed prompt based on the user's profile
    and calculated nutrition targets.

    Args:
        profile: UserProfile object with dietary preferences and restrictions
        nutrition_targets: NutritionTargets object with calorie and macro goals

    Returns:
        str: Complete user prompt for the AI
    """

    # Determine meals per day structure
    meals_structure = {
        3: "breakfast, lunch, dinner",
        4: "breakfast, lunch, dinner + 1 snack",
        5: "breakfast, lunch, dinner + 2 snacks",
        6: "breakfast, mid-morning snack, lunch, afternoon snack, dinner, evening snack"
    }

    meals_desc = meals_structure.get(profile.meals_per_day, f"{profile.meals_per_day} meals")

    # Build cuisines list
    cuisines_text = ""
    if profile.preferred_cuisines and len(profile.preferred_cuisines) > 0:
        cuisines_text = f"\n- Preferred cuisines: {', '.join(profile.preferred_cuisines)}"
    else:
        cuisines_text = "\n- No specific cuisine preferences (use variety)"

    # Build allergies list
    allergies_text = ""
    if profile.allergies and len(profile.allergies) > 0:
        allergies_text = f"\n- **ALLERGIES (NEVER INCLUDE)**: {', '.join(profile.allergies)}"
    else:
        allergies_text = "\n- No allergies reported"

    # Build foods to avoid list
    avoid_text = ""
    if profile.foods_to_avoid and len(profile.foods_to_avoid) > 0:
        avoid_text = f"\n- **Foods to avoid**: {', '.join(profile.foods_to_avoid)}"
    else:
        avoid_text = "\n- No specific foods to avoid"

    # Build medical goals text
    medical_goals_text = ""
    if profile.medical_goals and len(profile.medical_goals) > 0:
        medical_goals_text = f"\n- **Medical goals**: {', '.join(profile.medical_goals)}"
        medical_goals_text += "\n  Apply the medical goal adjustments specified in the system prompt."

    # Build specific notes text
    notes_text = ""
    if profile.specific_notes and profile.specific_notes.strip():
        notes_text = f"\n- **Additional notes**: {profile.specific_notes.strip()}"

    prompt = f"""Please generate a complete 7-day meal plan for the following user:

## Nutritional Targets (Daily)
- **Total Calories**: {nutrition_targets.calories} kcal
- **Protein**: {nutrition_targets.protein}g ({nutrition_targets.protein_percentage}% of calories)
- **Carbohydrates**: {nutrition_targets.carbs}g ({nutrition_targets.carbs_percentage}% of calories)
- **Fats**: {nutrition_targets.fats}g ({nutrition_targets.fats_percentage}% of calories)
- **Fiber**: Minimum 25-30g per day

## Dietary Profile
- **Diet Type**: {profile.diet_type}{' (strictly enforce all restrictions for this diet)' if profile.diet_type != 'none' else ''}{allergies_text}{avoid_text}{cuisines_text}

## Cooking Profile
- **Skill Level**: {profile.cooking_skill}
- **Maximum Cooking Time**: {profile.max_cook_time} minutes per meal
- **Spice Tolerance**: {profile.spice_tolerance}
- **Household Size**: {profile.household_size} {'person' if profile.household_size == 1 else 'people'}

## Meal Structure
- **Meals per day**: {profile.meals_per_day} ({meals_desc})
- Generate meals for all 7 days: Monday (day_of_week: 0) through Sunday (day_of_week: 6){medical_goals_text}{notes_text}

## Important Reminders
1. Each meal MUST include complete nutritional data and full ingredient list with quantities
2. Daily totals MUST be within ±50 calories and ±5g macros of the targets above
3. NEVER include allergens: {', '.join(profile.allergies) if profile.allergies else 'none listed'}
4. All meals must be unique across the 7 days
5. Portion sizes should account for household size of {profile.household_size}
6. Recipe briefs should be clear, actionable, and match the {profile.cooking_skill} skill level

Please generate the complete 7-day meal plan now."""

    return prompt


def build_swap_prompt(
    current_meal: dict,
    day_meals: list[dict],
    profile,
    nutrition_targets,
    reason: str = None
) -> str:
    """
    Build the user prompt for swapping a single meal.

    Args:
        current_meal: The meal being replaced (dict with meal data)
        day_meals: All other meals for this day (to avoid duplication)
        profile: UserProfile object
        nutrition_targets: NutritionTargets object
        reason: Optional user-provided reason for swap

    Returns:
        str: Complete user prompt for meal swap
    """

    # Get other meals for the day (excluding current meal)
    other_meals = [m for m in day_meals if m.get('id') != current_meal.get('id')]
    other_dishes = [m.get('dish_name') for m in other_meals if m.get('dish_name')]

    # Build reason text
    reason_text = ""
    if reason and reason.strip():
        reason_text = f"\n\n**User's reason for swap**: {reason.strip()}\nPlease honor this preference while maintaining nutritional similarity."

    # Build allergies reminder
    allergies_text = ""
    if profile.allergies and len(profile.allergies) > 0:
        allergies_text = f"\n- **NEVER INCLUDE THESE ALLERGENS**: {', '.join(profile.allergies)}"

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
{chr(10).join([f"- {dish}" for dish in other_dishes]) if other_dishes else "- (none)"}

**DO NOT duplicate any of these dishes or use overly similar ingredients.**

## Replacement Requirements
1. **Nutritional Match**: Target the same calories (±50) and macros (±5g) as the meal being replaced
2. **Completely Different**: Different dish name, different main ingredients, ideally different cuisine
3. **Same Meal Type**: Must be a {current_meal.get('meal_type', 'unknown')}
4. **No Duplication**: Must not match any other meals planned for this day

## User Constraints
- **Diet Type**: {profile.diet_type}{allergies_text}
- **Cooking Skill**: {profile.cooking_skill}
- **Max Cook Time**: {profile.max_cook_time} minutes
- **Household Size**: {profile.household_size}{reason_text}

Please generate a single replacement meal that meets all these requirements."""

    return prompt


def build_regenerate_day_prompt(
    day_of_week: int,
    other_days_meals: list[dict],
    profile,
    nutrition_targets
) -> str:
    """
    Build the user prompt for regenerating all meals for a single day.

    Args:
        day_of_week: Integer 0-6 representing the day to regenerate
        other_days_meals: Meals from all other days (for variety context)
        profile: UserProfile object
        nutrition_targets: NutritionTargets object

    Returns:
        str: Complete user prompt for day regeneration
    """

    day_names = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]
    day_name = day_names[day_of_week]

    # Extract dish names from other days
    other_dishes = [m.get('dish_name') for m in other_days_meals if m.get('dish_name')]
    other_dishes_text = ", ".join(other_dishes[:20])  # Limit to first 20 for brevity
    if len(other_dishes) > 20:
        other_dishes_text += "..."

    # Determine meals per day structure
    meals_structure = {
        3: "breakfast, lunch, dinner",
        4: "breakfast, lunch, dinner + 1 snack",
        5: "breakfast, lunch, dinner + 2 snacks",
        6: "breakfast, mid-morning snack, lunch, afternoon snack, dinner, evening snack"
    }
    meals_desc = meals_structure.get(profile.meals_per_day, f"{profile.meals_per_day} meals")

    # Build allergies reminder
    allergies_text = ""
    if profile.allergies and len(profile.allergies) > 0:
        allergies_text = f"\n- **ALLERGIES (NEVER INCLUDE)**: {', '.join(profile.allergies)}"

    prompt = f"""Please regenerate ALL meals for {day_name} in the user's weekly meal plan.

## Day to Regenerate
- **Day**: {day_name} (day_of_week: {day_of_week})
- **Meals needed**: {profile.meals_per_day} ({meals_desc})

## Dishes Already Planned for Other Days
{other_dishes_text}

**Your generated meals must be sufficiently different from these to provide weekly variety.**

## Nutritional Targets (Daily for This Day)
- **Total Calories**: {nutrition_targets.calories} kcal
- **Protein**: {nutrition_targets.protein}g ({nutrition_targets.protein_percentage}% of calories)
- **Carbohydrates**: {nutrition_targets.carbs}g ({nutrition_targets.carbs_percentage}% of calories)
- **Fats**: {nutrition_targets.fats}g ({nutrition_targets.fats_percentage}% of calories)
- **Fiber**: Minimum 25-30g

## User Constraints
- **Diet Type**: {profile.diet_type}{allergies_text}
- **Cooking Skill**: {profile.cooking_skill}
- **Max Cook Time**: {profile.max_cook_time} minutes
- **Spice Tolerance**: {profile.spice_tolerance}
- **Household Size**: {profile.household_size}

## Meal Distribution
- Breakfast: ~{int(nutrition_targets.calories * 0.25)} kcal
- Lunch: ~{int(nutrition_targets.calories * 0.35)} kcal
- Dinner: ~{int(nutrition_targets.calories * 0.30)} kcal
- Snacks: ~{int(nutrition_targets.calories * 0.10)} kcal total

Please generate all {profile.meals_per_day} meals for {day_name} that meet these requirements and provide variety from the rest of the week."""

    return prompt
```

---

### 3. JSON Schemas for Structured Output

**File:** `backend/schemas/ai_schemas.py`

```python
"""
JSON schemas for OpenAI structured output.
These schemas enforce strict adherence to our expected response format.
"""

# Schema for a single ingredient
INGREDIENT_SCHEMA = {
    "type": "object",
    "properties": {
        "name": {
            "type": "string",
            "description": "Name of the ingredient (e.g., 'chicken breast', 'olive oil')"
        },
        "quantity": {
            "type": "string",
            "description": "Amount of ingredient (e.g., '2', '1.5', '1/4')"
        },
        "unit": {
            "type": "string",
            "description": "Unit of measurement (e.g., 'cup', 'tbsp', 'oz', 'g', 'pieces')"
        }
    },
    "required": ["name", "quantity", "unit"],
    "additionalProperties": False
}

# Schema for a single meal
MEAL_SCHEMA = {
    "type": "object",
    "properties": {
        "meal_type": {
            "type": "string",
            "description": "Type of meal",
            "enum": ["breakfast", "lunch", "dinner", "snack"]
        },
        "dish_name": {
            "type": "string",
            "description": "Name of the dish (e.g., 'Grilled Chicken Salad with Avocado')"
        },
        "description": {
            "type": "string",
            "description": "Brief appetizing description of the dish (1-2 sentences)"
        },
        "cuisine": {
            "type": "string",
            "description": "Cuisine type (e.g., 'Italian', 'Mexican', 'Asian', 'American', 'Mediterranean')"
        },
        "portion_size": {
            "type": "string",
            "description": "Specific portion size with measurements (e.g., '1 cup (200g)', '6 oz (170g)')"
        },
        "calories": {
            "type": "number",
            "description": "Total calories for this meal"
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
            "description": "Dietary fiber in grams"
        },
        "prep_time": {
            "type": "integer",
            "description": "Preparation and cooking time in minutes"
        },
        "ingredients": {
            "type": "array",
            "description": "Complete list of ingredients with quantities",
            "items": INGREDIENT_SCHEMA
        },
        "recipe_brief": {
            "type": "string",
            "description": "Brief cooking instructions (2-4 sentences with key steps)"
        }
    },
    "required": [
        "meal_type", "dish_name", "description", "cuisine", "portion_size",
        "calories", "protein", "carbs", "fats", "fiber", "prep_time",
        "ingredients", "recipe_brief"
    ],
    "additionalProperties": False
}

# Schema for a single day
DAY_SCHEMA = {
    "type": "object",
    "properties": {
        "day_of_week": {
            "type": "integer",
            "description": "Day of week (0=Monday, 1=Tuesday, ..., 6=Sunday)",
            "minimum": 0,
            "maximum": 6
        },
        "meals": {
            "type": "array",
            "description": "All meals for this day",
            "items": MEAL_SCHEMA
        },
        "total_calories": {
            "type": "number",
            "description": "Sum of all meal calories for this day"
        },
        "total_protein": {
            "type": "number",
            "description": "Sum of all meal protein for this day"
        },
        "total_carbs": {
            "type": "number",
            "description": "Sum of all meal carbs for this day"
        },
        "total_fats": {
            "type": "number",
            "description": "Sum of all meal fats for this day"
        }
    },
    "required": ["day_of_week", "meals", "total_calories", "total_protein", "total_carbs", "total_fats"],
    "additionalProperties": False
}

# Complete weekly meal plan schema
WEEKLY_MEAL_PLAN_SCHEMA = {
    "name": "weekly_meal_plan",
    "strict": True,
    "schema": {
        "type": "object",
        "properties": {
            "days": {
                "type": "array",
                "description": "All 7 days of the week",
                "items": DAY_SCHEMA,
                "minItems": 7,
                "maxItems": 7
            }
        },
        "required": ["days"],
        "additionalProperties": False
    }
}

# Single meal swap schema (returns just one meal)
SINGLE_MEAL_SWAP_SCHEMA = {
    "name": "single_meal_swap",
    "strict": True,
    "schema": {
        "type": "object",
        "properties": {
            "meal": MEAL_SCHEMA
        },
        "required": ["meal"],
        "additionalProperties": False
    }
}

# Single day regeneration schema (returns one day with all meals)
SINGLE_DAY_SCHEMA = {
    "name": "single_day_plan",
    "strict": True,
    "schema": {
        "type": "object",
        "properties": {
            "day": DAY_SCHEMA
        },
        "required": ["day"],
        "additionalProperties": False
    }
}
```

---

### 4. Pydantic Response Schemas

**File:** `backend/schemas/meal_plan.py`

```python
"""
Pydantic schemas for meal plan API requests and responses.
"""

from pydantic import BaseModel, Field, validator
from typing import List, Optional
from datetime import date, datetime
from enum import Enum


class MealType(str, Enum):
    """Enum for meal types"""
    BREAKFAST = "breakfast"
    LUNCH = "lunch"
    DINNER = "dinner"
    SNACK = "snack"


class PlanStatus(str, Enum):
    """Enum for meal plan status"""
    ACTIVE = "active"
    ARCHIVED = "archived"
    DRAFT = "draft"


class IngredientSchema(BaseModel):
    """Schema for a single ingredient"""
    name: str = Field(..., description="Name of the ingredient")
    quantity: str = Field(..., description="Amount (e.g., '2', '1.5', '1/4')")
    unit: str = Field(..., description="Unit of measurement (e.g., 'cup', 'tbsp', 'oz')")

    class Config:
        json_schema_extra = {
            "example": {
                "name": "chicken breast",
                "quantity": "6",
                "unit": "oz"
            }
        }


class MealResponse(BaseModel):
    """Schema for a single meal response"""
    id: Optional[int] = None
    meal_type: MealType
    dish_name: str
    description: str
    cuisine: str
    portion_size: str

    # Nutritional information
    calories: float
    protein: float
    carbs: float
    fats: float
    fiber: float

    # Recipe information
    prep_time: int = Field(..., description="Preparation time in minutes")
    ingredients: List[IngredientSchema]
    recipe_brief: str

    # Metadata
    created_at: Optional[datetime] = None

    @validator('calories', 'protein', 'carbs', 'fats', 'fiber')
    def round_nutrition_values(cls, v):
        """Round nutritional values to 1 decimal place"""
        return round(v, 1)

    class Config:
        from_attributes = True
        json_schema_extra = {
            "example": {
                "id": 1,
                "meal_type": "lunch",
                "dish_name": "Grilled Chicken Caesar Salad",
                "description": "Classic Caesar salad with grilled chicken breast, crisp romaine, and homemade dressing",
                "cuisine": "American",
                "portion_size": "2 cups salad + 6 oz chicken (400g total)",
                "calories": 450.0,
                "protein": 42.0,
                "carbs": 18.0,
                "fats": 24.0,
                "fiber": 4.5,
                "prep_time": 25,
                "ingredients": [
                    {"name": "chicken breast", "quantity": "6", "unit": "oz"},
                    {"name": "romaine lettuce", "quantity": "2", "unit": "cups"},
                    {"name": "parmesan cheese", "quantity": "1/4", "unit": "cup"}
                ],
                "recipe_brief": "Season chicken with salt and pepper, grill for 6-7 minutes per side until cooked through. Chop romaine lettuce and toss with Caesar dressing. Slice chicken and arrange over salad, top with parmesan and croutons."
            }
        }


class DailyPlanResponse(BaseModel):
    """Schema for a single day's meal plan"""
    id: Optional[int] = None
    day_of_week: int = Field(..., ge=0, le=6, description="0=Monday, 6=Sunday")
    day_date: Optional[date] = Field(None, description="Actual calendar date for this day")

    meals: List[MealResponse]

    # Daily totals
    total_calories: float
    total_protein: float
    total_carbs: float
    total_fats: float
    total_fiber: Optional[float] = 0.0

    @validator('day_date', pre=True)
    def parse_date(cls, v):
        """Parse date if it's a string"""
        if isinstance(v, str):
            return date.fromisoformat(v)
        return v

    class Config:
        from_attributes = True


class WeeklyPlanResponse(BaseModel):
    """Schema for complete weekly meal plan"""
    id: int
    user_id: int
    week_start_date: date
    status: PlanStatus

    days: List[DailyPlanResponse]

    created_at: datetime
    updated_at: Optional[datetime] = None

    @validator('week_start_date', pre=True)
    def parse_week_start(cls, v):
        """Parse date if it's a string"""
        if isinstance(v, str):
            return date.fromisoformat(v)
        return v

    class Config:
        from_attributes = True


class GeneratePlanResponse(BaseModel):
    """Response for plan generation"""
    message: str
    plan: WeeklyPlanResponse

    class Config:
        json_schema_extra = {
            "example": {
                "message": "Weekly meal plan generated successfully",
                "plan": {
                    "id": 1,
                    "user_id": 1,
                    "week_start_date": "2024-01-15",
                    "status": "active",
                    "days": []
                }
            }
        }


class MealSwapRequest(BaseModel):
    """Request schema for swapping a meal"""
    reason: Optional[str] = Field(
        None,
        description="Optional reason for swap (e.g., 'want something lighter', 'different cuisine')",
        max_length=500
    )

    class Config:
        json_schema_extra = {
            "example": {
                "reason": "I want something lighter and with less carbs"
            }
        }


class MealSwapResponse(BaseModel):
    """Response for meal swap"""
    message: str
    meal: MealResponse

    class Config:
        json_schema_extra = {
            "example": {
                "message": "Meal swapped successfully",
                "meal": {}
            }
        }


class RegenerateDayResponse(BaseModel):
    """Response for day regeneration"""
    message: str
    day: DailyPlanResponse

    class Config:
        json_schema_extra = {
            "example": {
                "message": "Day regenerated successfully",
                "day": {}
            }
        }
```

---

### 5. AI Meal Planner Service

**File:** `backend/services/ai_meal_planner.py`

```python
"""
AI Meal Planner Service - Core AI integration for meal plan generation.

This service handles all interactions with OpenAI's GPT-4o API for:
- Generating complete 7-day meal plans
- Swapping individual meals
- Regenerating single days

Security Considerations:
- API key stored in environment variables (never hardcoded)
- Input validation before sending to API
- Response validation after receiving from API
- Timeout protection to prevent hanging requests
- Retry logic for transient failures

Performance Considerations:
- Requests typically take 10-20 seconds for full weekly plans
- Single meal swaps take 3-5 seconds
- Implement proper loading states in frontend
- Consider caching strategies for repeated similar requests
"""

import json
import logging
from typing import Dict, List, Optional
from openai import OpenAI, APIError, APITimeoutError, RateLimitError
from tenacity import retry, stop_after_attempt, wait_exponential, retry_if_exception_type

from backend.config.settings import settings
from backend.prompts.meal_plan_system import (
    MEAL_PLAN_SYSTEM_PROMPT,
    SWAP_SYSTEM_PROMPT,
    REGENERATE_DAY_SYSTEM_PROMPT,
    build_user_prompt,
    build_swap_prompt,
    build_regenerate_day_prompt
)
from backend.schemas.ai_schemas import (
    WEEKLY_MEAL_PLAN_SCHEMA,
    SINGLE_MEAL_SWAP_SCHEMA,
    SINGLE_DAY_SCHEMA
)

# Configure logging
logger = logging.getLogger(__name__)

# Initialize OpenAI client
client = OpenAI(
    api_key=settings.OPENAI_API_KEY,
    timeout=settings.OPENAI_TIMEOUT,
    max_retries=0  # We handle retries manually with tenacity
)


class MealPlanGenerationError(Exception):
    """Raised when meal plan generation fails"""
    pass


class MealPlanValidationError(Exception):
    """Raised when generated meal plan fails validation"""
    pass


# Retry configuration for transient failures
@retry(
    stop=stop_after_attempt(settings.OPENAI_MAX_RETRIES),
    wait=wait_exponential(multiplier=1, min=2, max=10),
    retry=retry_if_exception_type((APITimeoutError, APIError)),
    reraise=True
)
def _call_openai_with_retry(
    system_prompt: str,
    user_prompt: str,
    json_schema: dict,
    temperature: float = None
) -> dict:
    """
    Call OpenAI API with retry logic for transient failures.

    Args:
        system_prompt: System prompt defining AI behavior
        user_prompt: User-specific prompt with requirements
        json_schema: JSON schema for structured output
        temperature: Override default temperature (optional)

    Returns:
        dict: Parsed JSON response from API

    Raises:
        APITimeoutError: Request timed out after retries
        RateLimitError: Rate limit exceeded
        APIError: Other API errors
        MealPlanGenerationError: Failed to parse or validate response
    """
    try:
        temp = temperature if temperature is not None else settings.OPENAI_TEMPERATURE

        logger.info(f"Calling OpenAI API with model {settings.OPENAI_MODEL}, temp={temp}")

        response = client.chat.completions.create(
            model=settings.OPENAI_MODEL,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt}
            ],
            response_format={
                "type": "json_schema",
                "json_schema": json_schema
            },
            temperature=temp,
            max_tokens=settings.OPENAI_MAX_TOKENS
        )

        # Extract and parse JSON response
        content = response.choices[0].message.content

        if not content:
            raise MealPlanGenerationError("Empty response from OpenAI API")

        try:
            parsed = json.loads(content)
        except json.JSONDecodeError as e:
            logger.error(f"Failed to parse JSON response: {e}")
            logger.error(f"Response content: {content[:500]}")
            raise MealPlanGenerationError(f"Invalid JSON response: {str(e)}")

        logger.info(f"Successfully received and parsed response. Tokens used: {response.usage.total_tokens}")

        return parsed

    except RateLimitError as e:
        logger.error(f"OpenAI rate limit exceeded: {e}")
        raise
    except APITimeoutError as e:
        logger.error(f"OpenAI API timeout: {e}")
        raise
    except APIError as e:
        logger.error(f"OpenAI API error: {e}")
        raise


def validate_weekly_plan(plan_data: dict, expected_meals_per_day: int) -> None:
    """
    Validate that the generated weekly plan meets basic requirements.

    Args:
        plan_data: Parsed JSON data from AI
        expected_meals_per_day: Number of meals expected per day

    Raises:
        MealPlanValidationError: If validation fails
    """
    try:
        # Check structure
        if "days" not in plan_data:
            raise MealPlanValidationError("Missing 'days' in response")

        days = plan_data["days"]

        # Check we have 7 days
        if len(days) != 7:
            raise MealPlanValidationError(f"Expected 7 days, got {len(days)}")

        # Check each day
        day_numbers_seen = set()

        for day in days:
            # Check day_of_week is valid and unique
            day_num = day.get("day_of_week")
            if day_num is None or day_num < 0 or day_num > 6:
                raise MealPlanValidationError(f"Invalid day_of_week: {day_num}")

            if day_num in day_numbers_seen:
                raise MealPlanValidationError(f"Duplicate day_of_week: {day_num}")
            day_numbers_seen.add(day_num)

            # Check meals
            meals = day.get("meals", [])
            if len(meals) != expected_meals_per_day:
                raise MealPlanValidationError(
                    f"Day {day_num}: Expected {expected_meals_per_day} meals, got {len(meals)}"
                )

            # Check each meal has required fields
            for meal in meals:
                required_fields = [
                    "meal_type", "dish_name", "description", "cuisine",
                    "portion_size", "calories", "protein", "carbs", "fats",
                    "fiber", "prep_time", "ingredients", "recipe_brief"
                ]
                for field in required_fields:
                    if field not in meal:
                        raise MealPlanValidationError(
                            f"Day {day_num}, meal '{meal.get('dish_name', 'unknown')}': Missing field '{field}'"
                        )

                # Check ingredients have required fields
                for ingredient in meal.get("ingredients", []):
                    if not all(k in ingredient for k in ["name", "quantity", "unit"]):
                        raise MealPlanValidationError(
                            f"Day {day_num}, meal '{meal.get('dish_name')}': Invalid ingredient {ingredient}"
                        )

        logger.info("Weekly plan validation passed")

    except KeyError as e:
        raise MealPlanValidationError(f"Missing required field: {e}")


def validate_single_meal(meal_data: dict) -> None:
    """
    Validate a single meal structure.

    Args:
        meal_data: Parsed meal JSON data

    Raises:
        MealPlanValidationError: If validation fails
    """
    required_fields = [
        "meal_type", "dish_name", "description", "cuisine",
        "portion_size", "calories", "protein", "carbs", "fats",
        "fiber", "prep_time", "ingredients", "recipe_brief"
    ]

    for field in required_fields:
        if field not in meal_data:
            raise MealPlanValidationError(f"Missing required field: {field}")

    # Validate ingredients
    for ingredient in meal_data.get("ingredients", []):
        if not all(k in ingredient for k in ["name", "quantity", "unit"]):
            raise MealPlanValidationError(f"Invalid ingredient: {ingredient}")

    logger.info(f"Meal validation passed for: {meal_data.get('dish_name')}")


def generate_weekly_plan(profile, nutrition_targets) -> dict:
    """
    Generate a complete 7-day meal plan using OpenAI GPT-4o.

    This is the primary function for meal plan generation. It:
    1. Builds personalized prompts from user profile and nutrition targets
    2. Calls OpenAI API with structured output schema
    3. Validates the response
    4. Returns parsed meal plan data

    Args:
        profile: UserProfile model instance with dietary preferences
        nutrition_targets: NutritionTargets model instance with calorie/macro goals

    Returns:
        dict: Parsed JSON containing 7 days of meal plans

    Raises:
        MealPlanGenerationError: If generation fails
        MealPlanValidationError: If validation fails
        RateLimitError: If OpenAI rate limit exceeded

    Performance Note:
        This typically takes 10-20 seconds. Frontend must show loading state.
    """
    logger.info(f"Generating weekly meal plan for user {profile.user_id}")
    logger.info(f"Targets: {nutrition_targets.calories} cal, {nutrition_targets.protein}p/{nutrition_targets.carbs}c/{nutrition_targets.fats}f")
    logger.info(f"Diet: {profile.diet_type}, Skill: {profile.cooking_skill}, Meals/day: {profile.meals_per_day}")

    try:
        # Build prompts
        user_prompt = build_user_prompt(profile, nutrition_targets)

        # Log prompt for debugging (truncated)
        logger.debug(f"User prompt: {user_prompt[:300]}...")

        # Call OpenAI with retry logic
        response_data = _call_openai_with_retry(
            system_prompt=MEAL_PLAN_SYSTEM_PROMPT,
            user_prompt=user_prompt,
            json_schema=WEEKLY_MEAL_PLAN_SCHEMA,
            temperature=settings.OPENAI_TEMPERATURE
        )

        # Validate response structure
        validate_weekly_plan(response_data, profile.meals_per_day)

        logger.info("Weekly meal plan generated and validated successfully")

        return response_data

    except (MealPlanGenerationError, MealPlanValidationError):
        # Re-raise our custom errors
        raise
    except RateLimitError:
        logger.error("OpenAI rate limit exceeded")
        raise MealPlanGenerationError(
            "Service temporarily unavailable due to high demand. Please try again in a few minutes."
        )
    except APITimeoutError:
        logger.error("OpenAI request timed out after retries")
        raise MealPlanGenerationError(
            "Request timed out. The meal plan generation is taking longer than expected. Please try again."
        )
    except Exception as e:
        logger.error(f"Unexpected error in generate_weekly_plan: {e}", exc_info=True)
        raise MealPlanGenerationError(f"Failed to generate meal plan: {str(e)}")


def swap_single_meal(
    profile,
    nutrition_targets,
    current_meal: dict,
    day_meals: List[dict],
    reason: Optional[str] = None
) -> dict:
    """
    Generate a replacement for a single meal.

    This function:
    1. Takes the current meal being replaced
    2. Considers other meals that day (to avoid duplication)
    3. Honors user's reason for swap if provided
    4. Generates a nutritionally similar but different meal

    Args:
        profile: UserProfile model instance
        nutrition_targets: NutritionTargets model instance
        current_meal: Dict with current meal data
        day_meals: List of all meals for this day (for context)
        reason: Optional user reason for swap (e.g., "want something lighter")

    Returns:
        dict: Parsed JSON containing the replacement meal

    Raises:
        MealPlanGenerationError: If generation fails
        MealPlanValidationError: If validation fails

    Performance Note:
        This typically takes 3-5 seconds.
    """
    logger.info(f"Swapping meal: {current_meal.get('dish_name', 'unknown')}")
    if reason:
        logger.info(f"Swap reason: {reason}")

    try:
        # Build swap prompt
        user_prompt = build_swap_prompt(
            current_meal=current_meal,
            day_meals=day_meals,
            profile=profile,
            nutrition_targets=nutrition_targets,
            reason=reason
        )

        # Call OpenAI
        response_data = _call_openai_with_retry(
            system_prompt=SWAP_SYSTEM_PROMPT,
            user_prompt=user_prompt,
            json_schema=SINGLE_MEAL_SWAP_SCHEMA,
            temperature=0.8  # Slightly higher temp for more variety
        )

        # Extract meal from response
        if "meal" not in response_data:
            raise MealPlanValidationError("Response missing 'meal' field")

        meal_data = response_data["meal"]

        # Validate meal structure
        validate_single_meal(meal_data)

        logger.info(f"Meal swapped successfully. New dish: {meal_data.get('dish_name')}")

        return meal_data

    except (MealPlanGenerationError, MealPlanValidationError):
        raise
    except RateLimitError:
        raise MealPlanGenerationError("Service temporarily unavailable. Please try again shortly.")
    except Exception as e:
        logger.error(f"Unexpected error in swap_single_meal: {e}", exc_info=True)
        raise MealPlanGenerationError(f"Failed to swap meal: {str(e)}")


def regenerate_day(
    profile,
    nutrition_targets,
    day_of_week: int,
    other_days_meals: List[dict]
) -> dict:
    """
    Regenerate all meals for a single day.

    This function:
    1. Takes the day to regenerate (0-6)
    2. Considers meals from other days (for weekly variety)
    3. Generates all meals for the specified day
    4. Maintains daily nutrition targets

    Args:
        profile: UserProfile model instance
        nutrition_targets: NutritionTargets model instance
        day_of_week: Integer 0-6 (0=Monday, 6=Sunday)
        other_days_meals: List of meals from all other days (for variety)

    Returns:
        dict: Parsed JSON containing the regenerated day with all meals

    Raises:
        MealPlanGenerationError: If generation fails
        MealPlanValidationError: If validation fails

    Performance Note:
        This typically takes 8-12 seconds.
    """
    day_names = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]
    day_name = day_names[day_of_week]

    logger.info(f"Regenerating all meals for {day_name} (day_of_week={day_of_week})")
    logger.info(f"Context: {len(other_days_meals)} meals from other days")

    try:
        # Build regenerate day prompt
        user_prompt = build_regenerate_day_prompt(
            day_of_week=day_of_week,
            other_days_meals=other_days_meals,
            profile=profile,
            nutrition_targets=nutrition_targets
        )

        # Call OpenAI
        response_data = _call_openai_with_retry(
            system_prompt=REGENERATE_DAY_SYSTEM_PROMPT,
            user_prompt=user_prompt,
            json_schema=SINGLE_DAY_SCHEMA,
            temperature=0.75
        )

        # Extract day from response
        if "day" not in response_data:
            raise MealPlanValidationError("Response missing 'day' field")

        day_data = response_data["day"]

        # Validate day structure
        if "meals" not in day_data:
            raise MealPlanValidationError("Day missing 'meals' field")

        if len(day_data["meals"]) != profile.meals_per_day:
            raise MealPlanValidationError(
                f"Expected {profile.meals_per_day} meals, got {len(day_data['meals'])}"
            )

        # Validate each meal
        for meal in day_data["meals"]:
            validate_single_meal(meal)

        logger.info(f"Day regenerated successfully with {len(day_data['meals'])} meals")

        return day_data

    except (MealPlanGenerationError, MealPlanValidationError):
        raise
    except RateLimitError:
        raise MealPlanGenerationError("Service temporarily unavailable. Please try again shortly.")
    except Exception as e:
        logger.error(f"Unexpected error in regenerate_day: {e}", exc_info=True)
        raise MealPlanGenerationError(f"Failed to regenerate day: {str(e)}")
```

---

### 6. Database Models

**File:** `backend/models/meal_plan.py`

```python
"""
Database models for meal plans.
"""

from sqlalchemy import Column, Integer, String, Float, Date, DateTime, ForeignKey, Text, Enum
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from sqlalchemy.dialects.postgresql import JSON
import enum

from backend.database import Base


class PlanStatus(str, enum.Enum):
    """Status enum for meal plans"""
    ACTIVE = "active"
    ARCHIVED = "archived"
    DRAFT = "draft"


class MealType(str, enum.Enum):
    """Meal type enum"""
    BREAKFAST = "breakfast"
    LUNCH = "lunch"
    DINNER = "dinner"
    SNACK = "snack"


class WeeklyPlan(Base):
    """
    Weekly meal plan - top level container.
    Each user can have multiple weekly plans, but only one active at a time.
    """
    __tablename__ = "weekly_plans"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)

    week_start_date = Column(Date, nullable=False, index=True)
    status = Column(Enum(PlanStatus), default=PlanStatus.ACTIVE, nullable=False, index=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    # Relationships
    user = relationship("User", back_populates="weekly_plans")
    daily_plans = relationship("DailyPlan", back_populates="weekly_plan", cascade="all, delete-orphan")

    def __repr__(self):
        return f"<WeeklyPlan(id={self.id}, user_id={self.user_id}, week_start={self.week_start_date}, status={self.status})>"


class DailyPlan(Base):
    """
    Daily meal plan - contains all meals for a single day.
    Linked to a weekly plan.
    """
    __tablename__ = "daily_plans"

    id = Column(Integer, primary_key=True, index=True)
    weekly_plan_id = Column(Integer, ForeignKey("weekly_plans.id", ondelete="CASCADE"), nullable=False, index=True)

    day_of_week = Column(Integer, nullable=False)  # 0=Monday, 6=Sunday
    day_date = Column(Date, nullable=False)  # Actual calendar date

    # Daily totals (calculated from meals)
    total_calories = Column(Float, nullable=False, default=0.0)
    total_protein = Column(Float, nullable=False, default=0.0)
    total_carbs = Column(Float, nullable=False, default=0.0)
    total_fats = Column(Float, nullable=False, default=0.0)
    total_fiber = Column(Float, nullable=False, default=0.0)

    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    # Relationships
    weekly_plan = relationship("WeeklyPlan", back_populates="daily_plans")
    meals = relationship("Meal", back_populates="daily_plan", cascade="all, delete-orphan")

    def __repr__(self):
        return f"<DailyPlan(id={self.id}, date={self.day_date}, calories={self.total_calories})>"


class Meal(Base):
    """
    Individual meal - breakfast, lunch, dinner, or snack.
    Contains complete recipe and nutritional information.
    """
    __tablename__ = "meals"

    id = Column(Integer, primary_key=True, index=True)
    daily_plan_id = Column(Integer, ForeignKey("daily_plans.id", ondelete="CASCADE"), nullable=False, index=True)

    # Meal metadata
    meal_type = Column(Enum(MealType), nullable=False)
    dish_name = Column(String(255), nullable=False)
    description = Column(Text)
    cuisine = Column(String(100))
    portion_size = Column(String(255))

    # Nutritional information
    calories = Column(Float, nullable=False)
    protein = Column(Float, nullable=False)
    carbs = Column(Float, nullable=False)
    fats = Column(Float, nullable=False)
    fiber = Column(Float, nullable=False)

    # Recipe information
    prep_time = Column(Integer, nullable=False)  # minutes
    ingredients = Column(JSON, nullable=False)  # Array of {name, quantity, unit}
    recipe_brief = Column(Text, nullable=False)

    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    # Relationships
    daily_plan = relationship("DailyPlan", back_populates="meals")

    def __repr__(self):
        return f"<Meal(id={self.id}, type={self.meal_type}, dish={self.dish_name}, cal={self.calories})>"
```

**Migration:** Create Alembic migration for these tables:

```bash
alembic revision --autogenerate -m "Add meal plan tables"
alembic upgrade head
```

---

### 7. API Router

**File:** `backend/routers/meal_plan.py`

```python
"""
API routes for meal plan generation and management.

Security Notes:
- All routes require authentication (current_user dependency)
- Users can only access their own meal plans
- Input validation via Pydantic schemas
- Database operations use transactions for consistency
"""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import desc
from datetime import date, timedelta
from typing import List
import logging

from backend.database import get_db
from backend.models.user import User
from backend.models.profile import UserProfile
from backend.models.nutrition import NutritionTargets
from backend.models.meal_plan import WeeklyPlan, DailyPlan, Meal, PlanStatus
from backend.schemas.meal_plan import (
    WeeklyPlanResponse,
    DailyPlanResponse,
    MealResponse,
    GeneratePlanResponse,
    MealSwapRequest,
    MealSwapResponse,
    RegenerateDayResponse
)
from backend.services.ai_meal_planner import (
    generate_weekly_plan,
    swap_single_meal,
    regenerate_day,
    MealPlanGenerationError,
    MealPlanValidationError
)
from backend.dependencies import get_current_user

router = APIRouter(prefix="/meal-plans", tags=["Meal Plans"])
logger = logging.getLogger(__name__)


def get_monday_of_week(target_date: date = None) -> date:
    """
    Get the Monday of the week containing the target date.

    Args:
        target_date: Date to find Monday for (defaults to today)

    Returns:
        date: The Monday of that week
    """
    if target_date is None:
        target_date = date.today()

    # Get day of week (0=Monday, 6=Sunday)
    days_since_monday = target_date.weekday()
    monday = target_date - timedelta(days=days_since_monday)
    return monday


def calculate_daily_totals(meals: List[Meal]) -> dict:
    """
    Calculate total nutrition for a list of meals.

    Args:
        meals: List of Meal model instances

    Returns:
        dict: Totals for calories, protein, carbs, fats, fiber
    """
    return {
        "total_calories": sum(m.calories for m in meals),
        "total_protein": sum(m.protein for m in meals),
        "total_carbs": sum(m.carbs for m in meals),
        "total_fats": sum(m.fats for m in meals),
        "total_fiber": sum(m.fiber for m in meals)
    }


@router.post("/generate", response_model=GeneratePlanResponse, status_code=status.HTTP_201_CREATED)
def generate_meal_plan(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Generate a new 7-day meal plan using AI.

    This endpoint:
    1. Retrieves user's profile and nutrition targets
    2. Archives any existing active meal plan
    3. Calls AI service to generate complete weekly plan
    4. Saves all meals to database
    5. Returns the complete plan

    **Important:** This request takes 10-20 seconds to complete.
    Frontend must display appropriate loading state.

    Returns:
        GeneratePlanResponse: Complete weekly meal plan with all meals

    Raises:
        404: User profile not found
        503: AI service unavailable or failed
        500: Server error during plan generation
    """
    logger.info(f"Generating meal plan for user {current_user.id}")

    try:
        # 1. Get user profile
        profile = db.query(UserProfile).filter(UserProfile.user_id == current_user.id).first()
        if not profile:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="User profile not found. Please complete your profile first."
            )

        # 2. Get nutrition targets
        nutrition_targets = db.query(NutritionTargets).filter(
            NutritionTargets.user_id == current_user.id
        ).first()

        if not nutrition_targets:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Nutrition targets not calculated. Please complete your profile."
            )

        # 3. Archive existing active plan
        existing_plan = db.query(WeeklyPlan).filter(
            WeeklyPlan.user_id == current_user.id,
            WeeklyPlan.status == PlanStatus.ACTIVE
        ).first()

        if existing_plan:
            logger.info(f"Archiving existing plan {existing_plan.id}")
            existing_plan.status = PlanStatus.ARCHIVED

        # 4. Generate meal plan via AI
        try:
            ai_plan_data = generate_weekly_plan(profile, nutrition_targets)
        except MealPlanGenerationError as e:
            logger.error(f"AI meal plan generation failed: {e}")
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail=str(e)
            )
        except MealPlanValidationError as e:
            logger.error(f"AI meal plan validation failed: {e}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Generated plan validation failed: {str(e)}"
            )

        # 5. Create WeeklyPlan record
        week_start = get_monday_of_week()

        weekly_plan = WeeklyPlan(
            user_id=current_user.id,
            week_start_date=week_start,
            status=PlanStatus.ACTIVE
        )
        db.add(weekly_plan)
        db.flush()  # Get ID without committing

        # 6. Create DailyPlan and Meal records
        for day_data in ai_plan_data["days"]:
            day_of_week = day_data["day_of_week"]
            day_date = week_start + timedelta(days=day_of_week)

            # Create DailyPlan
            daily_plan = DailyPlan(
                weekly_plan_id=weekly_plan.id,
                day_of_week=day_of_week,
                day_date=day_date,
                total_calories=day_data["total_calories"],
                total_protein=day_data["total_protein"],
                total_carbs=day_data["total_carbs"],
                total_fats=day_data["total_fats"],
                total_fiber=sum(m["fiber"] for m in day_data["meals"])
            )
            db.add(daily_plan)
            db.flush()

            # Create Meals
            for meal_data in day_data["meals"]:
                meal = Meal(
                    daily_plan_id=daily_plan.id,
                    meal_type=meal_data["meal_type"],
                    dish_name=meal_data["dish_name"],
                    description=meal_data["description"],
                    cuisine=meal_data["cuisine"],
                    portion_size=meal_data["portion_size"],
                    calories=meal_data["calories"],
                    protein=meal_data["protein"],
                    carbs=meal_data["carbs"],
                    fats=meal_data["fats"],
                    fiber=meal_data["fiber"],
                    prep_time=meal_data["prep_time"],
                    ingredients=meal_data["ingredients"],
                    recipe_brief=meal_data["recipe_brief"]
                )
                db.add(meal)

        # Commit all changes
        db.commit()
        db.refresh(weekly_plan)

        # 7. Load complete plan with relationships
        complete_plan = db.query(WeeklyPlan).options(
            joinedload(WeeklyPlan.daily_plans).joinedload(DailyPlan.meals)
        ).filter(WeeklyPlan.id == weekly_plan.id).first()

        logger.info(f"Meal plan {complete_plan.id} generated successfully")

        return GeneratePlanResponse(
            message="Weekly meal plan generated successfully",
            plan=WeeklyPlanResponse.from_orm(complete_plan)
        )

    except HTTPException:
        db.rollback()
        raise
    except Exception as e:
        db.rollback()
        logger.error(f"Unexpected error generating meal plan: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An error occurred while generating your meal plan. Please try again."
        )


@router.get("/current", response_model=WeeklyPlanResponse)
def get_current_meal_plan(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Get the user's current active meal plan.

    Returns:
        WeeklyPlanResponse: Complete active meal plan with all days and meals

    Raises:
        404: No active meal plan found
    """
    logger.info(f"Fetching current meal plan for user {current_user.id}")

    # Query active plan with all relationships loaded
    plan = db.query(WeeklyPlan).options(
        joinedload(WeeklyPlan.daily_plans).joinedload(DailyPlan.meals)
    ).filter(
        WeeklyPlan.user_id == current_user.id,
        WeeklyPlan.status == PlanStatus.ACTIVE
    ).first()

    if not plan:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No active meal plan found. Generate your first meal plan to get started."
        )

    return WeeklyPlanResponse.from_orm(plan)


@router.post("/meals/{meal_id}/swap", response_model=MealSwapResponse)
def swap_meal(
    meal_id: int,
    request: MealSwapRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Swap a single meal with a new AI-generated alternative.

    This endpoint:
    1. Validates meal ownership
    2. Generates a replacement meal using AI
    3. Updates the meal in place
    4. Recalculates daily totals

    **Performance:** Takes 3-5 seconds.

    Args:
        meal_id: ID of meal to swap
        request: Optional reason for swap

    Returns:
        MealSwapResponse: Updated meal data

    Raises:
        404: Meal not found or not owned by user
        503: AI service unavailable
    """
    logger.info(f"Swapping meal {meal_id} for user {current_user.id}")

    try:
        # 1. Get meal and verify ownership
        meal = db.query(Meal).options(
            joinedload(Meal.daily_plan).joinedload(DailyPlan.weekly_plan)
        ).filter(Meal.id == meal_id).first()

        if not meal:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Meal not found"
            )

        if meal.daily_plan.weekly_plan.user_id != current_user.id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You don't have permission to modify this meal"
            )

        # 2. Get all meals for this day
        daily_plan = meal.daily_plan
        all_day_meals = db.query(Meal).filter(
            Meal.daily_plan_id == daily_plan.id
        ).all()

        # Convert to dicts for AI service
        current_meal_dict = {
            "id": meal.id,
            "meal_type": meal.meal_type,
            "dish_name": meal.dish_name,
            "cuisine": meal.cuisine,
            "calories": meal.calories,
            "protein": meal.protein,
            "carbs": meal.carbs,
            "fats": meal.fats
        }

        day_meals_dicts = [
            {
                "id": m.id,
                "dish_name": m.dish_name,
                "cuisine": m.cuisine
            } for m in all_day_meals
        ]

        # 3. Get profile and nutrition targets
        profile = db.query(UserProfile).filter(
            UserProfile.user_id == current_user.id
        ).first()

        nutrition_targets = db.query(NutritionTargets).filter(
            NutritionTargets.user_id == current_user.id
        ).first()

        # 4. Generate replacement meal via AI
        try:
            new_meal_data = swap_single_meal(
                profile=profile,
                nutrition_targets=nutrition_targets,
                current_meal=current_meal_dict,
                day_meals=day_meals_dicts,
                reason=request.reason
            )
        except MealPlanGenerationError as e:
            logger.error(f"AI meal swap failed: {e}")
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail=str(e)
            )

        # 5. Update meal record
        meal.dish_name = new_meal_data["dish_name"]
        meal.description = new_meal_data["description"]
        meal.cuisine = new_meal_data["cuisine"]
        meal.portion_size = new_meal_data["portion_size"]
        meal.calories = new_meal_data["calories"]
        meal.protein = new_meal_data["protein"]
        meal.carbs = new_meal_data["carbs"]
        meal.fats = new_meal_data["fats"]
        meal.fiber = new_meal_data["fiber"]
        meal.prep_time = new_meal_data["prep_time"]
        meal.ingredients = new_meal_data["ingredients"]
        meal.recipe_brief = new_meal_data["recipe_brief"]

        # 6. Recalculate daily totals
        all_meals_updated = db.query(Meal).filter(
            Meal.daily_plan_id == daily_plan.id
        ).all()

        totals = calculate_daily_totals(all_meals_updated)
        daily_plan.total_calories = totals["total_calories"]
        daily_plan.total_protein = totals["total_protein"]
        daily_plan.total_carbs = totals["total_carbs"]
        daily_plan.total_fats = totals["total_fats"]
        daily_plan.total_fiber = totals["total_fiber"]

        db.commit()
        db.refresh(meal)

        logger.info(f"Meal {meal_id} swapped successfully to: {meal.dish_name}")

        return MealSwapResponse(
            message="Meal swapped successfully",
            meal=MealResponse.from_orm(meal)
        )

    except HTTPException:
        db.rollback()
        raise
    except Exception as e:
        db.rollback()
        logger.error(f"Unexpected error swapping meal: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An error occurred while swapping the meal. Please try again."
        )


@router.post("/{plan_id}/regenerate-day/{day_index}", response_model=RegenerateDayResponse)
def regenerate_single_day(
    plan_id: int,
    day_index: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Regenerate all meals for a single day using AI.

    This endpoint:
    1. Validates plan ownership and day index
    2. Deletes existing meals for the day
    3. Generates new meals via AI (considering other days for variety)
    4. Creates new meal records
    5. Updates daily totals

    **Performance:** Takes 8-12 seconds.

    Args:
        plan_id: ID of weekly plan
        day_index: Day to regenerate (0-6, where 0=Monday)

    Returns:
        RegenerateDayResponse: Updated day with new meals

    Raises:
        404: Plan or day not found
        400: Invalid day index
        503: AI service unavailable
    """
    logger.info(f"Regenerating day {day_index} for plan {plan_id}, user {current_user.id}")

    if day_index < 0 or day_index > 6:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid day_index. Must be 0-6 (0=Monday, 6=Sunday)"
        )

    try:
        # 1. Get weekly plan and verify ownership
        plan = db.query(WeeklyPlan).filter(WeeklyPlan.id == plan_id).first()

        if not plan:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Meal plan not found"
            )

        if plan.user_id != current_user.id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You don't have permission to modify this meal plan"
            )

        # 2. Get the daily plan for this day
        daily_plan = db.query(DailyPlan).filter(
            DailyPlan.weekly_plan_id == plan_id,
            DailyPlan.day_of_week == day_index
        ).first()

        if not daily_plan:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Day {day_index} not found in this meal plan"
            )

        # 3. Get meals from OTHER days (for variety context)
        other_days_meals = db.query(Meal).join(DailyPlan).filter(
            DailyPlan.weekly_plan_id == plan_id,
            DailyPlan.day_of_week != day_index
        ).all()

        other_meals_dicts = [
            {"dish_name": m.dish_name, "cuisine": m.cuisine}
            for m in other_days_meals
        ]

        # 4. Get profile and nutrition targets
        profile = db.query(UserProfile).filter(
            UserProfile.user_id == current_user.id
        ).first()

        nutrition_targets = db.query(NutritionTargets).filter(
            NutritionTargets.user_id == current_user.id
        ).first()

        # 5. Delete existing meals for this day
        db.query(Meal).filter(Meal.daily_plan_id == daily_plan.id).delete()
        db.flush()

        # 6. Generate new day via AI
        try:
            new_day_data = regenerate_day(
                profile=profile,
                nutrition_targets=nutrition_targets,
                day_of_week=day_index,
                other_days_meals=other_meals_dicts
            )
        except MealPlanGenerationError as e:
            logger.error(f"AI day regeneration failed: {e}")
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail=str(e)
            )

        # 7. Create new meal records
        for meal_data in new_day_data["meals"]:
            meal = Meal(
                daily_plan_id=daily_plan.id,
                meal_type=meal_data["meal_type"],
                dish_name=meal_data["dish_name"],
                description=meal_data["description"],
                cuisine=meal_data["cuisine"],
                portion_size=meal_data["portion_size"],
                calories=meal_data["calories"],
                protein=meal_data["protein"],
                carbs=meal_data["carbs"],
                fats=meal_data["fats"],
                fiber=meal_data["fiber"],
                prep_time=meal_data["prep_time"],
                ingredients=meal_data["ingredients"],
                recipe_brief=meal_data["recipe_brief"]
            )
            db.add(meal)

        # 8. Update daily totals
        daily_plan.total_calories = new_day_data["total_calories"]
        daily_plan.total_protein = new_day_data["total_protein"]
        daily_plan.total_carbs = new_day_data["total_carbs"]
        daily_plan.total_fats = new_day_data["total_fats"]
        daily_plan.total_fiber = sum(m["fiber"] for m in new_day_data["meals"])

        db.commit()
        db.refresh(daily_plan)

        # 9. Load updated daily plan with meals
        updated_daily = db.query(DailyPlan).options(
            joinedload(DailyPlan.meals)
        ).filter(DailyPlan.id == daily_plan.id).first()

        logger.info(f"Day {day_index} regenerated successfully with {len(updated_daily.meals)} meals")

        return RegenerateDayResponse(
            message=f"Day regenerated successfully",
            day=DailyPlanResponse.from_orm(updated_daily)
        )

    except HTTPException:
        db.rollback()
        raise
    except Exception as e:
        db.rollback()
        logger.error(f"Unexpected error regenerating day: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An error occurred while regenerating the day. Please try again."
        )


@router.post("/{plan_id}/regenerate", response_model=GeneratePlanResponse)
def regenerate_entire_plan(
    plan_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Regenerate the entire weekly meal plan.

    This is equivalent to deleting the current plan and generating a new one,
    but preserves the same week_start_date.

    **Performance:** Takes 10-20 seconds.

    Args:
        plan_id: ID of weekly plan to regenerate

    Returns:
        GeneratePlanResponse: Complete new meal plan

    Raises:
        404: Plan not found
        503: AI service unavailable
    """
    logger.info(f"Regenerating entire plan {plan_id} for user {current_user.id}")

    try:
        # 1. Get and verify plan
        plan = db.query(WeeklyPlan).filter(WeeklyPlan.id == plan_id).first()

        if not plan:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Meal plan not found"
            )

        if plan.user_id != current_user.id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You don't have permission to modify this meal plan"
            )

        # 2. Delete all daily plans and meals (cascade)
        db.query(DailyPlan).filter(DailyPlan.weekly_plan_id == plan_id).delete()
        db.flush()

        # 3. Get profile and nutrition targets
        profile = db.query(UserProfile).filter(
            UserProfile.user_id == current_user.id
        ).first()

        nutrition_targets = db.query(NutritionTargets).filter(
            NutritionTargets.user_id == current_user.id
        ).first()

        # 4. Generate new plan via AI
        try:
            ai_plan_data = generate_weekly_plan(profile, nutrition_targets)
        except MealPlanGenerationError as e:
            logger.error(f"AI meal plan regeneration failed: {e}")
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail=str(e)
            )

        # 5. Create new DailyPlan and Meal records
        week_start = plan.week_start_date

        for day_data in ai_plan_data["days"]:
            day_of_week = day_data["day_of_week"]
            day_date = week_start + timedelta(days=day_of_week)

            daily_plan = DailyPlan(
                weekly_plan_id=plan.id,
                day_of_week=day_of_week,
                day_date=day_date,
                total_calories=day_data["total_calories"],
                total_protein=day_data["total_protein"],
                total_carbs=day_data["total_carbs"],
                total_fats=day_data["total_fats"],
                total_fiber=sum(m["fiber"] for m in day_data["meals"])
            )
            db.add(daily_plan)
            db.flush()

            for meal_data in day_data["meals"]:
                meal = Meal(
                    daily_plan_id=daily_plan.id,
                    meal_type=meal_data["meal_type"],
                    dish_name=meal_data["dish_name"],
                    description=meal_data["description"],
                    cuisine=meal_data["cuisine"],
                    portion_size=meal_data["portion_size"],
                    calories=meal_data["calories"],
                    protein=meal_data["protein"],
                    carbs=meal_data["carbs"],
                    fats=meal_data["fats"],
                    fiber=meal_data["fiber"],
                    prep_time=meal_data["prep_time"],
                    ingredients=meal_data["ingredients"],
                    recipe_brief=meal_data["recipe_brief"]
                )
                db.add(meal)

        db.commit()
        db.refresh(plan)

        # 6. Load complete plan
        complete_plan = db.query(WeeklyPlan).options(
            joinedload(WeeklyPlan.daily_plans).joinedload(DailyPlan.meals)
        ).filter(WeeklyPlan.id == plan.id).first()

        logger.info(f"Plan {plan_id} regenerated successfully")

        return GeneratePlanResponse(
            message="Meal plan regenerated successfully",
            plan=WeeklyPlanResponse.from_orm(complete_plan)
        )

    except HTTPException:
        db.rollback()
        raise
    except Exception as e:
        db.rollback()
        logger.error(f"Unexpected error regenerating plan: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An error occurred while regenerating the meal plan. Please try again."
        )
```

**Register router in `backend/main.py`:**

```python
from backend.routers import meal_plan

app.include_router(meal_plan.router)
```

---

## Frontend Implementation

### 1. Meal Plan Page

**File:** `src/app/meal-plan/page.tsx`

```typescript
'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, RefreshCw, Sparkles, AlertCircle } from 'lucide-react';
import { WeekView } from '@/components/meal-plan/WeekView';
import { api } from '@/lib/api';
import type { WeeklyPlanResponse } from '@/types/meal-plan';

export default function MealPlanPage() {
  const [mealPlan, setMealPlan] = useState<WeeklyPlanResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch current meal plan on mount
  useEffect(() => {
    fetchCurrentPlan();
  }, []);

  const fetchCurrentPlan = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await api.get<WeeklyPlanResponse>('/meal-plans/current');
      setMealPlan(response.data);
    } catch (err: any) {
      if (err.response?.status === 404) {
        // No active plan - this is expected for new users
        setMealPlan(null);
      } else {
        setError(err.response?.data?.detail || 'Failed to load meal plan');
      }
    } finally {
      setLoading(false);
    }
  };

  const generatePlan = async () => {
    try {
      setGenerating(true);
      setError(null);

      const response = await api.post<{ message: string; plan: WeeklyPlanResponse }>(
        '/meal-plans/generate'
      );

      setMealPlan(response.data.plan);
    } catch (err: any) {
      if (err.response?.status === 404) {
        setError('Please complete your profile before generating a meal plan.');
      } else if (err.response?.status === 503) {
        setError(err.response?.data?.detail || 'AI service temporarily unavailable. Please try again in a few minutes.');
      } else {
        setError(err.response?.data?.detail || 'Failed to generate meal plan');
      }
    } finally {
      setGenerating(false);
    }
  };

  const regenerateEntirePlan = async () => {
    if (!mealPlan) return;

    if (!confirm('Are you sure you want to regenerate the entire meal plan? This will replace all current meals.')) {
      return;
    }

    try {
      setGenerating(true);
      setError(null);

      const response = await api.post<{ message: string; plan: WeeklyPlanResponse }>(
        `/meal-plans/${mealPlan.id}/regenerate`
      );

      setMealPlan(response.data.plan);
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to regenerate meal plan');
    } finally {
      setGenerating(false);
    }
  };

  // Loading state
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // Empty state - no meal plan
  if (!mealPlan && !generating) {
    return (
      <div className="container mx-auto px-4 py-8">
        <Card className="max-w-2xl mx-auto">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
              <Sparkles className="h-6 w-6 text-primary" />
            </div>
            <CardTitle className="text-2xl">Generate Your First Meal Plan</CardTitle>
            <CardDescription className="text-base mt-2">
              Get a personalized 7-day meal plan based on your dietary preferences,
              nutrition goals, and cooking skills.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {error && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <div className="bg-muted/50 p-4 rounded-lg space-y-2">
              <h3 className="font-semibold text-sm">Your meal plan will include:</h3>
              <ul className="text-sm space-y-1 ml-4 list-disc text-muted-foreground">
                <li>7 days of complete meals (breakfast, lunch, dinner, snacks)</li>
                <li>Full nutritional information for each meal</li>
                <li>Complete ingredient lists with quantities</li>
                <li>Step-by-step cooking instructions</li>
                <li>Meals tailored to your dietary restrictions and preferences</li>
              </ul>
            </div>

            <Button
              onClick={generatePlan}
              className="w-full"
              size="lg"
              disabled={generating}
            >
              {generating ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Generating Your Meal Plan...
                </>
              ) : (
                <>
                  <Sparkles className="mr-2 h-4 w-4" />
                  Generate Meal Plan
                </>
              )}
            </Button>

            {generating && (
              <p className="text-sm text-muted-foreground text-center">
                This may take 15-20 seconds while AI creates your personalized plan...
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  // Generating overlay
  if (generating && !mealPlan) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen space-y-4">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <div className="text-center space-y-2">
          <h2 className="text-xl font-semibold">Generating Your Personalized Meal Plan</h2>
          <p className="text-muted-foreground">
            AI is creating meals tailored to your preferences...
          </p>
          <p className="text-sm text-muted-foreground">
            This may take 15-20 seconds
          </p>
        </div>
      </div>
    );
  }

  // Main view with meal plan
  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Your Meal Plan</h1>
          <p className="text-muted-foreground mt-1">
            Week of {new Date(mealPlan!.week_start_date).toLocaleDateString()}
          </p>
        </div>

        <Button
          onClick={regenerateEntirePlan}
          variant="outline"
          disabled={generating}
        >
          {generating ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Regenerating...
            </>
          ) : (
            <>
              <RefreshCw className="mr-2 h-4 w-4" />
              Regenerate Week
            </>
          )}
        </Button>
      </div>

      {error && (
        <Alert variant="destructive" className="mb-6">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <WeekView
        weeklyPlan={mealPlan!}
        onMealSwapped={fetchCurrentPlan}
        onDayRegenerated={fetchCurrentPlan}
      />
    </div>
  );
}
```

---

### 2. Week View Component

**File:** `src/components/meal-plan/WeekView.tsx`

```typescript
import { DayColumn } from './DayColumn';
import type { WeeklyPlanResponse } from '@/types/meal-plan';

interface WeekViewProps {
  weeklyPlan: WeeklyPlanResponse;
  onMealSwapped: () => void;
  onDayRegenerated: () => void;
}

const DAY_NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

export function WeekView({ weeklyPlan, onMealSwapped, onDayRegenerated }: WeekViewProps) {
  // Sort days by day_of_week
  const sortedDays = [...weeklyPlan.days].sort((a, b) => a.day_of_week - b.day_of_week);

  return (
    <div className="overflow-x-auto pb-4">
      <div className="flex gap-4 min-w-max">
        {sortedDays.map((day) => (
          <DayColumn
            key={day.id}
            dailyPlan={day}
            dayName={DAY_NAMES[day.day_of_week]}
            weeklyPlanId={weeklyPlan.id}
            onMealSwapped={onMealSwapped}
            onDayRegenerated={onDayRegenerated}
          />
        ))}
      </div>
    </div>
  );
}
```

---

### 3. Day Column Component

**File:** `src/components/meal-plan/DayColumn.tsx`

```typescript
import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { RefreshCw, Loader2 } from 'lucide-react';
import { MealCard } from './MealCard';
import { api } from '@/lib/api';
import type { DailyPlanResponse } from '@/types/meal-plan';

interface DayColumnProps {
  dailyPlan: DailyPlanResponse;
  dayName: string;
  weeklyPlanId: number;
  onMealSwapped: () => void;
  onDayRegenerated: () => void;
}

export function DayColumn({
  dailyPlan,
  dayName,
  weeklyPlanId,
  onMealSwapped,
  onDayRegenerated
}: DayColumnProps) {
  const [regenerating, setRegenerating] = useState(false);

  // Calculate calorie status for color coding
  const getCalorieStatus = (actual: number, target: number = 2000): string => {
    const diff = Math.abs(actual - target);
    if (diff <= 50) return 'success';
    if (diff <= 100) return 'warning';
    return 'error';
  };

  const handleRegenerateDay = async () => {
    if (!confirm(`Regenerate all meals for ${dayName}?`)) return;

    try {
      setRegenerating(true);
      await api.post(`/meal-plans/${weeklyPlanId}/regenerate-day/${dailyPlan.day_of_week}`);
      onDayRegenerated();
    } catch (err) {
      console.error('Failed to regenerate day:', err);
    } finally {
      setRegenerating(false);
    }
  };

  const calorieStatus = getCalorieStatus(dailyPlan.total_calories);
  const statusColors = {
    success: 'bg-green-500/10 text-green-700 border-green-500/20',
    warning: 'bg-yellow-500/10 text-yellow-700 border-yellow-500/20',
    error: 'bg-red-500/10 text-red-700 border-red-500/20'
  };

  return (
    <Card className="w-[350px] flex-shrink-0">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-lg">{dayName}</CardTitle>
            <p className="text-sm text-muted-foreground mt-1">
              {new Date(dailyPlan.day_date).toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric'
              })}
            </p>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleRegenerateDay}
            disabled={regenerating}
          >
            {regenerating ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
          </Button>
        </div>
      </CardHeader>

      <CardContent className="space-y-3">
        {/* Meals */}
        <div className="space-y-3">
          {dailyPlan.meals.map((meal) => (
            <MealCard
              key={meal.id}
              meal={meal}
              onSwapComplete={onMealSwapped}
            />
          ))}
        </div>

        {/* Daily totals */}
        <Card className={`border ${statusColors[calorieStatus]}`}>
          <CardContent className="pt-4">
            <div className="text-sm space-y-1">
              <div className="flex justify-between font-semibold">
                <span>Total:</span>
                <span>{Math.round(dailyPlan.total_calories)} cal</span>
              </div>
              <div className="flex justify-between text-muted-foreground">
                <span>Protein:</span>
                <span>{Math.round(dailyPlan.total_protein)}g</span>
              </div>
              <div className="flex justify-between text-muted-foreground">
                <span>Carbs:</span>
                <span>{Math.round(dailyPlan.total_carbs)}g</span>
              </div>
              <div className="flex justify-between text-muted-foreground">
                <span>Fats:</span>
                <span>{Math.round(dailyPlan.total_fats)}g</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </CardContent>
    </Card>
  );
}
```

---

### 4. Meal Card Component

**File:** `src/components/meal-plan/MealCard.tsx`

```typescript
import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { ChevronDown, Clock, RefreshCw } from 'lucide-react';
import { SwapButton } from './SwapButton';
import type { MealResponse } from '@/types/meal-plan';

interface MealCardProps {
  meal: MealResponse;
  onSwapComplete: () => void;
}

const MEAL_TYPE_COLORS = {
  breakfast: 'bg-orange-500/10 text-orange-700 border-orange-500/20',
  lunch: 'bg-blue-500/10 text-blue-700 border-blue-500/20',
  dinner: 'bg-purple-500/10 text-purple-700 border-purple-500/20',
  snack: 'bg-green-500/10 text-green-700 border-green-500/20'
};

export function MealCard({ meal, onSwapComplete }: MealCardProps) {
  const [isOpen, setIsOpen] = useState(false);

  const mealTypeColor = MEAL_TYPE_COLORS[meal.meal_type as keyof typeof MEAL_TYPE_COLORS];

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <Card>
        <CardContent className="pt-4">
          {/* Header */}
          <div className="flex items-start justify-between mb-2">
            <div className="flex-1">
              <Badge variant="outline" className={`mb-2 ${mealTypeColor}`}>
                {meal.meal_type.charAt(0).toUpperCase() + meal.meal_type.slice(1)}
              </Badge>
              <h3 className="font-semibold text-sm">{meal.dish_name}</h3>
              <p className="text-xs text-muted-foreground mt-1">{meal.cuisine}</p>
            </div>
            <SwapButton mealId={meal.id!} onSwapComplete={onSwapComplete} />
          </div>

          {/* Nutrition summary */}
          <div className="flex items-center gap-3 text-xs text-muted-foreground mt-3">
            <span className="font-medium text-foreground">
              {Math.round(meal.calories)} cal
            </span>
            <span>P: {Math.round(meal.protein)}g</span>
            <span>C: {Math.round(meal.carbs)}g</span>
            <span>F: {Math.round(meal.fats)}g</span>
          </div>

          <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
            <Clock className="h-3 w-3" />
            <span>{meal.prep_time} min</span>
          </div>

          {/* Expand button */}
          <CollapsibleTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="w-full mt-3 text-xs"
            >
              {isOpen ? 'Show less' : 'View details'}
              <ChevronDown className={`ml-2 h-3 w-3 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
            </Button>
          </CollapsibleTrigger>

          {/* Expandable content */}
          <CollapsibleContent className="mt-3 space-y-3">
            {/* Description */}
            <div>
              <p className="text-sm text-muted-foreground">{meal.description}</p>
            </div>

            {/* Portion size */}
            <div>
              <h4 className="text-xs font-semibold mb-1">Portion Size</h4>
              <p className="text-sm text-muted-foreground">{meal.portion_size}</p>
            </div>

            {/* Ingredients */}
            <div>
              <h4 className="text-xs font-semibold mb-2">Ingredients</h4>
              <ul className="space-y-1">
                {meal.ingredients.map((ingredient, idx) => (
                  <li key={idx} className="text-sm text-muted-foreground flex items-baseline">
                    <span className="mr-2">•</span>
                    <span>
                      {ingredient.quantity} {ingredient.unit} {ingredient.name}
                    </span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Recipe */}
            <div>
              <h4 className="text-xs font-semibold mb-2">Recipe</h4>
              <p className="text-sm text-muted-foreground leading-relaxed">
                {meal.recipe_brief}
              </p>
            </div>

            {/* Fiber */}
            <div className="pt-2 border-t">
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">Fiber:</span>
                <span className="font-medium">{Math.round(meal.fiber)}g</span>
              </div>
            </div>
          </CollapsibleContent>
        </CardContent>
      </Card>
    </Collapsible>
  );
}
```

---

### 5. Swap Button Component

**File:** `src/components/meal-plan/SwapButton.tsx`

```typescript
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { RefreshCw, Loader2 } from 'lucide-react';
import { api } from '@/lib/api';

interface SwapButtonProps {
  mealId: number;
  onSwapComplete: () => void;
}

const SWAP_REASONS = [
  { value: 'lighter', label: 'Want something lighter' },
  { value: 'different_cuisine', label: 'Different cuisine' },
  { value: 'quicker', label: 'Quicker to prepare' },
  { value: 'more_protein', label: 'More protein' },
  { value: 'custom', label: 'Custom reason' }
];

export function SwapButton({ mealId, onSwapComplete }: SwapButtonProps) {
  const [open, setOpen] = useState(false);
  const [swapping, setSwapping] = useState(false);
  const [selectedReason, setSelectedReason] = useState('');
  const [customReason, setCustomReason] = useState('');

  const handleSwap = async () => {
    try {
      setSwapping(true);

      let reasonText = '';
      if (selectedReason === 'custom') {
        reasonText = customReason;
      } else if (selectedReason) {
        const reason = SWAP_REASONS.find(r => r.value === selectedReason);
        reasonText = reason?.label || '';
      }

      await api.post(`/meal-plans/meals/${mealId}/swap`, {
        reason: reasonText || undefined
      });

      onSwapComplete();
      setOpen(false);
      setSelectedReason('');
      setCustomReason('');
    } catch (err) {
      console.error('Failed to swap meal:', err);
    } finally {
      setSwapping(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
          <RefreshCw className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Swap Meal</DialogTitle>
          <DialogDescription>
            Generate a different meal with similar nutrition. Optionally tell us why.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <RadioGroup value={selectedReason} onValueChange={setSelectedReason}>
            {SWAP_REASONS.map((reason) => (
              <div key={reason.value} className="flex items-center space-x-2">
                <RadioGroupItem value={reason.value} id={reason.value} />
                <Label htmlFor={reason.value} className="cursor-pointer">
                  {reason.label}
                </Label>
              </div>
            ))}
          </RadioGroup>

          {selectedReason === 'custom' && (
            <div className="space-y-2">
              <Label htmlFor="custom-reason">Your reason</Label>
              <Textarea
                id="custom-reason"
                placeholder="E.g., I want something with less spice..."
                value={customReason}
                onChange={(e) => setCustomReason(e.target.value)}
                rows={3}
              />
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={swapping}>
            Cancel
          </Button>
          <Button onClick={handleSwap} disabled={swapping}>
            {swapping ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Swapping...
              </>
            ) : (
              'Swap Meal'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
```

---

### 6. TypeScript Types

**File:** `src/types/meal-plan.ts`

```typescript
export interface IngredientSchema {
  name: string;
  quantity: string;
  unit: string;
}

export type MealType = 'breakfast' | 'lunch' | 'dinner' | 'snack';
export type PlanStatus = 'active' | 'archived' | 'draft';

export interface MealResponse {
  id?: number;
  meal_type: MealType;
  dish_name: string;
  description: string;
  cuisine: string;
  portion_size: string;
  calories: number;
  protein: number;
  carbs: number;
  fats: number;
  fiber: number;
  prep_time: number;
  ingredients: IngredientSchema[];
  recipe_brief: string;
  created_at?: string;
}

export interface DailyPlanResponse {
  id?: number;
  day_of_week: number;
  day_date: string;
  meals: MealResponse[];
  total_calories: number;
  total_protein: number;
  total_carbs: number;
  total_fats: number;
  total_fiber?: number;
}

export interface WeeklyPlanResponse {
  id: number;
  user_id: number;
  week_start_date: string;
  status: PlanStatus;
  days: DailyPlanResponse[];
  created_at: string;
  updated_at?: string;
}
```

---

## Error Handling

### Backend Error Responses

All endpoints return consistent error formats:

```json
{
  "detail": "Human-readable error message"
}
```

**Status Codes:**
- `400`: Invalid input (bad day_index, etc.)
- `403`: Forbidden (trying to modify another user's plan)
- `404`: Resource not found (profile, plan, meal)
- `429`: Rate limit exceeded (OpenAI)
- `500`: Internal server error
- `503`: Service unavailable (OpenAI down or failed)

### Frontend Error Handling

1. **Network Errors**: Show toast notification with retry option
2. **404 on Current Plan**: Show empty state with generate button
3. **503 on Generate**: Show friendly message about service availability
4. **Timeout**: Show message about retrying shortly

---

## Verification Checklist

### Backend Testing

- [ ] Generate plan with all diet types (vegetarian, vegan, keto, etc.)
- [ ] Verify daily calories within ±50 of target
- [ ] Verify daily macros within ±5g of targets
- [ ] Verify no allergens in any meal
- [ ] Verify all meals respect diet_type restrictions
- [ ] Verify prep times within max_cook_time
- [ ] Test meal swap with and without reason
- [ ] Verify swapped meal is different from original
- [ ] Verify swapped meal has similar nutrition
- [ ] Test day regeneration
- [ ] Verify regenerated day has different meals
- [ ] Test full plan regeneration
- [ ] Test error handling for OpenAI failures
- [ ] Test timeout handling (mock slow response)
- [ ] Verify database transactions rollback on error

### Frontend Testing

- [ ] Empty state shows correctly for new users
- [ ] Generate button triggers loading state
- [ ] Loading state shows estimated time
- [ ] Week view displays all 7 days
- [ ] Day columns show correct date and day name
- [ ] Meal cards display all information correctly
- [ ] Expand/collapse works on meal cards
- [ ] Swap button opens modal
- [ ] Swap with reason works correctly
- [ ] Swap without reason works correctly
- [ ] Individual meal loading state during swap
- [ ] Day regeneration shows loading state
- [ ] Full week regeneration shows confirmation dialog
- [ ] Daily totals calculate correctly
- [ ] Color coding for calorie variance works
- [ ] Error messages display appropriately
- [ ] Responsive design works on mobile

### Integration Testing

- [ ] Generate plan → verify saved to database
- [ ] Archive old plan when generating new one
- [ ] Swap meal → verify database updated
- [ ] Regenerate day → verify old meals deleted, new ones created
- [ ] Daily totals recalculate after swap
- [ ] Week navigation maintains state
- [ ] Multiple users can have separate active plans

---

## Performance Optimization

### Backend

1. **Database Queries**: Use `joinedload` for eager loading relationships
2. **API Timeouts**: 60-second timeout on OpenAI calls
3. **Retry Logic**: Exponential backoff for transient failures
4. **Connection Pooling**: PostgreSQL connection pool for concurrent requests

### Frontend

1. **Loading States**: Show progress indicators for all async operations
2. **Optimistic Updates**: Consider updating UI before server confirmation
3. **Error Recovery**: Allow retry without losing user input
4. **Scroll Performance**: Use virtual scrolling for large meal lists (if needed)

---

## Security Considerations

1. **API Key Protection**: Never expose OpenAI key in frontend
2. **User Isolation**: All queries filter by user_id
3. **Input Validation**: Pydantic schemas validate all inputs
4. **SQL Injection**: SQLAlchemy ORM prevents SQL injection
5. **Rate Limiting**: Consider implementing rate limits on generate endpoints
6. **CORS**: Ensure proper CORS configuration for production

---

## Future Enhancements

1. **Meal History**: Track user's favorite meals for better personalization
2. **Dietary Preferences Learning**: Learn from swaps to improve future generation
3. **Meal Notes**: Allow users to add notes/ratings to meals
4. **Shopping List**: Auto-generate shopping list from weekly plan
5. **Recipe Scaling**: Adjust portions based on household size
6. **Export Options**: PDF/print view of weekly plan
7. **Meal Prep Mode**: Batch cooking suggestions for efficiency
8. **Nutrition Insights**: Weekly nutrition trends and analysis

---

This completes the AI Meal Plan Generation implementation plan with complete code for all backend services and detailed specifications for frontend components.