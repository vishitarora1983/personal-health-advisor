# 03 — Profile System (Phase 2)

## Overview

Phase 2 implements a comprehensive user profile system that collects health metrics, dietary preferences, cooking constraints, and automatically calculates personalized nutrition targets. This forms the foundation for personalized meal planning in subsequent phases.

The profile system captures:
- **Basic Health Metrics**: Age, gender, height, weight, activity level
- **Health Goals**: Weight goals, medical objectives (diabetes, heart health, etc.)
- **Dietary Preferences**: Diet type, allergies, foods to avoid
- **Cooking Constraints**: Skill level, time availability, cuisine preferences
- **Nutrition Targets**: Auto-calculated BMR, TDEE, and macro targets with manual override capability

## Backend Implementation

### 1. Pydantic Schemas (backend/schemas/profile.py)

Complete schema definitions with comprehensive validation:

```python
"""
Profile schemas for user profile management.

Handles validation and serialization for user health metrics, dietary preferences,
and nutrition targets. Includes comprehensive field validation and business rule
enforcement.
"""

from typing import Optional, Literal
from pydantic import BaseModel, Field, field_validator, model_validator
from datetime import datetime


class ProfileBase(BaseModel):
    """
    Base profile schema with shared fields and validation.

    Enforces data integrity for health metrics, dietary preferences, and cooking
    constraints. All numeric fields have realistic bounds to prevent data entry errors.
    """

    # Basic Health Metrics
    age: int = Field(ge=13, le=120, description="User age in years")
    gender: Literal["male", "female", "other"]
    height_cm: float = Field(ge=100, le=250, description="Height in centimeters")
    weight_kg: float = Field(ge=30, le=300, description="Weight in kilograms")
    activity_level: Literal[
        "sedentary",
        "lightly_active",
        "moderately_active",
        "very_active",
        "extra_active"
    ]
    household_size: int = Field(ge=1, le=10, default=1, description="Number of people to cook for")

    # Health Goals
    weight_goal: Literal["lose", "maintain", "gain"]
    medical_goals: Optional[list[str]] = Field(
        default=None,
        description="Medical/fitness goals: diabetes_management, heart_health, high_protein, muscle_building, general_wellness"
    )

    # Dietary Preferences
    diet_type: Literal[
        "none",
        "vegetarian",
        "vegan",
        "keto",
        "paleo",
        "mediterranean",
        "pescatarian"
    ] = "none"
    allergies: Optional[list[str]] = Field(
        default=None,
        description="Food allergies: peanuts, tree_nuts, dairy, eggs, shellfish, soy, wheat, fish"
    )
    foods_to_avoid: Optional[str] = Field(
        default=None,
        max_length=500,
        description="Free-text list of foods to avoid"
    )

    # Cooking Preferences
    spice_tolerance: Literal["mild", "medium", "hot"] = "medium"
    cooking_skill: Literal["beginner", "intermediate", "advanced"] = "intermediate"
    max_cook_time: int = Field(
        ge=10,
        le=120,
        default=45,
        description="Maximum cooking time in minutes"
    )
    cuisines: Optional[list[str]] = Field(
        default=None,
        description="Preferred cuisines: indian, italian, mexican, chinese, japanese, thai, mediterranean, american, middle_eastern, korean, french, other"
    )

    # Meal Planning Preferences
    meals_per_day: list[str] = Field(
        min_length=1,
        description="Meals to plan: breakfast, lunch, dinner"
    )
    snacks_per_day: int = Field(ge=0, le=3, default=1)

    # Manual Nutrition Target Overrides (optional)
    target_calories: Optional[int] = Field(default=None, ge=800, le=5000)
    target_protein: Optional[int] = Field(default=None, ge=20, le=400, description="Grams")
    target_carbs: Optional[int] = Field(default=None, ge=20, le=600, description="Grams")
    target_fats: Optional[int] = Field(default=None, ge=20, le=250, description="Grams")
    target_fiber: Optional[int] = Field(default=None, ge=10, le=100, description="Grams")
    target_sodium: Optional[int] = Field(default=None, ge=500, le=5000, description="Milligrams")
    target_sugar: Optional[int] = Field(default=None, ge=10, le=150, description="Grams")

    @field_validator("meals_per_day")
    @classmethod
    def validate_meals(cls, v: list[str]) -> list[str]:
        """
        Validate and normalize meal types.

        Ensures only valid meal types are specified and normalizes to lowercase.
        Prevents duplicate meal entries.
        """
        allowed_meals = {"breakfast", "lunch", "dinner"}
        normalized = [meal.lower().strip() for meal in v]

        for meal in normalized:
            if meal not in allowed_meals:
                raise ValueError(
                    f"Invalid meal type: {meal}. Allowed: {', '.join(allowed_meals)}"
                )

        # Remove duplicates while preserving order
        seen = set()
        unique_meals = []
        for meal in normalized:
            if meal not in seen:
                seen.add(meal)
                unique_meals.append(meal)

        if not unique_meals:
            raise ValueError("At least one meal type must be specified")

        return unique_meals

    @field_validator("medical_goals", "allergies", "cuisines")
    @classmethod
    def normalize_list_fields(cls, v: Optional[list[str]]) -> Optional[list[str]]:
        """
        Normalize list fields to lowercase and remove duplicates.

        Ensures consistent data storage and prevents duplicate entries.
        """
        if v is None:
            return None

        normalized = [item.lower().strip() for item in v if item.strip()]

        # Remove duplicates while preserving order
        seen = set()
        unique_items = []
        for item in normalized:
            if item not in seen:
                seen.add(item)
                unique_items.append(item)

        return unique_items if unique_items else None

    @model_validator(mode="after")
    def validate_manual_macros(self):
        """
        Validate manual macro overrides sum to target calories.

        When all macros are manually set, verifies they align with target calories
        using standard conversion factors (protein/carbs: 4 cal/g, fats: 9 cal/g).
        Allows 10% margin for rounding and user flexibility.
        """
        if not self.target_calories:
            return self

        # Check if all macros are manually set
        has_all_macros = all([
            self.target_protein is not None,
            self.target_carbs is not None,
            self.target_fats is not None
        ])

        if has_all_macros:
            # Calculate calories from macros (protein: 4 cal/g, carbs: 4 cal/g, fats: 9 cal/g)
            macro_calories = (
                (self.target_protein * 4) +
                (self.target_carbs * 4) +
                (self.target_fats * 9)
            )

            # Allow 10% margin for rounding
            lower_bound = self.target_calories * 0.9
            upper_bound = self.target_calories * 1.1

            if not (lower_bound <= macro_calories <= upper_bound):
                raise ValueError(
                    f"Manual macros ({macro_calories} cal) don't match target calories "
                    f"({self.target_calories} cal). Please adjust your macro targets."
                )

        return self


class ProfileCreate(ProfileBase):
    """Schema for creating a new profile."""
    pass


class ProfileUpdate(BaseModel):
    """
    Schema for partial profile updates.

    All fields are optional to support PATCH-style updates where only
    changed fields are submitted.
    """

    # Basic Health Metrics
    age: Optional[int] = Field(default=None, ge=13, le=120)
    gender: Optional[Literal["male", "female", "other"]] = None
    height_cm: Optional[float] = Field(default=None, ge=100, le=250)
    weight_kg: Optional[float] = Field(default=None, ge=30, le=300)
    activity_level: Optional[Literal[
        "sedentary",
        "lightly_active",
        "moderately_active",
        "very_active",
        "extra_active"
    ]] = None
    household_size: Optional[int] = Field(default=None, ge=1, le=10)

    # Health Goals
    weight_goal: Optional[Literal["lose", "maintain", "gain"]] = None
    medical_goals: Optional[list[str]] = None

    # Dietary Preferences
    diet_type: Optional[Literal[
        "none",
        "vegetarian",
        "vegan",
        "keto",
        "paleo",
        "mediterranean",
        "pescatarian"
    ]] = None
    allergies: Optional[list[str]] = None
    foods_to_avoid: Optional[str] = Field(default=None, max_length=500)

    # Cooking Preferences
    spice_tolerance: Optional[Literal["mild", "medium", "hot"]] = None
    cooking_skill: Optional[Literal["beginner", "intermediate", "advanced"]] = None
    max_cook_time: Optional[int] = Field(default=None, ge=10, le=120)
    cuisines: Optional[list[str]] = None

    # Meal Planning Preferences
    meals_per_day: Optional[list[str]] = Field(default=None, min_length=1)
    snacks_per_day: Optional[int] = Field(default=None, ge=0, le=3)

    # Manual Nutrition Target Overrides
    target_calories: Optional[int] = Field(default=None, ge=800, le=5000)
    target_protein: Optional[int] = Field(default=None, ge=20, le=400)
    target_carbs: Optional[int] = Field(default=None, ge=20, le=600)
    target_fats: Optional[int] = Field(default=None, ge=20, le=250)
    target_fiber: Optional[int] = Field(default=None, ge=10, le=100)
    target_sodium: Optional[int] = Field(default=None, ge=500, le=5000)
    target_sugar: Optional[int] = Field(default=None, ge=10, le=150)

    # Use the same validators as ProfileBase
    _validate_meals = field_validator("meals_per_day")(ProfileBase.validate_meals.__func__)
    _normalize_lists = field_validator("medical_goals", "allergies", "cuisines")(
        ProfileBase.normalize_list_fields.__func__
    )


class ProfileResponse(ProfileBase):
    """
    Schema for profile API responses.

    Includes database metadata fields (id, timestamps) in addition to user data.
    """
    id: int
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class NutritionTargets(BaseModel):
    """
    Calculated or manually-set nutrition targets.

    BMR: Basal Metabolic Rate - calories burned at rest
    TDEE: Total Daily Energy Expenditure - BMR adjusted for activity level
    Target values: Daily intake goals for calories and macronutrients
    """
    bmr: float = Field(description="Basal Metabolic Rate in calories")
    tdee: float = Field(description="Total Daily Energy Expenditure in calories")
    target_calories: int = Field(description="Daily calorie target")
    target_protein: int = Field(description="Daily protein target in grams")
    target_carbs: int = Field(description="Daily carbohydrate target in grams")
    target_fats: int = Field(description="Daily fat target in grams")
    target_fiber: int = Field(description="Daily fiber target in grams")
    target_sodium: int = Field(description="Daily sodium target in milligrams")
    target_sugar: int = Field(description="Daily sugar target in grams")
    macro_split: dict[str, int] = Field(
        description="Macronutrient percentage split: protein, carbs, fats"
    )

    @field_validator("macro_split")
    @classmethod
    def validate_macro_split(cls, v: dict[str, int]) -> dict[str, int]:
        """
        Validate macro split percentages sum to 100.

        Ensures proper macro distribution for meal planning algorithms.
        """
        required_keys = {"protein", "carbs", "fats"}
        if set(v.keys()) != required_keys:
            raise ValueError(f"macro_split must contain exactly: {required_keys}")

        total = sum(v.values())
        if total != 100:
            raise ValueError(
                f"Macro percentages must sum to 100, got {total}: {v}"
            )

        return v
```

### 2. Nutrition Calculator Service (backend/services/nutrition_calculator.py)

Complete nutrition calculation service with evidence-based algorithms:

```python
"""
Nutrition calculation service.

Implements evidence-based algorithms for calculating personalized nutrition targets:
- BMR: Mifflin-St Jeor equation (most accurate for modern populations)
- TDEE: BMR adjusted by activity level multiplier
- Macros: Customized based on diet type and medical goals
- Micronutrients: Based on gender and health objectives

All calculations respect manual overrides when provided.
"""

from typing import Optional
from backend.models.user_profile import UserProfile
from backend.schemas.profile import NutritionTargets


# Activity level multipliers based on Harris-Benedict equation
ACTIVITY_MULTIPLIERS = {
    "sedentary": 1.2,              # Little to no exercise
    "lightly_active": 1.375,       # Light exercise 1-3 days/week
    "moderately_active": 1.55,     # Moderate exercise 3-5 days/week
    "very_active": 1.725,          # Hard exercise 6-7 days/week
    "extra_active": 1.9,           # Very hard exercise, physical job
}

# Calorie adjustments for weight goals (daily deficit/surplus)
GOAL_ADJUSTMENTS = {
    "lose": -500,      # 0.5 kg/week loss (safe, sustainable)
    "maintain": 0,     # Maintain current weight
    "gain": 300,       # 0.25 kg/week gain (lean muscle focus)
}

# Medical goal-specific macro distributions (percent of calories)
# Prioritized over diet type when specified
MEDICAL_GOAL_MACROS = {
    "high_protein": {
        "protein": 40,   # Enhanced protein for satiety/muscle
        "carbs": 30,
        "fats": 30
    },
    "diabetes_management": {
        "protein": 30,
        "carbs": 35,     # Controlled carbs for blood sugar
        "fats": 35       # Healthy fats for satiety
    },
    "heart_health": {
        "protein": 25,
        "carbs": 50,
        "fats": 25       # Lower fat for cardiovascular health
    },
    "muscle_building": {
        "protein": 40,   # High protein for muscle synthesis
        "carbs": 35,     # Adequate carbs for energy
        "fats": 25
    },
}

# Diet type-specific macro distributions
DIET_TYPE_MACROS = {
    "keto": {
        "protein": 25,
        "carbs": 5,      # Ketogenic low-carb
        "fats": 70       # High fat for ketosis
    },
    "paleo": {
        "protein": 30,
        "carbs": 35,
        "fats": 35
    },
    "vegan": {
        "protein": 20,   # Plant-based protein
        "carbs": 55,     # Higher carbs from whole grains/legumes
        "fats": 25
    },
    "vegetarian": {
        "protein": 25,
        "carbs": 45,
        "fats": 30
    },
    "mediterranean": {
        "protein": 25,
        "carbs": 45,
        "fats": 30       # Healthy fats from olive oil, nuts
    },
    "pescatarian": {
        "protein": 30,   # Fish protein
        "carbs": 40,
        "fats": 30
    },
}

# Default balanced macro split
DEFAULT_MACROS = {
    "protein": 30,
    "carbs": 40,
    "fats": 30
}


def calculate_bmr(
    weight_kg: float,
    height_cm: float,
    age: int,
    gender: str
) -> float:
    """
    Calculate Basal Metabolic Rate using Mifflin-St Jeor equation.

    This is the most accurate BMR formula for contemporary populations,
    accounting for the decrease in average physical activity compared to
    older formulas like Harris-Benedict.

    Formula:
    - Male: BMR = 10 * weight(kg) + 6.25 * height(cm) - 5 * age(years) + 5
    - Female: BMR = 10 * weight(kg) + 6.25 * height(cm) - 5 * age(years) - 161
    - Other: Average of male and female calculations

    Args:
        weight_kg: Body weight in kilograms
        height_cm: Height in centimeters
        age: Age in years
        gender: Biological gender (male, female, other)

    Returns:
        BMR in calories per day
    """
    base = (10 * weight_kg) + (6.25 * height_cm) - (5 * age)

    if gender == "male":
        return base + 5
    elif gender == "female":
        return base - 161
    else:
        # For non-binary, use average of male and female
        return (base + 5 + base - 161) / 2


def calculate_tdee(bmr: float, activity_level: str) -> float:
    """
    Calculate Total Daily Energy Expenditure.

    Adjusts BMR by activity level multiplier to estimate actual daily
    calorie burn including exercise and daily activities.

    Args:
        bmr: Basal Metabolic Rate
        activity_level: Activity level key (sedentary, lightly_active, etc.)

    Returns:
        TDEE in calories per day
    """
    multiplier = ACTIVITY_MULTIPLIERS.get(activity_level, 1.2)
    return bmr * multiplier


def get_macro_split(
    diet_type: str,
    medical_goals: Optional[list[str]]
) -> dict[str, int]:
    """
    Determine optimal macro split based on diet type and medical goals.

    Priority hierarchy:
    1. Medical goals (highest priority for health outcomes)
    2. Diet type (lifestyle preference)
    3. Default balanced split

    When multiple medical goals exist, uses the first matching goal in
    priority order: high_protein > muscle_building > diabetes_management > heart_health

    Args:
        diet_type: Dietary pattern (vegan, keto, etc.)
        medical_goals: List of health objectives

    Returns:
        Dictionary with protein, carbs, fats percentages (sum to 100)
    """
    # Priority 1: Medical goals
    if medical_goals:
        # Priority order for medical goals
        priority_goals = [
            "high_protein",
            "muscle_building",
            "diabetes_management",
            "heart_health"
        ]

        for goal in priority_goals:
            if goal in medical_goals:
                return MEDICAL_GOAL_MACROS[goal].copy()

    # Priority 2: Diet type
    if diet_type != "none" and diet_type in DIET_TYPE_MACROS:
        return DIET_TYPE_MACROS[diet_type].copy()

    # Priority 3: Default balanced
    return DEFAULT_MACROS.copy()


def calculate_macros(
    target_calories: int,
    macro_split: dict[str, int]
) -> dict[str, int]:
    """
    Convert macro percentages to gram targets.

    Uses standard conversion factors:
    - Protein: 4 calories per gram
    - Carbohydrates: 4 calories per gram
    - Fats: 9 calories per gram

    Args:
        target_calories: Daily calorie target
        macro_split: Percentage split (protein, carbs, fats)

    Returns:
        Dictionary with protein, carbs, fats in grams
    """
    return {
        "protein": round((target_calories * macro_split["protein"] / 100) / 4),
        "carbs": round((target_calories * macro_split["carbs"] / 100) / 4),
        "fats": round((target_calories * macro_split["fats"] / 100) / 9),
    }


def calculate_fiber_target(gender: str) -> int:
    """
    Calculate daily fiber target based on gender.

    Based on USDA Dietary Guidelines:
    - Male: 30-38g (using 30g as conservative target)
    - Female: 25-28g (using 25g as conservative target)
    - Other: Average of male and female

    Args:
        gender: Biological gender

    Returns:
        Daily fiber target in grams
    """
    if gender == "male":
        return 30
    elif gender == "female":
        return 25
    else:
        return 28  # Average


def calculate_sodium_target(medical_goals: Optional[list[str]]) -> int:
    """
    Calculate daily sodium target based on health goals.

    - Default: 2300mg (FDA recommendation)
    - Heart health: 1500mg (AHA recommendation for cardiovascular disease)

    Args:
        medical_goals: List of health objectives

    Returns:
        Daily sodium target in milligrams
    """
    if medical_goals and "heart_health" in medical_goals:
        return 1500  # AHA recommendation for heart disease prevention
    return 2300  # FDA general recommendation


def calculate_sugar_target(gender: str) -> int:
    """
    Calculate daily added sugar target based on gender.

    Based on AHA recommendations for added sugars:
    - Male: 36g (9 teaspoons)
    - Female: 25g (6 teaspoons)
    - Other: Average

    Note: This is added sugars, not total sugars from whole foods.

    Args:
        gender: Biological gender

    Returns:
        Daily added sugar target in grams
    """
    if gender == "male":
        return 36
    elif gender == "female":
        return 25
    else:
        return 30  # Average


def calculate_nutrition_targets(profile: UserProfile) -> NutritionTargets:
    """
    Calculate complete personalized nutrition targets.

    Main entry point for nutrition calculation. Respects manual overrides
    when provided, otherwise calculates based on health metrics and goals.

    Process:
    1. Calculate BMR (Mifflin-St Jeor)
    2. Calculate TDEE (BMR * activity multiplier)
    3. Adjust for weight goal (+/- calories)
    4. Determine macro split (medical goals > diet type > default)
    5. Calculate macro grams from percentages
    6. Calculate micronutrient targets
    7. Apply manual overrides if provided

    Args:
        profile: User profile with health metrics and preferences

    Returns:
        Complete nutrition targets with BMR, TDEE, and all macro/micro goals
    """
    # Step 1: Calculate BMR
    bmr = calculate_bmr(
        weight_kg=profile.weight_kg,
        height_cm=profile.height_cm,
        age=profile.age,
        gender=profile.gender
    )

    # Step 2: Calculate TDEE
    tdee = calculate_tdee(bmr, profile.activity_level)

    # Step 3: Adjust for weight goal
    goal_adjustment = GOAL_ADJUSTMENTS.get(profile.weight_goal, 0)
    calculated_calories = int(tdee + goal_adjustment)

    # Use manual override if provided, otherwise use calculated
    target_calories = profile.target_calories or calculated_calories

    # Step 4: Determine macro split
    macro_split = get_macro_split(
        diet_type=profile.diet_type,
        medical_goals=profile.medical_goals
    )

    # Step 5: Calculate macros from split
    macros = calculate_macros(target_calories, macro_split)

    # Apply manual overrides for macros if provided
    target_protein = profile.target_protein or macros["protein"]
    target_carbs = profile.target_carbs or macros["carbs"]
    target_fats = profile.target_fats or macros["fats"]

    # Step 6: Calculate micronutrient targets
    target_fiber = profile.target_fiber or calculate_fiber_target(profile.gender)
    target_sodium = profile.target_sodium or calculate_sodium_target(profile.medical_goals)
    target_sugar = profile.target_sugar or calculate_sugar_target(profile.gender)

    return NutritionTargets(
        bmr=round(bmr, 1),
        tdee=round(tdee, 1),
        target_calories=target_calories,
        target_protein=target_protein,
        target_carbs=target_carbs,
        target_fats=target_fats,
        target_fiber=target_fiber,
        target_sodium=target_sodium,
        target_sugar=target_sugar,
        macro_split=macro_split
    )
```

### 3. Profile Router (backend/routers/profile.py)

Complete REST API implementation with proper error handling:

```python
"""
Profile management API endpoints.

Provides CRUD operations for user profiles and nutrition target calculation.
Handles JSON field serialization for PostgreSQL storage.
"""

from typing import Optional
import json
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from backend.database import get_db
from backend.models.user_profile import UserProfile
from backend.schemas.profile import (
    ProfileCreate,
    ProfileUpdate,
    ProfileResponse,
    NutritionTargets
)
from backend.services.nutrition_calculator import calculate_nutrition_targets


router = APIRouter(prefix="/profile", tags=["profile"])


def serialize_json_field(value: Optional[list[str]]) -> Optional[str]:
    """
    Serialize list fields to JSON string for database storage.

    PostgreSQL doesn't natively support array types in all configurations,
    so we store lists as JSON strings for maximum compatibility.

    Args:
        value: List of strings or None

    Returns:
        JSON string or None
    """
    if value is None or (isinstance(value, list) and len(value) == 0):
        return None
    return json.dumps(value)


def deserialize_json_field(value: Optional[str]) -> Optional[list[str]]:
    """
    Deserialize JSON string from database to list.

    Handles edge cases:
    - None/empty string -> None
    - Invalid JSON -> None (with logging in production)

    Args:
        value: JSON string or None

    Returns:
        List of strings or None
    """
    if not value:
        return None
    try:
        return json.loads(value)
    except json.JSONDecodeError:
        # In production, this should be logged
        return None


@router.get("", response_model=ProfileResponse, status_code=status.HTTP_200_OK)
def get_profile(db: Session = Depends(get_db)) -> ProfileResponse:
    """
    Retrieve the user's profile.

    Currently supports single-user mode. In multi-user mode, this would
    filter by authenticated user ID from JWT token.

    Returns:
        User profile with all fields and metadata

    Raises:
        404: Profile not found (user needs to create one)
    """
    profile = db.query(UserProfile).first()

    if not profile:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Profile not found. Please create a profile first."
        )

    # Deserialize JSON fields for response
    profile_dict = {
        **profile.__dict__,
        "medical_goals": deserialize_json_field(profile.medical_goals),
        "allergies": deserialize_json_field(profile.allergies),
        "cuisines": deserialize_json_field(profile.cuisines),
        "meals_per_day": deserialize_json_field(profile.meals_per_day),
    }

    return ProfileResponse(**profile_dict)


@router.post("", response_model=ProfileResponse, status_code=status.HTTP_201_CREATED)
def create_profile(
    profile_data: ProfileCreate,
    db: Session = Depends(get_db)
) -> ProfileResponse:
    """
    Create a new user profile.

    Enforces single profile constraint in single-user mode. In multi-user mode,
    this would check for existing profile by user ID.

    Args:
        profile_data: Validated profile creation data

    Returns:
        Created profile with generated ID and timestamps

    Raises:
        409: Profile already exists
    """
    # Check if profile already exists (single-user mode)
    existing_profile = db.query(UserProfile).first()
    if existing_profile:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Profile already exists. Use PUT to update."
        )

    # Serialize JSON fields for database storage
    profile_dict = profile_data.model_dump()
    profile_dict["medical_goals"] = serialize_json_field(profile_dict.get("medical_goals"))
    profile_dict["allergies"] = serialize_json_field(profile_dict.get("allergies"))
    profile_dict["cuisines"] = serialize_json_field(profile_dict.get("cuisines"))
    profile_dict["meals_per_day"] = serialize_json_field(profile_dict.get("meals_per_day"))

    # Create and save profile
    new_profile = UserProfile(**profile_dict)
    db.add(new_profile)
    db.commit()
    db.refresh(new_profile)

    # Deserialize for response
    response_dict = {
        **new_profile.__dict__,
        "medical_goals": deserialize_json_field(new_profile.medical_goals),
        "allergies": deserialize_json_field(new_profile.allergies),
        "cuisines": deserialize_json_field(new_profile.cuisines),
        "meals_per_day": deserialize_json_field(new_profile.meals_per_day),
    }

    return ProfileResponse(**response_dict)


@router.put("", response_model=ProfileResponse, status_code=status.HTTP_200_OK)
def update_profile(
    profile_data: ProfileUpdate,
    db: Session = Depends(get_db)
) -> ProfileResponse:
    """
    Update existing user profile.

    Supports partial updates - only provided fields are modified.
    Handles JSON field serialization for list-type fields.

    Args:
        profile_data: Validated profile update data (all fields optional)

    Returns:
        Updated profile

    Raises:
        404: Profile not found (must create first)
    """
    # Get existing profile
    profile = db.query(UserProfile).first()
    if not profile:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Profile not found. Please create a profile first."
        )

    # Get only the fields that were actually set (not None)
    update_data = profile_data.model_dump(exclude_unset=True)

    # Serialize JSON fields if present in update
    if "medical_goals" in update_data:
        update_data["medical_goals"] = serialize_json_field(update_data["medical_goals"])
    if "allergies" in update_data:
        update_data["allergies"] = serialize_json_field(update_data["allergies"])
    if "cuisines" in update_data:
        update_data["cuisines"] = serialize_json_field(update_data["cuisines"])
    if "meals_per_day" in update_data:
        update_data["meals_per_day"] = serialize_json_field(update_data["meals_per_day"])

    # Update profile fields
    for field, value in update_data.items():
        setattr(profile, field, value)

    db.commit()
    db.refresh(profile)

    # Deserialize for response
    response_dict = {
        **profile.__dict__,
        "medical_goals": deserialize_json_field(profile.medical_goals),
        "allergies": deserialize_json_field(profile.allergies),
        "cuisines": deserialize_json_field(profile.cuisines),
        "meals_per_day": deserialize_json_field(profile.meals_per_day),
    }

    return ProfileResponse(**response_dict)


@router.get("/nutrition-targets", response_model=NutritionTargets, status_code=status.HTTP_200_OK)
def get_nutrition_targets(db: Session = Depends(get_db)) -> NutritionTargets:
    """
    Calculate personalized nutrition targets.

    Returns calculated BMR, TDEE, and macro/micronutrient targets based on
    user's health metrics, activity level, and goals. Respects manual overrides
    when provided.

    Used by:
    - Profile page to preview nutrition targets
    - Meal planning algorithm to set nutritional constraints

    Returns:
        Complete nutrition targets

    Raises:
        404: Profile not found
    """
    profile = db.query(UserProfile).first()

    if not profile:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Profile not found. Please create a profile first."
        )

    # Deserialize JSON fields for calculation
    profile.medical_goals = deserialize_json_field(profile.medical_goals)

    # Calculate and return targets
    return calculate_nutrition_targets(profile)
```

## Frontend Implementation

### 1. Profile Page (src/app/profile/page.tsx)

Main profile management page with tabbed form interface:

```typescript
"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import BasicInfoForm from "@/components/profile/BasicInfoForm";
import HealthGoalsForm from "@/components/profile/HealthGoalsForm";
import DietaryPrefsForm from "@/components/profile/DietaryPrefsForm";
import CookingPrefsForm from "@/components/profile/CookingPrefsForm";
import { toast } from "react-hot-toast";

interface ProfileFormData {
  // Basic Health Metrics
  age?: number;
  gender?: "male" | "female" | "other";
  height_cm?: number;
  weight_kg?: number;
  activity_level?: "sedentary" | "lightly_active" | "moderately_active" | "very_active" | "extra_active";
  household_size?: number;

  // Health Goals
  weight_goal?: "lose" | "maintain" | "gain";
  medical_goals?: string[];

  // Manual Overrides
  target_calories?: number;
  target_protein?: number;
  target_carbs?: number;
  target_fats?: number;
  target_fiber?: number;
  target_sodium?: number;
  target_sugar?: number;

  // Dietary Preferences
  diet_type?: "none" | "vegetarian" | "vegan" | "keto" | "paleo" | "mediterranean" | "pescatarian";
  allergies?: string[];
  foods_to_avoid?: string;

  // Cooking Preferences
  spice_tolerance?: "mild" | "medium" | "hot";
  cooking_skill?: "beginner" | "intermediate" | "advanced";
  max_cook_time?: number;
  cuisines?: string[];
  meals_per_day?: string[];
  snacks_per_day?: number;
}

interface NutritionTargets {
  bmr: number;
  tdee: number;
  target_calories: number;
  target_protein: number;
  target_carbs: number;
  target_fats: number;
  target_fiber: number;
  target_sodium: number;
  target_sugar: number;
  macro_split: { protein: number; carbs: number; fats: number };
}

const SECTION_TITLES = [
  "Basic Information",
  "Health Goals",
  "Dietary Preferences",
  "Cooking Preferences"
];

export default function ProfilePage() {
  const router = useRouter();

  const [formData, setFormData] = useState<ProfileFormData>({
    household_size: 1,
    diet_type: "none",
    spice_tolerance: "medium",
    cooking_skill: "intermediate",
    max_cook_time: 45,
    snacks_per_day: 1,
    meals_per_day: ["breakfast", "lunch", "dinner"],
    medical_goals: [],
    allergies: [],
    cuisines: [],
  });

  const [isExistingProfile, setIsExistingProfile] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});
  const [activeSection, setActiveSection] = useState(0);
  const [nutritionTargets, setNutritionTargets] = useState<NutritionTargets | null>(null);

  // Load existing profile on mount
  useEffect(() => {
    fetchProfile();
  }, []);

  const fetchProfile = async () => {
    try {
      setIsLoading(true);
      const response = await fetch("/api/profile");

      if (response.status === 200) {
        const data = await response.json();
        setFormData(data);
        setIsExistingProfile(true);

        // Also fetch nutrition targets
        fetchNutritionTargets();
      } else if (response.status === 404) {
        // No profile exists yet - show empty form
        setIsExistingProfile(false);
      } else {
        throw new Error("Failed to load profile");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load profile");
      toast.error("Failed to load profile");
    } finally {
      setIsLoading(false);
    }
  };

  const fetchNutritionTargets = async () => {
    try {
      const response = await fetch("/api/profile/nutrition-targets");
      if (response.ok) {
        const data = await response.json();
        setNutritionTargets(data);
      }
    } catch (err) {
      console.error("Failed to fetch nutrition targets:", err);
    }
  };

  const handleFieldChange = (field: string, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));

    // Clear validation error for this field
    if (validationErrors[field]) {
      setValidationErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[field];
        return newErrors;
      });
    }
  };

  const validateProfile = (data: ProfileFormData): Record<string, string> => {
    const errors: Record<string, string> = {};

    // Required fields
    if (!data.age) errors.age = "Age is required";
    else if (data.age < 13 || data.age > 120) errors.age = "Age must be between 13 and 120";

    if (!data.gender) errors.gender = "Gender is required";
    if (!data.height_cm) errors.height_cm = "Height is required";
    else if (data.height_cm < 100 || data.height_cm > 250) errors.height_cm = "Height must be between 100-250 cm";

    if (!data.weight_kg) errors.weight_kg = "Weight is required";
    else if (data.weight_kg < 30 || data.weight_kg > 300) errors.weight_kg = "Weight must be between 30-300 kg";

    if (!data.activity_level) errors.activity_level = "Activity level is required";
    if (!data.weight_goal) errors.weight_goal = "Weight goal is required";

    if (!data.meals_per_day || data.meals_per_day.length === 0) {
      errors.meals_per_day = "Select at least one meal";
    }

    // Manual macros validation
    const hasAllManualMacros = data.target_calories && data.target_protein && data.target_carbs && data.target_fats;
    if (hasAllManualMacros) {
      const macroCalories = (data.target_protein! * 4) + (data.target_carbs! * 4) + (data.target_fats! * 9);
      const lowerBound = data.target_calories! * 0.9;
      const upperBound = data.target_calories! * 1.1;

      if (macroCalories < lowerBound || macroCalories > upperBound) {
        errors.target_calories = `Macros (${macroCalories} cal) don't match target calories`;
      }
    }

    return errors;
  };

  const handleSubmit = async () => {
    // Validate
    const errors = validateProfile(formData);
    if (Object.keys(errors).length > 0) {
      setValidationErrors(errors);
      toast.error("Please fix validation errors");

      // Navigate to first section with errors
      const sectionsWithErrors = [
        ["age", "gender", "height_cm", "weight_kg", "activity_level", "household_size"],
        ["weight_goal", "medical_goals", "target_calories"],
        ["diet_type", "allergies", "foods_to_avoid"],
        ["spice_tolerance", "cooking_skill", "max_cook_time", "cuisines", "meals_per_day", "snacks_per_day"]
      ];

      for (let i = 0; i < sectionsWithErrors.length; i++) {
        if (sectionsWithErrors[i].some(field => errors[field])) {
          setActiveSection(i);
          break;
        }
      }

      return;
    }

    try {
      setIsSaving(true);

      const method = isExistingProfile ? "PUT" : "POST";
      const response = await fetch("/api/profile", {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || "Failed to save profile");
      }

      toast.success(isExistingProfile ? "Profile updated!" : "Profile created!");
      router.push("/meal-plan");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save profile");
      toast.error(err instanceof Error ? err.message : "Failed to save profile");
    } finally {
      setIsSaving(false);
    }
  };

  const handleNext = () => {
    if (activeSection < 3) {
      setActiveSection(prev => prev + 1);
    }
  };

  const handlePrevious = () => {
    if (activeSection > 0) {
      setActiveSection(prev => prev - 1);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading profile...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            {isExistingProfile ? "Update Your Profile" : "Create Your Profile"}
          </h1>
          <p className="text-gray-600">
            Tell us about yourself to get personalized meal plans
          </p>
        </div>

        {/* Progress Tabs */}
        <div className="bg-white rounded-lg shadow-sm mb-6">
          <div className="flex border-b">
            {SECTION_TITLES.map((title, index) => (
              <button
                key={index}
                onClick={() => setActiveSection(index)}
                className={`flex-1 py-4 px-6 text-sm font-medium transition-colors ${
                  activeSection === index
                    ? "border-b-2 border-blue-600 text-blue-600"
                    : "text-gray-600 hover:text-gray-900"
                }`}
              >
                <div className="flex items-center justify-center gap-2">
                  <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs ${
                    activeSection === index
                      ? "bg-blue-600 text-white"
                      : "bg-gray-200 text-gray-600"
                  }`}>
                    {index + 1}
                  </span>
                  <span className="hidden sm:inline">{title}</span>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Form Sections */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
          {activeSection === 0 && (
            <BasicInfoForm
              formData={formData}
              onChange={handleFieldChange}
              errors={validationErrors}
            />
          )}

          {activeSection === 1 && (
            <HealthGoalsForm
              formData={formData}
              onChange={handleFieldChange}
              errors={validationErrors}
            />
          )}

          {activeSection === 2 && (
            <DietaryPrefsForm
              formData={formData}
              onChange={handleFieldChange}
              errors={validationErrors}
            />
          )}

          {activeSection === 3 && (
            <CookingPrefsForm
              formData={formData}
              onChange={handleFieldChange}
              errors={validationErrors}
            />
          )}
        </div>

        {/* Nutrition Targets Preview (if profile exists) */}
        {isExistingProfile && nutritionTargets && activeSection === 1 && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 mb-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Your Nutrition Targets</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <p className="text-sm text-gray-600">Daily Calories</p>
                <p className="text-2xl font-bold text-blue-600">{nutritionTargets.target_calories}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Protein</p>
                <p className="text-2xl font-bold text-blue-600">{nutritionTargets.target_protein}g</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Carbs</p>
                <p className="text-2xl font-bold text-blue-600">{nutritionTargets.target_carbs}g</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Fats</p>
                <p className="text-2xl font-bold text-blue-600">{nutritionTargets.target_fats}g</p>
              </div>
            </div>
            <div className="mt-4 pt-4 border-t border-blue-200">
              <p className="text-sm text-gray-600 mb-2">Macro Split</p>
              <div className="flex gap-2">
                <div className="flex-1 bg-blue-600 text-white text-center py-1 rounded" style={{width: `${nutritionTargets.macro_split.protein}%`}}>
                  <span className="text-xs">P: {nutritionTargets.macro_split.protein}%</span>
                </div>
                <div className="flex-1 bg-green-600 text-white text-center py-1 rounded" style={{width: `${nutritionTargets.macro_split.carbs}%`}}>
                  <span className="text-xs">C: {nutritionTargets.macro_split.carbs}%</span>
                </div>
                <div className="flex-1 bg-yellow-600 text-white text-center py-1 rounded" style={{width: `${nutritionTargets.macro_split.fats}%`}}>
                  <span className="text-xs">F: {nutritionTargets.macro_split.fats}%</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Navigation Buttons */}
        <div className="flex justify-between items-center">
          <button
            onClick={handlePrevious}
            disabled={activeSection === 0}
            className="px-6 py-2 text-gray-600 hover:text-gray-900 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Previous
          </button>

          <div className="flex gap-3">
            {activeSection < 3 ? (
              <button
                onClick={handleNext}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                Next
              </button>
            ) : (
              <button
                onClick={handleSubmit}
                disabled={isSaving}
                className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSaving ? "Saving..." : (isExistingProfile ? "Update Profile" : "Save Profile")}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
```

### 2. BasicInfoForm Component (src/components/profile/BasicInfoForm.tsx)

Form for basic health metrics:

```typescript
interface BasicInfoFormProps {
  formData: any;
  onChange: (field: string, value: any) => void;
  errors: Record<string, string>;
}

export default function BasicInfoForm({ formData, onChange, errors }: BasicInfoFormProps) {
  return (
    <div className="space-y-6">
      <h2 className="text-xl font-semibold text-gray-900 mb-4">Basic Information</h2>

      {/* Age */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Age <span className="text-red-500">*</span>
        </label>
        <input
          type="number"
          min="13"
          max="120"
          value={formData.age || ""}
          onChange={(e) => onChange("age", parseInt(e.target.value))}
          className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 ${
            errors.age ? "border-red-500" : "border-gray-300"
          }`}
          placeholder="Enter your age"
        />
        {errors.age && <p className="mt-1 text-sm text-red-500">{errors.age}</p>}
      </div>

      {/* Gender */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Gender <span className="text-red-500">*</span>
        </label>
        <select
          value={formData.gender || ""}
          onChange={(e) => onChange("gender", e.target.value)}
          className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 ${
            errors.gender ? "border-red-500" : "border-gray-300"
          }`}
        >
          <option value="">Select gender</option>
          <option value="male">Male</option>
          <option value="female">Female</option>
          <option value="other">Other</option>
        </select>
        {errors.gender && <p className="mt-1 text-sm text-red-500">{errors.gender}</p>}
      </div>

      {/* Height */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Height (cm) <span className="text-red-500">*</span>
        </label>
        <input
          type="number"
          min="100"
          max="250"
          step="0.1"
          value={formData.height_cm || ""}
          onChange={(e) => onChange("height_cm", parseFloat(e.target.value))}
          className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 ${
            errors.height_cm ? "border-red-500" : "border-gray-300"
          }`}
          placeholder="Enter height in centimeters"
        />
        {errors.height_cm && <p className="mt-1 text-sm text-red-500">{errors.height_cm}</p>}
        <p className="mt-1 text-xs text-gray-500">Example: 175 cm</p>
      </div>

      {/* Weight */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Weight (kg) <span className="text-red-500">*</span>
        </label>
        <input
          type="number"
          min="30"
          max="300"
          step="0.1"
          value={formData.weight_kg || ""}
          onChange={(e) => onChange("weight_kg", parseFloat(e.target.value))}
          className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 ${
            errors.weight_kg ? "border-red-500" : "border-gray-300"
          }`}
          placeholder="Enter weight in kilograms"
        />
        {errors.weight_kg && <p className="mt-1 text-sm text-red-500">{errors.weight_kg}</p>}
        <p className="mt-1 text-xs text-gray-500">Example: 70 kg</p>
      </div>

      {/* Activity Level */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Activity Level <span className="text-red-500">*</span>
        </label>
        <select
          value={formData.activity_level || ""}
          onChange={(e) => onChange("activity_level", e.target.value)}
          className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 ${
            errors.activity_level ? "border-red-500" : "border-gray-300"
          }`}
        >
          <option value="">Select activity level</option>
          <option value="sedentary">Sedentary - Little to no exercise</option>
          <option value="lightly_active">Lightly Active - Light exercise 1-3 days/week</option>
          <option value="moderately_active">Moderately Active - Moderate exercise 3-5 days/week</option>
          <option value="very_active">Very Active - Hard exercise 6-7 days/week</option>
          <option value="extra_active">Extra Active - Very hard exercise, physical job</option>
        </select>
        {errors.activity_level && <p className="mt-1 text-sm text-red-500">{errors.activity_level}</p>}
      </div>

      {/* Household Size */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Household Size
        </label>
        <input
          type="number"
          min="1"
          max="10"
          value={formData.household_size || 1}
          onChange={(e) => onChange("household_size", parseInt(e.target.value))}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
        />
        <p className="mt-1 text-xs text-gray-500">Number of people you're cooking for</p>
      </div>
    </div>
  );
}
```

### 3. HealthGoalsForm Component (src/components/profile/HealthGoalsForm.tsx)

Form for health goals and manual overrides:

```typescript
import { useState } from "react";

interface HealthGoalsFormProps {
  formData: any;
  onChange: (field: string, value: any) => void;
  errors: Record<string, string>;
}

const MEDICAL_GOALS = [
  { value: "diabetes_management", label: "Diabetes Management" },
  { value: "heart_health", label: "Heart Health" },
  { value: "high_protein", label: "High Protein" },
  { value: "muscle_building", label: "Muscle Building" },
  { value: "general_wellness", label: "General Wellness" },
];

export default function HealthGoalsForm({ formData, onChange, errors }: HealthGoalsFormProps) {
  const [showAdvanced, setShowAdvanced] = useState(false);

  const toggleMedicalGoal = (goal: string) => {
    const current = formData.medical_goals || [];
    const updated = current.includes(goal)
      ? current.filter((g: string) => g !== goal)
      : [...current, goal];
    onChange("medical_goals", updated);
  };

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-semibold text-gray-900 mb-4">Health Goals</h2>

      {/* Weight Goal */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-3">
          Weight Goal <span className="text-red-500">*</span>
        </label>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {[
            { value: "lose", label: "Lose Weight", desc: "500 cal deficit/day" },
            { value: "maintain", label: "Maintain", desc: "Maintain current weight" },
            { value: "gain", label: "Gain Weight", desc: "300 cal surplus/day" },
          ].map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => onChange("weight_goal", option.value)}
              className={`p-4 border-2 rounded-lg text-left transition-all ${
                formData.weight_goal === option.value
                  ? "border-blue-600 bg-blue-50"
                  : "border-gray-200 hover:border-gray-300"
              }`}
            >
              <div className="font-medium text-gray-900">{option.label}</div>
              <div className="text-sm text-gray-500 mt-1">{option.desc}</div>
            </button>
          ))}
        </div>
        {errors.weight_goal && <p className="mt-1 text-sm text-red-500">{errors.weight_goal}</p>}
      </div>

      {/* Medical Goals */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-3">
          Medical/Fitness Goals
        </label>
        <div className="space-y-2">
          {MEDICAL_GOALS.map((goal) => (
            <label key={goal.value} className="flex items-center">
              <input
                type="checkbox"
                checked={(formData.medical_goals || []).includes(goal.value)}
                onChange={() => toggleMedicalGoal(goal.value)}
                className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
              />
              <span className="ml-2 text-gray-700">{goal.label}</span>
            </label>
          ))}
        </div>
      </div>

      {/* Advanced Options Collapsible */}
      <div className="border-t pt-6">
        <button
          type="button"
          onClick={() => setShowAdvanced(!showAdvanced)}
          className="flex items-center gap-2 text-blue-600 hover:text-blue-700 font-medium"
        >
          <svg
            className={`w-5 h-5 transition-transform ${showAdvanced ? "rotate-90" : ""}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
          Advanced Options - Manual Target Overrides
        </button>

        {showAdvanced && (
          <div className="mt-4 p-4 bg-gray-50 rounded-lg space-y-4">
            <p className="text-sm text-gray-600 mb-4">
              Leave blank to use auto-calculated values based on your profile
            </p>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Target Calories
                </label>
                <input
                  type="number"
                  min="800"
                  max="5000"
                  value={formData.target_calories || ""}
                  onChange={(e) => onChange("target_calories", e.target.value ? parseInt(e.target.value) : null)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  placeholder="Auto-calculated"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Target Protein (g)
                </label>
                <input
                  type="number"
                  min="20"
                  max="400"
                  value={formData.target_protein || ""}
                  onChange={(e) => onChange("target_protein", e.target.value ? parseInt(e.target.value) : null)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  placeholder="Auto-calculated"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Target Carbs (g)
                </label>
                <input
                  type="number"
                  min="20"
                  max="600"
                  value={formData.target_carbs || ""}
                  onChange={(e) => onChange("target_carbs", e.target.value ? parseInt(e.target.value) : null)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  placeholder="Auto-calculated"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Target Fats (g)
                </label>
                <input
                  type="number"
                  min="20"
                  max="250"
                  value={formData.target_fats || ""}
                  onChange={(e) => onChange("target_fats", e.target.value ? parseInt(e.target.value) : null)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  placeholder="Auto-calculated"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Target Fiber (g)
                </label>
                <input
                  type="number"
                  min="10"
                  max="100"
                  value={formData.target_fiber || ""}
                  onChange={(e) => onChange("target_fiber", e.target.value ? parseInt(e.target.value) : null)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  placeholder="Auto-calculated"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Target Sodium (mg)
                </label>
                <input
                  type="number"
                  min="500"
                  max="5000"
                  value={formData.target_sodium || ""}
                  onChange={(e) => onChange("target_sodium", e.target.value ? parseInt(e.target.value) : null)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  placeholder="Auto-calculated"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Target Sugar (g)
                </label>
                <input
                  type="number"
                  min="10"
                  max="150"
                  value={formData.target_sugar || ""}
                  onChange={(e) => onChange("target_sugar", e.target.value ? parseInt(e.target.value) : null)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  placeholder="Auto-calculated"
                />
              </div>
            </div>

            {errors.target_calories && (
              <p className="text-sm text-red-500">{errors.target_calories}</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
```

### 4. DietaryPrefsForm Component (src/components/profile/DietaryPrefsForm.tsx)

Form for dietary preferences and restrictions:

```typescript
interface DietaryPrefsFormProps {
  formData: any;
  onChange: (field: string, value: any) => void;
  errors: Record<string, string>;
}

const ALLERGY_OPTIONS = [
  "peanuts",
  "tree_nuts",
  "dairy",
  "eggs",
  "shellfish",
  "soy",
  "wheat",
  "fish",
];

export default function DietaryPrefsForm({ formData, onChange, errors }: DietaryPrefsFormProps) {
  const toggleAllergy = (allergy: string) => {
    const current = formData.allergies || [];
    const updated = current.includes(allergy)
      ? current.filter((a: string) => a !== allergy)
      : [...current, allergy];
    onChange("allergies", updated);
  };

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-semibold text-gray-900 mb-4">Dietary Preferences</h2>

      {/* Diet Type */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Diet Type
        </label>
        <select
          value={formData.diet_type || "none"}
          onChange={(e) => onChange("diet_type", e.target.value)}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
        >
          <option value="none">No Specific Diet</option>
          <option value="vegetarian">Vegetarian</option>
          <option value="vegan">Vegan</option>
          <option value="keto">Keto</option>
          <option value="paleo">Paleo</option>
          <option value="mediterranean">Mediterranean</option>
          <option value="pescatarian">Pescatarian</option>
        </select>
      </div>

      {/* Allergies */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-3">
          Food Allergies
        </label>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {ALLERGY_OPTIONS.map((allergy) => (
            <label key={allergy} className="flex items-center">
              <input
                type="checkbox"
                checked={(formData.allergies || []).includes(allergy)}
                onChange={() => toggleAllergy(allergy)}
                className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
              />
              <span className="ml-2 text-gray-700 capitalize">
                {allergy.replace("_", " ")}
              </span>
            </label>
          ))}
        </div>
      </div>

      {/* Foods to Avoid */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Foods to Avoid
        </label>
        <textarea
          value={formData.foods_to_avoid || ""}
          onChange={(e) => onChange("foods_to_avoid", e.target.value)}
          maxLength={500}
          rows={4}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
          placeholder="List any other foods you'd like to avoid (e.g., mushrooms, cilantro, etc.)"
        />
        <div className="flex justify-between mt-1">
          <p className="text-xs text-gray-500">
            Separate multiple items with commas
          </p>
          <p className="text-xs text-gray-500">
            {(formData.foods_to_avoid || "").length}/500
          </p>
        </div>
      </div>
    </div>
  );
}
```

### 5. CookingPrefsForm Component (src/components/profile/CookingPrefsForm.tsx)

Form for cooking preferences and meal planning:

```typescript
interface CookingPrefsFormProps {
  formData: any;
  onChange: (field: string, value: any) => void;
  errors: Record<string, string>;
}

const CUISINE_OPTIONS = [
  "indian",
  "italian",
  "mexican",
  "chinese",
  "japanese",
  "thai",
  "mediterranean",
  "american",
  "middle_eastern",
  "korean",
  "french",
  "other",
];

const MEAL_OPTIONS = ["breakfast", "lunch", "dinner"];

export default function CookingPrefsForm({ formData, onChange, errors }: CookingPrefsFormProps) {
  const toggleCuisine = (cuisine: string) => {
    const current = formData.cuisines || [];
    const updated = current.includes(cuisine)
      ? current.filter((c: string) => c !== cuisine)
      : [...current, cuisine];
    onChange("cuisines", updated);
  };

  const toggleMeal = (meal: string) => {
    const current = formData.meals_per_day || [];
    const updated = current.includes(meal)
      ? current.filter((m: string) => m !== meal)
      : [...current, meal];
    onChange("meals_per_day", updated);
  };

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-semibold text-gray-900 mb-4">Cooking Preferences</h2>

      {/* Spice Tolerance */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Spice Tolerance
        </label>
        <select
          value={formData.spice_tolerance || "medium"}
          onChange={(e) => onChange("spice_tolerance", e.target.value)}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
        >
          <option value="mild">Mild</option>
          <option value="medium">Medium</option>
          <option value="hot">Hot</option>
        </select>
      </div>

      {/* Cooking Skill */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Cooking Skill Level
        </label>
        <select
          value={formData.cooking_skill || "intermediate"}
          onChange={(e) => onChange("cooking_skill", e.target.value)}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
        >
          <option value="beginner">Beginner - Simple recipes with basic techniques</option>
          <option value="intermediate">Intermediate - Comfortable with most cooking methods</option>
          <option value="advanced">Advanced - Experienced with complex techniques</option>
        </select>
      </div>

      {/* Max Cook Time */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Maximum Cook Time: {formData.max_cook_time || 45} minutes
        </label>
        <input
          type="range"
          min="10"
          max="120"
          step="5"
          value={formData.max_cook_time || 45}
          onChange={(e) => onChange("max_cook_time", parseInt(e.target.value))}
          className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
        />
        <div className="flex justify-between text-xs text-gray-500 mt-1">
          <span>10 min</span>
          <span>120 min</span>
        </div>
      </div>

      {/* Preferred Cuisines */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-3">
          Preferred Cuisines
        </label>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {CUISINE_OPTIONS.map((cuisine) => (
            <label key={cuisine} className="flex items-center">
              <input
                type="checkbox"
                checked={(formData.cuisines || []).includes(cuisine)}
                onChange={() => toggleCuisine(cuisine)}
                className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
              />
              <span className="ml-2 text-gray-700 capitalize">
                {cuisine.replace("_", " ")}
              </span>
            </label>
          ))}
        </div>
      </div>

      {/* Meals Per Day */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-3">
          Meals to Plan <span className="text-red-500">*</span>
        </label>
        <div className="flex gap-3">
          {MEAL_OPTIONS.map((meal) => (
            <button
              key={meal}
              type="button"
              onClick={() => toggleMeal(meal)}
              className={`flex-1 py-3 px-4 border-2 rounded-lg font-medium capitalize transition-all ${
                (formData.meals_per_day || []).includes(meal)
                  ? "border-blue-600 bg-blue-50 text-blue-700"
                  : "border-gray-200 text-gray-700 hover:border-gray-300"
              }`}
            >
              {meal}
            </button>
          ))}
        </div>
        {errors.meals_per_day && <p className="mt-1 text-sm text-red-500">{errors.meals_per_day}</p>}
      </div>

      {/* Snacks Per Day */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-3">
          Snacks Per Day
        </label>
        <div className="flex gap-3">
          {[0, 1, 2, 3].map((num) => (
            <button
              key={num}
              type="button"
              onClick={() => onChange("snacks_per_day", num)}
              className={`flex-1 py-3 px-4 border-2 rounded-lg font-medium transition-all ${
                formData.snacks_per_day === num
                  ? "border-blue-600 bg-blue-50 text-blue-700"
                  : "border-gray-200 text-gray-700 hover:border-gray-300"
              }`}
            >
              {num}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
```

## Verification Checklist

Complete testing protocol for profile system:

### Backend API Tests

1. **POST /api/profile with valid data**
   - Send complete profile with all required fields
   - Verify 201 status code
   - Verify profile saved to database with correct values
   - Verify JSON fields serialized properly
   - Verify timestamps created

2. **GET /api/profile**
   - Verify 200 status code with existing profile
   - Verify all fields returned correctly
   - Verify JSON fields deserialized to arrays
   - Verify 404 when no profile exists

3. **PUT /api/profile partial update**
   - Update only weight_kg and activity_level
   - Verify only those fields changed
   - Verify other fields unchanged
   - Verify updated_at timestamp changed

4. **GET /api/profile/nutrition-targets - Basic Calculation**
   - Test profile: 30yo male, 175cm, 80kg, moderately_active, lose weight
   - Expected: BMR ≈ 1746, TDEE ≈ 2707, target_calories ≈ 2207
   - Expected macros (30/40/30): P≈165g, C≈220g, F≈74g

5. **Keto diet macro split**
   - Set diet_type: "keto"
   - Verify macro_split: {protein: 25, carbs: 5, fats: 70}
   - Verify calculated grams match percentages

6. **Heart health goal**
   - Set medical_goals: ["heart_health"]
   - Verify sodium target: 1500mg
   - Verify macro_split: {protein: 25, carbs: 50, fats: 25}

7. **Manual overrides respected**
   - Set target_calories: 2000, target_protein: 150
   - Verify returned targets use manual values
   - Verify auto-calculated values used for unset fields

8. **Manual macro validation**
   - Set target_calories: 2000
   - Set macros: P=150g, C=200g, F=50g (totals 1850 cal)
   - Verify validation passes (within 10%)
   - Set macros that exceed 10% margin
   - Verify validation error returned

### Frontend Tests

9. **Form validates required fields**
   - Leave age blank, try to submit
   - Verify inline error shown
   - Verify submit button disabled or shows error
   - Fill age, verify error clears

10. **Form submits and redirects**
    - Fill all required fields
    - Click "Save Profile"
    - Verify POST request sent
    - Verify redirect to /meal-plan on success
    - Verify success toast shown

11. **Returning to /profile shows pre-filled data**
    - Create profile
    - Navigate away
    - Return to /profile
    - Verify form pre-populated with saved values

12. **JSON fields round-trip correctly**
    - Select multiple allergies: ["peanuts", "dairy", "soy"]
    - Select multiple cuisines: ["indian", "italian", "mexican"]
    - Select multiple meals: ["breakfast", "dinner"]
    - Save profile
    - Reload page
    - Verify all selections still checked

13. **Nutrition targets preview updates**
    - Edit existing profile
    - Navigate to Health Goals tab
    - Verify nutrition targets card shows
    - Verify values match GET /nutrition-targets

14. **Range slider updates value display**
    - Move max_cook_time slider
    - Verify displayed value updates in real-time
    - Verify value between 10-120

15. **Character counter on foods_to_avoid**
    - Type in foods_to_avoid textarea
    - Verify character count updates
    - Verify max 500 characters enforced

16. **Tabbed navigation works**
    - Click each tab
    - Verify correct form section displays
    - Click Previous/Next buttons
    - Verify section changes appropriately

## Database Schema Reference

The UserProfile model should have these fields (from Phase 1):

```python
class UserProfile(Base):
    __tablename__ = "user_profiles"

    id = Column(Integer, primary_key=True, index=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Basic health metrics
    age = Column(Integer, nullable=False)
    gender = Column(String, nullable=False)
    height_cm = Column(Float, nullable=False)
    weight_kg = Column(Float, nullable=False)
    activity_level = Column(String, nullable=False)
    household_size = Column(Integer, default=1)

    # Health goals
    weight_goal = Column(String, nullable=False)
    medical_goals = Column(String, nullable=True)  # JSON string

    # Dietary preferences
    diet_type = Column(String, default="none")
    allergies = Column(String, nullable=True)  # JSON string
    foods_to_avoid = Column(String, nullable=True)

    # Cooking preferences
    spice_tolerance = Column(String, default="medium")
    cooking_skill = Column(String, default="intermediate")
    max_cook_time = Column(Integer, default=45)
    cuisines = Column(String, nullable=True)  # JSON string

    # Meal planning
    meals_per_day = Column(String, nullable=False)  # JSON string
    snacks_per_day = Column(Integer, default=1)

    # Manual nutrition targets
    target_calories = Column(Integer, nullable=True)
    target_protein = Column(Integer, nullable=True)
    target_carbs = Column(Integer, nullable=True)
    target_fats = Column(Integer, nullable=True)
    target_fiber = Column(Integer, nullable=True)
    target_sodium = Column(Integer, nullable=True)
    target_sugar = Column(Integer, nullable=True)
```

## Security Considerations

1. **Input Validation**: All numeric fields have min/max bounds to prevent unrealistic values
2. **SQL Injection Prevention**: Using SQLAlchemy ORM with parameterized queries
3. **XSS Prevention**: Frontend sanitizes user input before display
4. **Data Integrity**: Field validators ensure data consistency
5. **Error Messages**: Non-revealing error messages to prevent information leakage

## Performance Optimizations

1. **Database Indexing**: Primary key index on user_profiles.id
2. **Single Query Fetch**: Profile loaded in one database query
3. **Efficient JSON Serialization**: Minimal overhead for list fields
4. **Frontend State Management**: React state updates batched for performance

## Future Enhancements

- Multi-user support with user authentication
- Profile history tracking for weight/metric changes
- Imperial unit support (lbs, inches)
- Macro split customization beyond presets
- Integration with fitness trackers for activity level
- AI-suggested nutrition targets based on goals

---

**Next Phase**: Phase 3 - Recipe Database Integration (document 04-recipe-database.md)