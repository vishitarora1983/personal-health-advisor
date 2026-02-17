"""
AI Meal Planner service with switchable LLM providers (OpenAI / OCI).

Set LLM_PROVIDER=openai or LLM_PROVIDER=oci in .env to choose.
"""

import asyncio
import json
import logging
import re
from abc import ABC, abstractmethod
from typing import Dict, Any, Optional, List

from config import settings
from prompts.meal_plan_system import SYSTEM_PROMPT, MEAL_PLAN_JSON_SCHEMA, build_user_prompt
from prompts.swap_meal import SWAP_MEAL_JSON_SCHEMA, build_swap_prompt
from prompts.custom_meal import CUSTOM_MEAL_JSON_SCHEMA, build_custom_meal_prompt


logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Provider abstraction
# ---------------------------------------------------------------------------

class _LLMProvider(ABC):
    """Base class for LLM providers."""

    @abstractmethod
    async def chat(
        self,
        system_content: str,
        user_content: str,
        temperature: float,
        max_tokens: int,
    ) -> str:
        """Send a chat request and return the raw text response."""


class _OpenAIProvider(_LLMProvider):
    """OpenAI GPT provider using the async client."""

    def __init__(self):
        from openai import AsyncOpenAI

        if not settings.OPENAI_API_KEY:
            raise ValueError("OPENAI_API_KEY must be set in .env when LLM_PROVIDER=openai")

        self.client = AsyncOpenAI(api_key=settings.OPENAI_API_KEY)
        self.model = settings.OPENAI_MODEL
        logger.info(f"OpenAI provider initialised (model={self.model})")

    async def chat(
        self,
        system_content: str,
        user_content: str,
        temperature: float,
        max_tokens: int,
    ) -> str:
        response = await self.client.chat.completions.create(
            model=self.model,
            messages=[
                {"role": "system", "content": system_content},
                {"role": "user", "content": user_content},
            ],
            temperature=temperature,
            max_tokens=max_tokens,
            response_format={"type": "json_object"},
        )
        text = response.choices[0].message.content
        if not text:
            raise ValueError(
                f"Model returned empty response (finish_reason={response.choices[0].finish_reason})"
            )
        return text


class _OCIProvider(_LLMProvider):
    """OCI Generative AI (Cohere Command R+) provider."""

    def __init__(self):
        import oci
        from oci.generative_ai_inference import GenerativeAiInferenceClient

        if not settings.OCI_COMPARTMENT_ID or not settings.OCI_MODEL_ID:
            raise ValueError(
                "OCI_COMPARTMENT_ID and OCI_MODEL_ID must be set in .env when LLM_PROVIDER=oci"
            )

        oci_config = oci.config.from_file(profile_name=settings.OCI_CONFIG_PROFILE)
        self.client = GenerativeAiInferenceClient(
            config=oci_config,
            service_endpoint=settings.OCI_GENAI_ENDPOINT,
        )
        self.compartment_id = settings.OCI_COMPARTMENT_ID
        self.model_id = settings.OCI_MODEL_ID
        logger.info("OCI provider initialised")

    async def chat(
        self,
        system_content: str,
        user_content: str,
        temperature: float,
        max_tokens: int,
    ) -> str:
        from oci.generative_ai_inference.models import (
            ChatDetails,
            OnDemandServingMode,
            CohereChatRequest,
            CohereResponseJsonFormat,
        )

        chat_details = ChatDetails(
            compartment_id=self.compartment_id,
            serving_mode=OnDemandServingMode(model_id=self.model_id),
            chat_request=CohereChatRequest(
                message=user_content,
                preamble_override=system_content,
                max_tokens=max_tokens,
                temperature=temperature,
                response_format=CohereResponseJsonFormat(),
                is_stream=False,
            ),
        )

        response = await asyncio.to_thread(self.client.chat, chat_details)

        chat_response = response.data.chat_response
        text = chat_response.text
        if not text:
            raise ValueError(
                f"Model returned empty response (finish_reason={chat_response.finish_reason})"
            )
        return text


def _create_provider() -> _LLMProvider:
    """Factory: return the provider selected by LLM_PROVIDER env var."""
    provider_name = settings.LLM_PROVIDER
    if provider_name == "openai":
        return _OpenAIProvider()
    elif provider_name == "oci":
        return _OCIProvider()
    else:
        raise ValueError(f"Unknown LLM_PROVIDER: {provider_name!r}. Must be 'openai' or 'oci'.")


class AIMealPlanner:
    """
    AI-powered meal plan generator with switchable LLM backend.

    Uses LLM_PROVIDER env var to select OpenAI or OCI.
    """

    def __init__(self):
        self._provider = _create_provider()
        self.temperature = 0.7
        self.max_tokens = 16000
        self.max_retries = 2

    @staticmethod
    def _strip_code_fences(text: str) -> str:
        """Strip markdown code fences (```json ... ```) from LLM output."""
        stripped = re.sub(r'^```(?:json)?\s*\n?', '', text.strip())
        stripped = re.sub(r'\n?```\s*$', '', stripped)
        return stripped.strip()

    async def _chat(
        self,
        system_content: str,
        user_content: str,
        temperature: float = None,
        max_tokens: int = None,
    ) -> str:
        """Send a chat request via the active provider and return cleaned text."""
        raw_text = await self._provider.chat(
            system_content,
            user_content,
            temperature or self.temperature,
            max_tokens or self.max_tokens,
        )
        return self._strip_code_fences(raw_text)

    async def generate_meal_plan(
        self,
        profile,
        nutrition_targets: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        Generate a complete 7-day meal plan using AI.

        Args:
            profile: UserProfile ORM object with dietary preferences
            nutrition_targets: Dict with calculated nutrition targets

        Returns:
            Dict containing the weekly_plan array with 7 days of meals

        Raises:
            Exception: If API call fails or response is invalid JSON
        """
        user_prompt = build_user_prompt(profile, nutrition_targets)
        logger.info(f"Generating meal plan for profile {profile.id}")

        last_error = None
        for attempt in range(1, self.max_retries + 1):
            try:
                logger.info(f"Attempt {attempt}/{self.max_retries}")

                response_content = await self._chat(
                    SYSTEM_PROMPT,
                    user_prompt,
                    temperature=self.temperature,
                    max_tokens=self.max_tokens,
                )
                logger.debug(f"Raw AI response: {response_content[:500]}...")

                meal_plan_data = json.loads(response_content)

                # Try the expected key first, then common alternatives
                weekly_plan = None
                for key in ["weekly_plan", "days", "meal_plan", "week"]:
                    if key in meal_plan_data:
                        weekly_plan = meal_plan_data[key]
                        break

                if weekly_plan is None and isinstance(meal_plan_data, list):
                    weekly_plan = meal_plan_data

                if weekly_plan is None:
                    for v in meal_plan_data.values():
                        if isinstance(v, list) and len(v) == 7:
                            weekly_plan = v
                            break

                if weekly_plan is None:
                    logger.error(f"AI response keys: {list(meal_plan_data.keys())}")
                    last_error = ValueError(f"AI response missing 'weekly_plan' key. Got keys: {list(meal_plan_data.keys())}")
                    continue

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

        Args:
            meal: The meal to be replaced (dict with meal data)
            day_meals: All meals for this day (to avoid duplication)
            profile: UserProfile ORM object
            reason: Optional user-provided reason for swap

        Returns:
            Dict containing the new meal data
        """
        try:
            user_prompt = build_swap_prompt(meal, day_meals, profile, reason)

            logger.info(f"Swapping meal: {meal.get('dish_name', 'unknown')}")
            if reason:
                logger.debug(f"Swap reason: {reason}")

            response_content = await self._chat(
                "You are an expert nutritionist generating a replacement meal. "
                "Return a valid JSON object with a 'meal' key containing the new meal. "
                "Return ONLY valid JSON, no other text.",
                user_prompt,
                temperature=self.temperature,
                max_tokens=2000,
            )
            logger.debug(f"Raw swap response: {response_content[:300]}...")

            swap_data = json.loads(response_content)
            logger.info(f"Swap response keys: {list(swap_data.keys())}")

            if "meal" in swap_data and isinstance(swap_data["meal"], dict):
                new_meal = swap_data["meal"]
            else:
                new_meal = swap_data

            logger.info(f"Swap meal keys: {list(new_meal.keys())}")

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

            response_content = await self._chat(
                "You are an expert nutritionist and meal planner. Generate meals that precisely match the nutritional targets. Return valid JSON only.",
                prompt,
                temperature=self.temperature,
                max_tokens=2000,
            )

            data = json.loads(response_content)

            meals = data.get("meals", [])
            if not meals:
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

            response_content = await self._chat(
                "You are an expert chef and nutritionist. Generate precise recipes with exact ingredient quantities that match the given nutritional targets. Return valid JSON only.",
                prompt,
                temperature=0.6,
                max_tokens=1000,
            )

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

            response_content = await self._chat(
                "You are a nutrition expert. Estimate calories and macronutrients from food descriptions. Use USDA data for accuracy. Always return valid JSON with numeric values. Return ONLY the JSON object, no other text.",
                prompt,
                temperature=0.3,
                max_tokens=200,
            )

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

    async def analyze_custom_meal(
        self,
        description: str,
        meal_type: str,
        profile,
        nutrition_targets: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """
        Analyze a user-described meal and return full nutritional info.

        Args:
            description: Free-text meal description
            meal_type: The meal slot being replaced (breakfast, lunch, dinner, snack)
            profile: UserProfile ORM object
            nutrition_targets: Optional calculated nutrition targets for portion guidance

        Returns:
            Dict with 'meal' (full meal data) and 'warnings' (list of dietary warnings)
        """
        try:
            user_prompt = build_custom_meal_prompt(description, meal_type, profile, nutrition_targets)

            logger.info(f"Analyzing custom meal: {description[:100]}")

            response_content = await self._chat(
                "You are an expert nutritionist analyzing a user-described meal. "
                "Return accurate nutritional information and flag any dietary conflicts. "
                "Return a valid JSON object with 'meal' and 'warnings' keys. "
                "Return ONLY valid JSON, no other text.",
                user_prompt,
                temperature=0.4,
                max_tokens=1000,
            )
            logger.debug(f"Raw custom meal response: {response_content[:300]}...")

            data = json.loads(response_content)
            logger.info(f"Custom meal response keys: {list(data.keys())}")

            if "meal" in data and isinstance(data["meal"], dict):
                meal_data = data["meal"]
            else:
                meal_data = data

            warnings = data.get("warnings", [])
            if not isinstance(warnings, list):
                warnings = []

            required_fields = ["dish_name", "calories", "protein", "carbs", "fats"]
            for field in required_fields:
                if field not in meal_data:
                    raise ValueError(f"Custom meal missing required field: {field}")

            for field in ["calories", "protein", "carbs", "fats", "fiber", "sodium", "sugar"]:
                if field in meal_data and meal_data[field] is not None:
                    meal_data[field] = round(float(meal_data[field]), 1)

            if "prep_time" in meal_data and meal_data["prep_time"] is not None:
                meal_data["prep_time"] = int(meal_data["prep_time"])

            logger.info(f"Custom meal analyzed: {meal_data['dish_name']} — {meal_data['calories']} cal")

            return {"meal": meal_data, "warnings": warnings}

        except json.JSONDecodeError as e:
            logger.error(f"Failed to parse custom meal response as JSON: {e}")
            raise Exception(f"AI returned invalid JSON: {str(e)}")

        except Exception as e:
            logger.error(f"Error analyzing custom meal: {e}")
            raise Exception(f"Failed to analyze custom meal: {str(e)}")
