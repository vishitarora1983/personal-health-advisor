"""
AI Meal Planner service using OpenAI GPT-4o.

This service handles communication with OpenAI's API for generating
personalized meal plans using structured JSON output.
"""

import json
import logging
from typing import Dict, Any, Optional, List
from openai import AsyncOpenAI
from config import settings
from prompts.meal_plan_system import SYSTEM_PROMPT, MEAL_PLAN_JSON_SCHEMA, build_user_prompt
from prompts.swap_meal import SWAP_MEAL_JSON_SCHEMA, build_swap_prompt


# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


class AIMealPlanner:
    """
    AI-powered meal plan generator using OpenAI GPT-4o.

    This class encapsulates all interactions with the OpenAI API for meal planning,
    including full weekly plan generation and individual meal swaps.
    """

    def __init__(self):
        """
        Initialize AsyncOpenAI client with API key from settings.

        Raises:
            ValueError: If OPENAI_API_KEY is not set in environment
        """
        if not settings.OPENAI_API_KEY:
            raise ValueError(
                "OPENAI_API_KEY not found in environment. "
                "Please set it in your .env file."
            )

        self.client = AsyncOpenAI(api_key=settings.OPENAI_API_KEY)
        self.model = "gpt-4o"  # GPT-4o supports structured JSON output
        self.temperature = 0.7  # Balanced creativity and consistency
        self.max_tokens = 16000  # Summaries only (no recipes), well within gpt-4o 16384 limit
        self.max_retries = 2  # Retry if AI returns incomplete plan

    async def generate_meal_plan(
        self,
        profile,
        nutrition_targets: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        Generate a complete 7-day meal plan using AI.

        This method constructs a detailed prompt from the user's profile and
        nutrition targets, then uses OpenAI's structured output feature to
        generate a meal plan in strict JSON format.

        Args:
            profile: UserProfile ORM object with dietary preferences
            nutrition_targets: Dict with calculated nutrition targets

        Returns:
            Dict containing the weekly_plan array with 7 days of meals

        Raises:
            Exception: If API call fails or response is invalid JSON
        """
        # Build the user-specific prompt
        user_prompt = build_user_prompt(profile, nutrition_targets)
        logger.info(f"Generating meal plan for profile {profile.id}")

        last_error = None
        for attempt in range(1, self.max_retries + 1):
            try:
                logger.info(f"Attempt {attempt}/{self.max_retries}")

                # Call OpenAI with structured output (async)
                response = await self.client.chat.completions.create(
                    model=self.model,
                    messages=[
                        {"role": "system", "content": SYSTEM_PROMPT},
                        {"role": "user", "content": user_prompt}
                    ],
                    response_format={"type": "json_object"},
                    temperature=self.temperature,
                    max_tokens=self.max_tokens
                )

                # Extract and parse the JSON response
                response_content = response.choices[0].message.content
                finish_reason = response.choices[0].finish_reason
                logger.debug(f"Raw AI response: {response_content[:500]}...")
                logger.info(f"Finish reason: {finish_reason}")

                # If response was truncated (hit token limit), the JSON may be incomplete
                if finish_reason == "length":
                    logger.warning(f"Response truncated (hit max_tokens). Retrying...")
                    last_error = ValueError("AI response truncated due to token limit")
                    continue

                meal_plan_data = json.loads(response_content)

                # Try the expected key first, then common alternatives
                weekly_plan = None
                for key in ["weekly_plan", "days", "meal_plan", "week"]:
                    if key in meal_plan_data:
                        weekly_plan = meal_plan_data[key]
                        break

                # If no known key found, check if the response is a list directly
                if weekly_plan is None and isinstance(meal_plan_data, list):
                    weekly_plan = meal_plan_data

                # Last resort: grab the first list value in the response
                if weekly_plan is None:
                    for v in meal_plan_data.values():
                        if isinstance(v, list) and len(v) == 7:
                            weekly_plan = v
                            break

                if weekly_plan is None:
                    logger.error(f"AI response keys: {list(meal_plan_data.keys())}")
                    last_error = ValueError(f"AI response missing 'weekly_plan' key. Got keys: {list(meal_plan_data.keys())}")
                    continue

                # Normalize to expected format
                meal_plan_data = {"weekly_plan": weekly_plan}

                if len(meal_plan_data["weekly_plan"]) != 7:
                    logger.warning(f"Got {len(meal_plan_data['weekly_plan'])} days instead of 7, retrying...")
                    last_error = ValueError(f"Expected 7 days in plan, got {len(meal_plan_data['weekly_plan'])}")
                    continue

                logger.info(f"Successfully generated meal plan with 7 days")
                return meal_plan_data

            except json.JSONDecodeError as e:
                logger.error(f"Failed to parse AI response as JSON: {e}")
                last_error = e
                continue

        # All retries exhausted
        raise Exception(f"Failed to generate meal plan after {self.max_retries} attempts: {last_error}")

    async def swap_meal(
        self,
        meal: Dict[str, Any],
        day_meals: List[Dict[str, Any]],
        profile,
        reason: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Generate a replacement for a single meal using AI.

        This method creates a new meal that matches the nutritional profile of
        the original while being completely different in cuisine and ingredients.

        Args:
            meal: The meal to be replaced (dict with meal data)
            day_meals: All meals for this day (to avoid duplication)
            profile: UserProfile ORM object
            reason: Optional user-provided reason for swap

        Returns:
            Dict containing the new meal data

        Raises:
            Exception: If API call fails or response is invalid
        """
        try:
            # Build the swap-specific prompt
            user_prompt = build_swap_prompt(meal, day_meals, profile, reason)

            logger.info(f"Swapping meal: {meal.get('dish_name', 'unknown')}")
            if reason:
                logger.debug(f"Swap reason: {reason}")

            # Call OpenAI with structured output for single meal (async)
            response = await self.client.chat.completions.create(
                model=self.model,
                messages=[
                    {
                        "role": "system",
                        "content": "You are an expert nutritionist generating a replacement meal. "
                                   "Return a valid JSON object with a 'meal' key containing the new meal."
                    },
                    {"role": "user", "content": user_prompt}
                ],
                response_format={"type": "json_object"},
                temperature=self.temperature,
                max_tokens=2000  # Single meal needs less tokens
            )

            # Extract and parse the JSON response
            response_content = response.choices[0].message.content
            logger.debug(f"Raw swap response: {response_content[:300]}...")

            swap_data = json.loads(response_content)
            logger.info(f"Swap response keys: {list(swap_data.keys())}")

            # Normalize: AI may return {meal: {...}} or flat {...}
            if "meal" in swap_data and isinstance(swap_data["meal"], dict):
                new_meal = swap_data["meal"]
            else:
                # AI returned flat structure — use it directly
                new_meal = swap_data

            logger.info(f"Swap meal keys: {list(new_meal.keys())}")

            # Validate required meal fields
            required_fields = [
                "meal_type", "dish_name", "calories", "protein",
                "carbs", "fats"
            ]
            for field in required_fields:
                if field not in new_meal:
                    raise ValueError(f"Swapped meal missing required field: {field}")

            logger.info(f"Successfully swapped meal to: {new_meal['dish_name']}")

            return new_meal

        except json.JSONDecodeError as e:
            logger.error(f"Failed to parse swap response as JSON: {e}")
            raise Exception(f"AI returned invalid JSON: {str(e)}")

        except Exception as e:
            logger.error(f"Error swapping meal: {e}")
            raise Exception(f"Failed to swap meal: {str(e)}")

    async def generate_single_day(
        self,
        profile,
        nutrition_targets: Dict[str, Any],
        existing_dishes: List[str] = None
    ) -> List[Dict[str, Any]]:
        """
        Generate meals for a single day only (much faster than a full week).

        Args:
            profile: UserProfile ORM object
            nutrition_targets: Dict with target_calories, target_protein, etc.
            existing_dishes: List of dish names already in the plan to avoid duplicates

        Returns:
            List of meal dicts (same structure as one day's meals in weekly plan)
        """
        allergies = profile.allergies_list if hasattr(profile, 'allergies_list') else []
        cuisines = profile.cuisines_list if hasattr(profile, 'cuisines_list') else []
        meals_per_day = profile.meals_per_day_list if hasattr(profile, 'meals_per_day_list') else []

        allergies_text = f"ALLERGIES (NEVER USE): {', '.join(allergies)}" if allergies else "No allergies"
        cuisines_text = f"ALL meals MUST be from these cuisines ONLY: {', '.join(cuisines)}" if cuisines else "Use variety of cuisines"
        avoid_text = f"Foods to avoid: {profile.foods_to_avoid}" if profile.foods_to_avoid else ""

        snacks_per_day = profile.snacks_per_day if hasattr(profile, 'snacks_per_day') else 0
        num_meals = (len(meals_per_day) if meals_per_day else 3) + snacks_per_day
        meal_types = ', '.join(meals_per_day) if meals_per_day else 'breakfast, lunch, dinner'
        if snacks_per_day > 0:
            meal_types += f" + {snacks_per_day} snack(s)"

        existing_text = ""
        if existing_dishes:
            existing_text = f"\n\nDo NOT repeat any of these dishes already in the plan: {', '.join(existing_dishes)}"

        prompt = f"""Generate meals for ONE day with the following requirements:

## Nutrition Targets (per day)
- Calories: {nutrition_targets.get('target_calories', 2000)} kcal
- Protein: {nutrition_targets.get('target_protein', 50)}g
- Carbs: {nutrition_targets.get('target_carbs', 250)}g
- Fats: {nutrition_targets.get('target_fats', 65)}g

## Profile
- Diet: {profile.diet_type}
- {allergies_text}
- {cuisines_text}
- Cooking skill: {profile.cooking_skill}, Max cook time: {profile.max_cook_time} min
- Household size: {profile.household_size}
- Spice tolerance: {profile.spice_tolerance}
{f'- {avoid_text}' if avoid_text else ''}{existing_text}

Generate exactly {num_meals} meals ({meal_types}). Return JSON:
{{
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

Do NOT include ingredients or recipe_brief.

IMPORTANT: portion_size MUST be explicit with exact quantities — use cups, bowls, grams, pieces, slices, or count. Examples: "1 bowl (300g)", "2 medium rotis + 1 cup dal", "4 pieces (200g)", "1.5 cups (350ml)". NEVER use vague terms like "1 serving" or "standard portion"."""

        try:
            logger.info(f"Generating single day meals for profile {profile.id}")

            response = await self.client.chat.completions.create(
                model=self.model,
                messages=[
                    {
                        "role": "system",
                        "content": "You are an expert nutritionist and meal planner. Generate meals that precisely match the nutritional targets. Return valid JSON only."
                    },
                    {"role": "user", "content": prompt}
                ],
                response_format={"type": "json_object"},
                temperature=self.temperature,
                max_tokens=2000
            )

            response_content = response.choices[0].message.content
            data = json.loads(response_content)

            meals = data.get("meals", [])
            if not meals:
                # Try to find any list in the response
                for v in data.values():
                    if isinstance(v, list):
                        meals = v
                        break

            if not meals:
                raise ValueError(f"No meals in response. Keys: {list(data.keys())}")

            logger.info(f"Single day generated: {len(meals)} meals")
            return meals

        except Exception as e:
            logger.error(f"Error generating single day: {e}")
            raise Exception(f"Failed to generate meals for day: {str(e)}")

    async def generate_recipe(
        self,
        meal_dict: Dict[str, Any],
        profile
    ) -> Dict[str, Any]:
        """
        Generate ingredients and recipe_brief for a single meal on demand.

        Args:
            meal_dict: Dict with dish_name, meal_type, cuisine, portion_size,
                       calories, protein, carbs, fats
            profile: UserProfile ORM object

        Returns:
            Dict with 'ingredients' (list) and 'recipe_brief' (str)
        """
        allergies = profile.allergies_list if hasattr(profile, 'allergies_list') else []
        allergies_text = f"ALLERGIES (NEVER USE): {', '.join(allergies)}" if allergies else "No allergies"

        prompt = f"""Generate a detailed recipe for the following dish:

- **Dish**: {meal_dict['dish_name']}
- **Meal type**: {meal_dict.get('meal_type', 'meal')}
- **Cuisine**: {meal_dict.get('cuisine', 'any')}
- **Portion size**: {meal_dict.get('portion_size', 'standard')}
- **Target calories**: {meal_dict.get('calories', 0)} kcal
- **Protein**: {meal_dict.get('protein', 0)}g | **Carbs**: {meal_dict.get('carbs', 0)}g | **Fats**: {meal_dict.get('fats', 0)}g

## User Constraints
- **Cooking skill**: {profile.cooking_skill}
- **Max cook time**: {profile.max_cook_time} minutes
- **Household size**: {profile.household_size}
- **{allergies_text}**

Return a JSON object with exactly two keys:
{{
  "ingredients": [
    {{"name": "ingredient name", "quantity": "amount", "unit": "unit"}}
  ],
  "recipe_brief": "2-4 sentence cooking instructions"
}}

Ingredients must have specific quantities matching the nutritional targets. Recipe brief must be clear and actionable for a {profile.cooking_skill} cook."""

        try:
            logger.info(f"Generating recipe for: {meal_dict['dish_name']}")

            response = await self.client.chat.completions.create(
                model=self.model,
                messages=[
                    {
                        "role": "system",
                        "content": "You are an expert chef and nutritionist. Generate precise recipes with exact ingredient quantities that match the given nutritional targets. Return valid JSON only."
                    },
                    {"role": "user", "content": prompt}
                ],
                response_format={"type": "json_object"},
                temperature=0.6,
                max_tokens=1000
            )

            response_content = response.choices[0].message.content
            recipe_data = json.loads(response_content)

            if "ingredients" not in recipe_data or "recipe_brief" not in recipe_data:
                raise ValueError(f"Recipe response missing required keys. Got: {list(recipe_data.keys())}")

            logger.info(f"Recipe generated: {len(recipe_data['ingredients'])} ingredients")
            return recipe_data

        except json.JSONDecodeError as e:
            logger.error(f"Failed to parse recipe response as JSON: {e}")
            raise Exception(f"AI returned invalid JSON: {str(e)}")

        except Exception as e:
            logger.error(f"Error generating recipe: {e}")
            raise Exception(f"Failed to generate recipe: {str(e)}")

    async def estimate_nutrition(self, description: str) -> Dict[str, Any]:
        """
        Estimate calories and macros from a free-text food description.

        Args:
            description: Free-text like "2 slices of pepperoni pizza and a can of coke"

        Returns:
            Dict with calories, protein, carbs, fats
        """
        prompt = f"""Estimate the nutritional content of the following meal:

"{description}"

Return a JSON object with these exact keys:
{{
  "calories": <number>,
  "protein": <number in grams>,
  "carbs": <number in grams>,
  "fats": <number in grams>
}}

Use USDA nutritional database standards. Be as accurate as possible based on typical serving sizes implied by the description. Return only numbers, no units in the values."""

        try:
            logger.info(f"Estimating nutrition for: {description[:100]}")

            response = await self.client.chat.completions.create(
                model=self.model,
                messages=[
                    {
                        "role": "system",
                        "content": "You are a nutrition expert. Estimate calories and macronutrients from food descriptions. Use USDA data for accuracy. Always return valid JSON with numeric values."
                    },
                    {"role": "user", "content": prompt}
                ],
                response_format={"type": "json_object"},
                temperature=0.3,
                max_tokens=200
            )

            response_content = response.choices[0].message.content
            data = json.loads(response_content)

            required = ["calories", "protein", "carbs", "fats"]
            for field in required:
                if field not in data:
                    raise ValueError(f"Missing field: {field}")
                data[field] = round(float(data[field]), 1)

            logger.info(f"Nutrition estimate: {data['calories']} cal, P{data['protein']}g C{data['carbs']}g F{data['fats']}g")
            return data

        except json.JSONDecodeError as e:
            logger.error(f"Failed to parse nutrition estimate as JSON: {e}")
            raise Exception(f"AI returned invalid JSON: {str(e)}")

        except Exception as e:
            logger.error(f"Error estimating nutrition: {e}")
            raise Exception(f"Failed to estimate nutrition: {str(e)}")
