"""
Settings router for application-wide admin operations.
"""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import text

from database import get_db

router = APIRouter(prefix="/settings", tags=["Settings"])


@router.delete("/reset-all", status_code=status.HTTP_200_OK)
def reset_all_data(db: Session = Depends(get_db)):
    """
    Delete all data from every table in the database.

    Truncates: meal_tracking, grocery_items, meals, daily_plans, weekly_plans, user_profiles.
    Order matters due to foreign key constraints.
    """
    try:
        # Delete in dependency order (children first)
        tables = [
            "meal_tracking",
            "grocery_items",
            "meals",
            "daily_plans",
            "weekly_plans",
            "user_profiles",
        ]
        for table in tables:
            db.execute(text(f"DELETE FROM {table}"))
        db.commit()
        return {"message": "All data has been cleared successfully"}
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to reset data: {str(e)}"
        )
