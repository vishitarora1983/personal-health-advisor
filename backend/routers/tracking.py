"""
Tracking router for meal consumption tracking.

Handles recording whether meals were eaten as planned, skipped, or substituted.
"""

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from typing import Optional
from datetime import date as date_type

from database import get_db
from models.user import User
from models.profile import UserProfile
from models.meal_plan import Meal, DailyPlan, WeeklyPlan
from models.tracking import MealTracking
from schemas.tracking import (
    TrackMealRequest,
    TrackMealResponse,
    DailyTrackingResponse,
    WeeklyTrackingResponse,
    EstimateNutritionRequest,
    EstimateNutritionResponse
)
from services.tracking_service import track_meal, get_daily_tracking, get_weekly_tracking
from services.ai_meal_planner import AIMealPlanner
from auth import get_current_user


def _verify_meal_ownership(db: Session, meal_id: int, user: User) -> Meal:
    meal = db.query(Meal).filter(Meal.id == meal_id).first()
    if not meal:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Meal with id {meal_id} not found")
    daily_plan = db.query(DailyPlan).filter(DailyPlan.id == meal.daily_plan_id).first()
    weekly_plan = db.query(WeeklyPlan).filter(WeeklyPlan.id == daily_plan.weekly_plan_id).first()
    profile = db.query(UserProfile).filter(UserProfile.id == weekly_plan.profile_id).first()
    if not profile or profile.user_id != user.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Meal with id {meal_id} not found")
    return meal


def _verify_plan_ownership(db: Session, plan_id: int, user: User) -> WeeklyPlan:
    plan = db.query(WeeklyPlan).filter(WeeklyPlan.id == plan_id).first()
    if not plan:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Weekly plan with id {plan_id} not found")
    profile = db.query(UserProfile).filter(UserProfile.id == plan.profile_id).first()
    if not profile or profile.user_id != user.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Weekly plan with id {plan_id} not found")
    return plan


router = APIRouter(prefix="/tracking", tags=["Tracking"])


@router.post("/estimate-nutrition", response_model=EstimateNutritionResponse, status_code=status.HTTP_200_OK)
async def estimate_nutrition(request: EstimateNutritionRequest, current_user: User = Depends(get_current_user)):
    """
    Estimate calories and macros from a free-text food description using AI.
    """
    ai_planner = AIMealPlanner()

    try:
        result = await ai_planner.estimate_nutrition(request.description)
        return EstimateNutritionResponse(**result)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to estimate nutrition: {str(e)}"
        )


@router.post("/{meal_id}", response_model=TrackMealResponse, status_code=status.HTTP_201_CREATED)
def track_meal_endpoint(
    meal_id: int,
    tracking_data: TrackMealRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Log tracking status for a meal."""
    meal = _verify_meal_ownership(db, meal_id, current_user)

    # Check if already tracked
    existing_tracking = db.query(MealTracking).filter(MealTracking.meal_id == meal_id).first()
    if existing_tracking:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Meal {meal_id} already tracked. Use PUT to update."
        )

    try:
        # Create tracking record using service
        tracking_dict = tracking_data.model_dump()
        tracking_record = track_meal(db, meal_id, tracking_dict)

        # Build response with meal info
        return TrackMealResponse(
            meal_id=tracking_record.meal_id,
            status=tracking_record.status,
            alt_description=tracking_record.alt_description,
            alt_calories=tracking_record.alt_calories,
            alt_protein=tracking_record.alt_protein,
            alt_carbs=tracking_record.alt_carbs,
            alt_fats=tracking_record.alt_fats,
            tracked_at=tracking_record.tracked_at,
            dish_name=meal.dish_name,
            planned_calories=meal.calories,
            planned_protein=meal.protein,
            planned_carbs=meal.carbs,
            planned_fats=meal.fats
        )

    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to track meal: {str(e)}"
        )


@router.put("/{meal_id}", response_model=TrackMealResponse, status_code=status.HTTP_200_OK)
def update_meal_tracking(
    meal_id: int,
    tracking_data: TrackMealRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Update existing meal tracking record."""
    meal = _verify_meal_ownership(db, meal_id, current_user)

    try:
        # Call track_meal service directly (handles upsert internally)
        tracking_dict = tracking_data.model_dump()
        tracking_record = track_meal(db, meal_id, tracking_dict)

        # Build response with meal info
        return TrackMealResponse(
            meal_id=tracking_record.meal_id,
            status=tracking_record.status,
            alt_description=tracking_record.alt_description,
            alt_calories=tracking_record.alt_calories,
            alt_protein=tracking_record.alt_protein,
            alt_carbs=tracking_record.alt_carbs,
            alt_fats=tracking_record.alt_fats,
            tracked_at=tracking_record.tracked_at,
            dish_name=meal.dish_name,
            planned_calories=meal.calories,
            planned_protein=meal.protein,
            planned_carbs=meal.carbs,
            planned_fats=meal.fats
        )

    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to update meal tracking: {str(e)}"
        )


@router.get("/daily/{date_str}", response_model=DailyTrackingResponse, status_code=status.HTTP_200_OK)
def get_daily_tracking_endpoint(
    date_str: str,
    profile_id: Optional[int] = Query(default=None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Get tracking data for all meals on a specific date.

    Returns all meals planned for the date with their tracking status,
    plus aggregated nutrition totals (planned vs actual) and adherence percentage.

    Args:
        date_str: Date in YYYY-MM-DD format
        db: Database session dependency

    Returns:
        DailyTrackingResponse: All meals with tracking status and daily totals

    Raises:
        HTTPException 400: If date format is invalid
    """
    try:
        # Parse date
        target_date = date_type.fromisoformat(date_str)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid date format. Use YYYY-MM-DD."
        )

    # Verify profile ownership if provided
    if profile_id:
        from auth import get_user_profile_or_404
        get_user_profile_or_404(db, profile_id, current_user)

    try:
        daily_data = get_daily_tracking(db, target_date, profile_id=profile_id)
        return DailyTrackingResponse(**daily_data)

    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get daily tracking: {str(e)}"
        )


@router.get("/weekly/{plan_id}", response_model=WeeklyTrackingResponse, status_code=status.HTTP_200_OK)
def get_weekly_tracking_endpoint(
    plan_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Get tracking data for an entire weekly meal plan.

    Returns tracking for all 7 days with daily and weekly aggregates,
    including adherence metrics and nutrition totals.

    Args:
        plan_id: Weekly plan ID
        db: Database session dependency

    Returns:
        WeeklyTrackingResponse: Complete weekly tracking with all metrics

    Raises:
        HTTPException 404: If weekly plan not found
    """
    _verify_plan_ownership(db, plan_id, current_user)

    try:
        weekly_data = get_weekly_tracking(db, plan_id)
        return WeeklyTrackingResponse(**weekly_data)

    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get weekly tracking: {str(e)}"
        )
