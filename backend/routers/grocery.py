"""
Grocery list router for shopping list management.

Handles grocery list generation, retrieval, and item status updates.
"""

import asyncio
import json
import logging

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from collections import defaultdict

from database import get_db
from models.grocery import GroceryItem
from models.meal_plan import WeeklyPlan, DailyPlan, Meal
from models.profile import UserProfile
from schemas.grocery import (
    GroceryListResponse,
    GroceryItemResponse,
    ToggleGroceryItemRequest,
    RegenerateGroceryListResponse
)
from services.grocery_service import generate_grocery_list, regenerate_grocery_list, toggle_grocery_item
from services.export_service import generate_grocery_excel
from services.ai_meal_planner import AIMealPlanner

logger = logging.getLogger(__name__)


router = APIRouter(prefix="/grocery", tags=["Grocery"])


@router.get("/{plan_id}", response_model=GroceryListResponse, status_code=status.HTTP_200_OK)
def get_grocery_list(
    plan_id: int,
    db: Session = Depends(get_db)
):
    """
    Get the grocery list for a weekly meal plan.

    Returns all grocery items grouped by category (Produce, Protein, Dairy, etc.)
    with quantity aggregation and shopping progress tracking.

    Args:
        plan_id: Weekly plan ID
        db: Database session dependency

    Returns:
        GroceryListResponse: Grocery list grouped by category with progress

    Raises:
        HTTPException 404: If grocery list not found for this plan
    """
    # Get all grocery items for this plan
    grocery_items = db.query(GroceryItem).filter(
        GroceryItem.weekly_plan_id == plan_id
    ).order_by(GroceryItem.category, GroceryItem.ingredient_name).all()

    if not grocery_items:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"No grocery list found for plan {plan_id}. Generate one first."
        )

    # Group items by category
    items_by_category = defaultdict(list)
    total_items = 0
    checked_count = 0

    for item in grocery_items:
        item_response = GroceryItemResponse(
            id=item.id,
            ingredient_name=item.ingredient_name,
            quantity=item.quantity,
            unit=item.unit,
            category=item.category,
            checked=item.checked
        )

        items_by_category[item.category].append(item_response)
        total_items += 1

        if item.checked:
            checked_count += 1

    return GroceryListResponse(
        plan_id=plan_id,
        items=dict(items_by_category),
        total_items=total_items,
        checked_count=checked_count
    )


@router.post("/{plan_id}/generate", response_model=RegenerateGroceryListResponse, status_code=status.HTTP_201_CREATED)
async def generate_grocery_list_endpoint(
    plan_id: int,
    db: Session = Depends(get_db)
):
    """
    Generate or regenerate grocery list for a weekly meal plan.

    Auto-generates recipes (ingredients) for any meals that don't have them yet,
    processing one day at a time to avoid token limits. Then aggregates all
    ingredients into a categorized grocery list.

    Args:
        plan_id: Weekly plan ID
        db: Database session dependency

    Returns:
        RegenerateGroceryListResponse: Generated grocery list with metadata

    Raises:
        HTTPException 404: If weekly plan not found
    """
    try:
        # First: auto-generate recipes for meals missing ingredients
        await _ensure_all_recipes(db, plan_id)

        # Then: generate grocery list using service
        grocery_data = generate_grocery_list(db, plan_id)

        # Convert to response schema
        items_by_category = {}
        for category, items_list in grocery_data["items"].items():
            items_by_category[category] = [
                GroceryItemResponse(**item) for item in items_list
            ]

        grocery_list = GroceryListResponse(
            plan_id=grocery_data["plan_id"],
            items=items_by_category,
            total_items=grocery_data["total_items"],
            checked_count=grocery_data["checked_count"]
        )

        return RegenerateGroceryListResponse(
            message="Grocery list generated successfully",
            grocery_list=grocery_list,
            items_generated=grocery_data["total_items"]
        )

    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e)
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to generate grocery list: {str(e)}"
        )


async def _ensure_all_recipes(db: Session, plan_id: int):
    """
    Auto-generate recipes for all meals in the plan that are missing ingredients.
    Processes one day at a time, with meals within each day in parallel.
    """
    weekly_plan = db.query(WeeklyPlan).filter(WeeklyPlan.id == plan_id).first()
    if not weekly_plan:
        raise ValueError(f"Weekly plan with id {plan_id} not found")

    profile = db.query(UserProfile).filter(UserProfile.id == weekly_plan.profile_id).first()

    # Get daily plans ordered by day
    daily_plans = db.query(DailyPlan).filter(
        DailyPlan.weekly_plan_id == plan_id
    ).order_by(DailyPlan.day_of_week).all()

    ai_planner = AIMealPlanner()

    for daily_plan in daily_plans:
        # Find meals missing ingredients for this day
        meals_needing_recipes = db.query(Meal).filter(
            Meal.daily_plan_id == daily_plan.id,
            Meal.ingredients.is_(None)
        ).all()

        if not meals_needing_recipes:
            continue

        logger.info(f"Day {daily_plan.day_of_week}: generating recipes for {len(meals_needing_recipes)} meals")

        # Generate recipes for this day's meals in parallel
        async def _generate_for_meal(meal):
            meal_dict = {
                "dish_name": meal.dish_name,
                "meal_type": meal.meal_type,
                "cuisine": meal.cuisine,
                "portion_size": meal.portion_size,
                "calories": meal.calories,
                "protein": meal.protein,
                "carbs": meal.carbs,
                "fats": meal.fats,
            }
            recipe_data = await ai_planner.generate_recipe(meal_dict, profile)
            return meal.id, recipe_data

        results = await asyncio.gather(
            *[_generate_for_meal(m) for m in meals_needing_recipes],
            return_exceptions=True
        )

        # Persist results
        for result in results:
            if isinstance(result, Exception):
                logger.error(f"Recipe generation failed: {result}")
                continue
            meal_id, recipe_data = result
            meal = db.query(Meal).filter(Meal.id == meal_id).first()
            if meal:
                meal.ingredients = json.dumps(recipe_data["ingredients"])
                meal.recipe_brief = recipe_data.get("recipe_brief")

        db.commit()


@router.get("/{plan_id}/export-excel", status_code=status.HTTP_200_OK)
def export_grocery_excel(
    plan_id: int,
    db: Session = Depends(get_db)
):
    """
    Export grocery list to Excel file.

    Args:
        plan_id: Weekly plan ID
        db: Database session dependency

    Returns:
        StreamingResponse: Excel file download
    """
    try:
        excel_buffer = generate_grocery_excel(db, plan_id)
        return StreamingResponse(
            excel_buffer,
            media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            headers={
                "Content-Disposition": f"attachment; filename=grocery_list_{plan_id}.xlsx"
            }
        )
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e)
        )


@router.patch("/items/{item_id}", response_model=GroceryItemResponse, status_code=status.HTTP_200_OK)
def toggle_grocery_item_endpoint(
    item_id: int,
    toggle_request: ToggleGroceryItemRequest,
    db: Session = Depends(get_db)
):
    """
    Toggle the checked status of a grocery item.

    Marks an item as purchased (checked=true) or unpurchased (checked=false).
    Used to track shopping progress.

    Args:
        item_id: Grocery item ID
        toggle_request: New checked status
        db: Database session dependency

    Returns:
        GroceryItemResponse: Updated grocery item

    Raises:
        HTTPException 404: If grocery item not found
    """
    try:
        # Toggle item using service
        updated_item = toggle_grocery_item(db, item_id, toggle_request.checked)

        return GroceryItemResponse(
            id=updated_item.id,
            ingredient_name=updated_item.ingredient_name,
            quantity=updated_item.quantity,
            unit=updated_item.unit,
            category=updated_item.category,
            checked=updated_item.checked
        )

    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e)
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to toggle grocery item: {str(e)}"
        )
