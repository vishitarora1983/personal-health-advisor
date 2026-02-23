"""
Settings router for user-level application configuration and admin operations.
"""

import logging

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

logger = logging.getLogger(__name__)

from database import get_db
from models.user import User
from models.profile import UserProfile
from models.meal_plan import WeeklyPlan, DailyPlan, Meal
from models.tracking import MealTracking
from models.grocery import GroceryItem
from auth import get_current_user
from schemas.settings import UserSettingsResponse, UserSettingsUpdate

router = APIRouter(prefix="/settings", tags=["Settings"])


@router.get("", response_model=UserSettingsResponse, status_code=200)
def get_settings(current_user: User = Depends(get_current_user)):
    """
    Return the current user's application settings.

    Does not require a db Session because all settings are already loaded
    on the current_user object by get_current_user.
    """
    return UserSettingsResponse(
        family_meal_workflow=current_user.family_meal_workflow,
    )


@router.put("", response_model=UserSettingsResponse, status_code=200)
def update_settings(
    settings: UserSettingsUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Update the current user's application settings.

    Uses model_dump(exclude_unset=True) so only fields explicitly provided in
    the request body are written to the database. This allows partial updates:
    a caller can send {"family_meal_workflow": "llm_only"} without touching
    any other settings that may be added in future.
    """
    update_data = settings.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(current_user, field, value)
    db.commit()
    db.refresh(current_user)
    return UserSettingsResponse(
        family_meal_workflow=current_user.family_meal_workflow,
    )


@router.delete("/reset-all", status_code=status.HTTP_200_OK)
def reset_all_data(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """
    Delete all data belonging to the current user.

    Deletes: tracking, grocery items, meals, daily plans, weekly plans, user profiles.
    User account and settings are preserved.
    """
    try:
        # Get all profile IDs owned by this user
        profile_ids = [p.id for p in db.query(UserProfile.id).filter(UserProfile.user_id == current_user.id).all()]

        if profile_ids:
            # Get all weekly plan IDs for these profiles
            plan_ids = [p.id for p in db.query(WeeklyPlan.id).filter(WeeklyPlan.profile_id.in_(profile_ids)).all()]

            if plan_ids:
                # Get all daily plan IDs
                daily_ids = [d.id for d in db.query(DailyPlan.id).filter(DailyPlan.weekly_plan_id.in_(plan_ids)).all()]

                if daily_ids:
                    # Get all meal IDs
                    meal_ids = [m.id for m in db.query(Meal.id).filter(Meal.daily_plan_id.in_(daily_ids)).all()]

                    if meal_ids:
                        db.query(MealTracking).filter(MealTracking.meal_id.in_(meal_ids)).delete(synchronize_session=False)

                    db.query(Meal).filter(Meal.daily_plan_id.in_(daily_ids)).delete(synchronize_session=False)

                db.query(GroceryItem).filter(GroceryItem.weekly_plan_id.in_(plan_ids)).delete(synchronize_session=False)
                db.query(DailyPlan).filter(DailyPlan.weekly_plan_id.in_(plan_ids)).delete(synchronize_session=False)

            db.query(WeeklyPlan).filter(WeeklyPlan.profile_id.in_(profile_ids)).delete(synchronize_session=False)

        db.query(UserProfile).filter(UserProfile.user_id == current_user.id).delete(synchronize_session=False)
        db.commit()
        return {"message": "All your data has been cleared successfully"}
    except Exception as e:
        db.rollback()
        logger.exception("Failed to reset data for user %s", current_user.id)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to reset data. Please try again."
        )
