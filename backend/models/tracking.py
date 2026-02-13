"""
Meal tracking model for recording actual eating behavior.

This model allows users to track whether they:
1. Ate the meal as planned
2. Skipped the meal
3. Ate something different

If they ate something different, they can record the alternative meal's
nutritional information for accurate tracking.
"""

from datetime import datetime
from sqlalchemy import Column, Integer, String, Float, Text, DateTime, ForeignKey, Index
from sqlalchemy.orm import relationship
from database import Base


class MealTracking(Base):
    """
    Tracks actual eating behavior vs. planned meals.

    This is a 1:1 relationship with Meal (one tracking per meal, maximum).
    Users can track a meal after they've eaten (or skipped) it to maintain
    accountability and see how closely they're following their plan.

    Three tracking scenarios:
    1. ate_as_planned: User ate exactly what was planned
    2. skipped: User didn't eat this meal
    3. ate_something_else: User ate a different meal (record alternative nutrition)

    The alternative nutrition fields (alt_*) are only populated when
    status = "ate_something_else".
    """

    __tablename__ = "meal_tracking"

    # Primary Key
    id = Column(Integer, primary_key=True, autoincrement=True)

    # Foreign Key to Meal (UNIQUE constraint enforces 1:1 relationship)
    meal_id = Column(
        Integer,
        ForeignKey("meals.id", ondelete="CASCADE"),
        nullable=False,
        unique=True,
        comment="One tracking per meal (1:1 relationship)"
    )

    # Tracking Status
    status = Column(
        String(30),
        nullable=False,
        comment="ate_as_planned, skipped, ate_something_else"
    )

    # Alternative Meal Information (populated only if status = "ate_something_else")
    alt_description = Column(
        Text,
        nullable=True,
        comment="Description of what they ate instead"
    )
    alt_calories = Column(
        Float,
        nullable=True,
        comment="Calories of alternative meal"
    )
    alt_protein = Column(
        Float,
        nullable=True,
        comment="Protein in grams"
    )
    alt_carbs = Column(
        Float,
        nullable=True,
        comment="Carbohydrates in grams"
    )
    alt_fats = Column(
        Float,
        nullable=True,
        comment="Fats in grams"
    )

    # Timestamp
    tracked_at = Column(
        DateTime,
        nullable=False,
        default=datetime.utcnow,
        comment="When the tracking was recorded"
    )

    # Relationships
    meal = relationship("Meal", back_populates="tracking")

    # Unique index on meal_id (enforced by unique=True on column)
    __table_args__ = (
        Index("idx_meal_tracking_meal_unique", "meal_id", unique=True),
    )

    def get_actual_nutrition(self):
        """
        Returns the actual nutrition consumed based on tracking status.

        Returns a dict with keys: calories, protein, carbs, fats

        If ate_as_planned: Returns the planned meal's nutrition
        If skipped: Returns zeros
        If ate_something_else: Returns the alternative nutrition
        """
        if self.status == "ate_as_planned":
            return {
                "calories": self.meal.calories,
                "protein": self.meal.protein,
                "carbs": self.meal.carbs,
                "fats": self.meal.fats
            }
        elif self.status == "skipped":
            return {
                "calories": 0,
                "protein": 0,
                "carbs": 0,
                "fats": 0
            }
        elif self.status == "ate_something_else":
            return {
                "calories": self.alt_calories or 0,
                "protein": self.alt_protein or 0,
                "carbs": self.alt_carbs or 0,
                "fats": self.alt_fats or 0
            }
        else:
            # Fallback for unknown status
            return {
                "calories": 0,
                "protein": 0,
                "carbs": 0,
                "fats": 0
            }

    def __repr__(self):
        return f"<MealTracking(id={self.id}, meal_id={self.meal_id}, status={self.status})>"
