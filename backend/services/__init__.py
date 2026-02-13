"""
Services package for business logic.

Contains all service modules for nutrition calculation, AI meal generation,
tracking, grocery lists, dashboards, and exports.
"""

from .nutrition_calculator import calculate_targets
from .ai_meal_planner import AIMealPlanner
from .tracking_service import (
    track_meal,
    get_daily_tracking,
    get_weekly_tracking,
    calculate_actual_nutrition
)
from .grocery_service import (
    generate_grocery_list,
    regenerate_grocery_list,
    toggle_grocery_item
)
from .dashboard_service import get_dashboard_data
from .export_service import generate_excel

__all__ = [
    # Nutrition calculator
    "calculate_targets",

    # AI meal planner
    "AIMealPlanner",

    # Tracking service
    "track_meal",
    "get_daily_tracking",
    "get_weekly_tracking",
    "calculate_actual_nutrition",

    # Grocery service
    "generate_grocery_list",
    "regenerate_grocery_list",
    "toggle_grocery_item",

    # Dashboard service
    "get_dashboard_data",

    # Export service
    "generate_excel"
]
