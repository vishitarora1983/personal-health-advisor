"""
Meal plan router for AI-powered weekly meal planning.

Handles meal plan generation, retrieval, regeneration, and individual meal swaps.
"""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from datetime import date, timedelta
import json

from database import get_db
from models.profile import UserProfile
from models.meal_plan import WeeklyPlan, DailyPlan, Meal
from schemas.meal_plan import (
    WeeklyPlanResponse,
    DailyPlanSchema,
    MealResponse,
    GenerateMealPlanRequest,
    SwapMealRequest,
    SwapMealResponse
)
from services.nutrition_calculator import calculate_targets
from services.ai_meal_planner import AIMealPlanner


router = APIRouter(prefix="/meal-plans", tags=["Meal Plans"])


@router.post("/generate", response_model=WeeklyPlanResponse, status_code=status.HTTP_201_CREATED)
async def generate_meal_plan(
    profile_id: int,
    request: GenerateMealPlanRequest = None,
    db: Session = Depends(get_db)
):
    """
    Generate a new 7-day meal plan using AI for a specific profile.

    Args:
        profile_id: Profile ID (query param)
        request: Optional request body with preference overrides
        db: Database session dependency

    Returns:
        WeeklyPlanResponse: Generated weekly plan with all 7 days and meals
    """
    # Get user profile by ID
    profile = db.query(UserProfile).filter(UserProfile.id == profile_id).first()

    if not profile:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Profile with id {profile_id} not found."
        )

    # Calculate nutrition targets
    nutrition_targets = calculate_targets(profile)

    # Initialize AI meal planner
    ai_planner = AIMealPlanner()

    try:
        # Generate meal plan using AI
        meal_plan_data = await ai_planner.generate_meal_plan(profile, nutrition_targets)

        # Archive any existing active plans
        db.query(WeeklyPlan).filter(
            WeeklyPlan.profile_id == profile.id,
            WeeklyPlan.status == "active"
        ).update({"status": "archived"})

        # Week starts tomorrow
        today = date.today()
        week_start = today + timedelta(days=1)

        # Create weekly plan record
        weekly_plan = WeeklyPlan(
            profile_id=profile.id,
            week_start_date=week_start,
            status="active"
        )
        db.add(weekly_plan)
        db.flush()  # Get the weekly_plan.id

        # Process each day from AI response
        daily_plans = []
        for day_data in meal_plan_data["weekly_plan"]:
            day_of_week = day_data["day_of_week"]
            day_date = week_start + timedelta(days=day_of_week)

            # Calculate totals from meals (AI response doesn't include daily totals)
            meals_in_day = day_data["meals"]

            # Create daily plan record
            daily_plan = DailyPlan(
                weekly_plan_id=weekly_plan.id,
                day_of_week=day_of_week,
                day_date=day_date,
                total_calories=sum(m.get("calories", 0) for m in meals_in_day),
                total_protein=sum(m.get("protein", 0) for m in meals_in_day),
                total_carbs=sum(m.get("carbs", 0) for m in meals_in_day),
                total_fats=sum(m.get("fats", 0) for m in meals_in_day)
            )
            db.add(daily_plan)
            db.flush()  # Get the daily_plan.id

            # Create meal records (no ingredients/recipe_brief — generated on demand)
            for meal_data in day_data["meals"]:
                meal = Meal(
                    daily_plan_id=daily_plan.id,
                    meal_type=meal_data["meal_type"],
                    dish_name=meal_data["dish_name"],
                    description=meal_data.get("description"),
                    cuisine=meal_data.get("cuisine"),
                    portion_size=meal_data.get("portion_size"),
                    calories=meal_data["calories"],
                    protein=meal_data["protein"],
                    carbs=meal_data["carbs"],
                    fats=meal_data["fats"],
                    fiber=meal_data.get("fiber"),
                    sodium=meal_data.get("sodium"),
                    sugar=meal_data.get("sugar"),
                    prep_time=meal_data.get("prep_time"),
                    ingredients=None,
                    recipe_brief=None
                )
                db.add(meal)

            daily_plans.append(daily_plan)

        db.commit()
        db.refresh(weekly_plan)

        # Build response with daily plans and meals
        return _build_weekly_plan_response(db, weekly_plan)

    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to generate meal plan: {str(e)}"
        )


@router.get("/current", response_model=WeeklyPlanResponse, status_code=status.HTTP_200_OK)
def get_current_meal_plan(profile_id: int, db: Session = Depends(get_db)):
    """
    Get the current active weekly meal plan for a specific profile.

    Args:
        profile_id: Profile ID (query param)
        db: Database session dependency
    """
    # Get active weekly plan for this profile
    weekly_plan = db.query(WeeklyPlan).filter(
        WeeklyPlan.profile_id == profile_id,
        WeeklyPlan.status == "active"
    ).first()

    if not weekly_plan:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No active meal plan found. Please generate a meal plan first."
        )

    return _build_weekly_plan_response(db, weekly_plan)


@router.post("/{plan_id}/regenerate-day/{day_index}", response_model=DailyPlanSchema, status_code=status.HTTP_200_OK)
async def regenerate_day(
    plan_id: int,
    day_index: int,
    db: Session = Depends(get_db)
):
    """
    Regenerate meals for a single day in the weekly plan.

    Args:
        plan_id: Weekly plan ID
        day_index: Day of week to regenerate (0=Monday, 6=Sunday)
        db: Database session dependency

    Returns:
        DailyPlanSchema: Regenerated daily plan

    Raises:
        HTTPException 404: If plan or day not found
        HTTPException 400: If day_index is invalid
        HTTPException 500: If AI generation fails
    """
    if day_index < 0 or day_index > 6:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="day_index must be between 0 (Monday) and 6 (Sunday)"
        )

    # Get weekly plan
    weekly_plan = db.query(WeeklyPlan).filter(WeeklyPlan.id == plan_id).first()

    if not weekly_plan:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Weekly plan with id {plan_id} not found"
        )

    # Get daily plan for this day
    daily_plan = db.query(DailyPlan).filter(
        DailyPlan.weekly_plan_id == plan_id,
        DailyPlan.day_of_week == day_index
    ).first()

    if not daily_plan:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Day {day_index} not found in plan {plan_id}"
        )

    # Get profile and calculate targets
    profile = db.query(UserProfile).filter(UserProfile.id == weekly_plan.profile_id).first()
    nutrition_targets = calculate_targets(profile)

    # Initialize AI planner
    ai_planner = AIMealPlanner()

    try:
        # Collect existing dish names from other days to avoid duplicates
        all_meals = db.query(Meal).join(DailyPlan).filter(
            DailyPlan.weekly_plan_id == plan_id,
            DailyPlan.day_of_week != day_index
        ).all()
        existing_dishes = [m.dish_name for m in all_meals]

        # Generate meals for just this one day (fast — single day, not full week)
        meals_in_day = await ai_planner.generate_single_day(
            profile, nutrition_targets, existing_dishes=existing_dishes
        )

        # Delete existing meals for this day
        db.query(Meal).filter(Meal.daily_plan_id == daily_plan.id).delete()

        # Update daily plan totals
        daily_plan.total_calories = sum(m.get("calories", 0) for m in meals_in_day)
        daily_plan.total_protein = sum(m.get("protein", 0) for m in meals_in_day)
        daily_plan.total_carbs = sum(m.get("carbs", 0) for m in meals_in_day)
        daily_plan.total_fats = sum(m.get("fats", 0) for m in meals_in_day)

        # Create new meals for this day (no ingredients/recipe_brief — generated on demand)
        for meal_data in meals_in_day:
            meal = Meal(
                daily_plan_id=daily_plan.id,
                meal_type=meal_data["meal_type"],
                dish_name=meal_data["dish_name"],
                description=meal_data.get("description"),
                cuisine=meal_data.get("cuisine"),
                portion_size=meal_data.get("portion_size"),
                calories=meal_data["calories"],
                protein=meal_data["protein"],
                carbs=meal_data["carbs"],
                fats=meal_data["fats"],
                fiber=meal_data.get("fiber"),
                sodium=meal_data.get("sodium"),
                sugar=meal_data.get("sugar"),
                prep_time=meal_data.get("prep_time"),
                ingredients=None,
                recipe_brief=None
            )
            db.add(meal)

        db.commit()
        db.refresh(daily_plan)

        # Build and return just the regenerated day
        meals = db.query(Meal).filter(Meal.daily_plan_id == daily_plan.id).all()
        meals_data = [MealResponse.from_orm_with_ingredients(meal) for meal in meals]

        return DailyPlanSchema(
            id=daily_plan.id,
            day_of_week=daily_plan.day_of_week,
            day_date=daily_plan.day_date,
            meals=meals_data,
            total_calories=daily_plan.total_calories,
            total_protein=daily_plan.total_protein,
            total_carbs=daily_plan.total_carbs,
            total_fats=daily_plan.total_fats,
            total_fiber=daily_plan.total_fiber or 0,
            total_sodium=daily_plan.total_sodium or 0,
            total_sugar=daily_plan.total_sugar or 0
        )

    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to regenerate day: {str(e)}"
        )


@router.post("/{plan_id}/regenerate", response_model=WeeklyPlanResponse, status_code=status.HTTP_200_OK)
async def regenerate_meal_plan(
    plan_id: int,
    db: Session = Depends(get_db)
):
    """
    Regenerate the entire weekly meal plan.

    Archives the old plan and creates a completely new 7-day meal plan.

    Args:
        plan_id: Weekly plan ID to regenerate
        db: Database session dependency

    Returns:
        WeeklyPlanResponse: New weekly plan

    Raises:
        HTTPException 404: If plan not found
        HTTPException 500: If AI generation fails
    """
    # Get existing weekly plan
    old_plan = db.query(WeeklyPlan).filter(WeeklyPlan.id == plan_id).first()

    if not old_plan:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Weekly plan with id {plan_id} not found"
        )

    # Get profile
    profile = db.query(UserProfile).filter(UserProfile.id == old_plan.profile_id).first()

    # Archive old plan
    old_plan.status = "archived"

    # Calculate nutrition targets
    nutrition_targets = calculate_targets(profile)

    # Initialize AI meal planner
    ai_planner = AIMealPlanner()

    try:
        # Generate new meal plan
        meal_plan_data = await ai_planner.generate_meal_plan(profile, nutrition_targets)

        # Week starts tomorrow
        week_start = date.today() + timedelta(days=1)

        # Create new weekly plan record
        weekly_plan = WeeklyPlan(
            profile_id=profile.id,
            week_start_date=week_start,
            status="active"
        )
        db.add(weekly_plan)
        db.flush()

        # Process each day from AI response
        for day_data in meal_plan_data["weekly_plan"]:
            day_of_week = day_data["day_of_week"]
            day_date = week_start + timedelta(days=day_of_week)

            # Calculate totals from meals (AI response doesn't include daily totals)
            meals_in_day = day_data["meals"]

            # Create daily plan record
            daily_plan = DailyPlan(
                weekly_plan_id=weekly_plan.id,
                day_of_week=day_of_week,
                day_date=day_date,
                total_calories=sum(m.get("calories", 0) for m in meals_in_day),
                total_protein=sum(m.get("protein", 0) for m in meals_in_day),
                total_carbs=sum(m.get("carbs", 0) for m in meals_in_day),
                total_fats=sum(m.get("fats", 0) for m in meals_in_day)
            )
            db.add(daily_plan)
            db.flush()

            # Create meal records (no ingredients/recipe_brief — generated on demand)
            for meal_data in day_data["meals"]:
                meal = Meal(
                    daily_plan_id=daily_plan.id,
                    meal_type=meal_data["meal_type"],
                    dish_name=meal_data["dish_name"],
                    description=meal_data.get("description"),
                    cuisine=meal_data.get("cuisine"),
                    portion_size=meal_data.get("portion_size"),
                    calories=meal_data["calories"],
                    protein=meal_data["protein"],
                    carbs=meal_data["carbs"],
                    fats=meal_data["fats"],
                    fiber=meal_data.get("fiber"),
                    sodium=meal_data.get("sodium"),
                    sugar=meal_data.get("sugar"),
                    prep_time=meal_data.get("prep_time"),
                    ingredients=None,
                    recipe_brief=None
                )
                db.add(meal)

        db.commit()
        db.refresh(weekly_plan)

        return _build_weekly_plan_response(db, weekly_plan)

    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to regenerate meal plan: {str(e)}"
        )


def _build_weekly_plan_response(db: Session, weekly_plan: WeeklyPlan) -> WeeklyPlanResponse:
    """
    Build WeeklyPlanResponse from WeeklyPlan ORM object.

    Helper function to construct the response with nested daily plans and meals.

    Args:
        db: Database session
        weekly_plan: WeeklyPlan ORM object

    Returns:
        WeeklyPlanResponse: Complete weekly plan with all nested data
    """
    # Get all daily plans for this week
    daily_plans = db.query(DailyPlan).filter(
        DailyPlan.weekly_plan_id == weekly_plan.id
    ).order_by(DailyPlan.day_of_week).all()

    daily_plans_data = []

    for daily_plan in daily_plans:
        # Get all meals for this day
        meals = db.query(Meal).filter(
            Meal.daily_plan_id == daily_plan.id
        ).all()

        # Convert meals to schema format
        meals_data = [MealResponse.from_orm_with_ingredients(meal) for meal in meals]

        daily_plan_schema = DailyPlanSchema(
            id=daily_plan.id,
            day_of_week=daily_plan.day_of_week,
            day_date=daily_plan.day_date,
            meals=meals_data,
            total_calories=daily_plan.total_calories,
            total_protein=daily_plan.total_protein,
            total_carbs=daily_plan.total_carbs,
            total_fats=daily_plan.total_fats,
            total_fiber=daily_plan.total_fiber or 0,
            total_sodium=daily_plan.total_sodium or 0,
            total_sugar=daily_plan.total_sugar or 0
        )

        daily_plans_data.append(daily_plan_schema)

    return WeeklyPlanResponse(
        id=weekly_plan.id,
        profile_id=weekly_plan.profile_id,
        week_start_date=weekly_plan.week_start_date,
        status=weekly_plan.status,
        days=daily_plans_data,
        created_at=weekly_plan.created_at
    )
