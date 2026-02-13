# 08 — Excel Export (Phase 7)

## Overview

This phase implements Excel export functionality that generates a comprehensive, professionally formatted `.xlsx` file containing the complete weekly meal plan, grocery list, and nutrition tracking data. The export uses the `openpyxl` library for Excel generation and streams the file as a downloadable response.

**Key Features:**
- Three-sheet workbook with meal plan, grocery list, and nutrition tracking
- Professional formatting with colors, borders, and merged cells
- Automatic calculations for daily and weekly totals
- Frozen panes for easy navigation
- Conditional formatting for nutrition tracking status
- Streaming download with proper MIME types and filename

---

## Backend Implementation

### Dependencies

Add to `backend/requirements.txt`:

```txt
openpyxl==3.1.2
```

Install:
```bash
pip install openpyxl
```

---

### Export Service

**File:** `backend/services/export_service.py`

This service handles all Excel generation logic with three distinct sheets, each with comprehensive formatting.

```python
"""
Excel Export Service

Generates professionally formatted Excel workbooks containing:
- Weekly meal plan with all meals and nutritional data
- Grocery list organized by category
- Nutrition tracking with planned vs actual comparison

Uses openpyxl for Excel generation with proper styling and formatting.
"""

from io import BytesIO
from datetime import datetime, timedelta
from typing import Dict, List, Any
from sqlalchemy.orm import Session

from openpyxl import Workbook
from openpyxl.styles import Font, PatternFill, Border, Side, Alignment
from openpyxl.utils import get_column_letter
from openpyxl.worksheet.worksheet import Worksheet

from models.meal_plan import MealPlan
from models.meal import Meal
from models.grocery_item import GroceryItem
from models.nutrition_tracking import NutritionTracking


# ============================================================================
# STYLE CONSTANTS
# ============================================================================

# Fonts
TITLE_FONT = Font(bold=True, size=16, color="166534")
HEADER_FONT = Font(bold=True, color="FFFFFF", size=11)
SUBTOTAL_FONT = Font(bold=True, size=10)
GRAND_TOTAL_FONT = Font(bold=True, size=11, color="FFFFFF")
CATEGORY_FONT = Font(bold=True, size=10, color="1F2937")
NORMAL_FONT = Font(size=10)

# Fills
HEADER_FILL = PatternFill(start_color="166534", end_color="166534", fill_type="solid")
SUBTOTAL_FILL = PatternFill(start_color="D1FAE5", end_color="D1FAE5", fill_type="solid")
GRAND_TOTAL_FILL = PatternFill(start_color="166534", end_color="166534", fill_type="solid")
CATEGORY_FILL = PatternFill(start_color="DBEAFE", end_color="DBEAFE", fill_type="solid")
ALT_ROW_FILL = PatternFill(start_color="F9FAFB", end_color="F9FAFB", fill_type="solid")

# Status fills for nutrition tracking
STATUS_FILLS = {
    "ate_as_planned": PatternFill(start_color="D1FAE5", end_color="D1FAE5", fill_type="solid"),  # Green
    "skipped": PatternFill(start_color="FEE2E2", end_color="FEE2E2", fill_type="solid"),  # Red
    "ate_something_else": PatternFill(start_color="FED7AA", end_color="FED7AA", fill_type="solid"),  # Orange
    "not_tracked": PatternFill(start_color="E5E7EB", end_color="E5E7EB", fill_type="solid"),  # Gray
}

# Borders
THIN_BORDER = Border(
    left=Side(style="thin", color="D1D5DB"),
    right=Side(style="thin", color="D1D5DB"),
    top=Side(style="thin", color="D1D5DB"),
    bottom=Side(style="thin", color="D1D5DB")
)

THICK_BORDER = Border(
    left=Side(style="medium", color="166534"),
    right=Side(style="medium", color="166534"),
    top=Side(style="medium", color="166534"),
    bottom=Side(style="medium", color="166534")
)

# Alignment
CENTER_ALIGN = Alignment(horizontal="center", vertical="center", wrap_text=False)
LEFT_ALIGN = Alignment(horizontal="left", vertical="center", wrap_text=False)
WRAP_ALIGN = Alignment(horizontal="left", vertical="top", wrap_text=True)


# ============================================================================
# HELPER FUNCTIONS
# ============================================================================

def apply_header_style(ws: Worksheet, row: int, start_col: int, end_col: int):
    """Apply header styling to a row range."""
    for col in range(start_col, end_col + 1):
        cell = ws.cell(row=row, column=col)
        cell.font = HEADER_FONT
        cell.fill = HEADER_FILL
        cell.border = THIN_BORDER
        cell.alignment = CENTER_ALIGN


def apply_title_style(ws: Worksheet, row: int, start_col: int, end_col: int, title: str):
    """Apply title styling with merged cells."""
    ws.merge_cells(start_row=row, start_column=start_col, end_row=row, end_column=end_col)
    cell = ws.cell(row=row, column=start_col)
    cell.value = title
    cell.font = TITLE_FONT
    cell.alignment = CENTER_ALIGN


def apply_subtotal_style(ws: Worksheet, row: int, start_col: int, end_col: int):
    """Apply subtotal row styling."""
    for col in range(start_col, end_col + 1):
        cell = ws.cell(row=row, column=col)
        cell.font = SUBTOTAL_FONT
        cell.fill = SUBTOTAL_FILL
        cell.border = THIN_BORDER
        if col > 2:  # Numeric columns
            cell.alignment = CENTER_ALIGN


def apply_grand_total_style(ws: Worksheet, row: int, start_col: int, end_col: int):
    """Apply grand total row styling."""
    for col in range(start_col, end_col + 1):
        cell = ws.cell(row=row, column=col)
        cell.font = GRAND_TOTAL_FONT
        cell.fill = GRAND_TOTAL_FILL
        cell.border = THICK_BORDER
        if col > 2:  # Numeric columns
            cell.alignment = CENTER_ALIGN


def set_column_widths(ws: Worksheet, widths: Dict[int, int]):
    """Set column widths based on column index."""
    for col_idx, width in widths.items():
        ws.column_dimensions[get_column_letter(col_idx)].width = width


def format_week_range(start_date: datetime) -> str:
    """Format week date range as 'Monday Jan 15 - Sunday Jan 21, 2025'."""
    end_date = start_date + timedelta(days=6)
    return f"{start_date.strftime('%A %b %d')} - {end_date.strftime('%A %b %d, %Y')}"


def get_day_name(date: datetime) -> str:
    """Get day name from date."""
    return date.strftime("%A")


# ============================================================================
# SHEET GENERATORS
# ============================================================================

def generate_meal_plan_sheet(ws: Worksheet, db: Session, plan: MealPlan):
    """
    Generate Sheet 1: Weekly Meal Plan

    Contains all meals for the week with nutritional information,
    daily subtotals, and weekly grand totals.
    """
    # Set sheet title
    ws.title = "Weekly Meal Plan"

    # Row 1: Title
    apply_title_style(ws, 1, 1, 12, "Weekly Meal Plan")

    # Row 2: Week date range
    week_range = format_week_range(plan.week_start_date)
    ws.merge_cells(start_row=2, start_column=1, end_row=2, end_column=12)
    cell = ws.cell(row=2, column=1)
    cell.value = week_range
    cell.font = Font(size=11, italic=True, color="6B7280")
    cell.alignment = CENTER_ALIGN

    # Row 3: Empty

    # Row 4: Column headers
    headers = [
        "Day", "Meal Type", "Dish Name", "Cuisine",
        "Calories", "Protein (g)", "Carbs (g)", "Fats (g)", "Fiber (g)",
        "Prep Time (min)", "Ingredients", "Recipe"
    ]
    for col_idx, header in enumerate(headers, start=1):
        cell = ws.cell(row=4, column=col_idx)
        cell.value = header

    apply_header_style(ws, 4, 1, 12)

    # Set column widths
    set_column_widths(ws, {
        1: 12,   # Day
        2: 12,   # Meal Type
        3: 30,   # Dish Name
        4: 15,   # Cuisine
        5: 10,   # Calories
        6: 12,   # Protein
        7: 12,   # Carbs
        8: 12,   # Fats
        9: 12,   # Fiber
        10: 12,  # Prep Time
        11: 40,  # Ingredients
        12: 50,  # Recipe
    })

    # Fetch all meals for the plan, ordered by date and meal type
    meals = db.query(Meal).filter(
        Meal.plan_id == plan.id
    ).order_by(Meal.date, Meal.meal_type).all()

    # Group meals by day
    meals_by_day = {}
    for meal in meals:
        day_key = meal.date
        if day_key not in meals_by_day:
            meals_by_day[day_key] = []
        meals_by_day[day_key].append(meal)

    current_row = 5
    weekly_totals = {
        "calories": 0,
        "protein": 0,
        "carbs": 0,
        "fats": 0,
        "fiber": 0,
        "prep_time": 0,
    }

    # Process each day
    for day_offset in range(7):
        day_date = plan.week_start_date + timedelta(days=day_offset)
        day_meals = meals_by_day.get(day_date, [])

        if not day_meals:
            continue

        day_start_row = current_row
        day_totals = {
            "calories": 0,
            "protein": 0,
            "carbs": 0,
            "fats": 0,
            "fiber": 0,
            "prep_time": 0,
        }

        # Add meals for this day
        for meal_idx, meal in enumerate(day_meals):
            # Day column (only show on first meal of day)
            if meal_idx == 0:
                ws.cell(row=current_row, column=1).value = get_day_name(day_date)

            # Meal data
            ws.cell(row=current_row, column=2).value = meal.meal_type.replace("_", " ").title()
            ws.cell(row=current_row, column=3).value = meal.dish_name
            ws.cell(row=current_row, column=4).value = meal.cuisine or "N/A"
            ws.cell(row=current_row, column=5).value = meal.calories or 0
            ws.cell(row=current_row, column=6).value = round(meal.protein or 0, 1)
            ws.cell(row=current_row, column=7).value = round(meal.carbs or 0, 1)
            ws.cell(row=current_row, column=8).value = round(meal.fats or 0, 1)
            ws.cell(row=current_row, column=9).value = round(meal.fiber or 0, 1)
            ws.cell(row=current_row, column=10).value = meal.prep_time or 0

            # Ingredients (comma-separated list)
            ingredients_list = ", ".join(meal.ingredients) if meal.ingredients else "N/A"
            ws.cell(row=current_row, column=11).value = ingredients_list

            # Recipe (simplified steps)
            recipe_text = " | ".join(meal.recipe) if meal.recipe else "N/A"
            ws.cell(row=current_row, column=12).value = recipe_text

            # Apply formatting
            for col in range(1, 13):
                cell = ws.cell(row=current_row, column=col)
                cell.border = THIN_BORDER
                cell.font = NORMAL_FONT

                # Alignment
                if col in [5, 6, 7, 8, 9, 10]:  # Numeric columns
                    cell.alignment = CENTER_ALIGN
                    # Number format
                    if col == 5:  # Calories
                        cell.number_format = "#,##0"
                    else:  # Macros
                        cell.number_format = "#,##0.0"
                elif col in [11, 12]:  # Ingredients and recipe
                    cell.alignment = WRAP_ALIGN
                else:
                    cell.alignment = LEFT_ALIGN

                # Alternating row colors
                if current_row % 2 == 0:
                    cell.fill = ALT_ROW_FILL

            # Accumulate totals
            day_totals["calories"] += meal.calories or 0
            day_totals["protein"] += meal.protein or 0
            day_totals["carbs"] += meal.carbs or 0
            day_totals["fats"] += meal.fats or 0
            day_totals["fiber"] += meal.fiber or 0
            day_totals["prep_time"] += meal.prep_time or 0

            current_row += 1

        # Merge day column cells
        if len(day_meals) > 1:
            ws.merge_cells(start_row=day_start_row, start_column=1,
                          end_row=current_row - 1, end_column=1)
            ws.cell(row=day_start_row, column=1).alignment = CENTER_ALIGN

        # Add daily subtotal row
        ws.cell(row=current_row, column=1).value = f"{get_day_name(day_date)} Total"
        ws.cell(row=current_row, column=2).value = ""
        ws.cell(row=current_row, column=3).value = ""
        ws.cell(row=current_row, column=4).value = ""
        ws.cell(row=current_row, column=5).value = day_totals["calories"]
        ws.cell(row=current_row, column=6).value = round(day_totals["protein"], 1)
        ws.cell(row=current_row, column=7).value = round(day_totals["carbs"], 1)
        ws.cell(row=current_row, column=8).value = round(day_totals["fats"], 1)
        ws.cell(row=current_row, column=9).value = round(day_totals["fiber"], 1)
        ws.cell(row=current_row, column=10).value = day_totals["prep_time"]
        ws.cell(row=current_row, column=11).value = ""
        ws.cell(row=current_row, column=12).value = ""

        # Apply subtotal styling
        apply_subtotal_style(ws, current_row, 1, 12)

        # Number formats for subtotal
        ws.cell(row=current_row, column=5).number_format = "#,##0"
        for col in [6, 7, 8, 9]:
            ws.cell(row=current_row, column=col).number_format = "#,##0.0"

        # Accumulate weekly totals
        for key in weekly_totals:
            weekly_totals[key] += day_totals[key]

        current_row += 1

    # Add grand total row
    ws.cell(row=current_row, column=1).value = "Weekly Total"
    ws.cell(row=current_row, column=2).value = ""
    ws.cell(row=current_row, column=3).value = ""
    ws.cell(row=current_row, column=4).value = ""
    ws.cell(row=current_row, column=5).value = weekly_totals["calories"]
    ws.cell(row=current_row, column=6).value = round(weekly_totals["protein"], 1)
    ws.cell(row=current_row, column=7).value = round(weekly_totals["carbs"], 1)
    ws.cell(row=current_row, column=8).value = round(weekly_totals["fats"], 1)
    ws.cell(row=current_row, column=9).value = round(weekly_totals["fiber"], 1)
    ws.cell(row=current_row, column=10).value = weekly_totals["prep_time"]
    ws.cell(row=current_row, column=11).value = ""
    ws.cell(row=current_row, column=12).value = ""

    # Apply grand total styling
    apply_grand_total_style(ws, current_row, 1, 12)

    # Number formats for grand total
    ws.cell(row=current_row, column=5).number_format = "#,##0"
    for col in [6, 7, 8, 9]:
        ws.cell(row=current_row, column=col).number_format = "#,##0.0"

    # Freeze panes (freeze top 4 rows and first 2 columns)
    ws.freeze_panes = "C5"


def generate_grocery_list_sheet(ws: Worksheet, db: Session, plan: MealPlan):
    """
    Generate Sheet 2: Grocery List

    Contains all grocery items organized by category with checkboxes.
    """
    # Set sheet title
    ws.title = "Grocery List"

    # Row 1: Title
    apply_title_style(ws, 1, 1, 5, "Grocery List")

    # Row 2: Week reference
    week_range = format_week_range(plan.week_start_date)
    ws.merge_cells(start_row=2, start_column=1, end_row=2, end_column=5)
    cell = ws.cell(row=2, column=1)
    cell.value = f"Week of {week_range}"
    cell.font = Font(size=11, italic=True, color="6B7280")
    cell.alignment = CENTER_ALIGN

    # Row 3: Empty

    # Row 4: Column headers
    headers = ["Category", "Ingredient", "Quantity", "Unit", "✓"]
    for col_idx, header in enumerate(headers, start=1):
        cell = ws.cell(row=4, column=col_idx)
        cell.value = header

    apply_header_style(ws, 4, 1, 5)

    # Set column widths
    set_column_widths(ws, {
        1: 20,  # Category
        2: 30,  # Ingredient
        3: 10,  # Quantity
        4: 10,  # Unit
        5: 8,   # Checked
    })

    # Fetch all grocery items for the plan
    grocery_items = db.query(GroceryItem).filter(
        GroceryItem.plan_id == plan.id
    ).order_by(GroceryItem.category, GroceryItem.ingredient_name).all()

    # Group items by category
    items_by_category = {}
    for item in grocery_items:
        category = item.category or "Other"
        if category not in items_by_category:
            items_by_category[category] = []
        items_by_category[category].append(item)

    current_row = 5

    # Process each category
    for category in sorted(items_by_category.keys()):
        items = items_by_category[category]

        # Category header row
        ws.merge_cells(start_row=current_row, start_column=1, end_row=current_row, end_column=5)
        cell = ws.cell(row=current_row, column=1)
        cell.value = category
        cell.font = CATEGORY_FONT
        cell.fill = CATEGORY_FILL
        cell.border = THIN_BORDER
        cell.alignment = LEFT_ALIGN

        current_row += 1

        # Add items
        for item in items:
            ws.cell(row=current_row, column=1).value = ""  # Empty category column for items
            ws.cell(row=current_row, column=2).value = item.ingredient_name
            ws.cell(row=current_row, column=3).value = round(item.quantity, 2) if item.quantity else 0
            ws.cell(row=current_row, column=4).value = item.unit or "item"
            ws.cell(row=current_row, column=5).value = "Yes" if item.checked else "No"

            # Apply formatting
            for col in range(1, 6):
                cell = ws.cell(row=current_row, column=col)
                cell.border = THIN_BORDER
                cell.font = NORMAL_FONT

                # Alignment
                if col == 3:  # Quantity
                    cell.alignment = CENTER_ALIGN
                    cell.number_format = "#,##0.00"
                elif col in [4, 5]:  # Unit and checkbox
                    cell.alignment = CENTER_ALIGN
                else:
                    cell.alignment = LEFT_ALIGN

                # Alternating row colors
                if current_row % 2 == 0:
                    cell.fill = ALT_ROW_FILL

            current_row += 1

        # Add empty row between categories
        current_row += 1


def generate_nutrition_tracking_sheet(ws: Worksheet, db: Session, plan: MealPlan):
    """
    Generate Sheet 3: Nutrition Tracking

    Contains planned vs actual nutrition comparison with status tracking
    and adherence metrics.
    """
    # Set sheet title
    ws.title = "Nutrition Tracking"

    # Row 1: Title
    apply_title_style(ws, 1, 1, 11, "Planned vs Actual Nutrition")

    # Row 2: Week reference
    week_range = format_week_range(plan.week_start_date)
    ws.merge_cells(start_row=2, start_column=1, end_row=2, end_column=11)
    cell = ws.cell(row=2, column=1)
    cell.value = f"Week of {week_range}"
    cell.font = Font(size=11, italic=True, color="6B7280")
    cell.alignment = CENTER_ALIGN

    # Row 3: Empty

    # Row 4: Column headers
    headers = [
        "Day", "Meal", "Status",
        "Planned Cal", "Actual Cal",
        "Planned Protein", "Actual Protein",
        "Planned Carbs", "Actual Carbs",
        "Planned Fats", "Actual Fats"
    ]
    for col_idx, header in enumerate(headers, start=1):
        cell = ws.cell(row=4, column=col_idx)
        cell.value = header

    apply_header_style(ws, 4, 1, 11)

    # Set column widths
    set_column_widths(ws, {
        1: 12,   # Day
        2: 12,   # Meal
        3: 18,   # Status
        4: 12,   # Planned Cal
        5: 12,   # Actual Cal
        6: 14,   # Planned Protein
        7: 14,   # Actual Protein
        8: 13,   # Planned Carbs
        9: 13,   # Actual Carbs
        10: 12,  # Planned Fats
        11: 12,  # Actual Fats
    })

    # Fetch all meals and their tracking data
    meals = db.query(Meal).filter(
        Meal.plan_id == plan.id
    ).order_by(Meal.date, Meal.meal_type).all()

    # Group meals by day
    meals_by_day = {}
    for meal in meals:
        day_key = meal.date
        if day_key not in meals_by_day:
            meals_by_day[day_key] = []
        meals_by_day[day_key].append(meal)

    current_row = 5
    weekly_planned_totals = {"calories": 0, "protein": 0, "carbs": 0, "fats": 0}
    weekly_actual_totals = {"calories": 0, "protein": 0, "carbs": 0, "fats": 0}
    total_meals = 0
    meals_on_track = 0

    # Process each day
    for day_offset in range(7):
        day_date = plan.week_start_date + timedelta(days=day_offset)
        day_meals = meals_by_day.get(day_date, [])

        if not day_meals:
            continue

        day_start_row = current_row
        day_planned_totals = {"calories": 0, "protein": 0, "carbs": 0, "fats": 0}
        day_actual_totals = {"calories": 0, "protein": 0, "carbs": 0, "fats": 0}

        # Add meals for this day
        for meal_idx, meal in enumerate(day_meals):
            # Get tracking data
            tracking = db.query(NutritionTracking).filter(
                NutritionTracking.meal_id == meal.id
            ).first()

            # Day column (only show on first meal of day)
            if meal_idx == 0:
                ws.cell(row=current_row, column=1).value = get_day_name(day_date)

            # Meal data
            ws.cell(row=current_row, column=2).value = meal.meal_type.replace("_", " ").title()

            # Status
            status_text = "Not Tracked"
            status_key = "not_tracked"
            if tracking:
                status_map = {
                    "ate_as_planned": "Ate as Planned",
                    "skipped": "Skipped",
                    "ate_something_else": "Ate Something Else"
                }
                status_text = status_map.get(tracking.status, "Not Tracked")
                status_key = tracking.status

            ws.cell(row=current_row, column=3).value = status_text

            # Planned values
            planned_cal = meal.calories or 0
            planned_protein = meal.protein or 0
            planned_carbs = meal.carbs or 0
            planned_fats = meal.fats or 0

            ws.cell(row=current_row, column=4).value = planned_cal
            ws.cell(row=current_row, column=6).value = round(planned_protein, 1)
            ws.cell(row=current_row, column=8).value = round(planned_carbs, 1)
            ws.cell(row=current_row, column=10).value = round(planned_fats, 1)

            # Actual values
            actual_cal = 0
            actual_protein = 0
            actual_carbs = 0
            actual_fats = 0

            if tracking:
                if tracking.status == "ate_as_planned":
                    actual_cal = planned_cal
                    actual_protein = planned_protein
                    actual_carbs = planned_carbs
                    actual_fats = planned_fats
                    meals_on_track += 1
                elif tracking.status == "ate_something_else":
                    actual_cal = tracking.actual_calories or 0
                    actual_protein = tracking.actual_protein or 0
                    actual_carbs = tracking.actual_carbs or 0
                    actual_fats = tracking.actual_fats or 0
                # For "skipped", actuals remain 0

            ws.cell(row=current_row, column=5).value = actual_cal
            ws.cell(row=current_row, column=7).value = round(actual_protein, 1)
            ws.cell(row=current_row, column=9).value = round(actual_carbs, 1)
            ws.cell(row=current_row, column=11).value = round(actual_fats, 1)

            # Apply formatting
            for col in range(1, 12):
                cell = ws.cell(row=current_row, column=col)
                cell.border = THIN_BORDER
                cell.font = NORMAL_FONT

                # Alignment
                if col >= 4:  # Numeric columns
                    cell.alignment = CENTER_ALIGN
                    # Number format
                    if col in [4, 5]:  # Calories
                        cell.number_format = "#,##0"
                    elif col in [6, 7, 8, 9, 10, 11]:  # Macros
                        cell.number_format = "#,##0.0"
                else:
                    cell.alignment = LEFT_ALIGN

                # Status color coding
                if col == 3:
                    cell.fill = STATUS_FILLS.get(status_key, STATUS_FILLS["not_tracked"])
                elif current_row % 2 == 0 and col != 3:
                    cell.fill = ALT_ROW_FILL

            # Accumulate totals
            day_planned_totals["calories"] += planned_cal
            day_planned_totals["protein"] += planned_protein
            day_planned_totals["carbs"] += planned_carbs
            day_planned_totals["fats"] += planned_fats

            day_actual_totals["calories"] += actual_cal
            day_actual_totals["protein"] += actual_protein
            day_actual_totals["carbs"] += actual_carbs
            day_actual_totals["fats"] += actual_fats

            total_meals += 1
            current_row += 1

        # Merge day column cells
        if len(day_meals) > 1:
            ws.merge_cells(start_row=day_start_row, start_column=1,
                          end_row=current_row - 1, end_column=1)
            ws.cell(row=day_start_row, column=1).alignment = CENTER_ALIGN

        # Add daily subtotal row
        ws.cell(row=current_row, column=1).value = f"{get_day_name(day_date)} Total"
        ws.cell(row=current_row, column=2).value = ""
        ws.cell(row=current_row, column=3).value = ""
        ws.cell(row=current_row, column=4).value = day_planned_totals["calories"]
        ws.cell(row=current_row, column=5).value = day_actual_totals["calories"]
        ws.cell(row=current_row, column=6).value = round(day_planned_totals["protein"], 1)
        ws.cell(row=current_row, column=7).value = round(day_actual_totals["protein"], 1)
        ws.cell(row=current_row, column=8).value = round(day_planned_totals["carbs"], 1)
        ws.cell(row=current_row, column=9).value = round(day_actual_totals["carbs"], 1)
        ws.cell(row=current_row, column=10).value = round(day_planned_totals["fats"], 1)
        ws.cell(row=current_row, column=11).value = round(day_actual_totals["fats"], 1)

        # Apply subtotal styling
        apply_subtotal_style(ws, current_row, 1, 11)

        # Number formats for subtotal
        for col in [4, 5]:
            ws.cell(row=current_row, column=col).number_format = "#,##0"
        for col in [6, 7, 8, 9, 10, 11]:
            ws.cell(row=current_row, column=col).number_format = "#,##0.0"

        # Accumulate weekly totals
        for key in weekly_planned_totals:
            weekly_planned_totals[key] += day_planned_totals[key]
            weekly_actual_totals[key] += day_actual_totals[key]

        current_row += 1

    # Add empty row before summary
    current_row += 1

    # Weekly Summary Section
    ws.merge_cells(start_row=current_row, start_column=1, end_row=current_row, end_column=11)
    cell = ws.cell(row=current_row, column=1)
    cell.value = "Weekly Summary"
    cell.font = Font(bold=True, size=12, color="166534")
    cell.alignment = CENTER_ALIGN
    current_row += 1

    # Total Planned vs Total Actual
    ws.cell(row=current_row, column=1).value = "Weekly Total"
    ws.cell(row=current_row, column=2).value = ""
    ws.cell(row=current_row, column=3).value = ""
    ws.cell(row=current_row, column=4).value = weekly_planned_totals["calories"]
    ws.cell(row=current_row, column=5).value = weekly_actual_totals["calories"]
    ws.cell(row=current_row, column=6).value = round(weekly_planned_totals["protein"], 1)
    ws.cell(row=current_row, column=7).value = round(weekly_actual_totals["protein"], 1)
    ws.cell(row=current_row, column=8).value = round(weekly_planned_totals["carbs"], 1)
    ws.cell(row=current_row, column=9).value = round(weekly_actual_totals["carbs"], 1)
    ws.cell(row=current_row, column=10).value = round(weekly_planned_totals["fats"], 1)
    ws.cell(row=current_row, column=11).value = round(weekly_actual_totals["fats"], 1)

    apply_grand_total_style(ws, current_row, 1, 11)

    # Number formats
    for col in [4, 5]:
        ws.cell(row=current_row, column=col).number_format = "#,##0"
    for col in [6, 7, 8, 9, 10, 11]:
        ws.cell(row=current_row, column=col).number_format = "#,##0.0"

    current_row += 1

    # Adherence Rate
    adherence_rate = (meals_on_track / total_meals * 100) if total_meals > 0 else 0
    ws.cell(row=current_row, column=1).value = "Adherence Rate"
    ws.cell(row=current_row, column=2).value = f"{adherence_rate:.1f}%"
    ws.cell(row=current_row, column=3).value = f"({meals_on_track}/{total_meals} meals on track)"
    ws.merge_cells(start_row=current_row, start_column=3, end_row=current_row, end_column=11)

    for col in range(1, 12):
        cell = ws.cell(row=current_row, column=col)
        cell.font = Font(bold=True, size=10)
        cell.border = THIN_BORDER
        cell.alignment = LEFT_ALIGN

    current_row += 1

    # Average Daily Calories
    avg_planned = weekly_planned_totals["calories"] / 7
    avg_actual = weekly_actual_totals["calories"] / 7
    ws.cell(row=current_row, column=1).value = "Avg Daily Calories"
    ws.cell(row=current_row, column=2).value = f"Planned: {avg_planned:.0f}"
    ws.cell(row=current_row, column=3).value = f"Actual: {avg_actual:.0f}"
    ws.merge_cells(start_row=current_row, start_column=3, end_row=current_row, end_column=11)

    for col in range(1, 12):
        cell = ws.cell(row=current_row, column=col)
        cell.font = Font(bold=True, size=10)
        cell.border = THIN_BORDER
        cell.alignment = LEFT_ALIGN


# ============================================================================
# MAIN EXPORT FUNCTION
# ============================================================================

def generate_excel(db: Session, plan_id: int) -> BytesIO:
    """
    Generate complete Excel workbook for a meal plan.

    Args:
        db: Database session
        plan_id: ID of the meal plan to export

    Returns:
        BytesIO: Excel file as bytes in memory

    Raises:
        ValueError: If plan not found
    """
    # Fetch the meal plan
    plan = db.query(MealPlan).filter(MealPlan.id == plan_id).first()
    if not plan:
        raise ValueError(f"Meal plan with ID {plan_id} not found")

    # Create workbook
    wb = Workbook()

    # Remove default sheet
    wb.remove(wb.active)

    # Generate Sheet 1: Weekly Meal Plan
    ws_meal_plan = wb.create_sheet("Weekly Meal Plan")
    generate_meal_plan_sheet(ws_meal_plan, db, plan)

    # Generate Sheet 2: Grocery List
    ws_grocery = wb.create_sheet("Grocery List")
    generate_grocery_list_sheet(ws_grocery, db, plan)

    # Generate Sheet 3: Nutrition Tracking
    ws_tracking = wb.create_sheet("Nutrition Tracking")
    generate_nutrition_tracking_sheet(ws_tracking, db, plan)

    # Save to BytesIO
    output = BytesIO()
    wb.save(output)
    output.seek(0)

    return output
```

---

### Export Router

**File:** `backend/routers/export.py`

```python
"""
Export Router

Handles Excel file generation and download endpoints.
"""

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from database import get_db
from models.meal_plan import MealPlan
from services import export_service


router = APIRouter(prefix="/export", tags=["export"])


@router.get("/{plan_id}/excel")
def export_meal_plan_excel(
    plan_id: int,
    db: Session = Depends(get_db)
):
    """
    Export meal plan as Excel file.

    Generates a comprehensive .xlsx file containing:
    - Weekly meal plan with all meals and nutrition
    - Grocery list organized by category
    - Nutrition tracking with planned vs actual comparison

    Args:
        plan_id: ID of the meal plan to export
        db: Database session

    Returns:
        StreamingResponse: Excel file download

    Raises:
        HTTPException: 404 if plan not found, 500 if generation fails
    """
    # Verify plan exists
    plan = db.query(MealPlan).filter(MealPlan.id == plan_id).first()
    if not plan:
        raise HTTPException(status_code=404, detail="Meal plan not found")

    try:
        # Generate Excel file
        output = export_service.generate_excel(db, plan_id)

        # Create filename with week start date
        filename = f"meal_plan_{plan.week_start_date.isoformat()}.xlsx"

        # Return as streaming response
        return StreamingResponse(
            output,
            media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            headers={
                "Content-Disposition": f"attachment; filename={filename}",
                "Cache-Control": "no-cache"
            }
        )
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        # Log the error in production
        print(f"Error generating Excel: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail="Failed to generate Excel file"
        )
```

**Register router in `backend/main.py`:**

```python
from routers import export

app.include_router(export.router)
```

---

## Frontend Implementation

### Export Button Component

Add to meal plan page and dashboard.

**File:** `src/components/ExportButton.tsx`

```typescript
/**
 * Export Button Component
 *
 * Handles Excel file download for meal plans.
 * Shows loading state during generation and download.
 */

import { useState } from 'react';
import { Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { exportApi } from '@/lib/api';

interface ExportButtonProps {
  planId: number;
  disabled?: boolean;
  variant?: 'default' | 'outline' | 'ghost';
  size?: 'sm' | 'default' | 'lg';
  className?: string;
}

export function ExportButton({
  planId,
  disabled = false,
  variant = 'default',
  size = 'default',
  className = '',
}: ExportButtonProps) {
  const [exporting, setExporting] = useState(false);
  const { toast } = useToast();

  const handleExport = async () => {
    try {
      setExporting(true);

      // Fetch Excel file as blob
      const blob = await exportApi.downloadExcel(planId);

      // Create download link
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `meal_plan_${new Date().toISOString().split('T')[0]}.xlsx`);

      // Trigger download
      document.body.appendChild(link);
      link.click();

      // Cleanup
      link.remove();
      window.URL.revokeObjectURL(url);

      toast({
        title: 'Export Successful',
        description: 'Your meal plan has been downloaded.',
        variant: 'default',
      });
    } catch (error) {
      console.error('Export error:', error);
      toast({
        title: 'Export Failed',
        description: 'Failed to export meal plan. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setExporting(false);
    }
  };

  return (
    <Button
      onClick={handleExport}
      disabled={disabled || exporting}
      variant={variant}
      size={size}
      className={className}
    >
      <Download className="mr-2 h-4 w-4" />
      {exporting ? 'Exporting...' : 'Export to Excel'}
    </Button>
  );
}
```

---

### API Integration

**File:** `src/lib/api.ts` (add to existing API wrapper)

```typescript
/**
 * Export API
 */
export const exportApi = {
  /**
   * Download Excel file for a meal plan
   */
  downloadExcel: async (planId: number): Promise<Blob> => {
    const response = await api.get(`/export/${planId}/excel`, {
      responseType: 'blob',
    });
    return response.data;
  },
};
```

---

### Usage in Meal Plan Page

**File:** `src/pages/MealPlanPage.tsx` (add export button to header)

```typescript
import { ExportButton } from '@/components/ExportButton';

// In the page header section:
<div className="flex justify-between items-center mb-6">
  <h1 className="text-3xl font-bold">Weekly Meal Plan</h1>
  <div className="flex gap-2">
    <ExportButton planId={mealPlan.id} />
    {/* Other buttons */}
  </div>
</div>
```

---

### Usage in Dashboard

**File:** `src/pages/Dashboard.tsx`

```typescript
import { ExportButton } from '@/components/ExportButton';

// In the current plan section:
{currentPlan && (
  <Card>
    <CardHeader>
      <CardTitle>Current Week Plan</CardTitle>
      <CardDescription>
        Week of {formatDate(currentPlan.week_start_date)}
      </CardDescription>
    </CardHeader>
    <CardContent>
      {/* Plan summary */}
    </CardContent>
    <CardFooter className="flex gap-2">
      <Button onClick={() => navigate(`/meal-plan/${currentPlan.id}`)}>
        View Plan
      </Button>
      <ExportButton
        planId={currentPlan.id}
        variant="outline"
      />
    </CardFooter>
  </Card>
)}
```

---

## Security Considerations

### Input Validation

1. **Plan ID Validation**: Verify plan exists and belongs to user
2. **SQL Injection Prevention**: Use ORM queries (already handled by SQLAlchemy)
3. **Path Traversal**: No file paths exposed (using BytesIO)

### Access Control

```python
# In router, add user verification:
from auth import get_current_user

@router.get("/{plan_id}/excel")
def export_meal_plan_excel(
    plan_id: int,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    # Verify plan exists
    plan = db.query(MealPlan).filter(MealPlan.id == plan_id).first()
    if not plan:
        raise HTTPException(status_code=404, detail="Meal plan not found")

    # Verify ownership
    if plan.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Access denied")

    # ... rest of the code
```

### Rate Limiting

Add rate limiting to prevent abuse:

```python
from slowapi import Limiter
from slowapi.util import get_remote_address

limiter = Limiter(key_func=get_remote_address)

@router.get("/{plan_id}/excel")
@limiter.limit("10/minute")  # Max 10 exports per minute per IP
def export_meal_plan_excel(...):
    # ...
```

---

## Performance Optimization

### Memory Management

1. **Stream Generation**: Use BytesIO to keep file in memory (no disk I/O)
2. **Cleanup**: Properly close workbook and clear references
3. **File Size**: Typical file size 50-100 KB (small enough for memory)

### Database Optimization

```python
# Optimize queries with eager loading
from sqlalchemy.orm import joinedload

meals = db.query(Meal).filter(
    Meal.plan_id == plan_id
).options(
    joinedload(Meal.nutrition_tracking)
).order_by(Meal.date, Meal.meal_type).all()
```

### Caching Strategy

For frequently exported plans, consider caching:

```python
from functools import lru_cache
from datetime import datetime, timedelta

# Cache export for 5 minutes
@lru_cache(maxsize=100)
def get_cached_export(plan_id: int, cache_key: str):
    # Cache key includes plan_id and current 5-minute window
    # This ensures exports are regenerated if data changes
    return export_service.generate_excel(db, plan_id)

# In router:
cache_key = f"{plan_id}_{datetime.now().timestamp() // 300}"
output = get_cached_export(plan_id, cache_key)
```

---

## Error Handling

### Backend Error Handling

```python
@router.get("/{plan_id}/excel")
def export_meal_plan_excel(...):
    try:
        # Verify plan exists
        plan = db.query(MealPlan).filter(MealPlan.id == plan_id).first()
        if not plan:
            raise HTTPException(status_code=404, detail="Meal plan not found")

        # Generate Excel
        output = export_service.generate_excel(db, plan_id)

        # ... return response

    except ValueError as e:
        # Handle validation errors
        raise HTTPException(status_code=400, detail=str(e))
    except PermissionError as e:
        # Handle access control errors
        raise HTTPException(status_code=403, detail=str(e))
    except Exception as e:
        # Log unexpected errors
        logger.error(f"Excel export failed: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail="Failed to generate Excel file. Please try again later."
        )
```

### Frontend Error Handling

```typescript
const handleExport = async () => {
  try {
    setExporting(true);
    const blob = await exportApi.downloadExcel(planId);

    // Verify blob is valid
    if (!blob || blob.size === 0) {
      throw new Error('Empty file received');
    }

    // Create download
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `meal_plan.xlsx`);
    document.body.appendChild(link);
    link.click();

    // Cleanup
    setTimeout(() => {
      link.remove();
      window.URL.revokeObjectURL(url);
    }, 100);

    toast({
      title: 'Success',
      description: 'Meal plan exported successfully',
    });
  } catch (error) {
    console.error('Export error:', error);

    let errorMessage = 'Failed to export meal plan';
    if (error.response?.status === 404) {
      errorMessage = 'Meal plan not found';
    } else if (error.response?.status === 403) {
      errorMessage = 'Access denied';
    }

    toast({
      title: 'Export Failed',
      description: errorMessage,
      variant: 'destructive',
    });
  } finally {
    setExporting(false);
  }
};
```

---

## Testing

### Backend Tests

**File:** `backend/tests/test_export.py`

```python
import pytest
from io import BytesIO
from openpyxl import load_workbook

def test_export_excel_success(client, test_user, test_plan):
    """Test successful Excel export"""
    response = client.get(f"/export/{test_plan.id}/excel")

    assert response.status_code == 200
    assert response.headers["content-type"] == "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    assert "attachment" in response.headers["content-disposition"]

    # Verify Excel file is valid
    wb = load_workbook(BytesIO(response.content))
    assert "Weekly Meal Plan" in wb.sheetnames
    assert "Grocery List" in wb.sheetnames
    assert "Nutrition Tracking" in wb.sheetnames


def test_export_plan_not_found(client, test_user):
    """Test export with non-existent plan"""
    response = client.get("/export/99999/excel")
    assert response.status_code == 404


def test_export_unauthorized(client, test_plan):
    """Test export without authentication"""
    response = client.get(f"/export/{test_plan.id}/excel")
    assert response.status_code == 401


def test_excel_meal_plan_sheet(db, test_plan, test_meals):
    """Test meal plan sheet content"""
    from services.export_service import generate_excel

    output = generate_excel(db, test_plan.id)
    wb = load_workbook(output)
    ws = wb["Weekly Meal Plan"]

    # Verify title
    assert ws.cell(1, 1).value == "Weekly Meal Plan"

    # Verify headers
    assert ws.cell(4, 1).value == "Day"
    assert ws.cell(4, 2).value == "Meal Type"
    assert ws.cell(4, 3).value == "Dish Name"

    # Verify data row exists
    assert ws.cell(5, 3).value is not None  # Dish name


def test_excel_grocery_sheet(db, test_plan, test_grocery_items):
    """Test grocery list sheet content"""
    from services.export_service import generate_excel

    output = generate_excel(db, test_plan.id)
    wb = load_workbook(output)
    ws = wb["Grocery List"]

    # Verify title
    assert ws.cell(1, 1).value == "Grocery List"

    # Verify headers
    assert ws.cell(4, 1).value == "Category"
    assert ws.cell(4, 2).value == "Ingredient"


def test_excel_tracking_sheet(db, test_plan, test_meals, test_tracking):
    """Test nutrition tracking sheet content"""
    from services.export_service import generate_excel

    output = generate_excel(db, test_plan.id)
    wb = load_workbook(output)
    ws = wb["Nutrition Tracking"]

    # Verify title
    assert ws.cell(1, 1).value == "Planned vs Actual Nutrition"

    # Verify headers
    assert ws.cell(4, 3).value == "Status"
    assert ws.cell(4, 4).value == "Planned Cal"
```

### Frontend Tests

**File:** `src/components/__tests__/ExportButton.test.tsx`

```typescript
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ExportButton } from '../ExportButton';
import { exportApi } from '@/lib/api';

jest.mock('@/lib/api');

describe('ExportButton', () => {
  it('renders export button', () => {
    render(<ExportButton planId={1} />);
    expect(screen.getByText('Export to Excel')).toBeInTheDocument();
  });

  it('shows loading state during export', async () => {
    exportApi.downloadExcel = jest.fn(() => new Promise(() => {}));

    render(<ExportButton planId={1} />);
    fireEvent.click(screen.getByText('Export to Excel'));

    await waitFor(() => {
      expect(screen.getByText('Exporting...')).toBeInTheDocument();
    });
  });

  it('triggers download on success', async () => {
    const blob = new Blob(['test'], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    exportApi.downloadExcel = jest.fn(() => Promise.resolve(blob));

    // Mock createElement
    const mockLink = { click: jest.fn(), remove: jest.fn() };
    document.createElement = jest.fn(() => mockLink);

    render(<ExportButton planId={1} />);
    fireEvent.click(screen.getByText('Export to Excel'));

    await waitFor(() => {
      expect(mockLink.click).toHaveBeenCalled();
    });
  });

  it('handles export error', async () => {
    exportApi.downloadExcel = jest.fn(() => Promise.reject(new Error('Export failed')));

    render(<ExportButton planId={1} />);
    fireEvent.click(screen.getByText('Export to Excel'));

    await waitFor(() => {
      expect(screen.getByText('Export to Excel')).toBeInTheDocument(); // Back to normal state
    });
  });
});
```

---

## File Size Considerations

### Typical File Sizes

- **Weekly Plan (7 days, 3 meals/day)**: 40-60 KB
- **With 50 grocery items**: +10-15 KB
- **With tracking data**: +5-10 KB
- **Total typical size**: 50-100 KB

### Optimization Strategies

1. **No Images**: Text-only content keeps size small
2. **Minimal Formatting**: Use efficient styling
3. **No Embedded Objects**: Avoid charts, images, or embedded files
4. **Compressed Storage**: XLSX uses ZIP compression internally

### Size Limits

- **Maximum realistic size**: 500 KB (100+ meals)
- **Memory limit**: 5 MB buffer for safety
- **No pagination needed**: Single-file export is efficient

---

## Browser Compatibility

### Download Mechanism

The frontend download code works across all modern browsers:

```typescript
// Works in Chrome, Firefox, Safari, Edge
const url = window.URL.createObjectURL(blob);
const link = document.createElement('a');
link.href = url;
link.setAttribute('download', filename);
document.body.appendChild(link);
link.click();
link.remove();
window.URL.revokeObjectURL(url);
```

### Excel Compatibility

Generated XLSX files open correctly in:
- Microsoft Excel (2007+)
- Google Sheets
- Apple Numbers
- LibreOffice Calc
- WPS Office

---

## Verification Checklist

Before deploying to production, verify:

### Backend
- [ ] Excel downloads successfully with correct MIME type
- [ ] Filename includes week start date in ISO format
- [ ] All three sheets are present and named correctly
- [ ] Plan ownership verification works
- [ ] 404 returned for non-existent plans
- [ ] 403 returned for unauthorized access
- [ ] Rate limiting prevents abuse

### Sheet 1: Weekly Meal Plan
- [ ] Title and week range display correctly
- [ ] All 7 days present with correct meals
- [ ] Meal data includes all fields (name, cuisine, nutrition, ingredients, recipe)
- [ ] Daily subtotals calculate correctly
- [ ] Weekly grand total calculates correctly
- [ ] Formatting is professional (colors, fonts, borders)
- [ ] Column widths are appropriate
- [ ] Number formats display correctly (#,##0 for calories, #,##0.0 for macros)
- [ ] Frozen panes work (top 4 rows, first 2 columns)

### Sheet 2: Grocery List
- [ ] Title displays correctly
- [ ] Items grouped by category
- [ ] Category headers have blue background
- [ ] Items sorted alphabetically within categories
- [ ] Checkbox column shows Yes/No
- [ ] Quantities formatted with 2 decimals

### Sheet 3: Nutrition Tracking
- [ ] Title displays correctly
- [ ] All meals listed with correct status
- [ ] Status colors applied correctly (green/red/orange/gray)
- [ ] Planned values match meal plan
- [ ] Actual values calculated correctly based on status
- [ ] Daily subtotals calculate correctly
- [ ] Weekly summary shows totals and adherence rate
- [ ] Average daily calories displayed

### Frontend
- [ ] Export button renders correctly
- [ ] Loading state shows "Exporting..." during generation
- [ ] Download triggers automatically
- [ ] File saves with correct .xlsx extension
- [ ] Success toast displays after download
- [ ] Error toast displays on failure
- [ ] Button disabled when no plan exists
- [ ] Button accessible on meal plan page
- [ ] Button accessible on dashboard

### Cross-Platform
- [ ] File opens in Microsoft Excel
- [ ] File opens in Google Sheets
- [ ] File opens in Apple Numbers
- [ ] File opens in LibreOffice Calc
- [ ] All formatting preserved across applications
- [ ] Formulas (if any) work correctly
- [ ] Frozen panes work in all applications

### Edge Cases
- [ ] Export works with minimal data (1 meal)
- [ ] Export works with maximum data (100+ meals)
- [ ] Export handles missing optional fields (cuisine, prep time)
- [ ] Export handles empty grocery list
- [ ] Export handles no tracking data
- [ ] Export handles special characters in dish names
- [ ] Export handles very long ingredient lists
- [ ] Export handles very long recipe steps

---

## Deployment Notes

### Environment Setup

Add to `.env`:
```bash
# Export settings
EXPORT_MAX_FILE_SIZE_MB=5
EXPORT_RATE_LIMIT=10/minute
```

### Dependencies Installation

```bash
# Backend
cd backend
pip install openpyxl==3.1.2

# Verify installation
python -c "import openpyxl; print(openpyxl.__version__)"
```

### Monitoring

Add logging for export operations:

```python
import logging

logger = logging.getLogger(__name__)

@router.get("/{plan_id}/excel")
def export_meal_plan_excel(...):
    logger.info(f"Excel export requested: plan_id={plan_id}, user_id={current_user.id}")

    try:
        output = export_service.generate_excel(db, plan_id)
        logger.info(f"Excel export successful: plan_id={plan_id}, size={output.getbuffer().nbytes}")
        return StreamingResponse(...)
    except Exception as e:
        logger.error(f"Excel export failed: plan_id={plan_id}, error={str(e)}", exc_info=True)
        raise
```

### Performance Metrics

Monitor:
- Average export generation time (target: <2 seconds)
- File size distribution
- Error rate
- Daily export volume

---

## Next Steps

After completing Excel export:

1. **Phase 8: Multi-Week Planning** (Document 09)
   - Plan multiple weeks in advance
   - Copy meals across weeks
   - Track historical plans

2. **Phase 9: Preferences & Restrictions** (Document 10)
   - Advanced dietary restrictions
   - Ingredient preferences
   - Cuisine preferences

3. **Phase 10: Analytics Dashboard** (Document 11)
   - Nutrition trends over time
   - Adherence metrics
   - Cost analysis

---

## Summary

This phase implements a comprehensive Excel export system that generates professional, multi-sheet workbooks containing all meal planning data. The implementation prioritizes:

- **Professional formatting** with proper styling, colors, and borders
- **Complete data export** including meals, grocery lists, and tracking
- **Security** with proper access control and validation
- **Performance** with efficient generation and streaming
- **Cross-platform compatibility** with all major spreadsheet applications
- **User experience** with clear feedback and error handling

The export feature provides users with a complete offline copy of their meal plan, suitable for printing, sharing, or archival purposes.
