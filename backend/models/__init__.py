"""
Model registry - imports all models so they're registered with SQLAlchemy Base.

This file must be imported before calling Base.metadata.create_all() to ensure
all tables are created. It serves as a central registry for all ORM models.

Import order matters for SQLAlchemy relationship resolution:
  1. Base tables (User, UserProfile) must be registered before tables that
     reference them via ForeignKey.
  2. MealMemberServing references both meals.id and user_profiles.id, so
     it must be imported after both Meal and UserProfile are registered.
"""

from database import Base

# Import all models to register them with Base
from .user import User
from .profile import UserProfile
from .meal_plan import WeeklyPlan, DailyPlan, Meal
from .tracking import MealTracking
from .grocery import GroceryItem
from .joint_profile import JointProfileMember
from .meal_kid_share import MealKidShare
# MealMemberServing must come after Meal and UserProfile (FK dependencies above)
from .meal_member_serving import MealMemberServing

# Expose models for easy importing
__all__ = [
    "Base",
    "User",
    "UserProfile",
    "WeeklyPlan",
    "DailyPlan",
    "Meal",
    "MealTracking",
    "GroceryItem",
    "JointProfileMember",
    "MealKidShare",
    "MealMemberServing",
]
