# 05 — Meal Tracking (Phase 4)

## Overview

Phase 4 introduces meal tracking functionality, enabling users to log their actual food consumption against their planned meals. Users can mark meals as "Ate as Planned", "Skipped", or "Ate Something Else" (with custom meal details). This data powers real-time nutrition tracking and adherence analytics displayed on the dashboard.

**Key Features:**
- Three tracking states per meal with flexible status updates
- Alternative meal input with detailed nutrition logging
- Daily and weekly tracking aggregations
- Real-time planned vs. actual nutrition comparison
- Adherence percentage calculation across meals and time periods
- Date-based navigation within active meal plans

---

## Backend Implementation

### 1. Database Schema

The `meal_tracking` table stores tracking records linked to individual meals:

```sql
CREATE TABLE meal_tracking (
    id SERIAL PRIMARY KEY,
    meal_id INTEGER NOT NULL REFERENCES meals(id) ON DELETE CASCADE,
    status VARCHAR(50) NOT NULL CHECK (status IN ('ate_as_planned', 'skipped', 'ate_something_else')),
    alt_description TEXT,
    alt_calories FLOAT,
    alt_protein FLOAT,
    alt_carbs FLOAT,
    alt_fats FLOAT,
    tracked_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(meal_id)  -- One tracking record per meal
);

CREATE INDEX idx_meal_tracking_meal_id ON meal_tracking(meal_id);
CREATE INDEX idx_meal_tracking_status ON meal_tracking(status);
```

**Design Decisions:**
- `UNIQUE(meal_id)` enforces one tracking record per meal to prevent duplicates
- `ON DELETE CASCADE` ensures tracking records are removed if meals are deleted
- Alternative nutrition fields are nullable (NULL when status != 'ate_something_else')
- `tracked_at` captures initial tracking time; `updated_at` tracks modifications

---

### 2. Pydantic Schemas

**File:** `backend/schemas/tracking.py`

```python
"""
Pydantic schemas for meal tracking functionality.

These schemas handle validation for tracking meals against planned meals,
including alternative meal logging with custom nutrition data.
"""

from typing import Optional, Literal
from datetime import datetime, date
from pydantic import BaseModel, Field, field_validator, model_validator


# ============================================================================
# Request Schemas
# ============================================================================

class MealTrackingCreate(BaseModel):
    """
    Schema for creating a new meal tracking record.

    The meal_id comes from the path parameter, not the request body.
    When status is 'ate_something_else', alternative meal details are required.
    """
    status: Literal["ate_as_planned", "skipped", "ate_something_else"] = Field(
        ...,
        description="Tracking status for the meal"
    )
    alt_description: Optional[str] = Field(
        None,
        min_length=1,
        max_length=500,
        description="Description of alternative meal (required if status='ate_something_else')"
    )
    alt_calories: Optional[float] = Field(
        None,
        ge=0,
        le=10000,
        description="Alternative meal calories (required if status='ate_something_else')"
    )
    alt_protein: Optional[float] = Field(
        None,
        ge=0,
        le=1000,
        description="Alternative meal protein in grams"
    )
    alt_carbs: Optional[float] = Field(
        None,
        ge=0,
        le=1000,
        description="Alternative meal carbohydrates in grams"
    )
    alt_fats: Optional[float] = Field(
        None,
        ge=0,
        le=1000,
        description="Alternative meal fats in grams"
    )

    @model_validator(mode='after')
    def validate_alternative_meal_data(self):
        """
        Ensure alternative meal description and calories are provided when
        status is 'ate_something_else'.

        Security: Prevents incomplete alternative meal data that would break
        nutrition calculations.
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


class MealTrackingUpdate(BaseModel):
    """
    Schema for updating an existing meal tracking record.

    All fields are optional to allow partial updates. The same validation
    rules apply as MealTrackingCreate when status is changed.
    """
    status: Optional[Literal["ate_as_planned", "skipped", "ate_something_else"]] = None
    alt_description: Optional[str] = Field(
        None,
        min_length=1,
        max_length=500
    )
    alt_calories: Optional[float] = Field(None, ge=0, le=10000)
    alt_protein: Optional[float] = Field(None, ge=0, le=1000)
    alt_carbs: Optional[float] = Field(None, ge=0, le=1000)
    alt_fats: Optional[float] = Field(None, ge=0, le=1000)

    @model_validator(mode='after')
    def validate_alternative_meal_data(self):
        """
        When updating to 'ate_something_else', ensure required fields are present.

        Note: This only validates if status is being changed to 'ate_something_else'
        in this update. The router must also check existing values when status
        isn't being changed but alt fields are being updated.
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


# ============================================================================
# Response Schemas
# ============================================================================

class MealTrackingResponse(BaseModel):
    """
    Complete meal tracking response including both tracking data and
    original planned meal information for comparison.
    """
    # Tracking record fields
    id: int
    meal_id: int
    status: str
    alt_description: Optional[str] = None
    alt_calories: Optional[float] = None
    alt_protein: Optional[float] = None
    alt_carbs: Optional[float] = None
    alt_fats: Optional[float] = None
    tracked_at: datetime

    # Original planned meal information (for UI display)
    meal_type: str
    dish_name: str
    planned_calories: float
    planned_protein: float
    planned_carbs: float
    planned_fats: float

    class Config:
        from_attributes = True


class NutritionTotals(BaseModel):
    """Aggregated nutrition totals."""
    calories: float = Field(0.0, description="Total calories")
    protein: float = Field(0.0, description="Total protein in grams")
    carbs: float = Field(0.0, description="Total carbohydrates in grams")
    fats: float = Field(0.0, description="Total fats in grams")


class MealWithTracking(BaseModel):
    """
    A single meal with its tracking information.

    Tracking fields are nullable to support meals that haven't been tracked yet.
    """
    # Meal information
    meal_id: int
    meal_type: str
    dish_name: str
    calories: float
    protein: float
    carbs: float
    fats: float

    # Tracking information (null if not yet tracked)
    tracking_id: Optional[int] = None
    status: Optional[str] = None
    alt_description: Optional[str] = None
    alt_calories: Optional[float] = None
    alt_protein: Optional[float] = None
    alt_carbs: Optional[float] = None
    alt_fats: Optional[float] = None
    tracked_at: Optional[datetime] = None


class DailyTrackingResponse(BaseModel):
    """
    Complete tracking data for a single day.

    Includes all meals, planned vs actual nutrition totals, and adherence metrics.
    """
    date: str = Field(..., description="Date in YYYY-MM-DD format")
    meals: list[MealWithTracking] = Field(
        default_factory=list,
        description="All meals for this day with their tracking status"
    )
    planned_totals: NutritionTotals = Field(
        default_factory=NutritionTotals,
        description="Sum of all planned meal nutrition"
    )
    actual_totals: NutritionTotals = Field(
        default_factory=NutritionTotals,
        description="Sum of actual consumed nutrition based on tracking"
    )
    adherence_percentage: float = Field(
        0.0,
        ge=0.0,
        le=100.0,
        description="Percentage of meals tracked as 'ate_as_planned'"
    )


class WeeklyTrackingResponse(BaseModel):
    """
    Complete tracking data for an entire week (meal plan).

    Aggregates daily data with weekly-level metrics for dashboard display.
    """
    plan_id: int
    days: list[DailyTrackingResponse] = Field(
        default_factory=list,
        description="Tracking data for all 7 days in the plan"
    )
    weekly_adherence: float = Field(
        0.0,
        ge=0.0,
        le=100.0,
        description="Average adherence across all tracked meals in the week"
    )
    weekly_planned_totals: NutritionTotals = Field(
        default_factory=NutritionTotals,
        description="Sum of planned nutrition for entire week"
    )
    weekly_actual_totals: NutritionTotals = Field(
        default_factory=NutritionTotals,
        description="Sum of actual consumed nutrition for entire week"
    )
```

**Key Design Decisions:**

1. **Validation Strategy**: `@model_validator` ensures data integrity when status is 'ate_something_else'. This prevents partial alternative meal data that would corrupt nutrition calculations.

2. **Security Considerations**:
   - Field length limits prevent excessive data storage
   - Numeric bounds (e.g., calories <= 10000) prevent unrealistic values
   - String trimming and min_length validation prevent empty string submissions

3. **Response Design**: `MealTrackingResponse` includes both tracking data AND original meal info to reduce frontend API calls and enable direct comparison.

4. **Nullable Tracking**: `MealWithTracking` uses optional fields to represent untracked meals, eliminating the need for separate meal-only schemas.

---

### 3. Tracking Service

**File:** `backend/services/tracking_service.py`

```python
"""
Business logic for meal tracking and nutrition aggregation.

This service handles:
- Calculating actual nutrition from tracked meals
- Computing adherence percentages
- Aggregating daily and weekly tracking data
- Handling the three tracking states: ate_as_planned, skipped, ate_something_else
"""

from typing import List, Optional
from datetime import date, timedelta
from sqlalchemy.orm import Session
from sqlalchemy import and_

from backend.models.meal_plan import MealPlan, DailyPlan, Meal
from backend.models.meal_tracking import MealTracking
from backend.schemas.tracking import (
    DailyTrackingResponse,
    WeeklyTrackingResponse,
    MealWithTracking,
    NutritionTotals
)


def calculate_actual_nutrition(meals_with_tracking: List[MealWithTracking]) -> NutritionTotals:
    """
    Calculate actual consumed nutrition based on tracking data.

    Logic per meal:
    - ate_as_planned: Use planned nutrition values
    - skipped: Contribute 0 to all nutrition totals
    - ate_something_else: Use alternative nutrition values (alt_calories, etc.)

    Args:
        meals_with_tracking: List of meals with their tracking information

    Returns:
        NutritionTotals with aggregated actual nutrition

    Performance: O(n) single pass through meals list
    """
    totals = NutritionTotals()

    for meal in meals_with_tracking:
        # Meal not yet tracked - don't count it in actual totals
        if meal.status is None:
            continue

        if meal.status == "ate_as_planned":
            # Use planned nutrition values from the meal
            totals.calories += meal.calories
            totals.protein += meal.protein
            totals.carbs += meal.carbs
            totals.fats += meal.fats

        elif meal.status == "skipped":
            # Skipped meals contribute nothing to actual totals
            pass

        elif meal.status == "ate_something_else":
            # Use alternative nutrition values from tracking record
            # Note: alt_calories is required when status='ate_something_else'
            # but other macros are optional (may be None)
            totals.calories += meal.alt_calories or 0.0
            totals.protein += meal.alt_protein or 0.0
            totals.carbs += meal.alt_carbs or 0.0
            totals.fats += meal.alt_fats or 0.0

    return totals


def calculate_planned_nutrition(meals: List[MealWithTracking]) -> NutritionTotals:
    """
    Calculate planned nutrition by summing all planned meal values.

    This is independent of tracking status - it represents what was planned
    regardless of what was actually eaten.

    Args:
        meals: List of meals (tracking status irrelevant)

    Returns:
        NutritionTotals with aggregated planned nutrition
    """
    totals = NutritionTotals()

    for meal in meals:
        totals.calories += meal.calories
        totals.protein += meal.protein
        totals.carbs += meal.carbs
        totals.fats += meal.fats

    return totals


def calculate_adherence(meals_with_tracking: List[MealWithTracking]) -> float:
    """
    Calculate meal plan adherence as percentage of meals eaten as planned.

    Adherence Formula:
        (Number of meals with status='ate_as_planned') / (Total meals) × 100

    Only tracked meals are considered. If no meals are tracked, returns 0.0.

    Args:
        meals_with_tracking: List of meals with tracking data

    Returns:
        Adherence percentage between 0.0 and 100.0

    Edge Cases:
        - No meals exist: returns 0.0
        - No meals tracked yet: returns 0.0
        - All meals skipped or ate_something_else: returns 0.0
        - All meals ate_as_planned: returns 100.0
    """
    if not meals_with_tracking:
        return 0.0

    total_meals = len(meals_with_tracking)
    tracked_as_planned = sum(
        1 for meal in meals_with_tracking
        if meal.status == "ate_as_planned"
    )

    # Prevent division by zero (though total_meals > 0 is guaranteed here)
    if total_meals == 0:
        return 0.0

    adherence = (tracked_as_planned / total_meals) * 100.0

    # Ensure result is within bounds due to floating point arithmetic
    return round(adherence, 2)


def get_daily_tracking_data(
    db: Session,
    target_date: date,
    plan_id: int
) -> Optional[DailyTrackingResponse]:
    """
    Retrieve complete tracking data for a single day within a meal plan.

    Process:
    1. Find the daily plan for the specified date within the given plan
    2. Load all meals for that daily plan with LEFT JOIN to meal_tracking
    3. Calculate planned and actual nutrition totals
    4. Calculate adherence percentage
    5. Build DailyTrackingResponse

    Args:
        db: Database session
        target_date: The date to retrieve tracking for
        plan_id: The meal plan ID containing this date

    Returns:
        DailyTrackingResponse if daily plan exists, None otherwise

    Database Query Optimization:
        Uses LEFT JOIN to fetch meals and tracking in a single query,
        reducing N+1 query problems.
    """
    # Find the daily plan for this date within the specified meal plan
    daily_plan = db.query(DailyPlan).filter(
        and_(
            DailyPlan.plan_id == plan_id,
            DailyPlan.date == target_date
        )
    ).first()

    if not daily_plan:
        return None

    # Fetch all meals for this daily plan with their tracking records (LEFT JOIN)
    # This single query retrieves both meal and tracking data efficiently
    meals_query = (
        db.query(Meal, MealTracking)
        .outerjoin(MealTracking, Meal.id == MealTracking.meal_id)
        .filter(Meal.daily_plan_id == daily_plan.id)
        .order_by(Meal.meal_type)  # Consistent ordering: breakfast, lunch, dinner, snacks
    )

    # Build MealWithTracking objects
    meals_with_tracking = []
    for meal, tracking in meals_query.all():
        meal_data = MealWithTracking(
            meal_id=meal.id,
            meal_type=meal.meal_type,
            dish_name=meal.dish_name,
            calories=meal.calories,
            protein=meal.protein,
            carbs=meal.carbs,
            fats=meal.fats,
            # Tracking fields (None if not tracked yet)
            tracking_id=tracking.id if tracking else None,
            status=tracking.status if tracking else None,
            alt_description=tracking.alt_description if tracking else None,
            alt_calories=tracking.alt_calories if tracking else None,
            alt_protein=tracking.alt_protein if tracking else None,
            alt_carbs=tracking.alt_carbs if tracking else None,
            alt_fats=tracking.alt_fats if tracking else None,
            tracked_at=tracking.tracked_at if tracking else None
        )
        meals_with_tracking.append(meal_data)

    # Calculate aggregated nutrition
    planned_totals = calculate_planned_nutrition(meals_with_tracking)
    actual_totals = calculate_actual_nutrition(meals_with_tracking)
    adherence = calculate_adherence(meals_with_tracking)

    return DailyTrackingResponse(
        date=target_date.isoformat(),
        meals=meals_with_tracking,
        planned_totals=planned_totals,
        actual_totals=actual_totals,
        adherence_percentage=adherence
    )


def get_weekly_tracking_data(
    db: Session,
    plan_id: int
) -> Optional[WeeklyTrackingResponse]:
    """
    Retrieve complete tracking data for an entire week (meal plan).

    Process:
    1. Verify meal plan exists
    2. For each of the 7 days in the plan:
       - Get daily tracking data
       - Aggregate daily totals into weekly totals
    3. Calculate overall weekly adherence
    4. Build WeeklyTrackingResponse

    Args:
        db: Database session
        plan_id: The meal plan ID to retrieve tracking for

    Returns:
        WeeklyTrackingResponse if plan exists, None otherwise

    Performance Considerations:
        Makes 1 query for plan + 7 queries for daily data (one per day).
        Could be optimized with a single complex query, but current approach
        maintains code clarity and reuses daily tracking logic.
    """
    # Verify meal plan exists
    meal_plan = db.query(MealPlan).filter(MealPlan.id == plan_id).first()
    if not meal_plan:
        return None

    # Collect daily tracking data for all 7 days
    daily_responses: List[DailyTrackingResponse] = []
    current_date = meal_plan.start_date

    for _ in range(7):
        daily_data = get_daily_tracking_data(db, current_date, plan_id)
        if daily_data:
            daily_responses.append(daily_data)
        current_date += timedelta(days=1)

    # Calculate weekly aggregates
    weekly_planned = NutritionTotals()
    weekly_actual = NutritionTotals()
    total_meals = 0
    total_ate_as_planned = 0

    for day in daily_responses:
        # Aggregate nutrition totals
        weekly_planned.calories += day.planned_totals.calories
        weekly_planned.protein += day.planned_totals.protein
        weekly_planned.carbs += day.planned_totals.carbs
        weekly_planned.fats += day.planned_totals.fats

        weekly_actual.calories += day.actual_totals.calories
        weekly_actual.protein += day.actual_totals.protein
        weekly_actual.carbs += day.actual_totals.carbs
        weekly_actual.fats += day.actual_totals.fats

        # Count meals for adherence calculation
        total_meals += len(day.meals)
        total_ate_as_planned += sum(
            1 for meal in day.meals
            if meal.status == "ate_as_planned"
        )

    # Calculate weekly adherence percentage
    weekly_adherence = 0.0
    if total_meals > 0:
        weekly_adherence = round((total_ate_as_planned / total_meals) * 100.0, 2)

    return WeeklyTrackingResponse(
        plan_id=plan_id,
        days=daily_responses,
        weekly_adherence=weekly_adherence,
        weekly_planned_totals=weekly_planned,
        weekly_actual_totals=weekly_actual
    )
```

**Key Design Decisions:**

1. **Separation of Concerns**: Each function has a single responsibility - nutrition calculation, adherence calculation, or data aggregation. This improves testability and maintainability.

2. **NULL Handling**: The code explicitly handles `None` values for optional macro fields when status is 'ate_something_else', preventing arithmetic errors.

3. **Database Optimization**: Uses LEFT JOIN to fetch meals and tracking in one query, avoiding N+1 problems when loading daily data.

4. **Edge Case Handling**: Functions gracefully handle empty meal lists, untracked meals, and division-by-zero scenarios.

5. **Floating Point Precision**: Adherence percentages are rounded to 2 decimal places to avoid floating point representation issues.

---

### 4. Tracking Router

**File:** `backend/routers/tracking.py`

```python
"""
FastAPI router for meal tracking endpoints.

Provides REST API for:
- Creating meal tracking records
- Updating tracking status
- Retrieving daily tracking data
- Retrieving weekly tracking aggregations
"""

from typing import Optional
from datetime import date, datetime
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from backend.database import get_db
from backend.models.meal_plan import Meal, DailyPlan, MealPlan
from backend.models.meal_tracking import MealTracking
from backend.schemas.tracking import (
    MealTrackingCreate,
    MealTrackingUpdate,
    MealTrackingResponse,
    DailyTrackingResponse,
    WeeklyTrackingResponse
)
from backend.services.tracking_service import (
    get_daily_tracking_data,
    get_weekly_tracking_data
)


router = APIRouter(prefix="/tracking", tags=["Meal Tracking"])


# ============================================================================
# Helper Functions
# ============================================================================

def get_active_meal_plan(db: Session) -> Optional[MealPlan]:
    """
    Get the currently active meal plan for the authenticated user.

    In a production system, this would filter by user_id from auth token.
    For now, returns the most recent meal plan.

    Security TODO: Add user authentication and filter by user_id
    """
    return (
        db.query(MealPlan)
        .order_by(MealPlan.created_at.desc())
        .first()
    )


# ============================================================================
# Tracking CRUD Endpoints
# ============================================================================

@router.post("/{meal_id}", response_model=MealTrackingResponse, status_code=status.HTTP_201_CREATED)
def create_meal_tracking(
    meal_id: int,
    tracking_data: MealTrackingCreate,
    db: Session = Depends(get_db)
):
    """
    Create a new tracking record for a meal.

    Process:
    1. Verify meal exists
    2. Check if tracking already exists (409 if duplicate)
    3. Validate alternative meal data if status='ate_something_else'
    4. Create tracking record
    5. Return complete tracking response with meal info

    Args:
        meal_id: ID of the meal being tracked (from path)
        tracking_data: Tracking details (status and optional alt meal data)
        db: Database session

    Returns:
        MealTrackingResponse with tracking and meal information

    Raises:
        404: Meal not found
        409: Meal already tracked (use PUT to update)
        422: Validation error (e.g., missing alt_description when required)

    Security Considerations:
        - Validates meal exists before creating tracking
        - Prevents duplicate tracking records via database UNIQUE constraint check
        - Pydantic validation ensures data integrity for alternative meals
    """
    # 1. Verify meal exists
    meal = db.query(Meal).filter(Meal.id == meal_id).first()
    if not meal:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Meal with id {meal_id} not found"
        )

    # 2. Check if tracking already exists
    existing_tracking = db.query(MealTracking).filter(
        MealTracking.meal_id == meal_id
    ).first()

    if existing_tracking:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Meal {meal_id} is already tracked. Use PUT to update."
        )

    # 3. Validation already handled by Pydantic schema
    # (MealTrackingCreate validates alt_description and alt_calories when needed)

    # 4. Create tracking record
    new_tracking = MealTracking(
        meal_id=meal_id,
        status=tracking_data.status,
        alt_description=tracking_data.alt_description,
        alt_calories=tracking_data.alt_calories,
        alt_protein=tracking_data.alt_protein,
        alt_carbs=tracking_data.alt_carbs,
        alt_fats=tracking_data.alt_fats
    )

    db.add(new_tracking)
    db.commit()
    db.refresh(new_tracking)

    # 5. Build response with both tracking and meal data
    return MealTrackingResponse(
        # Tracking fields
        id=new_tracking.id,
        meal_id=new_tracking.meal_id,
        status=new_tracking.status,
        alt_description=new_tracking.alt_description,
        alt_calories=new_tracking.alt_calories,
        alt_protein=new_tracking.alt_protein,
        alt_carbs=new_tracking.alt_carbs,
        alt_fats=new_tracking.alt_fats,
        tracked_at=new_tracking.tracked_at,
        # Meal fields (for comparison in UI)
        meal_type=meal.meal_type,
        dish_name=meal.dish_name,
        planned_calories=meal.calories,
        planned_protein=meal.protein,
        planned_carbs=meal.carbs,
        planned_fats=meal.fats
    )


@router.put("/{meal_id}", response_model=MealTrackingResponse)
def update_meal_tracking(
    meal_id: int,
    tracking_data: MealTrackingUpdate,
    db: Session = Depends(get_db)
):
    """
    Update an existing meal tracking record.

    Allows changing tracking status and alternative meal details.
    All fields are optional - only provided fields are updated.

    Process:
    1. Get existing tracking record
    2. Validate update data (same rules as create)
    3. Update provided fields
    4. Handle status changes that affect alternative meal data
    5. Save and return updated record

    Args:
        meal_id: ID of the meal being tracked
        tracking_data: Fields to update
        db: Database session

    Returns:
        MealTrackingResponse with updated tracking data

    Raises:
        404: Tracking record not found (meal not tracked yet)
        422: Validation error (e.g., changing to 'ate_something_else' without alt data)

    Edge Cases:
        - Changing from 'ate_something_else' to 'ate_as_planned':
          Alternative fields remain in database but are ignored
        - Changing to 'ate_something_else' without providing alt data:
          Fails validation if existing record doesn't have alt data
    """
    # 1. Get existing tracking record
    tracking = db.query(MealTracking).filter(
        MealTracking.meal_id == meal_id
    ).first()

    if not tracking:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Meal {meal_id} has not been tracked yet. Use POST to create tracking."
        )

    # Get meal for response
    meal = db.query(Meal).filter(Meal.id == meal_id).first()

    # 2. Prepare updated data, merging with existing values
    update_dict = tracking_data.model_dump(exclude_unset=True)

    # Determine final status (either new or existing)
    final_status = update_dict.get('status', tracking.status)

    # 3. Validate: if final status is 'ate_something_else', ensure required fields exist
    if final_status == "ate_something_else":
        # Check for alt_description
        final_alt_desc = update_dict.get('alt_description', tracking.alt_description)
        if not final_alt_desc or not final_alt_desc.strip():
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="alt_description is required when status is 'ate_something_else'"
            )

        # Check for alt_calories
        final_alt_cal = update_dict.get('alt_calories', tracking.alt_calories)
        if final_alt_cal is None:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="alt_calories is required when status is 'ate_something_else'"
            )

    # 4. Update fields
    for field, value in update_dict.items():
        setattr(tracking, field, value)

    # Update the updated_at timestamp
    tracking.updated_at = datetime.utcnow()

    # 5. Save and return
    db.commit()
    db.refresh(tracking)

    return MealTrackingResponse(
        id=tracking.id,
        meal_id=tracking.meal_id,
        status=tracking.status,
        alt_description=tracking.alt_description,
        alt_calories=tracking.alt_calories,
        alt_protein=tracking.alt_protein,
        alt_carbs=tracking.alt_carbs,
        alt_fats=tracking.alt_fats,
        tracked_at=tracking.tracked_at,
        meal_type=meal.meal_type,
        dish_name=meal.dish_name,
        planned_calories=meal.calories,
        planned_protein=meal.protein,
        planned_carbs=meal.carbs,
        planned_fats=meal.fats
    )


# ============================================================================
# Tracking Aggregation Endpoints
# ============================================================================

@router.get("/daily/{date}", response_model=DailyTrackingResponse)
def get_daily_tracking(
    date: str,
    db: Session = Depends(get_db)
):
    """
    Get complete tracking data for a specific date.

    Returns all meals for the day with their tracking status, plus
    aggregated nutrition totals and adherence metrics.

    Process:
    1. Parse and validate date format
    2. Get active meal plan
    3. Verify date falls within plan's week
    4. Retrieve daily tracking data from service
    5. Return formatted response

    Args:
        date: Date string in YYYY-MM-DD format
        db: Database session

    Returns:
        DailyTrackingResponse with meals, totals, and adherence

    Raises:
        400: Invalid date format
        404: No active meal plan or no plan for this date

    Usage Example:
        GET /tracking/daily/2025-01-15

    Response includes untracked meals (status=null) so UI can display
    all meals with tracking buttons.
    """
    # 1. Parse date
    try:
        target_date = datetime.strptime(date, "%Y-%m-%d").date()
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid date format. Use YYYY-MM-DD (e.g., 2025-01-15)"
        )

    # 2. Get active meal plan
    active_plan = get_active_meal_plan(db)
    if not active_plan:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No active meal plan found. Please generate a meal plan first."
        )

    # 3. Verify date is within plan's week
    plan_end_date = active_plan.start_date + timedelta(days=6)
    if not (active_plan.start_date <= target_date <= plan_end_date):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"No meal plan exists for {date}. Current plan covers {active_plan.start_date} to {plan_end_date}."
        )

    # 4. Get daily tracking data
    daily_data = get_daily_tracking_data(db, target_date, active_plan.id)

    if not daily_data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"No daily plan found for {date}"
        )

    return daily_data


@router.get("/weekly/{plan_id}", response_model=WeeklyTrackingResponse)
def get_weekly_tracking(
    plan_id: int,
    db: Session = Depends(get_db)
):
    """
    Get complete tracking data for an entire week (meal plan).

    Aggregates all 7 days with weekly-level nutrition totals and adherence.
    Used for dashboard weekly overview and trend analysis.

    Process:
    1. Verify meal plan exists
    2. Retrieve weekly tracking data from service
    3. Return aggregated response

    Args:
        plan_id: ID of the meal plan
        db: Database session

    Returns:
        WeeklyTrackingResponse with all days and weekly aggregates

    Raises:
        404: Meal plan not found

    Usage Example:
        GET /tracking/weekly/123

    Performance:
        Executes multiple queries (1 for plan + 7 for daily data).
        Consider caching for frequently accessed plans.
    """
    # Retrieve weekly data (service handles plan existence check)
    weekly_data = get_weekly_tracking_data(db, plan_id)

    if not weekly_data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Meal plan with id {plan_id} not found"
        )

    return weekly_data


# ============================================================================
# Utility Endpoint (Optional)
# ============================================================================

@router.delete("/{meal_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_meal_tracking(
    meal_id: int,
    db: Session = Depends(get_db)
):
    """
    Delete a meal tracking record.

    Allows users to "untrack" a meal if they made a mistake.

    Args:
        meal_id: ID of the meal to untrack
        db: Database session

    Returns:
        204 No Content on success

    Raises:
        404: Tracking record not found

    Use Case:
        User accidentally marks meal as "skipped" and wants to reset it.
    """
    tracking = db.query(MealTracking).filter(
        MealTracking.meal_id == meal_id
    ).first()

    if not tracking:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"No tracking record found for meal {meal_id}"
        )

    db.delete(tracking)
    db.commit()

    return None
```

**Key Design Decisions:**

1. **RESTful Resource Design**: The meal_id is a path parameter, making the API semantically clear (`POST /tracking/{meal_id}` means "track this meal").

2. **Error Handling**: Comprehensive HTTP status codes:
   - 201 Created for successful POST
   - 409 Conflict for duplicate tracking
   - 404 Not Found for missing resources
   - 422 Unprocessable Entity for validation errors

3. **Duplicate Prevention**: Explicit check for existing tracking before POST, with clear error message directing users to use PUT instead.

4. **Date Validation**: The daily tracking endpoint validates date format and ensures the date falls within the active plan's week, preventing orphaned queries.

5. **Response Completeness**: Both POST and PUT return `MealTrackingResponse` with meal data included, reducing frontend API calls.

---

## Frontend Implementation

### 1. Tracking Page

**File:** `src/app/tracking/page.tsx`

```typescript
"use client";

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { format, addDays, subDays, parseISO, isValid } from 'date-fns';
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, TrendingUp } from 'lucide-react';

import { MealTrackingRow } from '@/components/tracking/MealTrackingRow';
import { DailySummaryCard } from '@/components/tracking/DailySummaryCard';
import { DatePicker } from '@/components/ui/DatePicker';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/ui/Alert';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';

import type { DailyTrackingResponse, MealWithTracking } from '@/types/tracking';

/**
 * Main Meal Tracking Page
 *
 * Features:
 * - Date navigation (prev/next arrows + date picker)
 * - List of all meals for selected date with tracking controls
 * - Daily nutrition summary (planned vs actual)
 * - Adherence percentage display
 * - Optimistic UI updates for better UX
 *
 * State Management:
 * - selectedDate: Current date being viewed
 * - trackingData: Complete daily tracking response from API
 * - isLoading: Loading state for initial data fetch
 * - error: Error message for failed API calls
 */
export default function TrackingPage() {
  const router = useRouter();
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [trackingData, setTrackingData] = useState<DailyTrackingResponse | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  /**
   * Fetch daily tracking data when selectedDate changes.
   *
   * API Call: GET /tracking/daily/{date}
   *
   * Error Scenarios:
   * - 404: No meal plan exists for this date
   * - Network error: Display retry option
   */
  useEffect(() => {
    const fetchDailyTracking = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const dateStr = format(selectedDate, 'yyyy-MM-dd');
        const response = await fetch(`/api/tracking/daily/${dateStr}`);

        if (!response.ok) {
          if (response.status === 404) {
            const errorData = await response.json();
            setError(errorData.detail || 'No meal plan found for this date.');
          } else {
            setError('Failed to load tracking data. Please try again.');
          }
          setTrackingData(null);
          return;
        }

        const data: DailyTrackingResponse = await response.json();
        setTrackingData(data);
      } catch (err) {
        console.error('Error fetching daily tracking:', err);
        setError('Network error. Please check your connection and try again.');
        setTrackingData(null);
      } finally {
        setIsLoading(false);
      }
    };

    fetchDailyTracking();
  }, [selectedDate]);

  /**
   * Handle tracking status change for a meal.
   *
   * Implements optimistic UI updates:
   * 1. Immediately update local state
   * 2. Send API request
   * 3. Revert on failure or update with server response
   *
   * API Call: POST /tracking/{meal_id} or PUT /tracking/{meal_id}
   */
  const handleTrackMeal = async (
    mealId: number,
    status: string,
    altData?: {
      alt_description?: string;
      alt_calories?: number;
      alt_protein?: number;
      alt_carbs?: number;
      alt_fats?: number;
    }
  ) => {
    if (!trackingData) return;

    // Determine if this is a new tracking or update
    const existingMeal = trackingData.meals.find(m => m.meal_id === mealId);
    const isUpdate = existingMeal?.tracking_id !== null;

    const endpoint = `/api/tracking/${mealId}`;
    const method = isUpdate ? 'PUT' : 'POST';

    // Optimistic update: immediately update UI
    const optimisticMeals = trackingData.meals.map(meal => {
      if (meal.meal_id === mealId) {
        return {
          ...meal,
          status,
          ...(altData || {}),
          tracked_at: new Date().toISOString()
        };
      }
      return meal;
    });

    // Recalculate totals and adherence optimistically
    const optimisticData = recalculateTracking({
      ...trackingData,
      meals: optimisticMeals
    });

    setTrackingData(optimisticData);

    try {
      const response = await fetch(endpoint, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status,
          ...altData
        })
      });

      if (!response.ok) {
        throw new Error('Failed to save tracking');
      }

      // Refresh full data from server to ensure consistency
      const dateStr = format(selectedDate, 'yyyy-MM-dd');
      const refreshResponse = await fetch(`/api/tracking/daily/${dateStr}`);
      const refreshedData: DailyTrackingResponse = await refreshResponse.json();
      setTrackingData(refreshedData);

    } catch (err) {
      console.error('Error tracking meal:', err);
      // Revert optimistic update on failure
      const dateStr = format(selectedDate, 'yyyy-MM-dd');
      const revertResponse = await fetch(`/api/tracking/daily/${dateStr}`);
      const revertedData: DailyTrackingResponse = await revertResponse.json();
      setTrackingData(revertedData);

      alert('Failed to save tracking. Please try again.');
    }
  };

  /**
   * Recalculate nutrition totals and adherence on the client side.
   * Used for optimistic updates before server confirmation.
   *
   * This mirrors the backend calculation logic for immediate feedback.
   */
  const recalculateTracking = (data: DailyTrackingResponse): DailyTrackingResponse => {
    let actualCalories = 0;
    let actualProtein = 0;
    let actualCarbs = 0;
    let actualFats = 0;
    let ateAsPlannedCount = 0;

    data.meals.forEach(meal => {
      if (meal.status === 'ate_as_planned') {
        actualCalories += meal.calories;
        actualProtein += meal.protein;
        actualCarbs += meal.carbs;
        actualFats += meal.fats;
        ateAsPlannedCount++;
      } else if (meal.status === 'ate_something_else') {
        actualCalories += meal.alt_calories || 0;
        actualProtein += meal.alt_protein || 0;
        actualCarbs += meal.alt_carbs || 0;
        actualFats += meal.alt_fats || 0;
      }
      // Skipped meals contribute 0
    });

    const adherence = data.meals.length > 0
      ? (ateAsPlannedCount / data.meals.length) * 100
      : 0;

    return {
      ...data,
      actual_totals: {
        calories: actualCalories,
        protein: actualProtein,
        carbs: actualCarbs,
        fats: actualFats
      },
      adherence_percentage: Math.round(adherence * 100) / 100
    };
  };

  // Date navigation handlers
  const handlePreviousDay = () => setSelectedDate(prev => subDays(prev, 1));
  const handleNextDay = () => setSelectedDate(prev => addDays(prev, 1));
  const handleDateSelect = (date: Date) => setSelectedDate(date);

  // Check if selected date is today
  const isToday = format(selectedDate, 'yyyy-MM-dd') === format(new Date(), 'yyyy-MM-dd');

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Meal Tracking</h1>
        <p className="text-gray-600">
          Track your daily meals and monitor nutrition adherence
        </p>
      </div>

      {/* Date Navigation */}
      <div className="bg-white rounded-lg shadow-md p-4 mb-6">
        <div className="flex items-center justify-between">
          <Button
            variant="ghost"
            size="sm"
            onClick={handlePreviousDay}
            className="p-2"
          >
            <ChevronLeft className="h-5 w-5" />
          </Button>

          <div className="flex items-center gap-4">
            <DatePicker
              selected={selectedDate}
              onChange={handleDateSelect}
              trigger={
                <Button variant="outline" className="flex items-center gap-2">
                  <CalendarIcon className="h-4 w-4" />
                  <span className="font-semibold">
                    {format(selectedDate, 'EEEE, MMMM d, yyyy')}
                  </span>
                  {isToday && (
                    <span className="ml-2 px-2 py-0.5 bg-blue-100 text-blue-800 text-xs font-medium rounded">
                      Today
                    </span>
                  )}
                </Button>
              }
            />
          </div>

          <Button
            variant="ghost"
            size="sm"
            onClick={handleNextDay}
            className="p-2"
          >
            <ChevronRight className="h-5 w-5" />
          </Button>
        </div>
      </div>

      {/* Loading State */}
      {isLoading && (
        <div className="flex justify-center items-center py-12">
          <LoadingSpinner size="lg" />
        </div>
      )}

      {/* Error State */}
      {error && !isLoading && (
        <Alert variant="error" className="mb-6">
          <p>{error}</p>
          {error.includes('No meal plan') && (
            <Button
              variant="primary"
              className="mt-4"
              onClick={() => router.push('/plans/generate')}
            >
              Generate Meal Plan
            </Button>
          )}
        </Alert>
      )}

      {/* Tracking Data */}
      {trackingData && !isLoading && (
        <>
          {/* Meals List */}
          <div className="space-y-4 mb-8">
            {trackingData.meals.length === 0 ? (
              <Alert variant="info">
                No meals planned for this date.
              </Alert>
            ) : (
              trackingData.meals.map(meal => (
                <MealTrackingRow
                  key={meal.meal_id}
                  meal={meal}
                  onTrack={handleTrackMeal}
                />
              ))
            )}
          </div>

          {/* Daily Summary */}
          {trackingData.meals.length > 0 && (
            <DailySummaryCard
              plannedTotals={trackingData.planned_totals}
              actualTotals={trackingData.actual_totals}
              adherencePercentage={trackingData.adherence_percentage}
              totalMeals={trackingData.meals.length}
              trackedMeals={trackingData.meals.filter(m => m.status).length}
            />
          )}

          {/* Weekly Overview Link */}
          <div className="mt-6 text-center">
            <Button
              variant="outline"
              onClick={() => router.push('/tracking/weekly')}
              className="inline-flex items-center gap-2"
            >
              <TrendingUp className="h-4 w-4" />
              View Weekly Progress
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
```

---

### 2. MealTrackingRow Component

**File:** `src/components/tracking/MealTrackingRow.tsx`

```typescript
"use client";

import React, { useState } from 'react';
import { Check, X, Edit3 } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { AlternativeMealInput } from './AlternativeMealInput';
import type { MealWithTracking } from '@/types/tracking';

interface MealTrackingRowProps {
  meal: MealWithTracking;
  onTrack: (
    mealId: number,
    status: string,
    altData?: {
      alt_description?: string;
      alt_calories?: number;
      alt_protein?: number;
      alt_carbs?: number;
      alt_fats?: number;
    }
  ) => Promise<void>;
}

/**
 * Individual meal row with tracking controls.
 *
 * Visual States:
 * - Untracked: Neutral gray background, all three buttons enabled
 * - Ate as Planned: Green left border, check icon, can change status
 * - Skipped: Red left border, strikethrough text, can change status
 * - Ate Something Else: Orange left border, shows alt meal info, can change
 *
 * Interaction Flow:
 * 1. User clicks status button
 * 2. For "Ate as Planned" or "Skipped": immediate API call
 * 3. For "Ate Something Else": expand inline form
 * 4. User fills form and submits: API call with alt data
 */
export function MealTrackingRow({ meal, onTrack }: MealTrackingRowProps) {
  const [showAltInput, setShowAltInput] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  /**
   * Handle quick tracking (ate_as_planned or skipped).
   * No additional input needed - immediate submission.
   */
  const handleQuickTrack = async (status: 'ate_as_planned' | 'skipped') => {
    setIsSubmitting(true);
    try {
      await onTrack(meal.meal_id, status);
      setShowAltInput(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  /**
   * Handle "Ate Something Else" button click.
   * Toggle the alternative meal input form.
   */
  const handleAltMealClick = () => {
    setShowAltInput(!showAltInput);
  };

  /**
   * Handle alternative meal form submission.
   */
  const handleAltSubmit = async (altData: {
    alt_description: string;
    alt_calories: number;
    alt_protein?: number;
    alt_carbs?: number;
    alt_fats?: number;
  }) => {
    setIsSubmitting(true);
    try {
      await onTrack(meal.meal_id, 'ate_something_else', altData);
      setShowAltInput(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Determine visual styling based on tracking status
  const getBorderColor = () => {
    if (!meal.status) return 'border-gray-200';
    switch (meal.status) {
      case 'ate_as_planned': return 'border-l-4 border-green-500';
      case 'skipped': return 'border-l-4 border-red-500';
      case 'ate_something_else': return 'border-l-4 border-orange-500';
      default: return 'border-gray-200';
    }
  };

  // Format meal type for display
  const formatMealType = (type: string) => {
    return type.split('_').map(word =>
      word.charAt(0).toUpperCase() + word.slice(1)
    ).join(' ');
  };

  return (
    <div className={`bg-white rounded-lg shadow-sm border ${getBorderColor()} p-4`}>
      {/* Main Row */}
      <div className="flex items-center justify-between mb-3">
        {/* Left: Meal Info */}
        <div className="flex-1">
          <div className="flex items-center gap-3 mb-1">
            <Badge variant="secondary" className="text-xs">
              {formatMealType(meal.meal_type)}
            </Badge>
            {meal.status && (
              <span className="text-xs text-gray-500">
                Tracked {new Date(meal.tracked_at!).toLocaleTimeString([], {
                  hour: '2-digit',
                  minute: '2-digit'
                })}
              </span>
            )}
          </div>
          <h3 className={`text-lg font-semibold ${meal.status === 'skipped' ? 'line-through text-gray-400' : 'text-gray-900'}`}>
            {meal.dish_name}
          </h3>
          <p className="text-sm text-gray-600">
            {meal.calories} cal • {meal.protein}g protein • {meal.carbs}g carbs • {meal.fats}g fat
          </p>

          {/* Alternative Meal Info */}
          {meal.status === 'ate_something_else' && meal.alt_description && (
            <div className="mt-2 p-2 bg-orange-50 rounded border border-orange-200">
              <p className="text-sm font-medium text-orange-900">Actually ate:</p>
              <p className="text-sm text-orange-800">{meal.alt_description}</p>
              <p className="text-xs text-orange-700 mt-1">
                {meal.alt_calories} cal
                {meal.alt_protein && ` • ${meal.alt_protein}g protein`}
                {meal.alt_carbs && ` • ${meal.alt_carbs}g carbs`}
                {meal.alt_fats && ` • ${meal.alt_fats}g fat`}
              </p>
            </div>
          )}
        </div>

        {/* Right: Status Buttons */}
        <div className="flex gap-2 ml-4">
          <Button
            variant={meal.status === 'ate_as_planned' ? 'solid-success' : 'outline'}
            size="sm"
            onClick={() => handleQuickTrack('ate_as_planned')}
            disabled={isSubmitting}
            className="flex items-center gap-1"
          >
            <Check className="h-4 w-4" />
            <span className="hidden sm:inline">As Planned</span>
          </Button>

          <Button
            variant={meal.status === 'skipped' ? 'solid-error' : 'outline'}
            size="sm"
            onClick={() => handleQuickTrack('skipped')}
            disabled={isSubmitting}
            className="flex items-center gap-1"
          >
            <X className="h-4 w-4" />
            <span className="hidden sm:inline">Skipped</span>
          </Button>

          <Button
            variant={meal.status === 'ate_something_else' ? 'solid-warning' : 'outline'}
            size="sm"
            onClick={handleAltMealClick}
            disabled={isSubmitting}
            className="flex items-center gap-1"
          >
            <Edit3 className="h-4 w-4" />
            <span className="hidden sm:inline">Something Else</span>
          </Button>
        </div>
      </div>

      {/* Alternative Meal Input Form */}
      {showAltInput && (
        <AlternativeMealInput
          mealId={meal.meal_id}
          initialData={meal.status === 'ate_something_else' ? {
            description: meal.alt_description || '',
            calories: meal.alt_calories || 0,
            protein: meal.alt_protein,
            carbs: meal.alt_carbs,
            fats: meal.alt_fats
          } : undefined}
          onSubmit={handleAltSubmit}
          onCancel={() => setShowAltInput(false)}
          isSubmitting={isSubmitting}
        />
      )}
    </div>
  );
}
```

---

### 3. AlternativeMealInput Component

**File:** `src/components/tracking/AlternativeMealInput.tsx`

```typescript
"use client";

import React, { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';

interface AlternativeMealInputProps {
  mealId: number;
  initialData?: {
    description: string;
    calories: number;
    protein?: number;
    carbs?: number;
    fats?: number;
  };
  onSubmit: (data: {
    alt_description: string;
    alt_calories: number;
    alt_protein?: number;
    alt_carbs?: number;
    alt_fats?: number;
  }) => Promise<void>;
  onCancel: () => void;
  isSubmitting: boolean;
}

/**
 * Inline form for entering alternative meal details.
 *
 * Features:
 * - Compact inline design (not a modal)
 * - Required fields: description, calories
 * - Optional fields: protein, carbs, fats
 * - Quick-fill suggestions for common alternatives
 * - Form validation before submission
 *
 * UX Considerations:
 * - Appears smoothly below the meal row
 * - Focus on description field when opened
 * - Clear validation messages
 * - Cancel button to dismiss without saving
 */
export function AlternativeMealInput({
  mealId,
  initialData,
  onSubmit,
  onCancel,
  isSubmitting
}: AlternativeMealInputProps) {
  const [description, setDescription] = useState(initialData?.description || '');
  const [calories, setCalories] = useState(initialData?.calories?.toString() || '');
  const [protein, setProtein] = useState(initialData?.protein?.toString() || '');
  const [carbs, setCarbs] = useState(initialData?.carbs?.toString() || '');
  const [fats, setFats] = useState(initialData?.fats?.toString() || '');
  const [errors, setErrors] = useState<{ [key: string]: string }>({});

  /**
   * Quick-fill suggestions for common alternative meals.
   * Clicking a suggestion pre-fills the form with approximate nutrition data.
   */
  const commonAlternatives = [
    { name: 'Skipped - had protein shake', calories: 200, protein: 25, carbs: 10, fats: 3 },
    { name: 'Restaurant meal (estimate)', calories: 800, protein: 30, carbs: 80, fats: 35 },
    { name: 'Fast food burger', calories: 550, protein: 25, carbs: 45, fats: 28 },
    { name: 'Salad with chicken', calories: 350, protein: 35, carbs: 20, fats: 12 }
  ];

  /**
   * Apply a quick-fill suggestion to the form.
   */
  const handleQuickFill = (suggestion: typeof commonAlternatives[0]) => {
    setDescription(suggestion.name);
    setCalories(suggestion.calories.toString());
    setProtein(suggestion.protein.toString());
    setCarbs(suggestion.carbs.toString());
    setFats(suggestion.fats.toString());
  };

  /**
   * Validate form before submission.
   *
   * Rules:
   * - Description is required and non-empty
   * - Calories is required and must be a positive number
   * - Macros (if provided) must be valid positive numbers
   */
  const validate = (): boolean => {
    const newErrors: { [key: string]: string } = {};

    if (!description.trim()) {
      newErrors.description = 'Please describe what you ate';
    }

    const caloriesNum = parseFloat(calories);
    if (!calories || isNaN(caloriesNum) || caloriesNum <= 0) {
      newErrors.calories = 'Please enter valid calories';
    }

    // Optional fields validation (only if provided)
    if (protein && (isNaN(parseFloat(protein)) || parseFloat(protein) < 0)) {
      newErrors.protein = 'Invalid protein value';
    }
    if (carbs && (isNaN(parseFloat(carbs)) || parseFloat(carbs) < 0)) {
      newErrors.carbs = 'Invalid carbs value';
    }
    if (fats && (isNaN(parseFloat(fats)) || parseFloat(fats) < 0)) {
      newErrors.fats = 'Invalid fats value';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  /**
   * Handle form submission.
   */
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validate()) return;

    await onSubmit({
      alt_description: description.trim(),
      alt_calories: parseFloat(calories),
      alt_protein: protein ? parseFloat(protein) : undefined,
      alt_carbs: carbs ? parseFloat(carbs) : undefined,
      alt_fats: fats ? parseFloat(fats) : undefined
    });
  };

  return (
    <div className="mt-4 p-4 bg-gray-50 rounded-lg border border-gray-200">
      <h4 className="text-sm font-semibold text-gray-900 mb-3">
        What did you eat instead?
      </h4>

      {/* Quick Fill Suggestions */}
      <div className="mb-4">
        <p className="text-xs text-gray-600 mb-2">Quick suggestions:</p>
        <div className="flex flex-wrap gap-2">
          {commonAlternatives.map((suggestion, idx) => (
            <Button
              key={idx}
              variant="ghost"
              size="xs"
              onClick={() => handleQuickFill(suggestion)}
              className="text-xs"
            >
              {suggestion.name}
            </Button>
          ))}
        </div>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="space-y-3">
        {/* Description */}
        <div>
          <label htmlFor={`desc-${mealId}`} className="block text-sm font-medium text-gray-700 mb-1">
            Description <span className="text-red-500">*</span>
          </label>
          <Input
            id={`desc-${mealId}`}
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="e.g., Chicken salad from cafe"
            className={errors.description ? 'border-red-500' : ''}
            autoFocus
          />
          {errors.description && (
            <p className="text-xs text-red-600 mt-1">{errors.description}</p>
          )}
        </div>

        {/* Nutrition Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {/* Calories */}
          <div>
            <label htmlFor={`cal-${mealId}`} className="block text-sm font-medium text-gray-700 mb-1">
              Calories <span className="text-red-500">*</span>
            </label>
            <Input
              id={`cal-${mealId}`}
              type="number"
              value={calories}
              onChange={(e) => setCalories(e.target.value)}
              placeholder="500"
              min="0"
              step="1"
              className={errors.calories ? 'border-red-500' : ''}
            />
            {errors.calories && (
              <p className="text-xs text-red-600 mt-1">{errors.calories}</p>
            )}
          </div>

          {/* Protein */}
          <div>
            <label htmlFor={`protein-${mealId}`} className="block text-sm font-medium text-gray-700 mb-1">
              Protein (g)
            </label>
            <Input
              id={`protein-${mealId}`}
              type="number"
              value={protein}
              onChange={(e) => setProtein(e.target.value)}
              placeholder="30"
              min="0"
              step="0.1"
              className={errors.protein ? 'border-red-500' : ''}
            />
          </div>

          {/* Carbs */}
          <div>
            <label htmlFor={`carbs-${mealId}`} className="block text-sm font-medium text-gray-700 mb-1">
              Carbs (g)
            </label>
            <Input
              id={`carbs-${mealId}`}
              type="number"
              value={carbs}
              onChange={(e) => setCarbs(e.target.value)}
              placeholder="40"
              min="0"
              step="0.1"
              className={errors.carbs ? 'border-red-500' : ''}
            />
          </div>

          {/* Fats */}
          <div>
            <label htmlFor={`fats-${mealId}`} className="block text-sm font-medium text-gray-700 mb-1">
              Fats (g)
            </label>
            <Input
              id={`fats-${mealId}`}
              type="number"
              value={fats}
              onChange={(e) => setFats(e.target.value)}
              placeholder="15"
              min="0"
              step="0.1"
              className={errors.fats ? 'border-red-500' : ''}
            />
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-2 justify-end pt-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onCancel}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            variant="primary"
            size="sm"
            disabled={isSubmitting}
          >
            {isSubmitting ? 'Saving...' : 'Save Alternative Meal'}
          </Button>
        </div>
      </form>
    </div>
  );
}
```

---

### 4. DailySummaryCard Component

**File:** `src/components/tracking/DailySummaryCard.tsx`

```typescript
"use client";

import React from 'react';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { Progress } from '@/components/ui/Progress';
import type { NutritionTotals } from '@/types/tracking';

interface DailySummaryCardProps {
  plannedTotals: NutritionTotals;
  actualTotals: NutritionTotals;
  adherencePercentage: number;
  totalMeals: number;
  trackedMeals: number;
}

/**
 * Daily nutrition summary card showing planned vs actual comparison.
 *
 * Features:
 * - Side-by-side planned vs actual nutrition
 * - Color-coded variance indicators:
 *   - Green: within ±10% of planned
 *   - Yellow: within ±20% of planned
 *   - Red: >20% off from planned
 * - Adherence badge and progress bar
 * - Tracking completion status
 *
 * Visual Design:
 * - Two-column layout for easy comparison
 * - Icons indicate over/under consumption
 * - Large adherence percentage for quick assessment
 */
export function DailySummaryCard({
  plannedTotals,
  actualTotals,
  adherencePercentage,
  totalMeals,
  trackedMeals
}: DailySummaryCardProps) {
  /**
   * Calculate variance percentage and determine color coding.
   *
   * Returns:
   * - percentage: Numeric variance (-100 to +∞)
   * - color: CSS class for color (green/yellow/red)
   * - icon: React icon component
   */
  const getVariance = (planned: number, actual: number) => {
    if (planned === 0) return { percentage: 0, color: 'text-gray-500', icon: Minus };

    const variance = ((actual - planned) / planned) * 100;
    const absVariance = Math.abs(variance);

    let color = 'text-green-600';
    let icon = Minus;

    if (absVariance <= 10) {
      color = 'text-green-600';
      icon = variance > 0 ? TrendingUp : variance < 0 ? TrendingDown : Minus;
    } else if (absVariance <= 20) {
      color = 'text-yellow-600';
      icon = variance > 0 ? TrendingUp : TrendingDown;
    } else {
      color = 'text-red-600';
      icon = variance > 0 ? TrendingUp : TrendingDown;
    }

    return {
      percentage: Math.round(variance),
      color,
      icon
    };
  };

  // Calculate variances for each nutrient
  const caloriesVariance = getVariance(plannedTotals.calories, actualTotals.calories);
  const proteinVariance = getVariance(plannedTotals.protein, actualTotals.protein);
  const carbsVariance = getVariance(plannedTotals.carbs, actualTotals.carbs);
  const fatsVariance = getVariance(plannedTotals.fats, actualTotals.fats);

  /**
   * Get adherence badge color based on percentage.
   */
  const getAdherenceBadgeVariant = () => {
    if (adherencePercentage >= 80) return 'success';
    if (adherencePercentage >= 60) return 'warning';
    return 'error';
  };

  return (
    <div className="bg-white rounded-lg shadow-md border border-gray-200 p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-bold text-gray-900">Daily Summary</h2>
        <div className="flex items-center gap-4">
          <span className="text-sm text-gray-600">
            {trackedMeals} of {totalMeals} meals tracked
          </span>
          <Badge variant={getAdherenceBadgeVariant()} className="text-sm px-3 py-1">
            {adherencePercentage.toFixed(0)}% adherence
          </Badge>
        </div>
      </div>

      {/* Adherence Progress Bar */}
      <div className="mb-6">
        <Progress value={adherencePercentage} className="h-2" />
      </div>

      {/* Nutrition Comparison Table */}
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-200">
              <th className="text-left py-2 px-3 text-sm font-semibold text-gray-700">
                Nutrient
              </th>
              <th className="text-right py-2 px-3 text-sm font-semibold text-gray-700">
                Planned
              </th>
              <th className="text-right py-2 px-3 text-sm font-semibold text-gray-700">
                Actual
              </th>
              <th className="text-right py-2 px-3 text-sm font-semibold text-gray-700">
                Variance
              </th>
            </tr>
          </thead>
          <tbody>
            {/* Calories Row */}
            <tr className="border-b border-gray-100 hover:bg-gray-50">
              <td className="py-3 px-3 font-medium text-gray-900">Calories</td>
              <td className="py-3 px-3 text-right text-gray-700">
                {Math.round(plannedTotals.calories)}
              </td>
              <td className="py-3 px-3 text-right text-gray-900 font-medium">
                {Math.round(actualTotals.calories)}
              </td>
              <td className={`py-3 px-3 text-right font-medium ${caloriesVariance.color}`}>
                <div className="flex items-center justify-end gap-1">
                  <caloriesVariance.icon className="h-4 w-4" />
                  <span>{caloriesVariance.percentage > 0 ? '+' : ''}{caloriesVariance.percentage}%</span>
                </div>
              </td>
            </tr>

            {/* Protein Row */}
            <tr className="border-b border-gray-100 hover:bg-gray-50">
              <td className="py-3 px-3 font-medium text-gray-900">Protein (g)</td>
              <td className="py-3 px-3 text-right text-gray-700">
                {Math.round(plannedTotals.protein)}
              </td>
              <td className="py-3 px-3 text-right text-gray-900 font-medium">
                {Math.round(actualTotals.protein)}
              </td>
              <td className={`py-3 px-3 text-right font-medium ${proteinVariance.color}`}>
                <div className="flex items-center justify-end gap-1">
                  <proteinVariance.icon className="h-4 w-4" />
                  <span>{proteinVariance.percentage > 0 ? '+' : ''}{proteinVariance.percentage}%</span>
                </div>
              </td>
            </tr>

            {/* Carbs Row */}
            <tr className="border-b border-gray-100 hover:bg-gray-50">
              <td className="py-3 px-3 font-medium text-gray-900">Carbs (g)</td>
              <td className="py-3 px-3 text-right text-gray-700">
                {Math.round(plannedTotals.carbs)}
              </td>
              <td className="py-3 px-3 text-right text-gray-900 font-medium">
                {Math.round(actualTotals.carbs)}
              </td>
              <td className={`py-3 px-3 text-right font-medium ${carbsVariance.color}`}>
                <div className="flex items-center justify-end gap-1">
                  <carbsVariance.icon className="h-4 w-4" />
                  <span>{carbsVariance.percentage > 0 ? '+' : ''}{carbsVariance.percentage}%</span>
                </div>
              </td>
            </tr>

            {/* Fats Row */}
            <tr className="hover:bg-gray-50">
              <td className="py-3 px-3 font-medium text-gray-900">Fats (g)</td>
              <td className="py-3 px-3 text-right text-gray-700">
                {Math.round(plannedTotals.fats)}
              </td>
              <td className="py-3 px-3 text-right text-gray-900 font-medium">
                {Math.round(actualTotals.fats)}
              </td>
              <td className={`py-3 px-3 text-right font-medium ${fatsVariance.color}`}>
                <div className="flex items-center justify-end gap-1">
                  <fatsVariance.icon className="h-4 w-4" />
                  <span>{fatsVariance.percentage > 0 ? '+' : ''}{fatsVariance.percentage}%</span>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Legend */}
      <div className="mt-4 pt-4 border-t border-gray-200">
        <p className="text-xs text-gray-600 mb-2">Color Guide:</p>
        <div className="flex flex-wrap gap-4 text-xs">
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded-full bg-green-500"></div>
            <span className="text-gray-700">Within ±10%</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
            <span className="text-gray-700">Within ±20%</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded-full bg-red-500"></div>
            <span className="text-gray-700">Over ±20%</span>
          </div>
        </div>
      </div>

      {/* Warning for No Tracking */}
      {trackedMeals === 0 && (
        <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded text-sm text-yellow-800">
          No meals tracked yet. Track your meals above to see accurate totals.
        </div>
      )}

      {/* Warning for All Skipped */}
      {actualTotals.calories === 0 && trackedMeals > 0 && (
        <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded text-sm text-red-800">
          Warning: You haven't consumed any calories today. Make sure you're eating enough!
        </div>
      )}
    </div>
  );
}
```

---

## TypeScript Types

**File:** `src/types/tracking.ts`

```typescript
/**
 * TypeScript type definitions for meal tracking.
 *
 * These types mirror the Pydantic schemas from the backend to ensure
 * type safety across the full stack.
 */

export type TrackingStatus = 'ate_as_planned' | 'skipped' | 'ate_something_else';

export interface NutritionTotals {
  calories: number;
  protein: number;
  carbs: number;
  fats: number;
}

export interface MealWithTracking {
  // Meal information
  meal_id: number;
  meal_type: string;
  dish_name: string;
  calories: number;
  protein: number;
  carbs: number;
  fats: number;

  // Tracking information (nullable if not tracked)
  tracking_id: number | null;
  status: TrackingStatus | null;
  alt_description: string | null;
  alt_calories: number | null;
  alt_protein: number | null;
  alt_carbs: number | null;
  alt_fats: number | null;
  tracked_at: string | null;
}

export interface DailyTrackingResponse {
  date: string; // YYYY-MM-DD format
  meals: MealWithTracking[];
  planned_totals: NutritionTotals;
  actual_totals: NutritionTotals;
  adherence_percentage: number;
}

export interface WeeklyTrackingResponse {
  plan_id: number;
  days: DailyTrackingResponse[];
  weekly_adherence: number;
  weekly_planned_totals: NutritionTotals;
  weekly_actual_totals: NutritionTotals;
}

export interface MealTrackingCreate {
  status: TrackingStatus;
  alt_description?: string;
  alt_calories?: number;
  alt_protein?: number;
  alt_carbs?: number;
  alt_fats?: number;
}

export interface MealTrackingUpdate extends Partial<MealTrackingCreate> {}
```

---

## Data Flow Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                      MEAL TRACKING FLOW                         │
└─────────────────────────────────────────────────────────────────┘

1. PAGE LOAD
   User opens /tracking
        ↓
   Component requests today's date
        ↓
   GET /tracking/daily/2025-01-15
        ↓
   Backend fetches meals + LEFT JOIN meal_tracking
        ↓
   Returns DailyTrackingResponse
        ↓
   UI renders meals (some tracked, some untracked)

2. QUICK TRACKING (Ate as Planned / Skipped)
   User clicks "Ate as Planned" button
        ↓
   Check if meal already tracked
        ↓
   If NEW: POST /tracking/{meal_id} {status: "ate_as_planned"}
   If UPDATE: PUT /tracking/{meal_id} {status: "ate_as_planned"}
        ↓
   Optimistic UI update (instant feedback)
        ↓
   Backend creates/updates MealTracking record
        ↓
   Returns MealTrackingResponse
        ↓
   UI refreshes full daily data to recalculate totals

3. ALTERNATIVE MEAL TRACKING
   User clicks "Ate Something Else"
        ↓
   Expand AlternativeMealInput component inline
        ↓
   User fills: description, calories, (optional: protein/carbs/fats)
        ↓
   Click "Save"
        ↓
   Validate: description & calories required
        ↓
   POST/PUT /tracking/{meal_id} {
     status: "ate_something_else",
     alt_description: "...",
     alt_calories: 650,
     ...
   }
        ↓
   Backend validates & saves
        ↓
   Returns MealTrackingResponse
        ↓
   UI collapses form, shows alt meal info in orange box

4. NUTRITION CALCULATION
   Frontend displays actual totals:
        ↓
   For each meal:
     - status === "ate_as_planned" → add planned nutrition
     - status === "skipped" → add 0
     - status === "ate_something_else" → add alt_calories/macros
        ↓
   Sum all → display in DailySummaryCard
        ↓
   Calculate variance: (actual - planned) / planned × 100%
        ↓
   Color code: green (±10%), yellow (±20%), red (>20%)

5. DATE NAVIGATION
   User clicks Previous Day arrow
        ↓
   selectedDate = subDays(selectedDate, 1)
        ↓
   useEffect triggers → GET /tracking/daily/{new-date}
        ↓
   Re-render with new date's data
        ↓
   Check if date is within active plan's week
        ↓
   If outside: show "No plan for this date" message
```

---

## Edge Cases & Error Handling

### 1. No Active Meal Plan
**Scenario:** User navigates to tracking page without generating a plan.

**Handling:**
- GET /tracking/daily/{date} returns 404
- UI displays: "No active meal plan found. Please generate a meal plan first."
- Show "Generate Meal Plan" button linking to /plans/generate

### 2. Date Outside Plan Week
**Scenario:** User tries to view tracking for a date not in the current plan.

**Handling:**
- Backend validates: `start_date <= target_date <= end_date`
- Returns 404 with message: "No meal plan exists for {date}. Current plan covers {start} to {end}."
- UI disables date picker for dates outside plan range

### 3. Duplicate Tracking Attempt
**Scenario:** User (or buggy UI) tries to POST tracking for already-tracked meal.

**Handling:**
- Backend checks: `SELECT * FROM meal_tracking WHERE meal_id = ?`
- If exists: return 409 Conflict with message "Already tracked. Use PUT to update."
- Frontend should always check meal.tracking_id before deciding POST vs PUT

### 4. Incomplete Alternative Meal Data
**Scenario:** User selects "Ate Something Else" but doesn't fill required fields.

**Handling:**
- Frontend validation: prevent form submission if description or calories empty
- Backend validation: Pydantic schema raises 422 if missing
- UI shows inline error messages: "Please describe what you ate" / "Please enter valid calories"

### 5. All Meals Skipped
**Scenario:** User marks all meals as "skipped" → actual nutrition = 0.

**Handling:**
- DailySummaryCard shows warning banner: "You haven't consumed any calories today!"
- Adherence = 0%
- Actual totals = 0 for all nutrients

### 6. Partial Tracking
**Scenario:** User tracks only 3 out of 6 meals.

**Handling:**
- Show tracking count: "3 of 6 meals tracked"
- Adherence calculation only includes tracked meals
- Untracked meals don't affect actual totals
- Progress bar reflects partial completion

### 7. Updating from "Ate Something Else" to "Ate as Planned"
**Scenario:** User changes mind after logging alternative meal.

**Handling:**
- PUT /tracking/{meal_id} {status: "ate_as_planned"}
- Backend updates status, but alt_* fields remain in database (ignored)
- UI hides orange alt meal box, shows green checkmark
- Actual nutrition switches from alt values to planned values

### 8. Network Failure During Tracking
**Scenario:** API call fails after optimistic update.

**Handling:**
- Catch error in try/catch
- Revert optimistic UI update
- Re-fetch daily data from server (source of truth)
- Show alert: "Failed to save tracking. Please try again."

### 9. Zero Planned Nutrition
**Scenario:** Edge case where planned nutrition is 0 (shouldn't happen, but handle gracefully).

**Handling:**
- Variance calculation: if planned === 0, return { percentage: 0, color: 'gray', icon: Minus }
- Prevents division by zero
- Display "N/A" instead of percentage

### 10. Date Picker Constraints
**Scenario:** User tries to pick a date months in the future.

**Handling:**
- Date picker should be constrained to active plan's week
- Disable dates outside: `start_date` to `end_date + 6 days`
- If no active plan: disable all dates, show message

---

## Verification Checklist

### Backend API Tests

- [ ] **POST /tracking/{meal_id}**
  - [ ] Creates new tracking record with status "ate_as_planned"
  - [ ] Creates with status "skipped"
  - [ ] Creates with status "ate_something_else" + valid alt data
  - [ ] Returns 404 for non-existent meal_id
  - [ ] Returns 409 if meal already tracked
  - [ ] Returns 422 if alt_description missing when status="ate_something_else"
  - [ ] Returns 422 if alt_calories missing when status="ate_something_else"

- [ ] **PUT /tracking/{meal_id}**
  - [ ] Updates existing tracking status
  - [ ] Updates alternative meal data
  - [ ] Returns 404 if meal not tracked yet
  - [ ] Validates alt fields when changing to "ate_something_else"
  - [ ] Allows changing from "ate_something_else" to "ate_as_planned"

- [ ] **GET /tracking/daily/{date}**
  - [ ] Returns all meals for the date with tracking status (null if untracked)
  - [ ] Calculates planned_totals correctly
  - [ ] Calculates actual_totals correctly (ate_as_planned, skipped, ate_something_else)
  - [ ] Calculates adherence_percentage correctly
  - [ ] Returns 404 if no active plan exists
  - [ ] Returns 404 if date outside plan's week
  - [ ] Returns 400 for invalid date format

- [ ] **GET /tracking/weekly/{plan_id}**
  - [ ] Returns all 7 days of tracking data
  - [ ] Calculates weekly_planned_totals correctly
  - [ ] Calculates weekly_actual_totals correctly
  - [ ] Calculates weekly_adherence as average across all meals
  - [ ] Returns 404 for non-existent plan_id

### Service Layer Tests

- [ ] **calculate_actual_nutrition()**
  - [ ] Sums planned nutrition for "ate_as_planned" meals
  - [ ] Returns 0 for "skipped" meals
  - [ ] Uses alt_calories/macros for "ate_something_else" meals
  - [ ] Handles null alt_protein/carbs/fats gracefully
  - [ ] Returns NutritionTotals(0,0,0,0) for empty meal list

- [ ] **calculate_adherence()**
  - [ ] Returns 0.0 for no meals
  - [ ] Returns 100.0 when all meals ate_as_planned
  - [ ] Returns 0.0 when all meals skipped
  - [ ] Returns correct percentage for mixed statuses
  - [ ] Rounds to 2 decimal places

### Frontend Tests

- [ ] **Tracking Page**
  - [ ] Loads daily tracking data on mount (today's date)
  - [ ] Displays all meals with correct tracking status
  - [ ] Shows "No meal plan" message when plan doesn't exist
  - [ ] Shows "No plan for this date" when date outside plan week
  - [ ] Date navigation updates URL and fetches new data
  - [ ] Optimistic updates work for quick tracking
  - [ ] Reverts optimistic update on API failure

- [ ] **MealTrackingRow**
  - [ ] Untracked meal shows all three buttons enabled
  - [ ] "Ate as Planned" click sends POST/PUT and updates UI
  - [ ] "Skipped" click sends POST/PUT and updates UI
  - [ ] "Ate Something Else" click expands AlternativeMealInput
  - [ ] Visual states (green/red/orange borders) match tracking status
  - [ ] Displays alt meal info in orange box when status="ate_something_else"
  - [ ] Strikethrough text when status="skipped"

- [ ] **AlternativeMealInput**
  - [ ] Quick-fill suggestions populate form correctly
  - [ ] Form validation prevents submission without description/calories
  - [ ] Optional macro fields allow empty values
  - [ ] Cancel button collapses form without saving
  - [ ] Submit sends correct data to parent handler
  - [ ] Shows validation error messages inline

- [ ] **DailySummaryCard**
  - [ ] Displays planned vs actual nutrition side-by-side
  - [ ] Calculates variance percentages correctly
  - [ ] Color codes variances (green ±10%, yellow ±20%, red >20%)
  - [ ] Shows adherence badge with correct color
  - [ ] Shows tracking completion count (X of Y meals)
  - [ ] Displays warning when all meals skipped
  - [ ] Displays warning when no meals tracked

### Integration Tests

- [ ] **End-to-End Tracking Flow**
  - [ ] Generate meal plan → navigate to tracking → track all meals → verify totals
  - [ ] Track meal as "ate_as_planned" → verify actual = planned
  - [ ] Track meal as "skipped" → verify actual = 0
  - [ ] Track meal as "ate_something_else" → verify actual = alt values
  - [ ] Change tracking status → verify recalculation
  - [ ] Navigate between dates → verify data persistence
  - [ ] View weekly summary → verify aggregation

- [ ] **Error Recovery**
  - [ ] Network timeout during POST → shows error, allows retry
  - [ ] Invalid date format → shows 400 error message
  - [ ] Duplicate POST attempt → shows 409 error, suggests PUT
  - [ ] Missing required fields → shows 422 validation errors

---

## Performance Considerations

### Backend Optimizations

1. **Database Indexing**
   - Index on `meal_tracking.meal_id` for fast lookups
   - Index on `meal_tracking.status` for adherence queries
   - Composite index on `daily_plan(plan_id, date)` for date range queries

2. **Query Optimization**
   - LEFT JOIN meals with tracking in single query (avoid N+1)
   - Use `select_related()` / `joinedload()` for ORM queries
   - Consider caching weekly tracking data (refreshed on updates)

3. **Response Size**
   - Weekly endpoint returns 7 days × meals → potentially large response
   - Consider pagination or lazy loading for historical data
   - Compress JSON responses (gzip)

### Frontend Optimizations

1. **Optimistic Updates**
   - Immediate UI feedback for better UX
   - Rollback on failure to maintain consistency

2. **Data Caching**
   - Cache daily tracking data to avoid refetching on unmount/remount
   - Use React Query or SWR for intelligent caching

3. **Lazy Loading**
   - Only load current day by default
   - Load weekly data on demand when user navigates to weekly view

4. **Debouncing**
   - If implementing live nutrition input, debounce API calls
   - Batch multiple quick changes into single update

---

## Security Considerations

### Input Validation

1. **SQL Injection Prevention**
   - Use parameterized queries (SQLAlchemy ORM handles this)
   - Never concatenate user input into SQL strings

2. **XSS Prevention**
   - Sanitize `alt_description` before rendering in UI
   - React escapes JSX by default, but be cautious with `dangerouslySetInnerHTML`

3. **Data Bounds**
   - Enforce max lengths: `alt_description` ≤ 500 chars
   - Enforce numeric bounds: calories ≤ 10000, macros ≤ 1000g
   - Prevent negative values (ge=0 in Pydantic)

### Authentication & Authorization

1. **User Isolation**
   - TODO: Filter meal plans and tracking by authenticated user_id
   - Prevent users from tracking other users' meals

2. **Rate Limiting**
   - Implement rate limiting on tracking endpoints (e.g., 100 req/min)
   - Prevent abuse via automated tracking bots

3. **Data Privacy**
   - Meal tracking data is sensitive health information
   - Ensure HTTPS in production
   - Consider encryption at rest for PII

---

## Future Enhancements

1. **Photo Logging**
   - Allow users to upload meal photos alongside tracking
   - Store in S3/CloudStorage with meal_tracking_id reference

2. **Voice Input**
   - "I ate a chicken salad, about 450 calories"
   - Use speech-to-text API to populate alt meal form

3. **Barcode Scanning**
   - Scan packaged food barcodes to auto-fill nutrition data
   - Integrate with food database APIs (USDA, Open Food Facts)

4. **AI-Powered Estimation**
   - User describes meal: "Large burger with fries"
   - AI estimates calories/macros using GPT-4 Vision or similar

5. **Historical Trends**
   - Line charts showing adherence over time
   - Average daily calorie intake trends
   - Weekly comparison (this week vs last week)

6. **Reminder Notifications**
   - Push notifications: "Don't forget to track lunch!"
   - Email summaries: "You tracked 85% of meals this week"

7. **Social Features**
   - Share meal plans with friends
   - Track accountability with a buddy system

8. **Export Data**
   - Export tracking history to CSV/PDF
   - Integration with health apps (Apple Health, Google Fit)

---

## Summary

Phase 4 implements comprehensive meal tracking functionality that enables users to log their actual food consumption against planned meals. The system supports three tracking states (ate as planned, skipped, ate something else), calculates real-time nutrition adherence, and provides visual feedback through planned vs. actual comparisons.

**Key Technical Achievements:**
- Robust backend with service layer for business logic separation
- Optimistic UI updates for instant feedback
- Comprehensive validation and error handling
- Scalable aggregation for daily and weekly analytics
- Production-ready code with security best practices

**Next Steps:**
- Implement Phase 5: Dashboard (displaying tracking trends and insights)
- Add user authentication and multi-user support
- Deploy backend and frontend to production environments
- Set up monitoring and analytics

This document provides a complete implementation guide for development teams to build the meal tracking feature from scratch.
