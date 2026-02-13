"""
Grocery list generation and management service.

Handles:
- Intelligent aggregation of ingredients from weekly meal plans
- Ingredient name normalization and duplicate merging
- Quantity summing with unit standardization
- Category classification for grocery store organization
"""

import json
import re
from typing import List, Dict, Optional, Any
from collections import defaultdict
from sqlalchemy.orm import Session
from models.meal_plan import WeeklyPlan, DailyPlan, Meal
from models.grocery import GroceryItem


# Category classification keywords
# Categories aligned with GroceryItem model's valid categories
CATEGORY_KEYWORDS = {
    "Produce": [
        "lettuce", "tomato", "onion", "garlic", "ginger", "carrot", "potato",
        "bell pepper", "cucumber", "spinach", "kale", "broccoli", "cauliflower",
        "zucchini", "mushroom", "celery", "parsley", "cilantro", "basil",
        "apple", "banana", "orange", "lemon", "lime", "avocado", "mango"
    ],
    "Meat & Seafood": [
        "chicken", "beef", "pork", "lamb", "turkey", "fish", "salmon", "tuna",
        "shrimp", "prawns", "bacon", "sausage", "meat", "seafood"
    ],
    "Dairy": [
        "milk", "cheese", "yogurt", "butter", "cream", "sour cream",
        "cottage cheese", "mozzarella", "cheddar", "parmesan", "feta"
    ],
    "Grains & Bread": [
        "rice", "pasta", "bread", "quinoa", "oats", "flour", "tortilla",
        "noodles", "couscous", "barley", "bulgur", "cereal"
    ],
    "Spices & Condiments": [
        "salt", "pepper", "cumin", "paprika", "turmeric", "cinnamon",
        "oregano", "thyme", "rosemary", "chili", "curry", "soy sauce",
        "vinegar", "mustard", "ketchup", "mayo", "hot sauce"
    ],
    "Oils & Fats": [
        "olive oil", "vegetable oil", "coconut oil", "sesame oil",
        "canola oil", "ghee", "oil", "fat"
    ],
    "Canned & Packaged": [
        "canned tomato", "tomato paste", "coconut milk", "beans",
        "chickpeas", "lentils", "stock", "broth", "pickles", "canned", "packaged"
    ],
    "Frozen": [
        "frozen peas", "frozen corn", "frozen berries", "ice cream", "frozen"
    ]
}


def normalize_ingredient_name(name: str) -> str:
    """
    Normalize ingredient name for duplicate detection.

    Handles case, plurals, modifiers, dashes, and parenthetical aliases.

    Args:
        name: Raw ingredient name

    Returns:
        Normalized ingredient name
    """
    # Convert to lowercase and strip
    name = name.lower().strip()

    # Remove parenthetical aliases: "besan (chickpea flour)" -> "besan"
    name = re.sub(r'\s*\([^)]*\)', '', name)

    # Remove common modifiers/adjectives
    modifiers = [
        'fresh', 'dried', 'frozen', 'chopped', 'diced', 'sliced', 'minced',
        'grated', 'crushed', 'ground', 'roasted', 'toasted', 'boiled', 'cooked',
        'raw', 'whole', 'organic', 'boneless', 'skinless', 'large', 'small',
        'medium', 'fine', 'thick', 'thin', 'unsalted', 'salted', 'unsweetened',
        'full-fat', 'low-fat', 'extra-virgin',
    ]
    for mod in modifiers:
        name = re.sub(r'\b' + re.escape(mod) + r'\b', '', name)

    # Normalize dashes to spaces
    name = name.replace('-', ' ')

    # Strip trailing 's' for basic plural handling (but not 'ss' like 'lass')
    # Also handle 'es' endings like 'potatoes' -> 'potato'
    name_parts = name.split()
    normalized_parts = []
    for part in name_parts:
        if len(part) > 3:
            if part.endswith('oes'):
                part = part[:-2]  # potatoes -> potato
            elif part.endswith('ies'):
                part = part[:-3] + 'y'  # berries -> berry
            elif part.endswith('ves'):
                part = part[:-3] + 'f'  # leaves -> leaf
            elif part.endswith('es') and not part.endswith('ses'):
                part = part[:-1]  # spices -> spice (but not "cheeses" edge)
            elif part.endswith('s') and not part.endswith('ss'):
                part = part[:-1]  # carrots -> carrot
        normalized_parts.append(part)
    name = ' '.join(normalized_parts)

    # Collapse whitespace
    name = re.sub(r'\s+', ' ', name).strip()

    return name


# Unit normalization: map abbreviations to canonical form
UNIT_ALIASES = {
    'g': 'g', 'gram': 'g', 'grams': 'g', 'gm': 'g',
    'kg': 'kg', 'kilogram': 'kg', 'kilograms': 'kg',
    'ml': 'ml', 'milliliter': 'ml', 'milliliters': 'ml', 'millilitre': 'ml',
    'l': 'l', 'liter': 'l', 'liters': 'l', 'litre': 'l',
    'tsp': 'tsp', 'teaspoon': 'tsp', 'teaspoons': 'tsp',
    'tbsp': 'tbsp', 'tablespoon': 'tbsp', 'tablespoons': 'tbsp',
    'cup': 'cup', 'cups': 'cup',
    'oz': 'oz', 'ounce': 'oz', 'ounces': 'oz',
    'lb': 'lb', 'pound': 'lb', 'pounds': 'lb',
    'piece': 'piece', 'pieces': 'piece', 'pc': 'piece', 'pcs': 'piece',
    'clove': 'clove', 'cloves': 'clove',
    'leaf': 'leaf', 'leaves': 'leaf',
    'pinch': 'pinch', 'pinches': 'pinch',
    'bunch': 'bunch', 'bunches': 'bunch',
    'slice': 'slice', 'slices': 'slice',
    'sprig': 'sprig', 'sprigs': 'sprig',
    'stick': 'stick', 'sticks': 'stick',
    'can': 'can', 'cans': 'can',
    'large': 'large',
    'medium': 'medium',
    'small': 'small',
}


def normalize_unit(unit: str) -> str:
    """Normalize measurement unit to canonical form."""
    unit = unit.lower().strip()
    return UNIT_ALIASES.get(unit, unit)


# Approximate gram equivalents for common units (used to merge different units)
UNIT_TO_GRAMS = {
    'g': 1.0,
    'kg': 1000.0,
    'ml': 1.0,  # ~1g for water-based liquids, rough approximation
    'l': 1000.0,
    'tsp': 5.0,
    'tbsp': 15.0,
    'cup': 240.0,
    'oz': 28.35,
    'lb': 453.6,
}

# Ingredient aliases — map alternate names to a single canonical name
INGREDIENT_ALIASES = {
    'cilantro': 'coriander leaves',
    'coriander': 'coriander leaves',
    'fresh coriander': 'coriander leaves',
    'dhania': 'coriander leaves',
    'coriander leave': 'coriander leaves',
    'greek yogurt': 'yogurt',
    'plain yogurt': 'yogurt',
    'plain greek yogurt': 'yogurt',
    'curd': 'yogurt',
    'dahi': 'yogurt',
    'vegetable oil': 'oil',
    'canola oil': 'oil',
    'sunflower oil': 'oil',
    'ginger garlic paste': 'ginger garlic paste',
    'garlic paste': 'garlic',
    'ginger paste': 'ginger',
}


def apply_aliases(name: str) -> str:
    """Apply ingredient aliases to merge known equivalent ingredients."""
    return INGREDIENT_ALIASES.get(name, name)


def classify_ingredient(ingredient_name: str) -> str:
    """
    Classify ingredient into grocery store category.

    Uses keyword matching to determine the most appropriate category.

    Args:
        ingredient_name: Normalized ingredient name

    Returns:
        Category name (e.g., "Produce", "Protein", "Other")
    """
    name_lower = ingredient_name.lower()

    for category, keywords in CATEGORY_KEYWORDS.items():
        for keyword in keywords:
            if keyword in name_lower:
                return category

    # Default category if no match found
    return "Other"


def parse_quantity(qty_str: str) -> Optional[float]:
    """
    Parse quantity string to float.

    Handles fractions, decimals, and ranges.

    Args:
        qty_str: Quantity as string (e.g., "1.5", "1/2", "2-3", "to taste")

    Returns:
        Float quantity or None if unparseable
    """
    if not qty_str or qty_str.lower() in ["to taste", "as needed", "pinch"]:
        return None

    try:
        # Handle fractions like "1/2"
        if '/' in qty_str:
            parts = qty_str.split('/')
            return float(parts[0]) / float(parts[1])

        # Handle ranges like "2-3", take the average
        if '-' in qty_str:
            parts = qty_str.split('-')
            return (float(parts[0]) + float(parts[1])) / 2

        # Direct float conversion
        return float(qty_str)

    except (ValueError, ZeroDivisionError):
        return None


def aggregate_ingredients(meals: List[Meal]) -> Dict[str, Dict[str, Any]]:
    """
    Aggregate ingredients from multiple meals, merging duplicates.

    Combines quantities for the same ingredient, converting different
    measurement units to grams where possible.

    Args:
        meals: List of Meal ORM objects

    Returns:
        Dict mapping normalized_name -> {name, total_qty, unit, category}
    """
    # Phase 1: Collect all ingredient entries with normalized names and units
    entries = []
    for meal in meals:
        try:
            if isinstance(meal.ingredients, str):
                ingredients = json.loads(meal.ingredients)
            else:
                ingredients = meal.ingredients or []
        except (json.JSONDecodeError, TypeError):
            continue

        for ing in ingredients:
            name = ing.get("name", "")
            qty_str = ing.get("quantity", "")
            unit = normalize_unit(ing.get("unit", ""))
            normalized_name = normalize_ingredient_name(name)
            normalized_name = apply_aliases(normalized_name)
            qty = parse_quantity(qty_str)
            entries.append({
                "normalized_name": normalized_name,
                "original_name": name,
                "quantity": qty,
                "unit": unit,
            })

    # Phase 2: Group by normalized name
    by_name = defaultdict(list)
    for entry in entries:
        by_name[entry["normalized_name"]].append(entry)

    # Phase 3: For each ingredient, try to merge units into grams
    aggregated = {}
    for normalized_name, group in by_name.items():
        original_name = group[0]["original_name"]

        # Collect all units used
        units_used = set(e["unit"] for e in group if e["quantity"] is not None)

        # If all convertible to grams, merge into grams
        all_convertible = units_used and all(u in UNIT_TO_GRAMS for u in units_used)

        if all_convertible and len(units_used) > 0:
            total_grams = 0.0
            count = 0
            for e in group:
                if e["quantity"] is not None:
                    factor = UNIT_TO_GRAMS.get(e["unit"], 1.0)
                    total_grams += e["quantity"] * factor
                    count += 1
            aggregated[normalized_name] = {
                "quantity": round(total_grams, 1),
                "count": count,
                "original_name": original_name,
                "unit": "g",
            }
        else:
            # Can't merge units — pick the most common unit and sum those,
            # convert the rest to that unit if possible
            # Simple fallback: just sum by the first unit seen
            total_qty = 0.0
            count = 0
            primary_unit = group[0]["unit"]
            for e in group:
                if e["quantity"] is not None:
                    total_qty += e["quantity"]
                    count += 1
            aggregated[normalized_name] = {
                "quantity": round(total_qty, 1),
                "count": count,
                "original_name": original_name,
                "unit": primary_unit,
            }

    return aggregated


def generate_grocery_list(db: Session, plan_id: int) -> Dict[str, Any]:
    """
    Generate a complete grocery list for a weekly plan.

    Process:
    1. Get all meals from the weekly plan
    2. Extract and aggregate ingredients
    3. Classify into categories
    4. Create GroceryItem records in database

    Args:
        db: Database session
        plan_id: Weekly plan ID

    Returns:
        Dict with generated grocery list data

    Raises:
        ValueError: If weekly plan not found
    """
    # Get weekly plan
    weekly_plan = db.query(WeeklyPlan).filter(WeeklyPlan.id == plan_id).first()
    if not weekly_plan:
        raise ValueError(f"Weekly plan with id {plan_id} not found")

    # Get all meals for this plan
    meals = db.query(Meal).join(DailyPlan).filter(
        DailyPlan.weekly_plan_id == plan_id
    ).all()

    # Aggregate ingredients
    aggregated = aggregate_ingredients(meals)

    try:
        # Delete existing grocery items for this plan
        db.query(GroceryItem).filter(GroceryItem.weekly_plan_id == plan_id).delete()

        # Create new grocery items
        grocery_items = []
        for normalized_name, data in aggregated.items():
            category = classify_ingredient(normalized_name)
            unit = data.get("unit", "")

            item = GroceryItem(
                weekly_plan_id=plan_id,
                ingredient_name=data["original_name"] or normalized_name,
                quantity=data["quantity"] if data["quantity"] > 0 else None,
                unit=unit if unit else None,
                category=category,
                checked=False
            )
            db.add(item)
            grocery_items.append(item)

        db.commit()
    except Exception as e:
        db.rollback()
        raise e

    # Build response grouped by category
    items_by_category = defaultdict(list)
    for item in grocery_items:
        db.refresh(item)
        items_by_category[item.category].append({
            "id": item.id,
            "ingredient_name": item.ingredient_name,
            "quantity": item.quantity,
            "unit": item.unit,
            "category": item.category,
            "checked": item.checked
        })

    return {
        "plan_id": plan_id,
        "items": dict(items_by_category),
        "total_items": len(grocery_items),
        "checked_count": 0
    }


def regenerate_grocery_list(db: Session, plan_id: int) -> Dict[str, Any]:
    """
    Regenerate grocery list for a weekly plan.

    Deletes existing items and generates fresh list from current meals.

    Args:
        db: Database session
        plan_id: Weekly plan ID

    Returns:
        Dict with regenerated grocery list data
    """
    return generate_grocery_list(db, plan_id)


def toggle_grocery_item(db: Session, item_id: int, checked: bool) -> GroceryItem:
    """
    Toggle the checked status of a grocery item.

    Args:
        db: Database session
        item_id: Grocery item ID
        checked: New checked status

    Returns:
        Updated GroceryItem

    Raises:
        ValueError: If item not found
    """
    item = db.query(GroceryItem).filter(GroceryItem.id == item_id).first()
    if not item:
        raise ValueError(f"Grocery item with id {item_id} not found")

    item.checked = checked
    db.commit()
    db.refresh(item)

    return item
