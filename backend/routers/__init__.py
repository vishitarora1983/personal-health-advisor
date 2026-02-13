"""
API routers package.

This package contains all FastAPI routers organized by resource type.
Import routers from here for easy access in main.py.
"""

from routers.profile import router as profile_router
from routers.meal_plan import router as meal_plan_router
from routers.tracking import router as tracking_router
from routers.grocery import router as grocery_router
from routers.dashboard import router as dashboard_router
from routers.export import router as export_router


__all__ = [
    "profile_router",
    "meal_plan_router",
    "tracking_router",
    "grocery_router",
    "dashboard_router",
    "export_router"
]
