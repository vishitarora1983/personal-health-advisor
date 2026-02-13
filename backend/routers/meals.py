"""
Meals router for individual meal operations.

Handles meal swap functionality (meal replacement with AI-generated alternatives).
"""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
import json

from database import get_db
from models.profile import UserProfile
from models.meal_plan import WeeklyPlan, DailyPlan, Meal
from schemas.meal_plan import SwapMealRequest, SwapMealResponse, MealResponse
from services.ai_meal_planner import AIMealPlanner


router = APIRouter(prefix="/meals", tags=["Meals"])


@router.post("/{meal_id}/recipe", response_model=MealResponse, status_code=status.HTTP_200_OK)
async def generate_recipe(
    meal_id: int,
    db: Session = Depends(get_db)
):
    """
    Generate recipe (ingredients + recipe_brief) for a single meal on demand.

    If the meal already has ingredients, returns immediately (cached).
    Otherwise calls AI to generate and persists the recipe.
    """
    meal = db.query(Meal).filter(Meal.id == meal_id).first()

    if not meal:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Meal with id {meal_id} not found"
        )

    # If recipe already exists, return immediately (cached)
    if meal.ingredients is not None:
        return MealResponse.from_orm_with_ingredients(meal)

    # Get profile for cooking constraints
    daily_plan = db.query(DailyPlan).filter(DailyPlan.id == meal.daily_plan_id).first()
    weekly_plan = db.query(WeeklyPlan).filter(WeeklyPlan.id == daily_plan.weekly_plan_id).first()
    profile = db.query(UserProfile).filter(UserProfile.id == weekly_plan.profile_id).first()

    meal_dict = {
        "dish_name": meal.dish_name,
        "meal_type": meal.meal_type,
        "cuisine": meal.cuisine,
        "portion_size": meal.portion_size,
        "calories": meal.calories,
        "protein": meal.protein,
        "carbs": meal.carbs,
        "fats": meal.fats,
    }

    ai_planner = AIMealPlanner()

    try:
        recipe_data = await ai_planner.generate_recipe(meal_dict, profile)

        meal.ingredients = json.dumps(recipe_data["ingredients"])
        meal.recipe_brief = recipe_data.get("recipe_brief")

        db.commit()
        db.refresh(meal)

        return MealResponse.from_orm_with_ingredients(meal)

    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to generate recipe: {str(e)}"
        )


@router.post("/{meal_id}/swap", response_model=SwapMealResponse, status_code=status.HTTP_200_OK)
async def swap_meal(
    meal_id: int,
    swap_request: SwapMealRequest,
    db: Session = Depends(get_db)
):
    """
    Swap a single meal with an AI-generated alternative.

    Generates a new meal that matches the nutritional profile of the original
    while being completely different in cuisine and ingredients.

    Args:
        meal_id: ID of the meal to swap
        swap_request: Optional reason for swap
        db: Database session dependency

    Returns:
        SwapMealResponse: Success message with new meal details

    Raises:
        HTTPException 404: If meal not found
        HTTPException 500: If AI generation fails
    """
    # Get the meal to swap
    meal = db.query(Meal).filter(Meal.id == meal_id).first()

    if not meal:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Meal with id {meal_id} not found"
        )

    # Get daily plan and profile
    daily_plan = db.query(DailyPlan).filter(DailyPlan.id == meal.daily_plan_id).first()
    weekly_plan = db.query(WeeklyPlan).filter(WeeklyPlan.id == daily_plan.weekly_plan_id).first()
    profile = db.query(UserProfile).filter(UserProfile.id == weekly_plan.profile_id).first()

    # Get all meals for this day (to avoid duplication)
    day_meals = db.query(Meal).filter(Meal.daily_plan_id == daily_plan.id).all()

    # Convert meal to dict for AI
    meal_dict = {
        "meal_type": meal.meal_type,
        "dish_name": meal.dish_name,
        "calories": meal.calories,
        "protein": meal.protein,
        "carbs": meal.carbs,
        "fats": meal.fats,
        "fiber": meal.fiber
    }

    # Convert day meals to list of dicts
    day_meals_list = [
        {
            "meal_type": m.meal_type,
            "dish_name": m.dish_name,
            "calories": m.calories,
            "protein": m.protein,
            "carbs": m.carbs,
            "fats": m.fats
        }
        for m in day_meals
    ]

    # Initialize AI meal planner
    ai_planner = AIMealPlanner()

    try:
        # Generate replacement meal
        new_meal_data = await ai_planner.swap_meal(
            meal=meal_dict,
            day_meals=day_meals_list,
            profile=profile,
            reason=swap_request.reason if swap_request else None
        )

        # Update existing meal record with new data
        meal.dish_name = new_meal_data["dish_name"]
        meal.description = new_meal_data.get("description")
        meal.cuisine = new_meal_data.get("cuisine")
        meal.portion_size = new_meal_data.get("portion_size")
        meal.calories = new_meal_data["calories"]
        meal.protein = new_meal_data["protein"]
        meal.carbs = new_meal_data["carbs"]
        meal.fats = new_meal_data["fats"]
        meal.fiber = new_meal_data.get("fiber")
        meal.sodium = new_meal_data.get("sodium")
        meal.sugar = new_meal_data.get("sugar")
        meal.prep_time = new_meal_data.get("prep_time")
        meal.ingredients = None  # Clear old recipe — generated on demand
        meal.recipe_brief = None

        # Update daily plan totals
        meals_in_day = db.query(Meal).filter(Meal.daily_plan_id == daily_plan.id).all()
        daily_plan.total_calories = sum(m.calories for m in meals_in_day)
        daily_plan.total_protein = sum(m.protein for m in meals_in_day)
        daily_plan.total_carbs = sum(m.carbs for m in meals_in_day)
        daily_plan.total_fats = sum(m.fats for m in meals_in_day)

        db.commit()
        db.refresh(meal)

        # Build response
        new_meal_response = MealResponse.from_orm_with_ingredients(meal)

        return SwapMealResponse(
            message="Meal swapped successfully",
            new_meal=new_meal_response
        )

    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to swap meal: {str(e)}"
        )
