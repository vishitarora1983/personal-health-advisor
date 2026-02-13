"""
Meal tracking schemas for recording actual eating behavior.

These schemas handle the three tracking states: ate as planned, skipped,
or ate something else (with alternative meal details).
"""

from typing import Optional, List
from pydantic import BaseModel, Field, model_validator
from datetime import datetime, date


class EstimateNutritionRequest(BaseModel):
    """Request to estimate nutrition from a food description."""
    description: str = Field(min_length=2, max_length=500, description="Free-text food description")


class EstimateNutritionResponse(BaseModel):
    """AI-estimated nutrition values."""
    calories: float
    protein: float
    carbs: float
    fats: float


class TrackMealRequest(BaseModel):
    """
    Request to track a meal's consumption status.

    When status is 'ate_something_else', alternative meal details are required.
    """
    status: str = Field(
        pattern="^(ate_as_planned|skipped|ate_something_else)$",
        description="Tracking status"
    )
    alt_description: Optional[str] = Field(
        default=None,
        max_length=500,
        description="Description of alternative meal (required if status='ate_something_else')"
    )
    alt_calories: Optional[float] = Field(
        default=None,
        ge=0,
        le=10000,
        description="Alternative meal calories"
    )
    alt_protein: Optional[float] = Field(
        default=None,
        ge=0,
        le=1000,
        description="Alternative meal protein in grams"
    )
    alt_carbs: Optional[float] = Field(
        default=None,
        ge=0,
        le=1000,
        description="Alternative meal carbs in grams"
    )
    alt_fats: Optional[float] = Field(
        default=None,
        ge=0,
        le=1000,
        description="Alternative meal fats in grams"
    )

    @model_validator(mode='after')
    def validate_alternative_meal_data(self):
        """
        Ensure alternative meal data is provided when status is 'ate_something_else'.

        This prevents incomplete tracking data that would break nutrition calculations.
        """
        if self.status == "ate_something_else":
            if not self.alt_description or not self.alt_description.strip():
                raise ValueError(
                    "alt_description is required when status is 'ate_something_else'"
                )
            if self.alt_calories is None:
                raise ValueError(
                    "alt_calories is required when status is 'ate_something_else'"
                )
        return self


class TrackMealResponse(BaseModel):
    """
    Response after tracking a meal.

    Includes both tracking data and original meal information for comparison.
    """
    meal_id: int
    status: str
    alt_description: Optional[str] = None
    alt_calories: Optional[float] = None
    alt_protein: Optional[float] = None
    alt_carbs: Optional[float] = None
    alt_fats: Optional[float] = None
    tracked_at: datetime

    # Original planned meal info
    dish_name: str = Field(description="Original planned dish")
    planned_calories: float
    planned_protein: float
    planned_carbs: float
    planned_fats: float

    model_config = {"from_attributes": True}


class MealTrackingInfo(BaseModel):
    """
    Meal with tracking status for daily tracking view.

    Combines planned meal data with tracking information.
    """
    meal_id: int
    meal_type: str
    dish_name: str
    planned_calories: float
    planned_protein: float
    planned_carbs: float
    planned_fats: float

    # Tracking info (null if not yet tracked)
    status: Optional[str] = None
    alt_description: Optional[str] = None
    alt_calories: Optional[float] = None
    alt_protein: Optional[float] = None
    alt_carbs: Optional[float] = None
    alt_fats: Optional[float] = None
    tracked_at: Optional[datetime] = None


class NutritionTotals(BaseModel):
    """Aggregated nutrition totals."""
    calories: float = Field(default=0.0)
    protein: float = Field(default=0.0)
    carbs: float = Field(default=0.0)
    fats: float = Field(default=0.0)


class DailyTrackingResponse(BaseModel):
    """
    Complete tracking data for a single day.

    Shows all meals with their tracking status and planned vs actual nutrition.
    """
    date: str = Field(description="Date in YYYY-MM-DD format")
    meals: List[MealTrackingInfo] = Field(description="All meals for this day")
    planned_totals: NutritionTotals = Field(description="Sum of planned nutrition")
    actual_totals: NutritionTotals = Field(description="Sum of actual consumed nutrition")
    adherence_percentage: float = Field(
        ge=0.0,
        le=100.0,
        description="Percentage of meals tracked as 'ate_as_planned'"
    )


class WeeklyTrackingResponse(BaseModel):
    """
    Complete tracking data for an entire week.

    Aggregates daily tracking with weekly metrics for dashboard display.
    """
    plan_id: int
    week_start_date: date
    daily_tracking: List[DailyTrackingResponse] = Field(description="Tracking for all 7 days")

    # Weekly Aggregates
    weekly_planned_totals: NutritionTotals
    weekly_actual_totals: NutritionTotals
    weekly_adherence_percentage: float = Field(
        ge=0.0,
        le=100.0,
        description="Average adherence across all tracked meals"
    )
    total_meals: int = Field(description="Total number of meals in the week")
    tracked_meals: int = Field(description="Number of meals that have been tracked")
