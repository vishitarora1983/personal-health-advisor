"""
Profile schemas for user profile management.

These Pydantic schemas handle validation, serialization, and deserialization
of user profile data including health metrics, dietary preferences, and nutrition targets.
"""

from typing import Optional, List
from pydantic import BaseModel, Field, field_validator
from datetime import datetime
import json


class ProfileCreate(BaseModel):
    """
    Schema for creating a new user profile.

    All required fields must be provided. JSON fields (lists) are automatically
    serialized for database storage.
    """
    # Profile Name
    name: str = Field(min_length=1, max_length=100, description="Profile name")

    # Member-Only Flag
    is_member_only: bool = Field(default=False, description="True for profiles created inside the Joint Profile wizard")

    # Physical Characteristics
    age: int = Field(ge=1, le=120, description="Age in years")
    gender: str = Field(pattern="^(male|female|other)$", description="Biological gender")
    height_cm: float = Field(ge=50, le=250, description="Height in centimeters")
    weight_kg: float = Field(ge=3, le=300, description="Current weight in kilograms")
    activity_level: str = Field(
        pattern="^(sedentary|lightly_active|moderately_active|very_active|extra_active)$",
        description="Physical activity level"
    )

    # Household and Goals
    household_size: int = Field(ge=1, le=10, default=1, description="Number of people to cook for")
    weight_goal: str = Field(pattern="^(lose|maintain|gain)$", description="Weight management goal")

    # Medical and Dietary Restrictions
    medical_goals: Optional[List[str]] = Field(default=None, description="Health objectives")
    diet_type: str = Field(
        default="none",
        pattern="^(none|vegetarian|vegan|keto|paleo|mediterranean|pescatarian)$",
        description="Dietary pattern"
    )
    allergies: Optional[List[str]] = Field(default=None, description="Food allergies")
    foods_to_avoid: Optional[str] = Field(default=None, max_length=500, description="Disliked foods")
    foods_to_include: Optional[str] = Field(default=None, max_length=500, description="Foods to actively include")

    # Cooking Preferences
    spice_tolerance: str = Field(
        default="medium",
        pattern="^(mild|medium|hot)$",
        description="Spice heat preference"
    )
    cooking_skill: str = Field(
        default="intermediate",
        pattern="^(beginner|intermediate|advanced)$",
        description="Cooking skill level"
    )
    max_cook_time: int = Field(ge=10, le=120, default=45, description="Maximum cooking time in minutes")
    cuisines: Optional[List[str]] = Field(default=None, description="Preferred cuisines")

    # Meal Structure
    meals_per_day: List[str] = Field(description="Which meals to plan (breakfast, lunch, dinner)")
    snacks_per_day: int = Field(ge=0, le=3, default=1, description="Number of snacks per day")
    meals_to_repeat: int = Field(default=4, ge=0, le=7, description="Number of meals to repeat across the week")

    # Manual Nutrition Targets (optional overrides)
    target_calories: Optional[int] = Field(default=None, ge=800, le=5000)
    target_protein: Optional[int] = Field(default=None, ge=20, le=400)
    target_carbs: Optional[int] = Field(default=None, ge=20, le=600)
    target_fats: Optional[int] = Field(default=None, ge=20, le=250)
    target_fiber: Optional[int] = Field(default=None, ge=10, le=100)
    target_sodium: Optional[int] = Field(default=None, ge=500, le=5000)
    target_sugar: Optional[int] = Field(default=None, ge=10, le=150)

    @field_validator('meals_per_day')
    @classmethod
    def validate_meals_per_day(cls, v: List[str]) -> List[str]:
        """Validate meals_per_day contains valid meal types."""
        if not v or len(v) == 0:
            raise ValueError("At least one meal type must be specified")

        allowed = {"breakfast", "lunch", "dinner"}
        for meal in v:
            if meal not in allowed:
                raise ValueError(f"Invalid meal type: {meal}. Must be one of: {allowed}")

        return v


class ProfileUpdate(BaseModel):
    """
    Schema for updating an existing profile.

    All fields are optional to support partial updates (PATCH semantics).
    """
    name: Optional[str] = Field(default=None, min_length=1, max_length=100)
    age: Optional[int] = Field(default=None, ge=1, le=120)
    gender: Optional[str] = Field(default=None, pattern="^(male|female|other)$")
    height_cm: Optional[float] = Field(default=None, ge=50, le=250)
    weight_kg: Optional[float] = Field(default=None, ge=3, le=300)
    activity_level: Optional[str] = Field(
        default=None,
        pattern="^(sedentary|lightly_active|moderately_active|very_active|extra_active)$"
    )
    household_size: Optional[int] = Field(default=None, ge=1, le=10)
    weight_goal: Optional[str] = Field(default=None, pattern="^(lose|maintain|gain)$")
    medical_goals: Optional[List[str]] = None
    diet_type: Optional[str] = Field(
        default=None,
        pattern="^(none|vegetarian|vegan|keto|paleo|mediterranean|pescatarian)$"
    )
    allergies: Optional[List[str]] = None
    foods_to_avoid: Optional[str] = Field(default=None, max_length=500)
    foods_to_include: Optional[str] = Field(default=None, max_length=500)
    spice_tolerance: Optional[str] = Field(default=None, pattern="^(mild|medium|hot)$")
    cooking_skill: Optional[str] = Field(default=None, pattern="^(beginner|intermediate|advanced)$")
    max_cook_time: Optional[int] = Field(default=None, ge=10, le=120)
    cuisines: Optional[List[str]] = None
    meals_per_day: Optional[List[str]] = None
    snacks_per_day: Optional[int] = Field(default=None, ge=0, le=3)
    meals_to_repeat: Optional[int] = Field(default=None, ge=0, le=7)
    target_calories: Optional[int] = Field(default=None, ge=800, le=5000)
    target_protein: Optional[int] = Field(default=None, ge=20, le=400)
    target_carbs: Optional[int] = Field(default=None, ge=20, le=600)
    target_fats: Optional[int] = Field(default=None, ge=20, le=250)
    target_fiber: Optional[int] = Field(default=None, ge=10, le=100)
    target_sodium: Optional[int] = Field(default=None, ge=500, le=5000)
    target_sugar: Optional[int] = Field(default=None, ge=10, le=150)


class ProfileResponse(BaseModel):
    """
    Schema for profile API responses.

    Includes all profile fields plus database metadata. JSON fields are automatically
    deserialized from database TEXT to Python lists.
    """
    id: int
    name: str
    is_joint: bool = False
    is_member_only: bool = False
    age: int
    gender: str
    height_cm: float
    weight_kg: float
    activity_level: str
    household_size: int
    weight_goal: str
    medical_goals: Optional[List[str]] = None
    diet_type: str
    allergies: Optional[List[str]] = None
    foods_to_avoid: Optional[str] = None
    foods_to_include: Optional[str] = None
    spice_tolerance: str
    cooking_skill: str
    max_cook_time: int
    cuisines: Optional[List[str]] = None
    meals_per_day: List[str]
    snacks_per_day: int
    meals_to_repeat: int = 4
    target_calories: Optional[int] = None
    target_protein: Optional[int] = None
    target_carbs: Optional[int] = None
    target_fats: Optional[int] = None
    target_fiber: Optional[int] = None
    target_sodium: Optional[int] = None
    target_sugar: Optional[int] = None
    created_at: datetime
    updated_at: datetime

    profile_type: str = "adult"

    model_config = {"from_attributes": True}

    @field_validator('medical_goals', 'allergies', 'cuisines', 'meals_per_day', mode='before')
    @classmethod
    def deserialize_json_fields(cls, v):
        """Deserialize JSON strings from database to Python lists."""
        if v is None:
            return None
        if isinstance(v, str):
            try:
                return json.loads(v)
            except json.JSONDecodeError:
                return None
        return v


class ProfileListItem(BaseModel):
    """Lightweight profile summary for listing all profiles."""
    id: int
    name: str
    is_joint: bool = False
    is_member_only: bool = False
    created_at: datetime

    model_config = {"from_attributes": True}


class NutritionTargetsResponse(BaseModel):
    """
    Calculated nutrition targets based on user profile.

    Includes BMR, TDEE, and all macro/micronutrient targets.
    """
    bmr: float = Field(description="Basal Metabolic Rate (calories at rest)")
    tdee: float = Field(description="Total Daily Energy Expenditure")
    target_calories: int
    target_protein: int = Field(description="Daily protein target in grams")
    target_carbs: int = Field(description="Daily carbohydrate target in grams")
    target_fats: int = Field(description="Daily fat target in grams")
    target_fiber: int = Field(description="Daily fiber target in grams")
    target_sodium: int = Field(description="Daily sodium limit in milligrams")
    target_sugar: int = Field(description="Daily sugar limit in grams")
    macro_split: dict = Field(description="Macro percentage split (protein, carbs, fats)")


class JointProfileCreate(BaseModel):
    """
    Schema for creating a joint profile with household-level preferences.

    The caller selects which individual profiles to include and specifies the
    household's shared cooking/dietary preferences directly. There is no concept
    of a 'primary' profile — all members are equal contributors to the plan.

    member_profile_ids must contain at least 2 IDs; each must belong to the
    current user and must not itself be a joint profile.

    Household preferences (diet_type, allergies, etc.) override or supplement
    any individual member preferences when the AI generates a meal plan.
    """
    name: str = Field(min_length=1, max_length=100)
    member_profile_ids: List[int] = Field(
        min_length=2,
        description="IDs of individual profiles to include (minimum 2, none can be joint profiles)"
    )

    # ---- Household-level dietary preferences --------------------------------
    # These become the joint profile's own preference fields and are stored on
    # the UserProfile row (same columns used by individual profiles).

    diet_type: str = Field(
        default="none",
        pattern="^(none|vegetarian|vegan|keto|paleo|mediterranean|pescatarian)$",
        description="Household dietary pattern"
    )
    allergies: Optional[List[str]] = Field(
        default=None,
        description=(
            "Explicit allergy list for the household. "
            "If omitted, the backend auto-merges (union) all members' allergies."
        )
    )
    foods_to_avoid: Optional[str] = Field(
        default=None,
        max_length=500,
        description=(
            "Household-level foods to avoid. "
            "If omitted, the backend concatenates each member's foods_to_avoid."
        )
    )
    foods_to_include: Optional[str] = Field(
        default=None,
        max_length=500,
        description=(
            "Household-level foods to actively include. "
            "If omitted, the backend concatenates each member's foods_to_include."
        )
    )
    spice_tolerance: str = Field(
        default="medium",
        pattern="^(mild|medium|hot)$",
        description="Household spice heat preference"
    )
    cooking_skill: str = Field(
        default="intermediate",
        pattern="^(beginner|intermediate|advanced)$",
        description="Household cooking skill level"
    )
    max_cook_time: int = Field(
        ge=10,
        le=120,
        default=45,
        description="Maximum cooking time in minutes for the household"
    )
    cuisines: Optional[List[str]] = Field(
        default=None,
        description="Preferred cuisines for the household"
    )
    meals_per_day: List[str] = Field(
        default=["breakfast", "lunch", "dinner"],
        description="Which meal slots to plan for the household"
    )
    snacks_per_day: int = Field(
        ge=0,
        le=3,
        default=1,
        description="Number of snack slots per day for the household"
    )
    meals_to_repeat: int = Field(
        default=4,
        ge=0,
        le=7,
        description="Number of meals repeated across the week for simplicity"
    )


class JointProfileMemberResponse(BaseModel):
    """
    Summary of one member within a joint profile.

    Exposes each member's individual nutrition goals so the frontend can display
    them in the household overview panel without a separate API call.
    is_primary is removed because the primary concept no longer exists.
    """
    profile_id: int
    profile_name: str
    target_calories: int
    weight_goal: str            # 'lose' | 'maintain' | 'gain'
    medical_goals: Optional[List[str]] = None


class JointProfileResponse(BaseModel):
    """Response for a joint profile with its members."""
    profile: ProfileResponse
    members: List[JointProfileMemberResponse]


class MemberNutritionTargetsResponse(BaseModel):
    """
    Full nutrition targets for one member of a joint profile.

    Used by the household nutrition breakdown panel and by the meal generation
    service to understand how many calories each member needs.

    is_primary and share_ratio are removed:
    - is_primary: the primary concept is gone.
    - share_ratio: callers who need a ratio can compute it from target_calories
      across the list; baking it into the response was fragile and redundant.

    weight_goal and medical_goals are added so the UI can label each member's
    context (e.g. "Alice — losing weight, heart health").
    """
    profile_id: int
    profile_name: str
    weight_goal: str                    # 'lose' | 'maintain' | 'gain'
    medical_goals: Optional[List[str]] = None
    bmr: float
    tdee: float
    target_calories: int
    target_protein: int
    target_carbs: int
    target_fats: int
    target_fiber: int
    target_sodium: int
    target_sugar: int
    macro_split: dict
