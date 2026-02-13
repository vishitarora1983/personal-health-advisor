"""
Meal planning models: WeeklyPlan, DailyPlan, and Meal.

These models represent the core meal planning entities:
- WeeklyPlan: A 7-day meal plan for a user
- DailyPlan: A single day's plan with aggregated nutrition
- Meal: An individual meal (breakfast, lunch, dinner, snack) with recipe details

The hierarchy is: UserProfile → WeeklyPlan → DailyPlan → Meal
"""

from datetime import datetime, date
from sqlalchemy import Column, Integer, String, Float, Text, Date, DateTime, ForeignKey, Index
from sqlalchemy.orm import relationship
from database import Base
import json


class WeeklyPlan(Base):
    """
    A weekly meal plan generated for a user profile.

    Each plan covers 7 days (Monday to Sunday) and contains:
    - 7 DailyPlan records (one per day)
    - A consolidated GroceryItem list for the week

    Multiple weekly plans can exist for a user (historical plans are archived).
    Only one plan should be "active" at a time per user.
    """

    __tablename__ = "weekly_plans"

    # Primary Key
    id = Column(Integer, primary_key=True, autoincrement=True)

    # Foreign Key to User Profile
    profile_id = Column(
        Integer,
        ForeignKey("user_profiles.id", ondelete="CASCADE"),
        nullable=False,
        comment="Owner of this meal plan"
    )

    # Plan Metadata
    week_start_date = Column(
        Date,
        nullable=False,
        comment="Monday of the plan week (ISO week format)"
    )
    status = Column(
        String(20),
        nullable=False,
        default="active",
        comment="active or archived"
    )

    # Timestamp
    created_at = Column(
        DateTime,
        nullable=False,
        default=datetime.utcnow,
        comment="Plan generation timestamp"
    )

    # Relationships
    profile = relationship("UserProfile", back_populates="weekly_plans")
    daily_plans = relationship(
        "DailyPlan",
        back_populates="weekly_plan",
        cascade="all, delete-orphan",
        order_by="DailyPlan.day_of_week"
    )
    grocery_items = relationship(
        "GroceryItem",
        back_populates="weekly_plan",
        cascade="all, delete-orphan"
    )

    # Index for efficient querying of active plans
    __table_args__ = (
        Index("idx_weekly_plans_profile_status", "profile_id", "status"),
    )

    def __repr__(self):
        return f"<WeeklyPlan(id={self.id}, profile_id={self.profile_id}, week_start={self.week_start_date}, status={self.status})>"


class DailyPlan(Base):
    """
    A single day's meal plan within a weekly plan.

    Contains:
    - 3-5 Meal records (breakfast, lunch, dinner, and optional snacks)
    - Aggregated nutritional totals for the day

    The nutritional totals (calories, protein, carbs, fats) are computed from
    the sum of all meals for that day. These can be updated when meals are tracked.
    """

    __tablename__ = "daily_plans"

    # Primary Key
    id = Column(Integer, primary_key=True, autoincrement=True)

    # Foreign Key to Weekly Plan
    weekly_plan_id = Column(
        Integer,
        ForeignKey("weekly_plans.id", ondelete="CASCADE"),
        nullable=False,
        comment="Parent weekly plan"
    )

    # Day Identification
    day_of_week = Column(
        Integer,
        nullable=False,
        comment="0=Day 1 through 6=Day 7 (offset from week_start_date)"
    )
    day_date = Column(
        Date,
        nullable=False,
        comment="Actual calendar date (YYYY-MM-DD)"
    )

    # Aggregated Nutritional Data (computed from meals)
    total_calories = Column(
        Float,
        nullable=True,
        comment="Sum of calories from all meals"
    )
    total_protein = Column(
        Float,
        nullable=True,
        comment="Sum of protein in grams"
    )
    total_carbs = Column(
        Float,
        nullable=True,
        comment="Sum of carbohydrates in grams"
    )
    total_fats = Column(
        Float,
        nullable=True,
        comment="Sum of fats in grams"
    )
    total_fiber = Column(
        Float,
        nullable=True,
        default=0,
        comment="Sum of fiber in grams"
    )
    total_sodium = Column(
        Float,
        nullable=True,
        default=0,
        comment="Sum of sodium in milligrams"
    )
    total_sugar = Column(
        Float,
        nullable=True,
        default=0,
        comment="Sum of sugar in grams"
    )

    # Relationships
    weekly_plan = relationship("WeeklyPlan", back_populates="daily_plans")
    meals = relationship(
        "Meal",
        back_populates="daily_plan",
        cascade="all, delete-orphan",
        order_by="Meal.meal_type"
    )

    # Index for efficient weekly plan queries
    __table_args__ = (
        Index("idx_daily_plans_weekly", "weekly_plan_id"),
    )

    def __repr__(self):
        return f"<DailyPlan(id={self.id}, date={self.day_date}, day_of_week={self.day_of_week})>"


class Meal(Base):
    """
    An individual meal entry (breakfast, lunch, dinner, or snack).

    Contains complete information about a dish:
    - Dish name and description
    - Nutritional breakdown (calories, macros, fiber)
    - Recipe details (ingredients with quantities, brief cooking instructions)
    - Portion sizing and prep time

    This is the most detailed entity in the meal planning system. The data here
    is primarily generated by Claude AI based on user preferences and nutritional targets.
    """

    __tablename__ = "meals"

    # Primary Key
    id = Column(Integer, primary_key=True, autoincrement=True)

    # Foreign Key to Daily Plan
    daily_plan_id = Column(
        Integer,
        ForeignKey("daily_plans.id", ondelete="CASCADE"),
        nullable=False,
        comment="Parent daily plan"
    )

    # Meal Identification
    meal_type = Column(
        String(20),
        nullable=False,
        comment="breakfast, lunch, dinner, snack"
    )

    # Dish Information
    dish_name = Column(
        String(200),
        nullable=False,
        comment="Name of the dish (e.g., 'Grilled Chicken Salad')"
    )
    description = Column(
        Text,
        nullable=True,
        comment="Brief description or serving suggestion"
    )
    cuisine = Column(
        String(50),
        nullable=True,
        comment="Cuisine type (e.g., 'Indian', 'Italian', 'Mexican')"
    )
    portion_size = Column(
        String(100),
        nullable=True,
        comment="Human-readable portion (e.g., '1 bowl (300g)', '2 pieces')"
    )

    # Nutritional Information
    calories = Column(Float, nullable=False, comment="Total calories")
    protein = Column(Float, nullable=False, comment="Protein in grams")
    carbs = Column(Float, nullable=False, comment="Carbohydrates in grams")
    fats = Column(Float, nullable=False, comment="Fats in grams")
    fiber = Column(Float, nullable=True, comment="Fiber in grams")
    sodium = Column(Float, nullable=True, default=0, comment="Sodium in milligrams")
    sugar = Column(Float, nullable=True, default=0, comment="Sugar in grams")

    # Recipe Details
    prep_time = Column(
        Integer,
        nullable=True,
        comment="Preparation time in minutes"
    )
    ingredients = Column(
        Text,
        nullable=True,
        comment='JSON array: [{"name":"chicken","qty":"200","unit":"g"}, ...]. Null until recipe is generated on demand.'
    )
    recipe_brief = Column(
        Text,
        nullable=True,
        comment="Short cooking instructions (2-4 steps)"
    )

    # Relationships
    daily_plan = relationship("DailyPlan", back_populates="meals")
    tracking = relationship(
        "MealTracking",
        back_populates="meal",
        uselist=False,  # One-to-one relationship
        cascade="all, delete-orphan"
    )

    # Index for efficient daily plan queries
    __table_args__ = (
        Index("idx_meals_daily_plan", "daily_plan_id"),
    )

    # JSON Property Helper for Ingredients
    @property
    def ingredients_list(self):
        """
        Parse ingredients JSON string to Python list.

        Expected format: [
            {"name": "chicken breast", "qty": "200", "unit": "g"},
            {"name": "olive oil", "qty": "1", "unit": "tbsp"},
            {"name": "salt", "qty": "1", "unit": "pinch"}
        ]
        """
        if self.ingredients:
            try:
                return json.loads(self.ingredients)
            except (json.JSONDecodeError, TypeError):
                return []
        return []

    @ingredients_list.setter
    def ingredients_list(self, value):
        """Serialize Python list to JSON string."""
        self.ingredients = json.dumps(value) if value else json.dumps([])

    def __repr__(self):
        return f"<Meal(id={self.id}, type={self.meal_type}, dish={self.dish_name}, calories={self.calories})>"
