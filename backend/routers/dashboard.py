"""
Dashboard router for analytics and progress visualization.

Provides comprehensive dashboard data including nutrition trends,
adherence metrics, and weekly progress analysis.
"""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from database import get_db
from models.user import User
from models.profile import UserProfile
from models.meal_plan import WeeklyPlan
from schemas.dashboard import DashboardResponse
from services.dashboard_service import get_dashboard_data
from auth import get_current_user


router = APIRouter(prefix="/dashboard", tags=["Dashboard"])


def _verify_plan_ownership(db: Session, plan_id: int, user: User) -> WeeklyPlan:
    plan = db.query(WeeklyPlan).filter(WeeklyPlan.id == plan_id).first()
    if not plan:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Weekly plan with id {plan_id} not found")
    profile = db.query(UserProfile).filter(UserProfile.id == plan.profile_id).first()
    if not profile or profile.user_id != user.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Weekly plan with id {plan_id} not found")
    return plan


@router.get("/{plan_id}", response_model=DashboardResponse, status_code=status.HTTP_200_OK)
def get_dashboard(
    plan_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Get comprehensive dashboard analytics for a weekly meal plan.

    Aggregates all tracking data into meaningful analytics including:
    - Daily nutrition statistics (planned vs actual for all 7 days)
    - Weekly adherence breakdown (ate as planned, skipped, substituted)
    - Macro distribution analysis (planned vs actual percentages)
    - Consistency scoring (days within 10% of planned calories)
    - Calorie trend analysis (daily surplus/deficit)

    Args:
        plan_id: Weekly plan ID
        db: Database session dependency

    Returns:
        DashboardResponse: Complete dashboard data with all metrics

    Raises:
        HTTPException 404: If weekly plan not found
    """
    _verify_plan_ownership(db, plan_id, current_user)

    try:
        dashboard_data = get_dashboard_data(db, plan_id)

        return DashboardResponse(**dashboard_data)

    except ValueError as e:
        # Service raises ValueError for not found
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e)
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get dashboard data: {str(e)}"
        )
