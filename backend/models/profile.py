"""
User profile model for storing health, dietary, and preference information.

This model stores all user-specific data needed to generate personalized meal plans,
including physical stats, dietary restrictions, preferences, and nutritional targets.
"""

from datetime import datetime
from sqlalchemy import Column, Integer, String, Float, Text, DateTime, Boolean, ForeignKey
from sqlalchemy.orm import relationship
from database import Base
import json


class UserProfile(Base):
    """
    User profile containing all health and dietary information.

    This is the primary entity that drives meal plan generation. It includes:
    - Physical characteristics (age, weight, height) for calorie calculations
    - Activity level and weight goals for TDEE adjustments
    - Dietary restrictions (allergies, diet type, foods to avoid)
    - Cooking preferences (skill level, time constraints, spice tolerance)
    - Nutritional targets (calories, macros, micronutrients)
    - Household information (size, meals per day, snacks)

    The profile is updated infrequently and is used as input to the AI meal planner.
    """

    __tablename__ = "user_profiles"

    # Primary Key
    id = Column(Integer, primary_key=True, autoincrement=True)

    # Owner (authenticated user)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=True, index=True)
    owner = relationship("User", back_populates="profiles")

    # Profile Name
    name = Column(String(100), nullable=False, server_default="My Profile")

    # Joint Profile Flag
    is_joint = Column(Boolean, default=False, server_default="0", nullable=False)

    # Member-Only Flag (profiles created inside the Joint Profile wizard)
    is_member_only = Column(Boolean, default=False, server_default="0", nullable=False)

    # Physical Characteristics (for BMR/TDEE calculation)
    age = Column(Integer, nullable=False, comment="Age in years")
    gender = Column(String(10), nullable=False, comment="male, female, other")
    height_cm = Column(Float, nullable=False, comment="Height in centimeters")
    weight_kg = Column(Float, nullable=False, comment="Current weight in kilograms")
    activity_level = Column(
        String(20),
        nullable=False,
        comment="sedentary, lightly_active, moderately_active, very_active, extra_active"
    )

    # Household and Goal Settings
    household_size = Column(
        Integer,
        nullable=False,
        default=1,
        comment="Number of people to cook for (scales recipes)"
    )
    weight_goal = Column(
        String(20),
        nullable=False,
        comment="lose, maintain, gain (affects calorie target)"
    )

    # Medical and Dietary Restrictions (stored as JSON)
    medical_goals = Column(
        Text,
        nullable=True,
        comment="JSON array: [diabetes_management, heart_health, high_protein, low_sodium]"
    )
    diet_type = Column(
        String(30),
        nullable=False,
        default="none",
        comment="none, vegetarian, vegan, keto, paleo, mediterranean, pescatarian"
    )
    allergies = Column(
        Text,
        nullable=True,
        comment="JSON array: [peanuts, shellfish, dairy, gluten, eggs, soy, tree_nuts]"
    )
    foods_to_avoid = Column(
        Text,
        nullable=True,
        comment="Comma-separated or free text list of disliked foods"
    )
    foods_to_include = Column(
        Text,
        nullable=True,
        comment="Comma-separated or free text list of foods to actively include"
    )

    # Cooking Preferences
    spice_tolerance = Column(
        String(10),
        nullable=False,
        default="medium",
        comment="mild, medium, hot"
    )
    cooking_skill = Column(
        String(20),
        nullable=False,
        default="intermediate",
        comment="beginner, intermediate, advanced"
    )
    max_cook_time = Column(
        Integer,
        nullable=False,
        default=45,
        comment="Maximum cooking time in minutes"
    )
    cuisines = Column(
        Text,
        nullable=True,
        comment="JSON array: [indian, italian, mexican, chinese, thai, japanese]"
    )

    # Meal Structure
    meals_per_day = Column(
        Text,
        nullable=False,
        comment="JSON array: [breakfast, lunch, dinner]"
    )
    snacks_per_day = Column(
        Integer,
        nullable=False,
        default=1,
        comment="Number of snacks per day (0-3)"
    )
    meals_to_repeat = Column(
        Integer,
        nullable=False,
        default=4,
        comment="Number of lunch/dinner meals to repeat across the week (0-7)"
    )

    # Nutritional Targets (nullable = auto-calculated from BMR/TDEE if not set)
    target_calories = Column(
        Integer,
        nullable=True,
        comment="Daily calorie target (auto-calculated if null)"
    )
    target_protein = Column(Integer, nullable=True, comment="Daily protein in grams")
    target_carbs = Column(Integer, nullable=True, comment="Daily carbs in grams")
    target_fats = Column(Integer, nullable=True, comment="Daily fats in grams")
    target_fiber = Column(Integer, nullable=True, comment="Daily fiber in grams")
    target_sodium = Column(Integer, nullable=True, comment="Daily sodium in mg")
    target_sugar = Column(Integer, nullable=True, comment="Daily sugar in grams")

    # Timestamps
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    updated_at = Column(
        DateTime,
        nullable=False,
        default=datetime.utcnow,
        onupdate=datetime.utcnow
    )

    # Relationships
    weekly_plans = relationship(
        "WeeklyPlan",
        back_populates="profile",
        cascade="all, delete-orphan",
        lazy="dynamic"
    )

    # JSON Property Helpers
    # These provide convenient Python list access to JSON-stored fields

    @property
    def medical_goals_list(self):
        """Parse medical_goals JSON string to Python list."""
        if self.medical_goals:
            try:
                return json.loads(self.medical_goals)
            except (json.JSONDecodeError, TypeError):
                return []
        return []

    @medical_goals_list.setter
    def medical_goals_list(self, value):
        """Serialize Python list to JSON string."""
        self.medical_goals = json.dumps(value) if value else None

    @property
    def allergies_list(self):
        """Parse allergies JSON string to Python list."""
        if self.allergies:
            try:
                return json.loads(self.allergies)
            except (json.JSONDecodeError, TypeError):
                return []
        return []

    @allergies_list.setter
    def allergies_list(self, value):
        """Serialize Python list to JSON string."""
        self.allergies = json.dumps(value) if value else None

    @property
    def cuisines_list(self):
        """Parse cuisines JSON string to Python list."""
        if self.cuisines:
            try:
                return json.loads(self.cuisines)
            except (json.JSONDecodeError, TypeError):
                return []
        return []

    @cuisines_list.setter
    def cuisines_list(self, value):
        """Serialize Python list to JSON string."""
        self.cuisines = json.dumps(value) if value else None

    @property
    def meals_per_day_list(self):
        """Parse meals_per_day JSON string to Python list."""
        if self.meals_per_day:
            try:
                return json.loads(self.meals_per_day)
            except (json.JSONDecodeError, TypeError):
                return ["breakfast", "lunch", "dinner"]
        return ["breakfast", "lunch", "dinner"]

    @meals_per_day_list.setter
    def meals_per_day_list(self, value):
        """Serialize Python list to JSON string."""
        self.meals_per_day = json.dumps(value) if value else json.dumps(["breakfast", "lunch", "dinner"])

    def __repr__(self):
        return f"<UserProfile(id={self.id}, age={self.age}, gender={self.gender}, weight_goal={self.weight_goal})>"
