"""
Excel export service for meal plans, grocery lists, and tracking data.

Uses openpyxl to create formatted Excel workbooks with multiple sheets:
- Sheet 1: Weekly Meal Plan
- Sheet 2: Grocery List
- Sheet 3: Tracking Summary
"""

import io
import json
from typing import BinaryIO
from datetime import date
from sqlalchemy.orm import Session
from openpyxl import Workbook
from openpyxl.styles import Font, Alignment, PatternFill, Border, Side
from openpyxl.utils import get_column_letter

from models.meal_plan import WeeklyPlan, DailyPlan, Meal
from models.grocery import GroceryItem
from models.tracking import MealTracking


# Styling constants
HEADER_FILL = PatternFill(start_color="366092", end_color="366092", fill_type="solid")
HEADER_FONT = Font(color="FFFFFF", bold=True, size=12)
BORDER_STYLE = Border(
    left=Side(style='thin'),
    right=Side(style='thin'),
    top=Side(style='thin'),
    bottom=Side(style='thin')
)


def generate_excel(db: Session, plan_id: int) -> BinaryIO:
    """
    Generate Excel workbook for a weekly meal plan.

    Creates a comprehensive Excel file with three sheets:
    1. Weekly Meal Plan - All meals with nutrition and recipes
    2. Grocery List - Categorized shopping list
    3. Tracking Summary - Meal tracking status and nutrition comparison

    Args:
        db: Database session
        plan_id: Weekly plan ID

    Returns:
        BytesIO buffer containing the Excel file

    Raises:
        ValueError: If weekly plan not found
    """
    # Get weekly plan
    weekly_plan = db.query(WeeklyPlan).filter(WeeklyPlan.id == plan_id).first()
    if not weekly_plan:
        raise ValueError(f"Weekly plan with id {plan_id} not found")

    # Create workbook
    wb = Workbook()

    # Remove default sheet
    wb.remove(wb.active)

    # Create Sheet 1: Weekly Meal Plan
    _create_meal_plan_sheet(wb, db, weekly_plan)

    # Create Sheet 2: Grocery List
    _create_grocery_list_sheet(wb, db, plan_id)

    # Create Sheet 3: Tracking Summary
    _create_tracking_sheet(wb, db, weekly_plan)

    # Save to BytesIO
    buffer = io.BytesIO()
    wb.save(buffer)
    buffer.seek(0)

    return buffer


def _create_meal_plan_sheet(wb: Workbook, db: Session, weekly_plan: WeeklyPlan):
    """
    Create the Weekly Meal Plan sheet.

    Columns: Day | Meal Type | Dish Name | Calories | Protein | Carbs | Fats | Prep Time
    """
    ws = wb.create_sheet("Weekly Meal Plan")

    # Define headers
    headers = ["Day", "Meal Type", "Dish Name", "Calories", "Protein (g)", "Carbs (g)", "Fats (g)", "Prep Time (min)"]

    # Write headers with styling
    for col_num, header in enumerate(headers, 1):
        cell = ws.cell(row=1, column=col_num, value=header)
        cell.font = HEADER_FONT
        cell.fill = HEADER_FILL
        cell.alignment = Alignment(horizontal="center", vertical="center")
        cell.border = BORDER_STYLE

    # Get all daily plans
    daily_plans = db.query(DailyPlan).filter(
        DailyPlan.weekly_plan_id == weekly_plan.id
    ).order_by(DailyPlan.day_of_week).all()

    # Write meal data
    row = 2
    for daily_plan in daily_plans:
        day_label = daily_plan.day_date.strftime("%A, %b %d") if daily_plan.day_date else f"Day {daily_plan.day_of_week + 1}"

        # Get meals for this day
        meals = db.query(Meal).filter(
            Meal.daily_plan_id == daily_plan.id
        ).order_by(Meal.meal_type).all()

        for meal in meals:
            ws.cell(row=row, column=1, value=day_label)
            ws.cell(row=row, column=2, value=meal.meal_type.capitalize())
            ws.cell(row=row, column=3, value=meal.dish_name)
            ws.cell(row=row, column=4, value=round(meal.calories, 1))
            ws.cell(row=row, column=5, value=round(meal.protein, 1))
            ws.cell(row=row, column=6, value=round(meal.carbs, 1))
            ws.cell(row=row, column=7, value=round(meal.fats, 1))
            ws.cell(row=row, column=8, value=meal.prep_time or 0)

            # Apply borders
            for col in range(1, 9):
                ws.cell(row=row, column=col).border = BORDER_STYLE

            row += 1

    # Adjust column widths
    ws.column_dimensions['A'].width = 12
    ws.column_dimensions['B'].width = 15
    ws.column_dimensions['C'].width = 35
    ws.column_dimensions['D'].width = 12
    ws.column_dimensions['E'].width = 12
    ws.column_dimensions['F'].width = 12
    ws.column_dimensions['G'].width = 12
    ws.column_dimensions['H'].width = 15


def _create_grocery_list_sheet(wb: Workbook, db: Session, plan_id: int):
    """
    Create the Grocery List sheet.

    Columns: Category | Item | Quantity | Unit
    """
    ws = wb.create_sheet("Grocery List")

    # Define headers
    headers = ["Category", "Item", "Quantity", "Unit"]

    # Write headers
    for col_num, header in enumerate(headers, 1):
        cell = ws.cell(row=1, column=col_num, value=header)
        cell.font = HEADER_FONT
        cell.fill = HEADER_FILL
        cell.alignment = Alignment(horizontal="center", vertical="center")
        cell.border = BORDER_STYLE

    # Get grocery items ordered by category
    grocery_items = db.query(GroceryItem).filter(
        GroceryItem.weekly_plan_id == plan_id
    ).order_by(GroceryItem.category, GroceryItem.ingredient_name).all()

    # Write grocery data
    row = 2
    for item in grocery_items:
        ws.cell(row=row, column=1, value=item.category)
        ws.cell(row=row, column=2, value=item.ingredient_name)

        # Format quantity
        qty_str = ""
        if item.quantity is not None:
            qty_str = f"{item.quantity:.1f}" if item.quantity % 1 else f"{int(item.quantity)}"

        ws.cell(row=row, column=3, value=qty_str)
        ws.cell(row=row, column=4, value=item.unit or "")

        # Apply borders
        for col in range(1, 5):
            ws.cell(row=row, column=col).border = BORDER_STYLE

        row += 1

    # Adjust column widths
    ws.column_dimensions['A'].width = 20
    ws.column_dimensions['B'].width = 30
    ws.column_dimensions['C'].width = 12
    ws.column_dimensions['D'].width = 12


def generate_grocery_excel(db: Session, plan_id: int) -> BinaryIO:
    """
    Generate a standalone Excel workbook for a grocery list.

    Creates a single-sheet Excel file with grocery items grouped by category,
    including a checked column for shopping progress.

    Args:
        db: Database session
        plan_id: Weekly plan ID

    Returns:
        BytesIO buffer containing the Excel file

    Raises:
        ValueError: If no grocery items found for this plan
    """
    grocery_items = db.query(GroceryItem).filter(
        GroceryItem.weekly_plan_id == plan_id
    ).order_by(GroceryItem.category, GroceryItem.ingredient_name).all()

    if not grocery_items:
        raise ValueError(f"No grocery list found for plan {plan_id}. Generate one first.")

    wb = Workbook()
    ws = wb.active
    ws.title = "Grocery List"

    # Category sub-header styling
    category_fill = PatternFill(start_color="D9E2F3", end_color="D9E2F3", fill_type="solid")
    category_font = Font(bold=True, size=11)
    checked_font = Font(color="888888", italic=True)

    # Headers
    headers = ["Item", "Quantity", "Unit", "Purchased"]
    for col_num, header in enumerate(headers, 1):
        cell = ws.cell(row=1, column=col_num, value=header)
        cell.font = HEADER_FONT
        cell.fill = HEADER_FILL
        cell.alignment = Alignment(horizontal="center", vertical="center")
        cell.border = BORDER_STYLE

    # Group items by category
    from collections import defaultdict
    by_category = defaultdict(list)
    for item in grocery_items:
        by_category[item.category].append(item)

    # Write data grouped by category
    row = 2
    for category in sorted(by_category.keys()):
        items = by_category[category]

        # Category header row
        cell = ws.cell(row=row, column=1, value=category)
        cell.font = category_font
        cell.fill = category_fill
        for col in range(1, 5):
            ws.cell(row=row, column=col).fill = category_fill
            ws.cell(row=row, column=col).border = BORDER_STYLE
        ws.merge_cells(start_row=row, start_column=1, end_row=row, end_column=4)
        row += 1

        for item in items:
            name_cell = ws.cell(row=row, column=1, value=item.ingredient_name)

            # Format quantity
            if item.quantity is not None:
                qty_str = f"{item.quantity:.1f}" if item.quantity % 1 else f"{int(item.quantity)}"
            else:
                qty_str = ""
            ws.cell(row=row, column=2, value=qty_str)
            ws.cell(row=row, column=3, value=item.unit or "")
            ws.cell(row=row, column=4, value="Yes" if item.checked else "")

            # Strikethrough style for checked items
            if item.checked:
                name_cell.font = checked_font

            for col in range(1, 5):
                ws.cell(row=row, column=col).border = BORDER_STYLE

            row += 1

    # Column widths
    ws.column_dimensions['A'].width = 35
    ws.column_dimensions['B'].width = 12
    ws.column_dimensions['C'].width = 10
    ws.column_dimensions['D'].width = 12

    buffer = io.BytesIO()
    wb.save(buffer)
    buffer.seek(0)
    return buffer


def _create_tracking_sheet(wb: Workbook, db: Session, weekly_plan: WeeklyPlan):
    """
    Create the Tracking Summary sheet.

    Columns: Day | Meal | Status | Planned Cal | Actual Cal | Planned Protein | Actual Protein
    """
    ws = wb.create_sheet("Tracking Summary")

    # Define headers
    headers = [
        "Day", "Meal Type", "Dish Name", "Status",
        "Planned Calories", "Actual Calories",
        "Planned Protein", "Actual Protein"
    ]

    # Write headers
    for col_num, header in enumerate(headers, 1):
        cell = ws.cell(row=1, column=col_num, value=header)
        cell.font = HEADER_FONT
        cell.fill = HEADER_FILL
        cell.alignment = Alignment(horizontal="center", vertical="center")
        cell.border = BORDER_STYLE

    # Get all daily plans
    daily_plans = db.query(DailyPlan).filter(
        DailyPlan.weekly_plan_id == weekly_plan.id
    ).order_by(DailyPlan.day_of_week).all()

    # Day names
    day_names = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]

    # Write tracking data
    row = 2
    for daily_plan in daily_plans:
        day_name = day_names[daily_plan.day_of_week]

        # Get meals for this day
        meals = db.query(Meal).filter(
            Meal.daily_plan_id == daily_plan.id
        ).order_by(Meal.meal_type).all()

        for meal in meals:
            # Get tracking if exists
            tracking = db.query(MealTracking).filter(
                MealTracking.meal_id == meal.id
            ).first()

            ws.cell(row=row, column=1, value=day_name)
            ws.cell(row=row, column=2, value=meal.meal_type.capitalize())
            ws.cell(row=row, column=3, value=meal.dish_name)

            # Status
            status = tracking.status if tracking else "Not Tracked"
            ws.cell(row=row, column=4, value=status.replace("_", " ").title())

            # Planned nutrition
            ws.cell(row=row, column=5, value=round(meal.calories, 1))
            ws.cell(row=row, column=7, value=round(meal.protein, 1))

            # Actual nutrition
            if tracking:
                if tracking.status == "ate_as_planned":
                    actual_cal = meal.calories
                    actual_protein = meal.protein
                elif tracking.status == "skipped":
                    actual_cal = 0
                    actual_protein = 0
                else:  # ate_something_else
                    actual_cal = tracking.alt_calories or 0
                    actual_protein = tracking.alt_protein or 0

                ws.cell(row=row, column=6, value=round(actual_cal, 1))
                ws.cell(row=row, column=8, value=round(actual_protein, 1))
            else:
                ws.cell(row=row, column=6, value="—")
                ws.cell(row=row, column=8, value="—")

            # Apply borders
            for col in range(1, 9):
                ws.cell(row=row, column=col).border = BORDER_STYLE

            row += 1

    # Adjust column widths
    ws.column_dimensions['A'].width = 12
    ws.column_dimensions['B'].width = 15
    ws.column_dimensions['C'].width = 30
    ws.column_dimensions['D'].width = 18
    ws.column_dimensions['E'].width = 15
    ws.column_dimensions['F'].width = 15
    ws.column_dimensions['G'].width = 15
    ws.column_dimensions['H'].width = 15
