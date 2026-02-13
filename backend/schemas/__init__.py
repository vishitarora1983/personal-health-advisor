"""
Schemas package for Pydantic request/response models.

This package contains all API schemas for validation and serialization.
"""

from .profile import (
    ProfileCreate,
    ProfileUpdate,
    ProfileResponse,
    NutritionTargetsResponse
)

from .meal_plan import (
    IngredientSchema,
    MealSchema,
    MealResponse,
    DailyPlanSchema,
    WeeklyPlanResponse,
    GenerateMealPlanRequest,
    SwapMealRequest,
    SwapMealResponse
)

from .tracking import (
    TrackMealRequest,
    TrackMealResponse,
    MealTrackingInfo,
    NutritionTotals,
    DailyTrackingResponse,
    WeeklyTrackingResponse
)

from .grocery import (
    GroceryItemSchema,
    GroceryItemResponse,
    GroceryListResponse,
    ToggleGroceryItemRequest,
    RegenerateGroceryListResponse
)

from .dashboard import (
    DailyNutritionStat,
    WeeklyAdherenceStats,
    MacroBreakdown,
    DashboardResponse
)

__all__ = [
    # Profile schemas
    "ProfileCreate",
    "ProfileUpdate",
    "ProfileResponse",
    "NutritionTargetsResponse",

    # Meal plan schemas
    "IngredientSchema",
    "MealSchema",
    "MealResponse",
    "DailyPlanSchema",
    "WeeklyPlanResponse",
    "GenerateMealPlanRequest",
    "SwapMealRequest",
    "SwapMealResponse",

    # Tracking schemas
    "TrackMealRequest",
    "TrackMealResponse",
    "MealTrackingInfo",
    "NutritionTotals",
    "DailyTrackingResponse",
    "WeeklyTrackingResponse",

    # Grocery schemas
    "GroceryItemSchema",
    "GroceryItemResponse",
    "GroceryListResponse",
    "ToggleGroceryItemRequest",
    "RegenerateGroceryListResponse",

    # Dashboard schemas
    "DailyNutritionStat",
    "WeeklyAdherenceStats",
    "MacroBreakdown",
    "DashboardResponse"
]
