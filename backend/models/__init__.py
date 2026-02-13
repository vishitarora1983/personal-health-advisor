"""
Model registry - imports all models so they're registered with SQLAlchemy Base.

This file must be imported before calling Base.metadata.create_all() to ensure
all tables are created. It serves as a central registry for all ORM models.
"""

from database import Base

# Import all models to register them with Base
from .profile import UserProfile
from .meal_plan import WeeklyPlan, DailyPlan, Meal
from .tracking import MealTracking
from .grocery import GroceryItem

# Expose models for easy importing
__all__ = [
    "Base",
    "UserProfile",
    "WeeklyPlan",
    "DailyPlan",
    "Meal",
    "MealTracking",
    "GroceryItem"
]
