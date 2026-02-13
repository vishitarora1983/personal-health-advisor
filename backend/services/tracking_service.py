"""
Meal tracking service for recording and analyzing actual food consumption.

Handles:
- Creating and updating meal tracking records
- Calculating actual vs planned nutrition
- Computing adherence percentages
- Aggregating daily and weekly tracking data
"""

from typing import List, Dict, Optional, Any
from datetime import date, datetime
from sqlalchemy.orm import Session
from sqlalchemy import func
from models.meal_plan import Meal, DailyPlan, WeeklyPlan
from models.tracking import MealTracking


# Whitelist of allowed fields for tracking updates (security measure)
ALLOWED_TRACKING_FIELDS = {
    "status",
    "alt_description",
    "alt_calories",
    "alt_protein",
    "alt_carbs",
    "alt_fats"
}


def track_meal(
    db: Session,
    meal_id: int,
    tracking_data: Dict[str, Any]
) -> MealTracking:
    """
    Create or update a meal tracking record.

    Args:
        db: Database session
        meal_id: ID of the meal being tracked
        tracking_data: Dict with status and optional alternative meal data

    Returns:
        MealTracking: Created or updated tracking record

    Raises:
        ValueError: If meal doesn't exist or tracking data is invalid
    """
    # Verify meal exists
    meal = db.query(Meal).filter(Meal.id == meal_id).first()
    if not meal:
        raise ValueError(f"Meal with id {meal_id} not found")

    # Check if tracking already exists
    existing_tracking = db.query(MealTracking).filter(
        MealTracking.meal_id == meal_id
    ).first()

    try:
        if existing_tracking:
            # Update existing tracking (only allowed fields for security)
            for key, value in tracking_data.items():
                if key in ALLOWED_TRACKING_FIELDS:
                    setattr(existing_tracking, key, value)
            db.commit()
            db.refresh(existing_tracking)
            return existing_tracking
        else:
            # Create new tracking
            new_tracking = MealTracking(
                meal_id=meal_id,
                **tracking_data
            )
            db.add(new_tracking)
            db.commit()
            db.refresh(new_tracking)
            return new_tracking
    except Exception as e:
        db.rollback()
        raise e


def calculate_actual_nutrition(tracking_records: List[MealTracking]) -> Dict[str, float]:
    """
    Calculate actual nutrition consumed based on tracking records.

    Logic:
    - ate_as_planned: Use planned meal nutrition
    - skipped: Zero nutrition
    - ate_something_else: Use alternative nutrition

    Args:
        tracking_records: List of MealTracking records with loaded meal relationships

    Returns:
        Dict with calories, protein, carbs, fats totals
    """
    totals = {
        "calories": 0.0,
        "protein": 0.0,
        "carbs": 0.0,
        "fats": 0.0
    }

    for tracking in tracking_records:
        if tracking.status == "ate_as_planned":
            # Use planned meal nutrition
            totals["calories"] += tracking.meal.calories or 0
            totals["protein"] += tracking.meal.protein or 0
            totals["carbs"] += tracking.meal.carbs or 0
            totals["fats"] += tracking.meal.fats or 0

        elif tracking.status == "skipped":
            # No nutrition consumed
            continue

        elif tracking.status == "ate_something_else":
            # Use alternative meal nutrition
            totals["calories"] += tracking.alt_calories or 0
            totals["protein"] += tracking.alt_protein or 0
            totals["carbs"] += tracking.alt_carbs or 0
            totals["fats"] += tracking.alt_fats or 0

    return totals


def get_daily_tracking(
    db: Session,
    target_date: date,
    profile_id: Optional[int] = None
) -> Dict[str, Any]:
    """
    Get tracking data for all meals on a specific date.

    Args:
        db: Database session
        target_date: Date to get tracking for
        profile_id: Optional profile ID filter

    Returns:
        Dict with meals, planned totals, actual totals, adherence percentage
    """
    # Find the daily plan for this date
    query = db.query(DailyPlan).filter(DailyPlan.day_date == target_date)

    if profile_id:
        query = query.join(WeeklyPlan).filter(WeeklyPlan.profile_id == profile_id)

    daily_plan = query.first()

    if not daily_plan:
        return {
            "date": target_date.isoformat(),
            "meals": [],
            "planned_totals": {"calories": 0, "protein": 0, "carbs": 0, "fats": 0},
            "actual_totals": {"calories": 0, "protein": 0, "carbs": 0, "fats": 0},
            "adherence_percentage": 0.0
        }

    # Get all meals for this day with their tracking
    meals = db.query(Meal).filter(Meal.daily_plan_id == daily_plan.id).all()

    # Build meal tracking info
    meal_tracking_info = []
    planned_totals = {"calories": 0.0, "protein": 0.0, "carbs": 0.0, "fats": 0.0}
    tracked_as_planned = 0
    total_tracked = 0

    for meal in meals:
        # Add to planned totals
        planned_totals["calories"] += meal.calories or 0
        planned_totals["protein"] += meal.protein or 0
        planned_totals["carbs"] += meal.carbs or 0
        planned_totals["fats"] += meal.fats or 0

        # Get tracking if exists
        tracking = db.query(MealTracking).filter(
            MealTracking.meal_id == meal.id
        ).first()

        meal_info = {
            "meal_id": meal.id,
            "meal_type": meal.meal_type,
            "dish_name": meal.dish_name,
            "planned_calories": meal.calories,
            "planned_protein": meal.protein,
            "planned_carbs": meal.carbs,
            "planned_fats": meal.fats,
            "status": None,
            "alt_description": None,
            "alt_calories": None,
            "alt_protein": None,
            "alt_carbs": None,
            "alt_fats": None,
            "tracked_at": None
        }

        if tracking:
            meal_info.update({
                "status": tracking.status,
                "alt_description": tracking.alt_description,
                "alt_calories": tracking.alt_calories,
                "alt_protein": tracking.alt_protein,
                "alt_carbs": tracking.alt_carbs,
                "alt_fats": tracking.alt_fats,
                "tracked_at": tracking.tracked_at
            })

            total_tracked += 1
            if tracking.status == "ate_as_planned":
                tracked_as_planned += 1

        meal_tracking_info.append(meal_info)

    # Calculate actual totals from tracking
    tracking_records = db.query(MealTracking).join(Meal).filter(
        Meal.daily_plan_id == daily_plan.id
    ).all()

    actual_totals = calculate_actual_nutrition(tracking_records)

    # Calculate adherence percentage
    adherence = (tracked_as_planned / total_tracked * 100) if total_tracked > 0 else 0.0

    return {
        "date": target_date.isoformat(),
        "meals": meal_tracking_info,
        "planned_totals": planned_totals,
        "actual_totals": actual_totals,
        "adherence_percentage": round(adherence, 1)
    }


def get_weekly_tracking(
    db: Session,
    plan_id: int
) -> Dict[str, Any]:
    """
    Get tracking data for all days in a weekly plan.

    Args:
        db: Database session
        plan_id: Weekly plan ID

    Returns:
        Dict with daily tracking, weekly aggregates, and adherence metrics
    """
    # Get the weekly plan
    weekly_plan = db.query(WeeklyPlan).filter(WeeklyPlan.id == plan_id).first()

    if not weekly_plan:
        raise ValueError(f"Weekly plan with id {plan_id} not found")

    # Get all daily plans for this week
    daily_plans = db.query(DailyPlan).filter(
        DailyPlan.weekly_plan_id == plan_id
    ).order_by(DailyPlan.day_of_week).all()

    # Build daily tracking data
    daily_tracking = []
    weekly_planned_totals = {"calories": 0.0, "protein": 0.0, "carbs": 0.0, "fats": 0.0}
    weekly_actual_totals = {"calories": 0.0, "protein": 0.0, "carbs": 0.0, "fats": 0.0}
    total_meals = 0
    total_tracked = 0
    tracked_as_planned = 0

    for daily_plan in daily_plans:
        day_data = get_daily_tracking(db, daily_plan.day_date)
        daily_tracking.append(day_data)

        # Aggregate weekly totals
        weekly_planned_totals["calories"] += day_data["planned_totals"]["calories"]
        weekly_planned_totals["protein"] += day_data["planned_totals"]["protein"]
        weekly_planned_totals["carbs"] += day_data["planned_totals"]["carbs"]
        weekly_planned_totals["fats"] += day_data["planned_totals"]["fats"]

        weekly_actual_totals["calories"] += day_data["actual_totals"]["calories"]
        weekly_actual_totals["protein"] += day_data["actual_totals"]["protein"]
        weekly_actual_totals["carbs"] += day_data["actual_totals"]["carbs"]
        weekly_actual_totals["fats"] += day_data["actual_totals"]["fats"]

        # Count meals and tracking
        total_meals += len(day_data["meals"])
        for meal in day_data["meals"]:
            if meal["status"]:
                total_tracked += 1
                if meal["status"] == "ate_as_planned":
                    tracked_as_planned += 1

    # Calculate weekly adherence
    weekly_adherence = (tracked_as_planned / total_tracked * 100) if total_tracked > 0 else 0.0

    return {
        "plan_id": plan_id,
        "week_start_date": weekly_plan.week_start_date,
        "daily_tracking": daily_tracking,
        "weekly_planned_totals": weekly_planned_totals,
        "weekly_actual_totals": weekly_actual_totals,
        "weekly_adherence_percentage": round(weekly_adherence, 1),
        "total_meals": total_meals,
        "tracked_meals": total_tracked
    }
