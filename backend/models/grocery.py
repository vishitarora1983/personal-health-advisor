"""
Grocery list model for weekly shopping lists.

This model stores consolidated grocery items for a weekly meal plan.
Ingredients from all meals in the week are aggregated, deduplicated,
and categorized for easy shopping.
"""

from sqlalchemy import Column, Integer, String, Float, Boolean, ForeignKey, Index
from sqlalchemy.orm import relationship
from database import Base


class GroceryItem(Base):
    """
    A single item on the weekly grocery list.

    Grocery items are generated from all meals in a weekly plan. The system:
    1. Extracts all ingredients from all meals
    2. Aggregates quantities of duplicate ingredients
    3. Categorizes items by grocery store section
    4. Creates a checkable shopping list

    Users can check off items as they shop. The grocery list is regenerated
    each time a new weekly plan is created.

    Categories help organize the shopping trip by grouping similar items
    (e.g., all produce together, all dairy together).
    """

    __tablename__ = "grocery_items"

    # Primary Key
    id = Column(Integer, primary_key=True, autoincrement=True)

    # Foreign Key to Weekly Plan
    weekly_plan_id = Column(
        Integer,
        ForeignKey("weekly_plans.id", ondelete="CASCADE"),
        nullable=False,
        comment="Parent weekly plan"
    )

    # Ingredient Information
    ingredient_name = Column(
        String(200),
        nullable=False,
        comment="Name of ingredient (e.g., 'Chicken Breast', 'Tomatoes')"
    )
    quantity = Column(
        Float,
        nullable=True,
        comment="Total quantity needed for the week"
    )
    unit = Column(
        String(30),
        nullable=True,
        comment="Unit of measurement: g, kg, ml, L, pieces, cups, tbsp, tsp, etc."
    )

    # Category for Organization
    category = Column(
        String(50),
        nullable=False,
        comment="Grocery category: Produce, Dairy, Meat & Seafood, Grains & Bread, Spices & Condiments, Oils & Fats, Canned & Packaged, Frozen, Other"
    )

    # Shopping Tracking
    checked = Column(
        Boolean,
        nullable=False,
        default=False,
        comment="Whether user has checked off this item while shopping"
    )

    # Relationships
    weekly_plan = relationship("WeeklyPlan", back_populates="grocery_items")

    # Index for efficient weekly plan queries
    __table_args__ = (
        Index("idx_grocery_items_weekly", "weekly_plan_id"),
    )

    @staticmethod
    def get_valid_categories():
        """
        Returns list of valid grocery categories.

        These categories are used to organize the shopping list by
        grocery store sections for efficient shopping.
        """
        return [
            "Produce",              # Fresh fruits, vegetables, herbs
            "Dairy",                # Milk, cheese, yogurt, butter
            "Meat & Seafood",       # Chicken, beef, pork, fish, shellfish
            "Grains & Bread",       # Rice, pasta, bread, flour, oats
            "Spices & Condiments",  # Salt, pepper, spices, sauces, vinegar
            "Oils & Fats",          # Cooking oil, olive oil, ghee
            "Canned & Packaged",    # Canned goods, packaged items
            "Frozen",               # Frozen vegetables, frozen meats
            "Other"                 # Miscellaneous items
        ]

    def __repr__(self):
        return f"<GroceryItem(id={self.id}, name={self.ingredient_name}, qty={self.quantity}, unit={self.unit}, category={self.category})>"
