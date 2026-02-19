"""
Meals router for individual meal operations.

Handles meal swap functionality (meal replacement with AI-generated alternatives).
"""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from datetime import timedelta
import json
import re

from database import get_db
from models.profile import UserProfile
from models.meal_plan import WeeklyPlan, DailyPlan, Meal
from models.meal_kid_share import MealKidShare
from schemas.meal_plan import (
    SwapMealRequest, SwapMealResponse,
    CustomMealRequest, CustomMealResponse,
    CopyMealRequest, CopyMealResponse,
    MealResponse, KidShareInfo,
    ShareWithKidsRequest, ShareWithKidsResponse,
)
from services.ai_meal_planner import AIMealPlanner
from services.nutrition_calculator import calculate_targets


def scale_portion_string(portion_size: str, ratio: float) -> str:
    """Scale numeric quantities in a portion string by a ratio.

    e.g. "4 parathas (600g total) + 100g chutney" with ratio 0.48
       → "~1.9 parathas (~288g total) + ~48g chutney"
    """
    parts = re.split(r'\s*\+\s*', portion_size)
    scaled_parts = []
    for part in parts:
        # Scale leading number
        scaled = re.sub(
            r'^(\d+\.?\d*)',
            lambda m: f"~{round(float(m.group(1)) * ratio, 1)}",
            part,
        )
        # Scale gram values in parentheses
        scaled = re.sub(
            r'\((\d+\.?\d*)\s*g([^)]*)\)',
            lambda m: f"(~{round(float(m.group(1)) * ratio)}g{m.group(2)})",
            scaled,
        )
        scaled_parts.append(scaled)
    return ' + '.join(scaled_parts)


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


@router.post("/{meal_id}/replace-custom", response_model=CustomMealResponse, status_code=status.HTTP_200_OK)
async def replace_with_custom_meal(
    meal_id: int,
    request: CustomMealRequest,
    db: Session = Depends(get_db)
):
    """
    Replace a meal with a user-described custom dish.

    Sends the description to AI for nutritional analysis, then updates
    the meal record with the returned data.

    Args:
        meal_id: ID of the meal to replace
        request: Custom meal description
        db: Database session dependency

    Returns:
        CustomMealResponse: Updated meal with nutritional info and any dietary warnings
    """
    # Get the meal to replace
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

    # Calculate nutrition targets for portion sizing guidance
    nutrition_targets = calculate_targets(profile)

    ai_planner = AIMealPlanner()

    try:
        result = await ai_planner.analyze_custom_meal(
            description=request.description,
            meal_type=meal.meal_type,
            profile=profile,
            nutrition_targets=nutrition_targets
        )

        new_meal_data = result["meal"]
        warnings = result.get("warnings", [])

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

        new_meal_response = MealResponse.from_orm_with_ingredients(meal)

        return CustomMealResponse(
            message="Meal replaced with custom dish",
            new_meal=new_meal_response,
            warnings=warnings if warnings else None
        )

    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to analyze custom meal: {str(e)}"
        )


@router.post("/{meal_id}/copy-to", response_model=CopyMealResponse, status_code=status.HTTP_200_OK)
async def copy_meal_to(
    meal_id: int,
    request: CopyMealRequest,
    db: Session = Depends(get_db)
):
    """
    Copy a meal's data to another meal slot. No AI call — pure data copy.

    Copies all nutritional/display fields from source to target,
    clears recipe on target (regenerated on demand), and recalculates
    the target day's daily totals.
    """
    source = db.query(Meal).filter(Meal.id == meal_id).first()
    if not source:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Source meal with id {meal_id} not found"
        )

    target = db.query(Meal).filter(Meal.id == request.target_meal_id).first()
    if not target:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Target meal with id {request.target_meal_id} not found"
        )

    if source.id == target.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot copy a meal onto itself"
        )

    # Copy display and nutritional fields
    target.dish_name = source.dish_name
    target.description = source.description
    target.cuisine = source.cuisine
    target.portion_size = source.portion_size
    target.calories = source.calories
    target.protein = source.protein
    target.carbs = source.carbs
    target.fats = source.fats
    target.fiber = source.fiber
    target.sodium = source.sodium
    target.sugar = source.sugar
    target.prep_time = source.prep_time
    # Clear recipe — regenerated on demand
    target.ingredients = None
    target.recipe_brief = None

    # Recalculate target day's daily totals
    target_daily_plan = db.query(DailyPlan).filter(DailyPlan.id == target.daily_plan_id).first()
    meals_in_day = db.query(Meal).filter(Meal.daily_plan_id == target_daily_plan.id).all()
    target_daily_plan.total_calories = sum(m.calories for m in meals_in_day)
    target_daily_plan.total_protein = sum(m.protein for m in meals_in_day)
    target_daily_plan.total_carbs = sum(m.carbs for m in meals_in_day)
    target_daily_plan.total_fats = sum(m.fats for m in meals_in_day)

    db.commit()
    db.refresh(target)

    return CopyMealResponse(
        message="Meal copied successfully",
        new_meal=MealResponse.from_orm_with_ingredients(target)
    )


def _get_shares_for_meal(db: Session, meal_id: int) -> list[KidShareInfo]:
    """Return KidShareInfo list for a given meal."""
    shares = db.query(MealKidShare).filter(MealKidShare.meal_id == meal_id).all()
    result = []
    for s in shares:
        kid = db.query(UserProfile).filter(UserProfile.id == s.kid_profile_id).first()
        if kid:
            result.append(KidShareInfo(profile_id=kid.id, profile_name=kid.name, scale_ratio=s.scale_ratio))
    return result


def _recalculate_daily_totals(db: Session, daily_plan):
    """Recalculate a daily plan's nutrition totals from its meals."""
    meals = db.query(Meal).filter(Meal.daily_plan_id == daily_plan.id).all()
    daily_plan.total_calories = sum(m.calories for m in meals)
    daily_plan.total_protein = sum(m.protein for m in meals)
    daily_plan.total_carbs = sum(m.carbs for m in meals)
    daily_plan.total_fats = sum(m.fats for m in meals)



@router.post("/{meal_id}/share-with-kids", response_model=ShareWithKidsResponse, status_code=status.HTTP_200_OK)
def share_with_kids(
    meal_id: int,
    request: ShareWithKidsRequest,
    db: Session = Depends(get_db)
):
    """
    Share (or unshare) a meal with kid profiles.

    Sets the desired kid_profile_ids for this meal. Newly added kids get a
    scaled copy of the meal in their plan. Removed kids have the shared meal
    deleted from their plan.
    """
    meal = db.query(Meal).filter(Meal.id == meal_id).first()
    if not meal:
        raise HTTPException(status_code=404, detail=f"Meal {meal_id} not found")

    # Navigate up to get the adult profile and week context
    daily_plan = db.query(DailyPlan).filter(DailyPlan.id == meal.daily_plan_id).first()
    weekly_plan = db.query(WeeklyPlan).filter(WeeklyPlan.id == daily_plan.weekly_plan_id).first()
    adult_profile = db.query(UserProfile).filter(UserProfile.id == weekly_plan.profile_id).first()

    # Current shares for this meal
    current_shares = db.query(MealKidShare).filter(MealKidShare.meal_id == meal_id).all()
    current_kid_ids = {s.kid_profile_id for s in current_shares}
    desired_kid_ids = set(request.kid_profile_ids)

    to_add = desired_kid_ids - current_kid_ids
    to_remove = current_kid_ids - desired_kid_ids

    # Calculate adult's target calories for ratio computation
    adult_targets = calculate_targets(adult_profile)
    adult_cal = adult_targets["target_calories"]

    try:
        # --- ADD new kids ---
        for kid_id in to_add:
            kid_profile = db.query(UserProfile).filter(UserProfile.id == kid_id).first()
            if not kid_profile:
                continue

            kid_targets = calculate_targets(kid_profile)
            kid_cal = kid_targets["target_calories"]
            scale_ratio = round(kid_cal / adult_cal, 4) if adult_cal else 1.0

            # Find kid's most-recent active weekly plan (the one they'd see in UI)
            kid_weekly = db.query(WeeklyPlan).filter(
                WeeklyPlan.profile_id == kid_id,
                WeeklyPlan.status == "active",
            ).order_by(WeeklyPlan.id.desc()).first()
            if not kid_weekly:
                kid_weekly = WeeklyPlan(
                    profile_id=kid_id,
                    week_start_date=weekly_plan.week_start_date,
                    status="active",
                )
                db.add(kid_weekly)
                db.flush()

            # Find or create kid's daily plan by calendar date (not day_of_week)
            kid_daily = db.query(DailyPlan).filter(
                DailyPlan.weekly_plan_id == kid_weekly.id,
                DailyPlan.day_date == daily_plan.day_date,
            ).first()
            if not kid_daily:
                day_offset = (daily_plan.day_date - kid_weekly.week_start_date).days
                kid_daily = DailyPlan(
                    weekly_plan_id=kid_weekly.id,
                    day_of_week=max(day_offset, 0),
                    day_date=daily_plan.day_date,
                    total_calories=0,
                    total_protein=0,
                    total_carbs=0,
                    total_fats=0,
                )
                db.add(kid_daily)
                db.flush()

            # Overwrite or create kid's meal in that slot
            kid_meal = db.query(Meal).filter(
                Meal.daily_plan_id == kid_daily.id,
                Meal.meal_type == meal.meal_type,
            ).first()

            scaled_fields = dict(
                dish_name=meal.dish_name,
                description=meal.description,
                cuisine=meal.cuisine,
                meal_type=meal.meal_type,
                portion_size=scale_portion_string(meal.portion_size, scale_ratio) if meal.portion_size else None,
                prep_time=meal.prep_time,
                calories=round(meal.calories * scale_ratio, 1),
                protein=round(meal.protein * scale_ratio, 1),
                carbs=round(meal.carbs * scale_ratio, 1),
                fats=round(meal.fats * scale_ratio, 1),
                fiber=round(meal.fiber * scale_ratio, 1) if meal.fiber else None,
                sodium=round(meal.sodium * scale_ratio, 1) if meal.sodium else None,
                sugar=round(meal.sugar * scale_ratio, 1) if meal.sugar else None,
                ingredients=None,
                recipe_brief=None,
            )

            if kid_meal:
                for k, v in scaled_fields.items():
                    setattr(kid_meal, k, v)
            else:
                kid_meal = Meal(daily_plan_id=kid_daily.id, **scaled_fields)
                db.add(kid_meal)

            _recalculate_daily_totals(db, kid_daily)

            # Create share record
            share = MealKidShare(meal_id=meal_id, kid_profile_id=kid_id, scale_ratio=scale_ratio)
            db.add(share)

        # --- REMOVE kids ---
        for kid_id in to_remove:
            # Delete the share record
            db.query(MealKidShare).filter(
                MealKidShare.meal_id == meal_id,
                MealKidShare.kid_profile_id == kid_id,
            ).delete()

            # Find kid's matching meal and delete it — search across all active plans by date
            kid_weekly = db.query(WeeklyPlan).filter(
                WeeklyPlan.profile_id == kid_id,
                WeeklyPlan.status == "active",
            ).order_by(WeeklyPlan.id.desc()).first()
            if not kid_weekly:
                continue

            kid_daily = db.query(DailyPlan).filter(
                DailyPlan.weekly_plan_id == kid_weekly.id,
                DailyPlan.day_date == daily_plan.day_date,
            ).first()
            if not kid_daily:
                continue

            kid_meal = db.query(Meal).filter(
                Meal.daily_plan_id == kid_daily.id,
                Meal.meal_type == meal.meal_type,
            ).first()
            if kid_meal:
                db.delete(kid_meal)
                _recalculate_daily_totals(db, kid_daily)

        db.commit()

        # Build response
        shares_info = _get_shares_for_meal(db, meal_id)
        meal_response = MealResponse.from_orm_with_ingredients(meal, kid_shares=shares_info)

        return ShareWithKidsResponse(
            message="Meal sharing updated",
            shares=shares_info,
            updated_meal=meal_response,
        )

    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to share meal: {str(e)}")
