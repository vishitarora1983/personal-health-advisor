"""
Grocery list schemas for shopping list management.

These schemas handle grocery item representation, categorization,
and progress tracking for shopping lists.
"""

from typing import List, Optional, Dict
from pydantic import BaseModel, Field


class GroceryItemSchema(BaseModel):
    """
    Individual grocery item with quantity and category.

    Represents a single line item on the shopping list.
    """
    ingredient_name: str = Field(description="Normalized ingredient name")
    quantity: Optional[float] = Field(default=None, description="Amount needed (None for 'to taste')")
    unit: Optional[str] = Field(default=None, description="Measurement unit (g, kg, cups, etc.)")
    category: str = Field(description="Grocery store category")
    checked: bool = Field(default=False, description="Whether item has been purchased")


class GroceryItemResponse(GroceryItemSchema):
    """
    Grocery item response including database ID.

    Used when returning items from the database.
    """
    id: int = Field(description="Database ID of the grocery item")

    model_config = {"from_attributes": True}


class GroceryListResponse(BaseModel):
    """
    Complete grocery list grouped by category with progress tracking.

    Provides items organized by grocery store sections for efficient shopping.
    """
    plan_id: int = Field(description="Associated weekly plan ID")
    items: Dict[str, List[GroceryItemResponse]] = Field(
        description="Items grouped by category (category name -> list of items)"
    )
    total_items: int = Field(description="Total number of items")
    checked_count: int = Field(description="Number of items marked as purchased")

    @property
    def completion_percentage(self) -> float:
        """Calculate shopping completion percentage (0-100)."""
        if self.total_items == 0:
            return 0.0
        return round((self.checked_count / self.total_items) * 100, 1)


class ToggleGroceryItemRequest(BaseModel):
    """
    Request to toggle grocery item checked status.

    Used to mark items as purchased or unpurchased.
    """
    checked: bool = Field(description="New checked status")


class RegenerateGroceryListResponse(BaseModel):
    """
    Response after regenerating a grocery list.

    Includes the new list and metadata about the regeneration.
    """
    message: str = Field(default="Grocery list regenerated successfully")
    grocery_list: GroceryListResponse
    items_generated: int = Field(description="Number of unique items generated")
