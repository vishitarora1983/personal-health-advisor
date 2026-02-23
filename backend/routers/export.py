"""
Export router for generating downloadable files.

Handles Excel export of meal plans, grocery lists, and tracking data.
"""

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from database import get_db
from models.user import User
from models.profile import UserProfile
from models.meal_plan import WeeklyPlan
from services.export_service import generate_excel
from auth import get_current_user


router = APIRouter(prefix="/export", tags=["Export"])


def _verify_plan_ownership(db: Session, plan_id: int, user: User) -> WeeklyPlan:
    plan = db.query(WeeklyPlan).filter(WeeklyPlan.id == plan_id).first()
    if not plan:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Weekly plan with id {plan_id} not found")
    profile = db.query(UserProfile).filter(UserProfile.id == plan.profile_id).first()
    if not profile or profile.user_id != user.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Weekly plan with id {plan_id} not found")
    return plan


@router.get("/{plan_id}/excel", status_code=status.HTTP_200_OK)
def export_meal_plan_excel(
    plan_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Export weekly meal plan to Excel file.

    Generates a comprehensive Excel workbook with three sheets:
    1. Weekly Meal Plan - All meals with nutrition and prep times
    2. Grocery List - Categorized shopping list with quantities
    3. Tracking Summary - Meal tracking status and nutrition comparison

    Args:
        plan_id: Weekly plan ID to export
        db: Database session dependency

    Returns:
        StreamingResponse: Excel file download

    Raises:
        HTTPException 404: If weekly plan not found
    """
    _verify_plan_ownership(db, plan_id, current_user)

    try:
        excel_buffer = generate_excel(db, plan_id)

        # Create filename with plan ID
        filename = f"meal_plan_{plan_id}.xlsx"

        # Return as streaming response for file download
        return StreamingResponse(
            excel_buffer,
            media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            headers={
                "Content-Disposition": f"attachment; filename={filename}"
            }
        )

    except ValueError as e:
        # Service raises ValueError for not found
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e)
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to generate Excel export: {str(e)}"
        )
