"""
Meal plan schemas for weekly and daily meal planning.

These schemas handle the complex structure of meal plans, including nested
meals with ingredients and nutritional information.
"""

from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field
from datetime import date, datetime
import json


class IngredientSchema(BaseModel):
    """Schema for a single ingredient with quantity and unit."""
    name: str = Field(description="Ingredient name")
    quantity: str = Field(description="Quantity as string (supports fractions)")
    unit: str = Field(description="Measurement unit (g, kg, cups, tbsp, etc.)")


class MealSchema(BaseModel):
    """
    Schema for a single meal with complete recipe and nutrition information.

    This represents one meal (breakfast, lunch, dinner, or snack) with all
    details needed for preparation and nutrition tracking.
    """
    meal_type: str = Field(description="Type: breakfast, lunch, dinner, or snack")
    dish_name: str = Field(description="Name of the dish")
    description: Optional[str] = Field(default=None, description="Brief description or serving suggestion")
    cuisine: Optional[str] = Field(default=None, description="Cuisine type (e.g., Indian, Italian)")
    portion_size: Optional[str] = Field(default=None, description="Human-readable portion (e.g., '1 bowl (300g)')")

    # Nutritional Information
    calories: float = Field(description="Total calories")
    protein: float = Field(description="Protein in grams")
    carbs: float = Field(description="Carbohydrates in grams")
    fats: float = Field(description="Fats in grams")
    fiber: Optional[float] = Field(default=None, description="Fiber in grams")
    sodium: Optional[float] = Field(default=None, description="Sodium in milligrams")
    sugar: Optional[float] = Field(default=None, description="Sugar in grams")

    # Recipe Details
    prep_time: Optional[int] = Field(default=None, description="Preparation time in minutes")
    ingredients: Optional[List[IngredientSchema]] = Field(default=None, description="List of ingredients with quantities (null until recipe generated on demand)")
    recipe_brief: Optional[str] = Field(default=None, description="Short cooking instructions")


class MealResponse(MealSchema):
    """
    Response schema for a single meal including database ID.

    Used when returning individual meal details from the database.
    """
    id: int = Field(description="Database ID of the meal")
    daily_plan_id: int = Field(description="Parent daily plan ID")

    model_config = {"from_attributes": True}

    @staticmethod
    def from_orm_with_ingredients(meal_obj):
        """
        Convert ORM meal object to response schema, deserializing ingredients.

        Args:
            meal_obj: SQLAlchemy Meal model instance

        Returns:
            MealResponse with deserialized ingredients
        """
        # Deserialize ingredients from JSON
        ingredients = []
        if meal_obj.ingredients:
            try:
                ingredients_data = json.loads(meal_obj.ingredients) if isinstance(meal_obj.ingredients, str) else meal_obj.ingredients
                ingredients = [IngredientSchema(**ing) for ing in ingredients_data]
            except (json.JSONDecodeError, TypeError):
                ingredients = []

        return MealResponse(
            id=meal_obj.id,
            daily_plan_id=meal_obj.daily_plan_id,
            meal_type=meal_obj.meal_type,
            dish_name=meal_obj.dish_name,
            description=meal_obj.description,
            cuisine=meal_obj.cuisine,
            portion_size=meal_obj.portion_size,
            calories=meal_obj.calories,
            protein=meal_obj.protein,
            carbs=meal_obj.carbs,
            fats=meal_obj.fats,
            fiber=meal_obj.fiber,
            prep_time=meal_obj.prep_time,
            ingredients=ingredients,
            recipe_brief=meal_obj.recipe_brief
        )


class DailyPlanSchema(BaseModel):
    """
    Schema for a single day's meal plan with aggregated nutrition.

    Contains all meals for one day plus daily nutritional totals.
    """
    id: int = Field(description="Database ID of the daily plan")
    day_of_week: int = Field(ge=0, le=6, description="0=Day 1 through 6=Day 7")
    day_date: date = Field(description="Actual calendar date (YYYY-MM-DD)")
    meals: List[MealResponse] = Field(description="All meals for this day")

    # Aggregated Daily Nutrition
    total_calories: float = Field(description="Sum of calories from all meals")
    total_protein: float = Field(description="Sum of protein in grams")
    total_carbs: float = Field(description="Sum of carbohydrates in grams")
    total_fats: float = Field(description="Sum of fats in grams")
    total_fiber: Optional[float] = Field(default=0, description="Sum of fiber in grams")
    total_sodium: Optional[float] = Field(default=0, description="Sum of sodium in milligrams")
    total_sugar: Optional[float] = Field(default=0, description="Sum of sugar in grams")


class WeeklyPlanResponse(BaseModel):
    """
    Complete weekly meal plan with all 7 days.

    This is the primary response schema for meal plan generation and retrieval.
    """
    id: int = Field(description="Database ID of the weekly plan")
    profile_id: int = Field(description="Owner profile ID")
    week_start_date: date = Field(description="Monday of the plan week")
    status: str = Field(description="active or archived")
    days: List[DailyPlanSchema] = Field(description="Meal plans for all 7 days")
    created_at: datetime = Field(description="Plan generation timestamp")

    model_config = {"from_attributes": True}


class GenerateMealPlanRequest(BaseModel):
    """
    Optional request body for meal plan generation.

    Allows temporary preference overrides without modifying the profile.
    """
    preferences_override: Optional[Dict[str, Any]] = Field(
        default=None,
        description="Temporary preference overrides (e.g., specific cuisine for this week)"
    )


class SwapMealRequest(BaseModel):
    """
    Request to swap a single meal with an alternative.

    Optionally includes a reason for the swap to guide AI generation.
    """
    reason: Optional[str] = Field(
        default=None,
        max_length=200,
        description="Optional reason for swap (e.g., 'want something lighter')"
    )


class SwapMealResponse(BaseModel):
    """
    Response after successfully swapping a meal.

    Returns the new meal that replaced the original.
    """
    message: str = Field(default="Meal swapped successfully")
    new_meal: MealResponse = Field(description="The replacement meal")
