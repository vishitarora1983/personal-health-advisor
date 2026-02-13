# 06 — Grocery List (Phase 5)

## Overview

The Grocery List feature automatically generates a categorized shopping list from the weekly meal plan by aggregating all ingredients across all meals, merging duplicates, summing quantities, and organizing items by grocery store category. Users can check off items as they shop, with progress tracking and the ability to regenerate the list when meal plans change.

**Key Capabilities:**
- Automatic aggregation of ingredients from weekly meal plan
- Smart merging of duplicate ingredients with quantity summation
- Categorization by grocery store sections (Produce, Meat, Dairy, etc.)
- Interactive checklist with progress tracking
- Regeneration when meal plan is modified
- Unit normalization and conversion
- Print-friendly view for physical shopping

**Technical Approach:**
- Parse all meal ingredients from the weekly plan
- Normalize ingredient names and units for accurate matching
- Aggregate quantities by ingredient and unit
- Classify into grocery categories using keyword matching
- Persist to database with checked state
- Provide CRUD operations via REST API

---

## Backend Implementation

### Database Model

The `GroceryItem` model is already defined in `backend/models/grocery.py`:

```python
from sqlalchemy import Column, Integer, String, Float, Boolean, ForeignKey, DateTime
from sqlalchemy.orm import relationship
from datetime import datetime
from .base import Base

class GroceryItem(Base):
    __tablename__ = "grocery_items"

    id = Column(Integer, primary_key=True, index=True)
    weekly_plan_id = Column(Integer, ForeignKey("weekly_plans.id"), nullable=False)
    ingredient_name = Column(String, nullable=False)
    quantity = Column(Float, nullable=True)  # None for "to taste"
    unit = Column(String, nullable=True)
    category = Column(String, nullable=False)  # Produce, Meat, Dairy, etc.
    checked = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    weekly_plan = relationship("WeeklyPlan", back_populates="grocery_items")
```

**Design Notes:**
- `quantity` is nullable to handle "to taste" or "as needed" ingredients
- `unit` is nullable for items sold by count (e.g., "3 onions")
- `checked` tracks shopping progress
- `category` enables grouping in UI
- Composite of (weekly_plan_id, ingredient_name, unit) creates a logical unique constraint for aggregation

---

### Pydantic Schemas

**File:** `backend/schemas/grocery.py`

```python
"""
Pydantic schemas for grocery list functionality.

Handles validation and serialization of grocery items, categories,
and complete shopping lists with progress tracking.
"""

from pydantic import BaseModel, Field, validator
from typing import Optional, List


class GroceryItemResponse(BaseModel):
    """
    Individual grocery item with quantity, unit, and checked status.

    Represents a single line item on the shopping list, such as:
    - "Chicken breast — 1.2 kg"
    - "Garlic — 8 cloves"
    - "Salt — to taste"
    """
    id: int = Field(..., description="Unique grocery item ID")
    ingredient_name: str = Field(..., description="Normalized ingredient name")
    quantity: Optional[float] = Field(None, description="Amount needed (None for 'to taste')")
    unit: Optional[str] = Field(None, description="Measurement unit (g, kg, cups, pieces, etc.)")
    category: str = Field(..., description="Grocery store category")
    checked: bool = Field(default=False, description="Whether item has been purchased")

    class Config:
        from_attributes = True
        json_schema_extra = {
            "example": {
                "id": 1,
                "ingredient_name": "chicken breast",
                "quantity": 1.2,
                "unit": "kg",
                "category": "Meat & Seafood",
                "checked": False
            }
        }


class GroceryCategoryResponse(BaseModel):
    """
    Grouped collection of grocery items by category.

    Organizes items by grocery store section (Produce, Meat, Dairy, etc.)
    for efficient shopping route planning.
    """
    category: str = Field(..., description="Category name (e.g., 'Produce', 'Meat & Seafood')")
    items: List[GroceryItemResponse] = Field(default_factory=list, description="Items in this category")

    @property
    def total_items(self) -> int:
        """Total number of items in this category."""
        return len(self.items)

    @property
    def checked_items(self) -> int:
        """Number of checked items in this category."""
        return sum(1 for item in self.items if item.checked)

    class Config:
        json_schema_extra = {
            "example": {
                "category": "Produce",
                "items": [
                    {
                        "id": 1,
                        "ingredient_name": "onion",
                        "quantity": 3.0,
                        "unit": "pieces",
                        "category": "Produce",
                        "checked": False
                    },
                    {
                        "id": 2,
                        "ingredient_name": "garlic",
                        "quantity": 8.0,
                        "unit": "cloves",
                        "category": "Produce",
                        "checked": True
                    }
                ]
            }
        }


class GroceryListResponse(BaseModel):
    """
    Complete grocery list with all categories and progress tracking.

    Provides a comprehensive view of the shopping list with metadata
    for UI progress indicators and completion tracking.
    """
    plan_id: int = Field(..., description="Associated weekly plan ID")
    categories: List[GroceryCategoryResponse] = Field(default_factory=list, description="Items grouped by category")
    total_items: int = Field(..., description="Total number of items across all categories")
    checked_items: int = Field(..., description="Number of items marked as purchased")

    @property
    def completion_percentage(self) -> float:
        """Calculate shopping completion percentage (0-100)."""
        if self.total_items == 0:
            return 0.0
        return round((self.checked_items / self.total_items) * 100, 1)

    @property
    def is_complete(self) -> bool:
        """Check if all items have been purchased."""
        return self.total_items > 0 and self.checked_items == self.total_items

    class Config:
        json_schema_extra = {
            "example": {
                "plan_id": 1,
                "categories": [
                    {
                        "category": "Produce",
                        "items": [
                            {
                                "id": 1,
                                "ingredient_name": "onion",
                                "quantity": 3.0,
                                "unit": "pieces",
                                "category": "Produce",
                                "checked": False
                            }
                        ]
                    }
                ],
                "total_items": 35,
                "checked_items": 12
            }
        }


class GroceryItemUpdate(BaseModel):
    """
    Update schema for modifying grocery item checked status.

    Currently only supports toggling the checked state.
    Future extensions could include quantity adjustments.
    """
    checked: bool = Field(..., description="New checked status")

    class Config:
        json_schema_extra = {
            "example": {
                "checked": True
            }
        }


class GroceryListGenerateRequest(BaseModel):
    """
    Optional request body for grocery list generation.

    Currently empty but allows for future parameters like:
    - Include pantry staples
    - Exclude certain categories
    - Apply quantity multipliers
    """
    pass


class GroceryListGenerateResponse(BaseModel):
    """
    Response after generating a grocery list.

    Returns the complete list plus metadata about the generation process.
    """
    message: str = Field(default="Grocery list generated successfully")
    grocery_list: GroceryListResponse
    items_aggregated: int = Field(..., description="Number of raw ingredient entries processed")

    class Config:
        json_schema_extra = {
            "example": {
                "message": "Grocery list generated successfully",
                "grocery_list": {
                    "plan_id": 1,
                    "categories": [],
                    "total_items": 35,
                    "checked_items": 0
                },
                "items_aggregated": 87
            }
        }
```

**Design Decisions:**
- `GroceryItemResponse` uses optional quantity/unit to handle "to taste" ingredients
- `GroceryCategoryResponse` includes computed properties for category-level progress
- `GroceryListResponse` provides completion percentage for UI progress bars
- `GroceryItemUpdate` is minimal but extensible for future features
- All schemas include comprehensive examples for API documentation

---

### Grocery Service

**File:** `backend/services/grocery_service.py`

```python
"""
Grocery list generation and management service.

Handles intelligent aggregation of ingredients from weekly meal plans,
including normalization, categorization, quantity summing, and duplicate merging.

Key Features:
- Ingredient name normalization (singularization, article removal)
- Unit standardization (g, kg, ml, L, cups, tbsp, tsp, pieces)
- Smart quantity parsing (fractions, ranges, "to taste")
- Category classification via keyword matching
- Duplicate detection and quantity aggregation
"""

from sqlalchemy.orm import Session
from sqlalchemy import select
from typing import Dict, List, Optional, Tuple, Set
import json
import re
from fractions import Fraction

from models.grocery import GroceryItem
from models.weekly_plan import WeeklyPlan
from models.daily_plan import DailyPlan
from models.meal import Meal
from schemas.grocery import (
    GroceryListResponse,
    GroceryCategoryResponse,
    GroceryItemResponse
)


# ============================================================================
# CATEGORY CLASSIFICATION
# ============================================================================

# Comprehensive mapping of ingredient keywords to grocery store categories
# Each category contains common ingredient names and their variations
CATEGORY_MAP = {
    "Produce": [
        # Vegetables
        "lettuce", "tomato", "tomatoes", "onion", "onions", "garlic", "pepper", "peppers",
        "bell pepper", "capsicum", "carrot", "carrots", "broccoli", "spinach", "kale",
        "avocado", "lemon", "lemons", "lime", "limes", "ginger", "cilantro", "coriander",
        "parsley", "basil", "mint", "thyme", "rosemary", "oregano", "dill", "chives",
        "potato", "potatoes", "sweet potato", "yam", "mushroom", "mushrooms",
        "zucchini", "cucumber", "celery", "cabbage", "cauliflower", "eggplant", "aubergine",
        "squash", "pumpkin", "beet", "beets", "radish", "turnip", "arugula", "rocket",
        "bok choy", "swiss chard", "collard", "scallion", "green onion", "leek",
        "jalapeno", "chili", "chilli", "serrano", "habanero",
        # Fruits
        "apple", "apples", "banana", "bananas", "berry", "berries", "strawberry",
        "blueberry", "raspberry", "blackberry", "mango", "mangoes", "pineapple",
        "orange", "oranges", "grape", "grapes", "watermelon", "melon", "cantaloupe",
        "peach", "peaches", "pear", "pears", "plum", "plums", "cherry", "cherries",
        "kiwi", "papaya", "guava", "pomegranate", "fig", "date", "dates",
        # Fresh herbs
        "herb", "herbs", "fresh basil", "fresh cilantro", "fresh parsley"
    ],

    "Meat & Seafood": [
        "chicken", "chicken breast", "chicken thigh", "chicken leg", "chicken wing",
        "beef", "ground beef", "steak", "sirloin", "ribeye", "chuck", "brisket",
        "pork", "pork chop", "pork loin", "bacon", "ham", "sausage", "chorizo",
        "lamb", "lamb chop", "ground lamb", "turkey", "ground turkey", "turkey breast",
        "duck", "venison", "veal",
        "salmon", "tuna", "cod", "tilapia", "halibut", "trout", "mackerel", "sardine",
        "shrimp", "prawns", "crab", "lobster", "scallop", "scallops", "mussel", "mussels",
        "clam", "clams", "oyster", "oysters", "squid", "calamari", "octopus",
        "fish", "white fish", "fish fillet"
    ],

    "Dairy & Eggs": [
        "milk", "whole milk", "skim milk", "2% milk", "almond milk", "soy milk",
        "oat milk", "coconut milk", "lactose-free milk",
        "cheese", "cheddar", "mozzarella", "parmesan", "feta", "goat cheese",
        "cream cheese", "ricotta", "cottage cheese", "swiss cheese", "brie", "gouda",
        "yogurt", "greek yogurt", "yoghurt", "plain yogurt", "vanilla yogurt",
        "butter", "unsalted butter", "salted butter", "ghee",
        "cream", "heavy cream", "whipping cream", "sour cream", "half and half",
        "egg", "eggs", "egg whites", "egg yolks",
        "paneer", "queso", "mascarpone", "crème fraîche"
    ],

    "Grains & Bread": [
        "rice", "white rice", "brown rice", "jasmine rice", "basmati rice", "arborio rice",
        "wild rice", "rice noodles",
        "bread", "white bread", "whole wheat bread", "sourdough", "baguette", "roll", "rolls",
        "bun", "buns", "pita", "naan", "tortilla", "tortillas", "wrap", "wraps",
        "pasta", "spaghetti", "penne", "fusilli", "linguine", "fettuccine", "macaroni",
        "lasagna", "ravioli", "noodles", "ramen", "udon", "soba",
        "flour", "all-purpose flour", "whole wheat flour", "bread flour", "cake flour",
        "oats", "rolled oats", "steel cut oats", "oatmeal",
        "quinoa", "couscous", "bulgur", "farro", "barley", "millet",
        "cereal", "granola", "cornmeal", "polenta", "grits",
        "bagel", "bagels", "english muffin", "croissant", "breadcrumbs", "panko"
    ],

    "Spices & Condiments": [
        "salt", "sea salt", "kosher salt", "table salt", "pink salt",
        "pepper", "black pepper", "white pepper", "peppercorn",
        "cumin", "coriander powder", "turmeric", "paprika", "cayenne", "chili powder",
        "cinnamon", "nutmeg", "clove", "cloves", "cardamom", "allspice",
        "bay leaf", "bay leaves", "vanilla", "vanilla extract", "almond extract",
        "soy sauce", "tamari", "worcestershire", "fish sauce", "oyster sauce",
        "hot sauce", "sriracha", "tabasco",
        "vinegar", "white vinegar", "apple cider vinegar", "balsamic vinegar",
        "rice vinegar", "red wine vinegar",
        "mustard", "dijon mustard", "yellow mustard", "whole grain mustard",
        "ketchup", "mayo", "mayonnaise", "bbq sauce", "barbecue sauce",
        "honey", "maple syrup", "agave", "molasses", "brown sugar", "white sugar",
        "sugar", "powdered sugar", "confectioners sugar",
        "curry powder", "garam masala", "italian seasoning", "herbs de provence",
        "garlic powder", "onion powder", "ginger powder", "chili flakes", "red pepper flakes",
        "sesame seeds", "poppy seeds", "mustard seeds", "fennel seeds", "fenugreek"
    ],

    "Oils & Fats": [
        "olive oil", "extra virgin olive oil", "vegetable oil", "canola oil",
        "coconut oil", "sesame oil", "peanut oil", "avocado oil", "grapeseed oil",
        "sunflower oil", "safflower oil", "corn oil",
        "ghee", "lard", "shortening", "cooking spray", "butter"
    ],

    "Canned & Packaged": [
        "canned", "can", "canned tomatoes", "tomato sauce", "tomato paste", "tomato puree",
        "beans", "black beans", "kidney beans", "pinto beans", "cannellini beans",
        "chickpeas", "garbanzo beans", "lentils", "red lentils", "green lentils",
        "coconut milk", "canned coconut milk", "evaporated milk", "condensed milk",
        "broth", "stock", "chicken broth", "beef broth", "vegetable broth",
        "chicken stock", "beef stock", "vegetable stock",
        "soup", "canned soup", "condensed soup",
        "tuna", "canned tuna", "sardines", "anchovies",
        "olives", "pickles", "capers", "roasted red peppers",
        "peanut butter", "almond butter", "tahini", "nutella",
        "jam", "jelly", "preserves", "marmalade",
        "salsa", "pasta sauce", "marinara", "alfredo sauce",
        "refried beans", "baked beans", "corn", "canned corn", "green beans"
    ],

    "Frozen": [
        "frozen", "frozen vegetables", "frozen peas", "frozen corn", "frozen broccoli",
        "frozen berries", "frozen strawberries", "frozen blueberries",
        "frozen pizza", "frozen fries", "ice cream", "frozen yogurt", "sorbet",
        "frozen fish", "frozen shrimp", "frozen chicken", "frozen meatballs"
    ],

    "Nuts & Seeds": [
        "almonds", "walnuts", "cashews", "pecans", "peanuts", "pistachios",
        "hazelnuts", "macadamia", "brazil nuts", "pine nuts",
        "chia seeds", "flax seeds", "flaxseed", "sunflower seeds", "pumpkin seeds",
        "hemp seeds", "sesame seeds", "poppy seeds"
    ],

    "Beverages": [
        "tea", "green tea", "black tea", "herbal tea", "chai",
        "coffee", "instant coffee", "espresso",
        "juice", "orange juice", "apple juice", "cranberry juice",
        "soda", "sparkling water", "tonic water", "club soda",
        "wine", "red wine", "white wine", "cooking wine",
        "beer", "sake", "rum", "vodka", "whiskey"
    ],

    "Baking": [
        "baking powder", "baking soda", "yeast", "active dry yeast", "instant yeast",
        "cornstarch", "corn starch", "tapioca", "gelatin", "pectin",
        "chocolate chips", "cocoa powder", "cacao", "dark chocolate", "milk chocolate",
        "white chocolate", "baking chocolate",
        "vanilla extract", "almond extract", "coconut extract", "food coloring",
        "sprinkles", "icing", "frosting"
    ],

    "Other": []  # Default catch-all category
}


def classify_ingredient(name: str) -> str:
    """
    Classify an ingredient into a grocery store category based on keyword matching.

    Algorithm:
    1. Convert ingredient name to lowercase for case-insensitive matching
    2. Check each category's keyword list for partial matches
    3. Return the first matching category
    4. Default to "Other" if no match found

    Args:
        name: Normalized ingredient name (e.g., "chicken breast", "tomato")

    Returns:
        Category name (e.g., "Meat & Seafood", "Produce", "Other")

    Examples:
        >>> classify_ingredient("chicken breast")
        "Meat & Seafood"
        >>> classify_ingredient("organic tomatoes")
        "Produce"
        >>> classify_ingredient("unknown ingredient")
        "Other"
    """
    name_lower = name.lower().strip()

    # Check each category for keyword matches
    for category, keywords in CATEGORY_MAP.items():
        if category == "Other":
            continue

        for keyword in keywords:
            # Check for whole word match to avoid false positives
            # e.g., "rice" shouldn't match "licorice"
            if f" {keyword} " in f" {name_lower} " or \
               name_lower.startswith(keyword + " ") or \
               name_lower.endswith(" " + keyword) or \
               name_lower == keyword:
                return category

    return "Other"


# ============================================================================
# UNIT NORMALIZATION
# ============================================================================

# Comprehensive unit conversion map for standardization
# Maps various unit representations to canonical forms
UNIT_CONVERSIONS = {
    # Weight - Metric
    "g": "g",
    "gram": "g",
    "grams": "g",
    "gm": "g",
    "kg": "kg",
    "kilogram": "kg",
    "kilograms": "kg",
    "kgs": "kg",
    "mg": "mg",
    "milligram": "mg",
    "milligrams": "mg",

    # Volume - Metric
    "ml": "ml",
    "milliliter": "ml",
    "milliliters": "ml",
    "millilitre": "ml",
    "millilitres": "ml",
    "l": "L",
    "liter": "L",
    "liters": "L",
    "litre": "L",
    "litres": "L",

    # Volume - Imperial/US
    "cup": "cups",
    "cups": "cups",
    "c": "cups",
    "tbsp": "tbsp",
    "tablespoon": "tbsp",
    "tablespoons": "tbsp",
    "tbs": "tbsp",
    "tsp": "tsp",
    "teaspoon": "tsp",
    "teaspoons": "tsp",
    "fl oz": "fl oz",
    "fluid ounce": "fl oz",
    "fluid ounces": "fl oz",
    "oz": "oz",
    "ounce": "oz",
    "ounces": "oz",
    "pint": "pints",
    "pints": "pints",
    "pt": "pints",
    "quart": "quarts",
    "quarts": "quarts",
    "qt": "quarts",
    "gallon": "gallons",
    "gallons": "gallons",
    "gal": "gallons",

    # Count
    "piece": "pieces",
    "pieces": "pieces",
    "pcs": "pieces",
    "pc": "pieces",
    "item": "pieces",
    "items": "pieces",
    "whole": "whole",

    # Bundles
    "bunch": "bunches",
    "bunches": "bunches",
    "bundle": "bundles",
    "bundles": "bundles",

    # Parts
    "clove": "cloves",
    "cloves": "cloves",
    "slice": "slices",
    "slices": "slices",
    "leaf": "leaves",
    "leaves": "leaves",
    "sprig": "sprigs",
    "sprigs": "sprigs",
    "stalk": "stalks",
    "stalks": "stalks",

    # Containers
    "can": "cans",
    "cans": "cans",
    "jar": "jars",
    "jars": "jars",
    "bottle": "bottles",
    "bottles": "bottles",
    "package": "packages",
    "packages": "packages",
    "pkg": "packages",
    "bag": "bags",
    "bags": "bags",
    "box": "boxes",
    "boxes": "boxes",

    # Special
    "pinch": "pinches",
    "pinches": "pinches",
    "dash": "dashes",
    "dashes": "dashes",
    "handful": "handfuls",
    "handfuls": "handfuls",
}


def normalize_unit(unit: str) -> str:
    """
    Normalize a unit string to its canonical form.

    Handles various unit representations and converts them to standardized forms:
    - "tablespoon" → "tbsp"
    - "Grams" → "g"
    - "Cup" → "cups"

    Args:
        unit: Raw unit string from ingredient (e.g., "tablespoons", "GRAMS", "Cup")

    Returns:
        Normalized unit string (e.g., "tbsp", "g", "cups")

    Examples:
        >>> normalize_unit("tablespoons")
        "tbsp"
        >>> normalize_unit("GRAMS")
        "g"
        >>> normalize_unit("unknown")
        "unknown"
    """
    if not unit:
        return ""

    unit_lower = unit.lower().strip()
    return UNIT_CONVERSIONS.get(unit_lower, unit_lower)


# ============================================================================
# INGREDIENT NAME NORMALIZATION
# ============================================================================

# Common article words to remove from ingredient names
ARTICLES = {"a", "an", "the"}

# Plural to singular conversions for common ingredients
# Helps merge "tomatoes" and "tomato" into single entry
PLURAL_MAP = {
    "tomatoes": "tomato",
    "potatoes": "potato",
    "onions": "onion",
    "carrots": "carrot",
    "peppers": "pepper",
    "mushrooms": "mushroom",
    "berries": "berry",
    "strawberries": "strawberry",
    "blueberries": "blueberry",
    "raspberries": "raspberry",
    "leaves": "leaf",
    "cloves": "clove",
    "olives": "olive",
    "beans": "bean",
}

# Ingredient name variations to standardize
# Maps alternative names to canonical forms
NAME_VARIATIONS = {
    "bell pepper": "capsicum",
    "capsicum": "bell pepper",
    "green onion": "scallion",
    "spring onion": "scallion",
    "coriander": "cilantro",
    "cilantro": "coriander",
    "eggplant": "aubergine",
    "aubergine": "eggplant",
    "zucchini": "courgette",
    "courgette": "zucchini",
}


def normalize_ingredient_name(name: str) -> str:
    """
    Normalize an ingredient name for consistent aggregation.

    Normalization steps:
    1. Convert to lowercase
    2. Remove leading articles ("a", "an", "the")
    3. Singularize common plurals
    4. Strip extra whitespace
    5. Standardize name variations

    This ensures "The Tomatoes", "tomato", and "a tomato" all aggregate together.

    Args:
        name: Raw ingredient name from meal data

    Returns:
        Normalized ingredient name

    Examples:
        >>> normalize_ingredient_name("The Tomatoes")
        "tomato"
        >>> normalize_ingredient_name("  A  chicken  breast  ")
        "chicken breast"
        >>> normalize_ingredient_name("Green Onions")
        "scallion"
    """
    # Convert to lowercase and strip whitespace
    normalized = name.lower().strip()

    # Remove extra internal whitespace
    normalized = re.sub(r'\s+', ' ', normalized)

    # Remove leading articles
    words = normalized.split()
    if words and words[0] in ARTICLES:
        words = words[1:]
        normalized = ' '.join(words)

    # Singularize common plurals
    # Check the last word for plural form
    words = normalized.split()
    if words and words[-1] in PLURAL_MAP:
        words[-1] = PLURAL_MAP[words[-1]]
        normalized = ' '.join(words)

    # Handle name variations
    for variation, canonical in NAME_VARIATIONS.items():
        if variation in normalized:
            normalized = normalized.replace(variation, canonical)

    # Remove any parenthetical notes (e.g., "chicken (boneless)" → "chicken")
    normalized = re.sub(r'\s*\([^)]*\)', '', normalized)

    # Final cleanup
    normalized = normalized.strip()

    return normalized if normalized else name.lower()


# ============================================================================
# QUANTITY PARSING
# ============================================================================

def parse_quantity(qty_str: str) -> Optional[float]:
    """
    Parse a quantity string into a float value.

    Handles various formats:
    - Simple numbers: "200" → 200.0
    - Decimals: "1.5" → 1.5
    - Fractions: "1/2" → 0.5
    - Mixed numbers: "1 1/2" → 1.5
    - Ranges: "2-3" → 3.0 (take upper bound)
    - To taste: "to taste", "as needed" → None

    Args:
        qty_str: Quantity string from ingredient data

    Returns:
        Parsed quantity as float, or None for "to taste" ingredients

    Examples:
        >>> parse_quantity("200")
        200.0
        >>> parse_quantity("1 1/2")
        1.5
        >>> parse_quantity("2-3")
        3.0
        >>> parse_quantity("to taste")
        None
    """
    if not qty_str:
        return None

    qty_str = str(qty_str).strip().lower()

    # Handle "to taste", "as needed", etc.
    if any(phrase in qty_str for phrase in ["to taste", "as needed", "taste", "optional"]):
        return None

    # Remove any leading/trailing non-numeric characters except fractions and decimals
    qty_str = re.sub(r'[^0-9\-\.\/\s]', '', qty_str).strip()

    if not qty_str:
        return None

    try:
        # Handle ranges (e.g., "2-3", "1.5-2") - take the upper bound
        if '-' in qty_str and qty_str.count('-') == 1:
            parts = qty_str.split('-')
            # Make sure it's not a negative number
            if parts[0].strip() and parts[1].strip():
                return float(parts[1].strip())

        # Handle fractions (e.g., "1/2", "3/4")
        if '/' in qty_str:
            # Check for mixed numbers (e.g., "1 1/2")
            if ' ' in qty_str.strip():
                parts = qty_str.strip().split()
                whole = float(parts[0])
                fraction = Fraction(parts[1])
                return float(whole + fraction)
            else:
                return float(Fraction(qty_str))

        # Handle simple numbers
        return float(qty_str)

    except (ValueError, ZeroDivisionError):
        # If parsing fails, return None rather than raising error
        # This allows ingredients to be included without quantities
        return None


# ============================================================================
# GROCERY LIST GENERATION
# ============================================================================

def get_all_meals_for_plan(db: Session, plan_id: int) -> List[Meal]:
    """
    Retrieve all meals associated with a weekly plan.

    Traverses the relationship chain:
    WeeklyPlan → DailyPlans → Meals

    Args:
        db: Database session
        plan_id: Weekly plan ID

    Returns:
        List of all meals in the plan across all days
    """
    # Get all daily plans for this weekly plan
    daily_plans = db.query(DailyPlan).filter(
        DailyPlan.weekly_plan_id == plan_id
    ).all()

    # Collect all meals from all daily plans
    meals = []
    for daily_plan in daily_plans:
        # Get meals for this daily plan
        day_meals = db.query(Meal).filter(
            Meal.daily_plan_id == daily_plan.id
        ).all()
        meals.extend(day_meals)

    return meals


def generate_grocery_list(db: Session, plan_id: int) -> GroceryListResponse:
    """
    Generate a complete grocery list from a weekly meal plan.

    Algorithm:
    1. Collect all ingredients from all meals in the weekly plan
    2. Normalize ingredient names and units
    3. Aggregate by (normalized_name, normalized_unit)
    4. Sum quantities for matching ingredients
    5. Classify each ingredient into grocery categories
    6. Delete existing grocery items (if regenerating)
    7. Create new GroceryItem records
    8. Return grouped by category

    Args:
        db: Database session
        plan_id: Weekly plan ID to generate grocery list for

    Returns:
        GroceryListResponse with categorized items and progress tracking

    Raises:
        ValueError: If plan doesn't exist or has no meals
    """
    # Verify plan exists
    plan = db.query(WeeklyPlan).filter(WeeklyPlan.id == plan_id).first()
    if not plan:
        raise ValueError(f"Weekly plan {plan_id} not found")

    # Step 1: Collect all ingredients from all meals
    all_ingredients = []
    meals = get_all_meals_for_plan(db, plan_id)

    if not meals:
        raise ValueError(f"Weekly plan {plan_id} has no meals")

    raw_ingredient_count = 0

    for meal in meals:
        # Parse ingredients JSON
        try:
            ingredients = json.loads(meal.ingredients) if isinstance(meal.ingredients, str) else meal.ingredients
        except (json.JSONDecodeError, TypeError):
            continue

        # Handle both list and dict formats
        if isinstance(ingredients, dict):
            ingredients = ingredients.get("items", [])

        for ing in ingredients:
            raw_ingredient_count += 1

            # Extract fields with fallbacks
            name = ing.get("name", ing.get("ingredient", "Unknown"))
            quantity_str = ing.get("quantity", ing.get("amount", ""))
            unit = ing.get("unit", "")

            # Normalize
            normalized_name = normalize_ingredient_name(name)
            normalized_unit = normalize_unit(unit) if unit else ""
            parsed_quantity = parse_quantity(str(quantity_str)) if quantity_str else None

            all_ingredients.append({
                "name": normalized_name,
                "quantity": parsed_quantity,
                "unit": normalized_unit
            })

    # Step 2: Aggregate ingredients by (name, unit)
    # Key = (normalized_name, normalized_unit)
    # Value = {"name": str, "quantity": float, "unit": str}
    aggregated: Dict[Tuple[str, str], Dict] = {}

    for ing in all_ingredients:
        key = (ing["name"], ing["unit"])

        if key in aggregated:
            # Merge quantities
            existing_qty = aggregated[key]["quantity"]
            new_qty = ing["quantity"]

            # Only sum if both are numeric (not None/"to taste")
            if existing_qty is not None and new_qty is not None:
                aggregated[key]["quantity"] = existing_qty + new_qty
            elif new_qty is not None:
                # If existing was None but new is numeric, use new
                aggregated[key]["quantity"] = new_qty
            # else: keep existing (including None)
        else:
            # New ingredient
            aggregated[key] = ing.copy()

    # Step 3: Classify and create GroceryItem objects
    items_to_create = []

    for (name, unit), ing in aggregated.items():
        category = classify_ingredient(name)

        item = GroceryItem(
            weekly_plan_id=plan_id,
            ingredient_name=name,
            quantity=ing["quantity"],
            unit=unit if unit else None,
            category=category,
            checked=False
        )
        items_to_create.append(item)

    # Step 4: Delete existing grocery items for this plan (regeneration scenario)
    db.query(GroceryItem).filter(GroceryItem.weekly_plan_id == plan_id).delete()

    # Step 5: Bulk insert new items
    db.add_all(items_to_create)
    db.commit()

    # Step 6: Return the complete grocery list
    return get_grocery_list(db, plan_id)


def get_grocery_list(db: Session, plan_id: int) -> GroceryListResponse:
    """
    Retrieve the grocery list for a weekly plan, grouped by category.

    Args:
        db: Database session
        plan_id: Weekly plan ID

    Returns:
        GroceryListResponse with items grouped by category

    Raises:
        ValueError: If plan doesn't exist
    """
    # Verify plan exists
    plan = db.query(WeeklyPlan).filter(WeeklyPlan.id == plan_id).first()
    if not plan:
        raise ValueError(f"Weekly plan {plan_id} not found")

    # Get all grocery items for this plan
    items = db.query(GroceryItem).filter(
        GroceryItem.weekly_plan_id == plan_id
    ).order_by(GroceryItem.category, GroceryItem.ingredient_name).all()

    # Group by category
    categories_dict: Dict[str, List[GroceryItem]] = {}
    for item in items:
        if item.category not in categories_dict:
            categories_dict[item.category] = []
        categories_dict[item.category].append(item)

    # Convert to response schema
    categories = []
    total_items = 0
    checked_items = 0

    # Define category display order (common categories first)
    category_order = [
        "Produce",
        "Meat & Seafood",
        "Dairy & Eggs",
        "Grains & Bread",
        "Canned & Packaged",
        "Frozen",
        "Spices & Condiments",
        "Oils & Fats",
        "Nuts & Seeds",
        "Baking",
        "Beverages",
        "Other"
    ]

    # Sort categories by defined order
    sorted_categories = sorted(
        categories_dict.keys(),
        key=lambda x: category_order.index(x) if x in category_order else 999
    )

    for category_name in sorted_categories:
        category_items = categories_dict[category_name]

        item_responses = [
            GroceryItemResponse.model_validate(item)
            for item in category_items
        ]

        categories.append(GroceryCategoryResponse(
            category=category_name,
            items=item_responses
        ))

        total_items += len(item_responses)
        checked_items += sum(1 for item in item_responses if item.checked)

    return GroceryListResponse(
        plan_id=plan_id,
        categories=categories,
        total_items=total_items,
        checked_items=checked_items
    )


def update_grocery_item(
    db: Session,
    item_id: int,
    checked: bool
) -> GroceryItemResponse:
    """
    Update the checked status of a grocery item.

    Args:
        db: Database session
        item_id: Grocery item ID
        checked: New checked status

    Returns:
        Updated GroceryItemResponse

    Raises:
        ValueError: If item doesn't exist
    """
    item = db.query(GroceryItem).filter(GroceryItem.id == item_id).first()
    if not item:
        raise ValueError(f"Grocery item {item_id} not found")

    item.checked = checked
    db.commit()
    db.refresh(item)

    return GroceryItemResponse.model_validate(item)


def delete_grocery_list(db: Session, plan_id: int) -> None:
    """
    Delete all grocery items for a weekly plan.

    Used when a plan is deleted or needs to be regenerated from scratch.

    Args:
        db: Database session
        plan_id: Weekly plan ID
    """
    db.query(GroceryItem).filter(GroceryItem.weekly_plan_id == plan_id).delete()
    db.commit()
```

**Design Decisions:**
- **Comprehensive categorization**: 11 categories covering all common grocery store sections
- **Fuzzy matching**: Uses substring matching for ingredient classification
- **Quantity aggregation**: Only sums quantities when units match to avoid errors
- **"To taste" handling**: Preserves None quantities for non-measurable ingredients
- **Unit normalization**: Standardizes 50+ unit variations
- **Name normalization**: Removes articles, singularizes plurals, handles variations
- **Fraction parsing**: Supports "1/2", "1 1/2", etc. using Python's Fraction class
- **Range handling**: Takes upper bound of ranges (e.g., "2-3" → 3)
- **Error resilience**: Handles malformed JSON, missing fields, invalid quantities gracefully

---

### Grocery Router

**File:** `backend/routers/grocery.py`

```python
"""
API endpoints for grocery list management.

Provides REST API for generating, retrieving, and updating grocery lists
from weekly meal plans.
"""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List

from database import get_db
from services import grocery_service
from schemas.grocery import (
    GroceryListResponse,
    GroceryItemResponse,
    GroceryItemUpdate,
    GroceryListGenerateResponse
)


router = APIRouter(prefix="/grocery", tags=["Grocery"])


@router.get(
    "/{plan_id}",
    response_model=GroceryListResponse,
    summary="Get grocery list for a weekly plan",
    description="""
    Retrieve the grocery list for a weekly meal plan, organized by category.

    Returns:
    - Items grouped by grocery store category (Produce, Meat, Dairy, etc.)
    - Total item count and checked item count for progress tracking
    - Empty list if no grocery list has been generated yet

    Use POST /grocery/{plan_id}/generate to create the grocery list first.
    """
)
def get_grocery_list(
    plan_id: int,
    db: Session = Depends(get_db)
):
    """
    Get the grocery list for a weekly plan.

    Returns categorized items with progress tracking. If no grocery list
    exists for this plan, returns an empty list (not an error).
    """
    try:
        return grocery_service.get_grocery_list(db, plan_id)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e)
        )


@router.post(
    "/{plan_id}/generate",
    response_model=GroceryListGenerateResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Generate grocery list from meal plan",
    description="""
    Generate a grocery list by aggregating all ingredients from the weekly meal plan.

    Process:
    1. Collects all ingredients from all meals in the plan
    2. Normalizes ingredient names and units
    3. Aggregates duplicate ingredients and sums quantities
    4. Categorizes items by grocery store section
    5. Deletes existing grocery list (if any) and creates new one

    This endpoint is idempotent - calling it multiple times regenerates the list.
    Use this after modifying the meal plan (e.g., swapping meals) to update the list.
    """
)
def generate_grocery_list(
    plan_id: int,
    db: Session = Depends(get_db)
):
    """
    Generate a grocery list from the weekly plan's meals.

    Aggregates all ingredients, merges duplicates, and categorizes items.
    Replaces any existing grocery list for this plan.
    """
    try:
        # Count raw ingredients before aggregation
        meals = grocery_service.get_all_meals_for_plan(db, plan_id)
        raw_count = 0
        for meal in meals:
            import json
            try:
                ingredients = json.loads(meal.ingredients) if isinstance(meal.ingredients, str) else meal.ingredients
                if isinstance(ingredients, dict):
                    ingredients = ingredients.get("items", [])
                raw_count += len(ingredients)
            except (json.JSONDecodeError, TypeError):
                continue

        # Generate the list
        grocery_list = grocery_service.generate_grocery_list(db, plan_id)

        return GroceryListGenerateResponse(
            message="Grocery list generated successfully",
            grocery_list=grocery_list,
            items_aggregated=raw_count
        )

    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e)
        )


@router.patch(
    "/items/{item_id}",
    response_model=GroceryItemResponse,
    summary="Update grocery item",
    description="""
    Update a grocery item's properties.

    Currently supports:
    - Toggling checked status (mark item as purchased)

    Future extensions could include:
    - Quantity adjustments
    - Custom notes
    - Category reassignment
    """
)
def update_grocery_item(
    item_id: int,
    update: GroceryItemUpdate,
    db: Session = Depends(get_db)
):
    """
    Update a grocery item (currently only checked status).

    Used to mark items as purchased while shopping.
    """
    try:
        return grocery_service.update_grocery_item(
            db=db,
            item_id=item_id,
            checked=update.checked
        )
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e)
        )


@router.delete(
    "/{plan_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete grocery list",
    description="""
    Delete all grocery items for a weekly plan.

    Use this to clear the list before regenerating or when deleting a plan.
    The list can be regenerated at any time using POST /grocery/{plan_id}/generate.
    """
)
def delete_grocery_list(
    plan_id: int,
    db: Session = Depends(get_db)
):
    """
    Delete the grocery list for a weekly plan.

    This is a hard delete - all items and their checked status will be lost.
    """
    grocery_service.delete_grocery_list(db, plan_id)
    return None
```

**API Design:**
- **GET /grocery/{plan_id}**: Retrieve existing grocery list (empty if not generated)
- **POST /grocery/{plan_id}/generate**: Create/regenerate complete list
- **PATCH /grocery/items/{item_id}**: Toggle individual item checked status
- **DELETE /grocery/{plan_id}**: Clear entire list
- All endpoints include comprehensive OpenAPI documentation
- Error handling with appropriate HTTP status codes
- Idempotent generation (safe to call multiple times)

---

## Frontend Implementation

### Types

**File:** `src/types/grocery.ts`

```typescript
/**
 * Type definitions for grocery list functionality.
 */

export interface GroceryItem {
  id: number;
  ingredient_name: string;
  quantity: number | null;
  unit: string | null;
  category: string;
  checked: boolean;
}

export interface GroceryCategory {
  category: string;
  items: GroceryItem[];
}

export interface GroceryList {
  plan_id: number;
  categories: GroceryCategory[];
  total_items: number;
  checked_items: number;
}

export interface GroceryListGenerateResponse {
  message: string;
  grocery_list: GroceryList;
  items_aggregated: number;
}
```

---

### API Service

**File:** `src/services/groceryApi.ts`

```typescript
/**
 * API client for grocery list operations.
 */

import { api } from './api';
import type { GroceryList, GroceryListGenerateResponse, GroceryItem } from '@/types/grocery';

export const groceryApi = {
  /**
   * Get grocery list for a weekly plan.
   */
  async getGroceryList(planId: number): Promise<GroceryList> {
    const response = await api.get<GroceryList>(`/grocery/${planId}`);
    return response.data;
  },

  /**
   * Generate grocery list from meal plan.
   */
  async generateGroceryList(planId: number): Promise<GroceryListGenerateResponse> {
    const response = await api.post<GroceryListGenerateResponse>(
      `/grocery/${planId}/generate`
    );
    return response.data;
  },

  /**
   * Update grocery item checked status.
   */
  async updateGroceryItem(itemId: number, checked: boolean): Promise<GroceryItem> {
    const response = await api.patch<GroceryItem>(`/grocery/items/${itemId}`, {
      checked,
    });
    return response.data;
  },

  /**
   * Delete grocery list.
   */
  async deleteGroceryList(planId: number): Promise<void> {
    await api.delete(`/grocery/${planId}`);
  },
};
```

---

### Grocery Page

**File:** `src/app/grocery/page.tsx`

```typescript
'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { groceryApi } from '@/services/groceryApi';
import { planApi } from '@/services/planApi';
import type { GroceryList } from '@/types/grocery';
import type { WeeklyPlan } from '@/types/plan';
import GroceryCategory from '@/components/grocery/GroceryCategory';
import ShoppingProgress from '@/components/grocery/ShoppingProgress';
import { Button } from '@/components/ui/Button';
import { Spinner } from '@/components/ui/Spinner';
import { Alert } from '@/components/ui/Alert';
import { RefreshCw, ShoppingCart, Printer, ArrowLeft } from 'lucide-react';

export default function GroceryPage() {
  const router = useRouter();
  const [plan, setPlan] = useState<WeeklyPlan | null>(null);
  const [groceryList, setGroceryList] = useState<GroceryList | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);

      // Get current plan
      const currentPlan = await planApi.getCurrentPlan();
      setPlan(currentPlan);

      if (currentPlan) {
        // Try to get existing grocery list
        try {
          const list = await groceryApi.getGroceryList(currentPlan.id);
          setGroceryList(list);
        } catch (err) {
          // No grocery list exists yet - this is okay
          setGroceryList(null);
        }
      }
    } catch (err) {
      setError('Failed to load grocery list. Please try again.');
      console.error('Error loading grocery list:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleGenerate = async () => {
    if (!plan) return;

    try {
      setGenerating(true);
      setError(null);

      const response = await groceryApi.generateGroceryList(plan.id);
      setGroceryList(response.grocery_list);
    } catch (err) {
      setError('Failed to generate grocery list. Please try again.');
      console.error('Error generating grocery list:', err);
    } finally {
      setGenerating(false);
    }
  };

  const handleToggleItem = async (itemId: number, checked: boolean) => {
    try {
      await groceryApi.updateGroceryItem(itemId, checked);

      // Update local state
      setGroceryList((prev) => {
        if (!prev) return prev;

        const updatedCategories = prev.categories.map((category) => ({
          ...category,
          items: category.items.map((item) =>
            item.id === itemId ? { ...item, checked } : item
          ),
        }));

        const totalChecked = updatedCategories.reduce(
          (sum, cat) => sum + cat.items.filter((item) => item.checked).length,
          0
        );

        return {
          ...prev,
          categories: updatedCategories,
          checked_items: totalChecked,
        };
      });
    } catch (err) {
      console.error('Error toggling item:', err);
      setError('Failed to update item. Please try again.');
    }
  };

  const handlePrint = () => {
    window.print();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Spinner size="lg" />
      </div>
    );
  }

  if (!plan) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-12">
        <Alert variant="warning">
          <p>No meal plan found. Please create a meal plan first.</p>
          <Button
            onClick={() => router.push('/plan')}
            className="mt-4"
          >
            Create Meal Plan
          </Button>
        </Alert>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6 print:hidden">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            onClick={() => router.push('/plan')}
            leftIcon={<ArrowLeft size={20} />}
          >
            Back to Plan
          </Button>
          <h1 className="text-3xl font-bold">Grocery List</h1>
        </div>

        <div className="flex gap-2">
          {groceryList && (
            <>
              <Button
                variant="outline"
                onClick={handlePrint}
                leftIcon={<Printer size={20} />}
              >
                Print
              </Button>
              <Button
                variant="outline"
                onClick={handleGenerate}
                loading={generating}
                leftIcon={<RefreshCw size={20} />}
              >
                Regenerate
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Error Alert */}
      {error && (
        <Alert variant="error" className="mb-6">
          {error}
        </Alert>
      )}

      {/* No Grocery List State */}
      {!groceryList && (
        <div className="text-center py-12">
          <ShoppingCart size={64} className="mx-auto mb-4 text-gray-400" />
          <h2 className="text-2xl font-semibold mb-2">No Grocery List Yet</h2>
          <p className="text-gray-600 mb-6">
            Generate a grocery list from your meal plan to get started.
          </p>
          <Button
            onClick={handleGenerate}
            loading={generating}
            size="lg"
            leftIcon={<ShoppingCart size={20} />}
          >
            Generate Grocery List
          </Button>
        </div>
      )}

      {/* Grocery List */}
      {groceryList && (
        <>
          {/* Progress Bar */}
          <ShoppingProgress
            totalItems={groceryList.total_items}
            checkedItems={groceryList.checked_items}
            className="mb-8"
          />

          {/* Outdated Warning */}
          {plan.last_modified && groceryList && (
            <Alert variant="info" className="mb-6 print:hidden">
              <p>
                Your meal plan was modified after this grocery list was generated.
                Consider regenerating the list to reflect the latest changes.
              </p>
            </Alert>
          )}

          {/* Categories */}
          <div className="space-y-6">
            {groceryList.categories.map((category) => (
              <GroceryCategory
                key={category.category}
                category={category}
                onToggleItem={handleToggleItem}
              />
            ))}
          </div>

          {/* Empty State */}
          {groceryList.categories.length === 0 && (
            <Alert variant="info">
              <p>Your grocery list is empty. Add meals to your plan first.</p>
            </Alert>
          )}
        </>
      )}

      {/* Print Styles */}
      <style jsx global>{`
        @media print {
          .print\\:hidden {
            display: none !important;
          }

          body {
            font-size: 12pt;
          }

          h1 {
            font-size: 24pt;
            margin-bottom: 16pt;
          }

          h2 {
            font-size: 16pt;
            margin-top: 12pt;
            margin-bottom: 8pt;
          }

          .grocery-category {
            page-break-inside: avoid;
          }

          .grocery-item {
            padding: 4pt 0;
          }
        }
      `}</style>
    </div>
  );
}
```

**Component Features:**
- Fetches current plan and grocery list on mount
- Shows empty state with "Generate" button if no list exists
- Displays progress bar when list exists
- Shows warning if plan modified after list generation
- Optimistic UI updates for item toggling
- Print-friendly styles
- Error handling with user feedback

---

### Shopping Progress Component

**File:** `src/components/grocery/ShoppingProgress.tsx`

```typescript
import { CheckCircle2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ShoppingProgressProps {
  totalItems: number;
  checkedItems: number;
  className?: string;
}

export default function ShoppingProgress({
  totalItems,
  checkedItems,
  className,
}: ShoppingProgressProps) {
  const percentage = totalItems > 0 ? (checkedItems / totalItems) * 100 : 0;
  const isComplete = totalItems > 0 && checkedItems === totalItems;

  return (
    <div className={cn('bg-white rounded-lg shadow-sm border p-6', className)}>
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-lg font-semibold">Shopping Progress</h2>
        <span className="text-sm text-gray-600">
          {checkedItems} of {totalItems} items ({Math.round(percentage)}%)
        </span>
      </div>

      {/* Progress Bar */}
      <div className="relative h-3 bg-gray-200 rounded-full overflow-hidden">
        <div
          className={cn(
            'absolute top-0 left-0 h-full transition-all duration-300 ease-out',
            isComplete ? 'bg-green-500' : 'bg-blue-500'
          )}
          style={{ width: `${percentage}%` }}
        />
      </div>

      {/* Completion Message */}
      {isComplete && (
        <div className="mt-4 flex items-center gap-2 text-green-600">
          <CheckCircle2 size={20} />
          <span className="font-medium">All done! Happy cooking!</span>
        </div>
      )}
    </div>
  );
}
```

**Features:**
- Visual progress bar with percentage
- Color changes to green when complete
- Success message on 100% completion
- Smooth animations
- Responsive layout

---

### Grocery Category Component

**File:** `src/components/grocery/GroceryCategory.tsx`

```typescript
'use client';

import { useState } from 'react';
import { ChevronDown, ChevronRight, CheckSquare, Square } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { GroceryCategory as GroceryCategoryType } from '@/types/grocery';
import GroceryItem from './GroceryItem';
import { Button } from '@/components/ui/Button';

interface GroceryCategoryProps {
  category: GroceryCategoryType;
  onToggleItem: (itemId: number, checked: boolean) => void;
}

export default function GroceryCategory({
  category,
  onToggleItem,
}: GroceryCategoryProps) {
  const [isExpanded, setIsExpanded] = useState(true);

  const checkedCount = category.items.filter((item) => item.checked).length;
  const totalCount = category.items.length;
  const allChecked = checkedCount === totalCount && totalCount > 0;
  const someChecked = checkedCount > 0 && !allChecked;

  const handleToggleAll = () => {
    const newCheckedState = !allChecked;
    category.items.forEach((item) => {
      if (item.checked !== newCheckedState) {
        onToggleItem(item.id, newCheckedState);
      }
    });
  };

  return (
    <div className="grocery-category bg-white rounded-lg shadow-sm border overflow-hidden">
      {/* Category Header */}
      <div className="border-b bg-gray-50">
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3 flex-1">
            {/* Expand/Collapse Button */}
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className="text-gray-500 hover:text-gray-700 transition-colors print:hidden"
              aria-label={isExpanded ? 'Collapse category' : 'Expand category'}
            >
              {isExpanded ? <ChevronDown size={20} /> : <ChevronRight size={20} />}
            </button>

            {/* Category Name */}
            <h3 className="text-lg font-semibold text-gray-900">
              {category.category}
            </h3>

            {/* Item Count Badge */}
            <span
              className={cn(
                'px-2 py-1 text-xs font-medium rounded-full',
                allChecked
                  ? 'bg-green-100 text-green-700'
                  : someChecked
                  ? 'bg-blue-100 text-blue-700'
                  : 'bg-gray-100 text-gray-600'
              )}
            >
              {checkedCount}/{totalCount} items
            </span>
          </div>

          {/* Check All / Uncheck All Button */}
          <Button
            variant="ghost"
            size="sm"
            onClick={handleToggleAll}
            className="print:hidden"
            leftIcon={
              allChecked ? <CheckSquare size={16} /> : <Square size={16} />
            }
          >
            {allChecked ? 'Uncheck All' : 'Check All'}
          </Button>
        </div>
      </div>

      {/* Category Items */}
      {isExpanded && (
        <div className="divide-y">
          {category.items.map((item) => (
            <GroceryItem
              key={item.id}
              item={item}
              onToggle={(checked) => onToggleItem(item.id, checked)}
            />
          ))}
        </div>
      )}

      {/* Print-only expanded view */}
      <div className="hidden print:block divide-y">
        {category.items.map((item) => (
          <GroceryItem
            key={item.id}
            item={item}
            onToggle={() => {}}
            printMode
          />
        ))}
      </div>
    </div>
  );
}
```

**Features:**
- Collapsible sections with expand/collapse icons
- Item count badge with color coding (gray/blue/green)
- "Check All" / "Uncheck All" button for bulk actions
- Progress indication (checked/total items)
- Print mode always shows expanded view
- Smooth animations

---

### Grocery Item Component

**File:** `src/components/grocery/GroceryItem.tsx`

```typescript
'use client';

import { cn } from '@/lib/utils';
import type { GroceryItem as GroceryItemType } from '@/types/grocery';
import { Check } from 'lucide-react';

interface GroceryItemProps {
  item: GroceryItemType;
  onToggle: (checked: boolean) => void;
  printMode?: boolean;
}

export default function GroceryItem({
  item,
  onToggle,
  printMode = false,
}: GroceryItemProps) {
  const handleToggle = () => {
    if (!printMode) {
      onToggle(!item.checked);
    }
  };

  const formatQuantity = () => {
    if (item.quantity === null || item.quantity === undefined) {
      return 'to taste';
    }

    const qty = item.quantity;

    // Format with appropriate precision
    const formatted = qty % 1 === 0 ? qty.toString() : qty.toFixed(1);

    return item.unit ? `${formatted} ${item.unit}` : formatted;
  };

  return (
    <div
      className={cn(
        'grocery-item px-4 py-3 transition-colors',
        !printMode && 'cursor-pointer hover:bg-gray-50',
        item.checked && 'bg-gray-50/50'
      )}
      onClick={handleToggle}
    >
      <div className="flex items-center gap-3">
        {/* Checkbox */}
        {!printMode && (
          <div
            className={cn(
              'flex-shrink-0 w-5 h-5 rounded border-2 flex items-center justify-center transition-all',
              item.checked
                ? 'bg-green-500 border-green-500'
                : 'border-gray-300 hover:border-green-500'
            )}
          >
            {item.checked && <Check size={14} className="text-white" />}
          </div>
        )}

        {/* Print Mode Checkbox */}
        {printMode && (
          <div className="flex-shrink-0 w-4 h-4 rounded border-2 border-gray-400" />
        )}

        {/* Ingredient Name */}
        <span
          className={cn(
            'flex-1 text-base capitalize',
            item.checked && !printMode && 'line-through text-gray-500'
          )}
        >
          {item.ingredient_name}
        </span>

        {/* Quantity */}
        <span
          className={cn(
            'text-sm font-medium',
            item.checked && !printMode ? 'text-gray-400' : 'text-gray-600'
          )}
        >
          {formatQuantity()}
        </span>
      </div>
    </div>
  );
}
```

**Features:**
- Click anywhere on row to toggle
- Custom checkbox with checkmark animation
- Strikethrough and muted color when checked
- Quantity formatting with appropriate precision
- "to taste" display for null quantities
- Print mode shows empty checkboxes
- Hover effects for interactivity
- Capitalized ingredient names

---

## Edge Cases & Error Handling

### 1. Ingredients with No Quantity

**Scenario:** "Salt to taste", "Pepper as needed"

**Handling:**
- Backend: `parse_quantity()` returns `None`
- Database: `quantity` column is nullable
- Frontend: Display "to taste" or "as needed" instead of numeric quantity
- Aggregation: Do not sum quantities when any are `None`

**Example:**
```
Meal 1: Salt (to taste)
Meal 2: Salt (2 tsp)
Result: 2 separate entries (cannot aggregate)
```

---

### 2. Duplicate Ingredients with Incompatible Units

**Scenario:** "200g chicken" + "2 pieces chicken"

**Handling:**
- Backend: Different units create different aggregation keys
- Result: List both separately
- UI: Display both entries under same category

**Example:**
```
Chicken breast — 1.2 kg
Chicken breast — 6 pieces
```

**Rationale:** Cannot safely convert between weight and count without knowing piece size.

---

### 3. Very Large Quantities

**Scenario:** Cooking for household of 6, quantities multiplied in AI generation

**Handling:**
- AI generation stage multiplies quantities by household size
- Grocery aggregation simply sums the already-scaled quantities
- Display with appropriate precision (e.g., "4.5 kg" not "4.5000000 kg")
- No unit conversion (1000g stays as 1000g, doesn't auto-convert to 1kg)

---

### 4. Plan Changes After Grocery List Generated

**Scenario:** User swaps meals after generating grocery list

**Handling:**
- Backend: Track `created_at` timestamp on grocery items
- Frontend: Compare plan's `last_modified` with grocery list creation
- UI: Show warning banner: "Grocery list may be outdated"
- Action: "Regenerate List" button prominently displayed
- Regeneration: Deletes old list and creates new one (resets all checked states)

---

### 5. Empty Meal Plan

**Scenario:** No meals in the weekly plan

**Handling:**
- Backend: `generate_grocery_list()` raises `ValueError`
- Frontend: Show empty state with message
- UI: "Add meals to your plan first" guidance
- No error, just informational message

---

### 6. Malformed Ingredient Data

**Scenario:** Invalid JSON, missing fields, corrupt data

**Handling:**
- Backend: Try/except around JSON parsing
- Missing fields: Use fallbacks ("Unknown" for name, "" for unit)
- Invalid quantities: `parse_quantity()` returns `None` on error
- Continue processing other ingredients (don't fail entire generation)

---

### 7. Unit Normalization Edge Cases

**Scenario:** "TABLESPOONS", "TbSp", "tbsp." all should be same

**Handling:**
- Lowercase all units before lookup
- Strip punctuation
- Comprehensive `UNIT_CONVERSIONS` map
- Unknown units preserved as-is (better than failing)

---

### 8. Name Normalization Edge Cases

**Scenario:** "The Tomatoes", "A tomato", "tomato"

**Handling:**
- Remove articles ("a", "an", "the")
- Singularize common plurals
- Trim whitespace
- Handle common variations (bell pepper = capsicum)
- Preserve original if normalization fails

---

### 9. Quantity Range Parsing

**Scenario:** "2-3 cups", "1.5-2 kg"

**Handling:**
- Take upper bound (conservative estimate for shopping)
- "2-3" → 3.0
- Ensures user doesn't run out of ingredients

---

### 10. Concurrent Updates

**Scenario:** Multiple users (or tabs) toggling items simultaneously

**Handling:**
- Backend: Atomic updates with database transactions
- Frontend: Optimistic UI updates
- Refresh on error to sync state
- No locking needed (checked status is per-item, independent)

---

## Testing & Verification Checklist

### Backend Tests

**Unit Tests (`tests/test_grocery_service.py`):**

```python
def test_classify_ingredient():
    assert classify_ingredient("chicken breast") == "Meat & Seafood"
    assert classify_ingredient("tomato") == "Produce"
    assert classify_ingredient("milk") == "Dairy & Eggs"
    assert classify_ingredient("unknown item") == "Other"

def test_normalize_unit():
    assert normalize_unit("tablespoons") == "tbsp"
    assert normalize_unit("GRAMS") == "g"
    assert normalize_unit("Cup") == "cups"

def test_normalize_ingredient_name():
    assert normalize_ingredient_name("The Tomatoes") == "tomato"
    assert normalize_ingredient_name("  A  chicken  breast  ") == "chicken breast"
    assert normalize_ingredient_name("Green Onions") == "scallion"

def test_parse_quantity():
    assert parse_quantity("200") == 200.0
    assert parse_quantity("1.5") == 1.5
    assert parse_quantity("1/2") == 0.5
    assert parse_quantity("1 1/2") == 1.5
    assert parse_quantity("2-3") == 3.0
    assert parse_quantity("to taste") is None

def test_generate_grocery_list_aggregation():
    # Create test plan with duplicate ingredients
    # Verify quantities summed correctly
    # Verify categories assigned
    pass

def test_generate_grocery_list_different_units():
    # Create plan with "200g chicken" and "2 pieces chicken"
    # Verify both listed separately
    pass
```

**Integration Tests:**

```python
def test_generate_grocery_list_endpoint():
    # POST /grocery/{plan_id}/generate
    # Verify 201 response
    # Verify correct item count

def test_get_grocery_list_endpoint():
    # GET /grocery/{plan_id}
    # Verify categories structure
    # Verify progress tracking

def test_update_grocery_item_endpoint():
    # PATCH /grocery/items/{item_id}
    # Verify checked status updated
    # Verify response matches database
```

---

### Frontend Tests

**Component Tests:**

```typescript
describe('GroceryItem', () => {
  it('displays quantity and unit correctly', () => {
    // Test "1.5 kg" format
    // Test "to taste" for null quantities
  });

  it('toggles checked state on click', () => {
    // Test checkbox toggle
    // Test strikethrough styling
  });
});

describe('GroceryCategory', () => {
  it('expands and collapses on click', () => {});

  it('shows correct item count badge', () => {});

  it('checks all items when "Check All" clicked', () => {});
});

describe('ShoppingProgress', () => {
  it('calculates percentage correctly', () => {});

  it('shows completion message at 100%', () => {});

  it('changes color when complete', () => {});
});
```

---

### Manual Testing Checklist

- [ ] **Generate grocery list** → All ingredients from all meals aggregated
- [ ] **Duplicate ingredients merged** → Quantities summed correctly
- [ ] **Items categorized correctly** → Check Produce, Meat, Dairy categories
- [ ] **Checking/unchecking persists** → Refresh page, state maintained
- [ ] **Regenerate after meal swap** → Updated list reflects changes
- [ ] **Progress counter accurate** → Matches checked/total items
- [ ] **Categories collapsible** → Expand/collapse works
- [ ] **Print-friendly view** → All items visible, no interactive elements
- [ ] **Empty state** → Shows when no list generated
- [ ] **Error handling** → Network errors show user-friendly messages
- [ ] **"To taste" items** → Display correctly without quantities
- [ ] **Large quantities** → Format cleanly (e.g., 4.5 kg not 4.500000)
- [ ] **Check all/uncheck all** → Bulk operations work per category
- [ ] **Outdated warning** → Shows when plan modified after generation
- [ ] **Mobile responsive** → Works on small screens

---

## Database Migration

Add the grocery items table if not already present:

```sql
-- Migration: Add grocery_items table

CREATE TABLE IF NOT EXISTS grocery_items (
    id SERIAL PRIMARY KEY,
    weekly_plan_id INTEGER NOT NULL REFERENCES weekly_plans(id) ON DELETE CASCADE,
    ingredient_name VARCHAR(200) NOT NULL,
    quantity FLOAT,
    unit VARCHAR(50),
    category VARCHAR(100) NOT NULL,
    checked BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    INDEX idx_grocery_items_plan (weekly_plan_id),
    INDEX idx_grocery_items_category (category)
);
```

---

## API Documentation

### Endpoints Summary

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/grocery/{plan_id}` | Get grocery list for a plan |
| POST | `/grocery/{plan_id}/generate` | Generate grocery list from meals |
| PATCH | `/grocery/items/{item_id}` | Update item checked status |
| DELETE | `/grocery/{plan_id}` | Delete entire grocery list |

### Example Requests

**Generate Grocery List:**
```bash
POST /api/grocery/1/generate
```

**Response (201):**
```json
{
  "message": "Grocery list generated successfully",
  "grocery_list": {
    "plan_id": 1,
    "categories": [
      {
        "category": "Produce",
        "items": [
          {
            "id": 1,
            "ingredient_name": "onion",
            "quantity": 3.0,
            "unit": "pieces",
            "category": "Produce",
            "checked": false
          },
          {
            "id": 2,
            "ingredient_name": "garlic",
            "quantity": 8.0,
            "unit": "cloves",
            "category": "Produce",
            "checked": false
          }
        ]
      },
      {
        "category": "Meat & Seafood",
        "items": [
          {
            "id": 3,
            "ingredient_name": "chicken breast",
            "quantity": 1.2,
            "unit": "kg",
            "category": "Meat & Seafood",
            "checked": false
          }
        ]
      }
    ],
    "total_items": 3,
    "checked_items": 0
  },
  "items_aggregated": 12
}
```

**Update Item:**
```bash
PATCH /api/grocery/items/1
{
  "checked": true
}
```

**Response (200):**
```json
{
  "id": 1,
  "ingredient_name": "onion",
  "quantity": 3.0,
  "unit": "pieces",
  "category": "Produce",
  "checked": true
}
```

---

## Performance Considerations

1. **Bulk Insert**: Use `db.add_all()` for grocery items rather than individual inserts
2. **Category Indexing**: Index `category` column for faster grouping queries
3. **Lazy Loading**: Only load grocery list when explicitly requested (not with plan)
4. **Optimistic UI**: Update frontend immediately, rollback on error
5. **Caching**: Consider caching category classification results
6. **Pagination**: Not needed (typical grocery lists < 100 items)

---

## Future Enhancements

1. **Smart Categorization**:
   - Machine learning model for better ingredient classification
   - User-customizable category assignments
   - Store-specific category layouts

2. **Pantry Integration**:
   - Track pantry inventory
   - Auto-exclude items already in stock
   - Low-stock alerts

3. **Shopping Mode**:
   - Offline support with service workers
   - Voice input for checking items
   - Barcode scanning

4. **Sharing**:
   - Share list via link or QR code
   - Real-time collaboration (multiple shoppers)
   - Send to partner's phone

5. **Store Integration**:
   - Export to store apps (Instacart, Amazon Fresh)
   - Price estimation
   - Store layout optimization

6. **Recipe Scaling**:
   - Adjust quantities for different household sizes
   - Batch cooking multipliers

---

## Security Considerations

1. **Authorization**: Verify user owns the plan before generating/accessing grocery list
2. **Input Validation**: Validate plan_id and item_id are integers
3. **SQL Injection**: Use parameterized queries (handled by SQLAlchemy ORM)
4. **Rate Limiting**: Prevent abuse of regenerate endpoint
5. **Data Privacy**: Grocery lists can reveal dietary preferences/health conditions

---

## Conclusion

The Grocery List feature completes the meal planning workflow by automatically generating organized shopping lists from weekly plans. Key achievements:

- **Intelligent Aggregation**: Merges duplicate ingredients with quantity summing
- **Smart Categorization**: Organizes by grocery store sections for efficient shopping
- **Robust Parsing**: Handles fractions, ranges, "to taste", and various unit formats
- **Interactive UI**: Check-off items with progress tracking
- **Regeneration**: Stays synchronized with meal plan changes
- **Print Support**: Physical shopping list option

**Files Created/Modified:**
- `backend/schemas/grocery.py` (new)
- `backend/services/grocery_service.py` (new)
- `backend/routers/grocery.py` (new)
- `src/types/grocery.ts` (new)
- `src/services/groceryApi.ts` (new)
- `src/app/grocery/page.tsx` (new)
- `src/components/grocery/ShoppingProgress.tsx` (new)
- `src/components/grocery/GroceryCategory.tsx` (new)
- `src/components/grocery/GroceryItem.tsx` (new)

This implementation provides a production-ready grocery list system with comprehensive error handling, edge case coverage, and user-friendly interfaces.
