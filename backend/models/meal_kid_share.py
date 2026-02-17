"""
MealKidShare model tracking which kid profiles share each adult meal.

When an adult shares a meal with a kid, a record is created here linking the
adult's meal to the kid's profile along with the calorie scale ratio used.
"""

from sqlalchemy import Column, Integer, Float, ForeignKey, UniqueConstraint
from sqlalchemy.orm import relationship
from database import Base


class MealKidShare(Base):
    """Tracks which kids an adult meal has been shared with."""

    __tablename__ = "meal_kid_shares"

    id = Column(Integer, primary_key=True, autoincrement=True)
    meal_id = Column(
        Integer,
        ForeignKey("meals.id", ondelete="CASCADE"),
        nullable=False,
    )
    kid_profile_id = Column(
        Integer,
        ForeignKey("user_profiles.id", ondelete="CASCADE"),
        nullable=False,
    )
    scale_ratio = Column(Float, nullable=False, comment="kid_target_cal / adult_target_cal")

    __table_args__ = (
        UniqueConstraint("meal_id", "kid_profile_id", name="uq_meal_kid_share"),
    )

    meal = relationship("Meal", backref="kid_shares")
    kid_profile = relationship("UserProfile")

    def __repr__(self):
        return f"<MealKidShare(meal_id={self.meal_id}, kid={self.kid_profile_id}, ratio={self.scale_ratio})>"
