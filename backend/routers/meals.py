"""
Meals router for individual meal operations.

Handles meal swap, custom meal replacement, copy-to, and share-with-kids.

Phase 4 (Joint Profile Orchestration) adds:
  - Joint-profile branching in swap_meal, replace_with_custom_meal, and copy_meal_to
  - MealMemberServing copy in copy_meal_to
  - No change to share_with_kids (orthogonal feature)

C4 (Architecture): The local load_member_targets helper has been removed.  Its
logic is now provided by load_joint_members + build_member_targets from
services.family_helpers (the single canonical source).  sum_member_servings and
store_member_servings are also imported from there, replacing the old cross-router
imports from routers.meal_plan.
"""

import logging
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from datetime import timedelta
import json
import re

from database import get_db
from models.user import User
from models.profile import UserProfile
from models.meal_plan import WeeklyPlan, DailyPlan, Meal
from models.meal_kid_share import MealKidShare
from models.meal_member_serving import MealMemberServing
from schemas.meal_plan import (
    SwapMealRequest, SwapMealResponse,
    CustomMealRequest, CustomMealResponse,
    CopyMealRequest, CopyMealResponse,
    MealResponse, KidShareInfo,
    MealMemberServingSchema,
    ShareWithKidsRequest, ShareWithKidsResponse,
)
from services.ai_meal_planner import AIMealPlanner
from services.nutrition_calculator import calculate_targets
from services.portion_optimizer import PortionOptimizer, MEAL_CALORIE_DISTRIBUTION
# C4: shared helpers — canonical source replaces both the old cross-router import
# (routers.meal_plan._sum_member_servings / _store_member_servings) and the local
# load_member_targets duplicate defined further below.
from services.family_helpers import (
    load_joint_members,
    build_member_targets,
    sum_member_servings,
    store_member_servings,
)
from auth import get_current_user


logger = logging.getLogger(__name__)


# =============================================================================
# Ownership helper
# =============================================================================

def _verify_meal_ownership(db: Session, meal_id: int, user: User) -> Meal:
    """Get a meal, verifying it belongs to the current user via plan -> profile chain."""
    meal = db.query(Meal).filter(Meal.id == meal_id).first()
    if not meal:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Meal with id {meal_id} not found")
    daily_plan = db.query(DailyPlan).filter(DailyPlan.id == meal.daily_plan_id).first()
    weekly_plan = db.query(WeeklyPlan).filter(WeeklyPlan.id == daily_plan.weekly_plan_id).first()
    profile = db.query(UserProfile).filter(UserProfile.id == weekly_plan.profile_id).first()
    if not profile or profile.user_id != user.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Meal with id {meal_id} not found")
    return meal


# =============================================================================
# Utility helpers
# =============================================================================

def scale_portion_string(portion_size: str, ratio: float) -> str:
    """Scale numeric quantities in a portion string by a ratio.

    e.g. "4 parathas (600g total) + 100g chutney" with ratio 0.48
       → "~1.9 parathas (~288g total) + ~48g chutney"
    """
    parts = re.split(r'\s*\+\s*', portion_size)
    scaled_parts = []
    for part in parts:
        # Scale leading number
        scaled = re.sub(
            r'^(\d+\.?\d*)',
            lambda m: f"~{round(float(m.group(1)) * ratio, 1)}",
            part,
        )
        # Scale gram values in parentheses
        scaled = re.sub(
            r'\((\d+\.?\d*)\s*g([^)]*)\)',
            lambda m: f"(~{round(float(m.group(1)) * ratio)}g{m.group(2)})",
            scaled,
        )
        scaled_parts.append(scaled)
    return ' + '.join(scaled_parts)


router = APIRouter(prefix="/meals", tags=["Meals"])


@router.post("/{meal_id}/recipe", response_model=MealResponse, status_code=status.HTTP_200_OK)
async def generate_recipe(
    meal_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Generate recipe (ingredients + recipe_brief) for a single meal on demand."""
    meal = _verify_meal_ownership(db, meal_id, current_user)

    # If recipe already exists, return immediately (cached)
    if meal.ingredients is not None:
        return MealResponse.from_orm_with_ingredients(meal)

    # Get profile for cooking constraints
    daily_plan = db.query(DailyPlan).filter(DailyPlan.id == meal.daily_plan_id).first()
    weekly_plan = db.query(WeeklyPlan).filter(WeeklyPlan.id == daily_plan.weekly_plan_id).first()
    profile = db.query(UserProfile).filter(UserProfile.id == weekly_plan.profile_id).first()

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

    ai_planner = AIMealPlanner()

    try:
        recipe_data = await ai_planner.generate_recipe(meal_dict, profile)

        meal.ingredients = json.dumps(recipe_data["ingredients"])
        meal.recipe_brief = recipe_data.get("recipe_brief")

        db.commit()
        db.refresh(meal)

        return MealResponse.from_orm_with_ingredients(meal)

    except Exception as e:
        db.rollback()
        logger.exception(f"Failed to generate recipe for meal {meal_id}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to generate recipe. Please try again."
        )


@router.post("/{meal_id}/swap", response_model=SwapMealResponse, status_code=status.HTTP_200_OK)
async def swap_meal(
    meal_id: int,
    swap_request: SwapMealRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Swap a single meal with an AI-generated alternative.

    For joint profiles, calls swap_family_meal which produces per-member servings.
    For solo profiles, the existing single-profile swap path is used unchanged.
    """
    meal = _verify_meal_ownership(db, meal_id, current_user)

    # Get daily plan and profile
    daily_plan = db.query(DailyPlan).filter(DailyPlan.id == meal.daily_plan_id).first()
    weekly_plan = db.query(WeeklyPlan).filter(WeeklyPlan.id == daily_plan.weekly_plan_id).first()
    profile = db.query(UserProfile).filter(UserProfile.id == weekly_plan.profile_id).first()

    # Get all meals for this day (to avoid duplication in the AI prompt)
    day_meals = db.query(Meal).filter(Meal.daily_plan_id == daily_plan.id).all()

    # Initialize AI meal planner
    ai_planner = AIMealPlanner()

    # -----------------------------------------------------------------------
    # JOINT PROFILE PATH
    # -----------------------------------------------------------------------
    if profile.is_joint:
        workflow       = current_user.family_meal_workflow
        if workflow not in ("hybrid", "llm_only"):
            workflow = "hybrid"
        # C4: canonical two-step pattern from services.family_helpers
        member_targets = build_member_targets(load_joint_members(db, profile))

        # Build meal dict for the AI call
        meal_dict = {
            "id":        meal.id,
            "meal_type": meal.meal_type,
            "dish_name": meal.dish_name,
            "calories":  meal.calories,
            "protein":   meal.protein,
            "carbs":     meal.carbs,
            "fats":      meal.fats,
            "fiber":     meal.fiber,
        }
        day_meals_list = [
            {
                "id":        m.id,
                "meal_type": m.meal_type,
                "dish_name": m.dish_name,
                "calories":  m.calories,
                "protein":   m.protein,
                "carbs":     m.carbs,
                "fats":      m.fats,
            }
            for m in day_meals
        ]

        try:
            new_meal_data = await ai_planner.swap_family_meal(
                meal=meal_dict,
                day_meals=day_meals_list,
                profile=profile,
                member_targets=member_targets,
                workflow=workflow,
                reason=swap_request.reason if swap_request else None,
            )
            new_meal_inner = new_meal_data["meal"]

            # If hybrid: run LP on the new meal's components to produce
            # per_member_nutrition + allocations.
            # Compute normalized fraction for this meal slot from the day's meal types.
            if workflow == "hybrid" and new_meal_inner.get("components"):
                all_day_meal_types = [m.meal_type for m in day_meals]
                num_snacks = sum(1 for mt in all_day_meal_types if mt == "snack")
                SNACK_TOTAL = 0.10
                if meal.meal_type == "snack":
                    swap_fraction = SNACK_TOTAL / num_snacks if num_snacks else 0.10
                else:
                    swap_fraction = MEAL_CALORIE_DISTRIBUTION.get(meal.meal_type, 0.30)

                optimizer = PortionOptimizer()
                result = optimizer.allocate(
                    components=new_meal_inner["components"],
                    member_targets=member_targets,
                    meal_type=meal.meal_type,
                    meal_fraction=swap_fraction,
                )
                if result.feasible:
                    new_meal_inner["allocations"]          = result.allocations
                    new_meal_inner["per_member_nutrition"] = result.per_member_nutrition
                else:
                    # LP infeasible on hybrid swap — fall back to llm_only for this meal
                    logger.warning(
                        f"[swap_meal] LP infeasible after hybrid swap of meal "
                        f"{meal.id}. Retrying as llm_only."
                    )
                    new_meal_data = await ai_planner.swap_family_meal(
                        meal=meal_dict,
                        day_meals=day_meals_list,
                        profile=profile,
                        member_targets=member_targets,
                        workflow="llm_only",
                        reason=swap_request.reason if swap_request else None,
                    )
                    new_meal_inner = new_meal_data["meal"]

            # Update Meal row with household totals
            meal_totals = sum_member_servings(new_meal_inner)
            meal.dish_name    = new_meal_inner.get("dish_name", meal.dish_name)
            meal.description  = new_meal_inner.get("description")
            meal.cuisine      = new_meal_inner.get("cuisine")
            meal.portion_size = new_meal_inner.get("portion_size")
            meal.calories     = meal_totals["calories"]
            meal.protein      = meal_totals["protein"]
            meal.carbs        = meal_totals["carbs"]
            meal.fats         = meal_totals["fats"]
            meal.fiber        = meal_totals.get("fiber")
            meal.prep_time    = new_meal_inner.get("prep_time")
            # Clear old recipe — regenerated on demand
            meal.ingredients  = None
            meal.recipe_brief = None

            # Delete old MealMemberServing rows for this meal before inserting new ones.
            # The UniqueConstraint on (meal_id, member_profile_id) requires explicit
            # deletion rather than upsert.
            db.query(MealMemberServing).filter(
                MealMemberServing.meal_id == meal.id
            ).delete()

            # Insert new MealMemberServing rows from the swapped meal data
            store_member_servings(db, meal.id, new_meal_inner, member_targets)

            # Recalculate daily plan totals from current meal set
            meals_in_day = db.query(Meal).filter(
                Meal.daily_plan_id == daily_plan.id
            ).all()
            daily_plan.total_calories = sum(m.calories for m in meals_in_day)
            daily_plan.total_protein  = sum(m.protein  for m in meals_in_day)
            daily_plan.total_carbs    = sum(m.carbs    for m in meals_in_day)
            daily_plan.total_fats     = sum(m.fats     for m in meals_in_day)

            db.commit()
            db.refresh(meal)

            # Re-query the freshly-committed MealMemberServing rows so the response
            # reflects the new per-member breakdown rather than the pre-swap state.
            fresh_servings = (
                db.query(MealMemberServing)
                .filter(MealMemberServing.meal_id == meal.id)
                .all()
            )
            servings_schemas = [
                MealMemberServingSchema.from_orm_serving(s)
                for s in fresh_servings
            ]
            new_meal_response = MealResponse.from_orm_with_ingredients(
                meal,
                member_servings=servings_schemas if servings_schemas else None,
            )
            return SwapMealResponse(
                message="Meal swapped successfully",
                new_meal=new_meal_response,
            )

        except HTTPException:
            raise
        except Exception as e:
            db.rollback()
            logger.exception(f"Failed to swap family meal {meal_id}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to swap family meal. Please try again."
            )

    # -----------------------------------------------------------------------
    # NON-JOINT PATH (unchanged from pre-Phase-4 behaviour)
    # -----------------------------------------------------------------------
    # Convert meal to dict for AI
    meal_dict = {
        "meal_type": meal.meal_type,
        "dish_name": meal.dish_name,
        "calories": meal.calories,
        "protein": meal.protein,
        "carbs": meal.carbs,
        "fats": meal.fats,
        "fiber": meal.fiber
    }

    # Convert day meals to list of dicts
    day_meals_list = [
        {
            "meal_type": m.meal_type,
            "dish_name": m.dish_name,
            "calories": m.calories,
            "protein": m.protein,
            "carbs": m.carbs,
            "fats": m.fats
        }
        for m in day_meals
    ]

    try:
        # Generate replacement meal
        new_meal_data = await ai_planner.swap_meal(
            meal=meal_dict,
            day_meals=day_meals_list,
            profile=profile,
            reason=swap_request.reason if swap_request else None
        )

        # Update existing meal record with new data
        meal.dish_name = new_meal_data["dish_name"]
        meal.description = new_meal_data.get("description")
        meal.cuisine = new_meal_data.get("cuisine")
        meal.portion_size = new_meal_data.get("portion_size")
        meal.calories = new_meal_data["calories"]
        meal.protein = new_meal_data["protein"]
        meal.carbs = new_meal_data["carbs"]
        meal.fats = new_meal_data["fats"]
        meal.fiber = new_meal_data.get("fiber")
        meal.sodium = new_meal_data.get("sodium")
        meal.sugar = new_meal_data.get("sugar")
        meal.prep_time = new_meal_data.get("prep_time")
        meal.ingredients = None  # Clear old recipe — generated on demand
        meal.recipe_brief = None

        # Update daily plan totals
        meals_in_day = db.query(Meal).filter(Meal.daily_plan_id == daily_plan.id).all()
        daily_plan.total_calories = sum(m.calories for m in meals_in_day)
        daily_plan.total_protein  = sum(m.protein  for m in meals_in_day)
        daily_plan.total_carbs    = sum(m.carbs    for m in meals_in_day)
        daily_plan.total_fats     = sum(m.fats     for m in meals_in_day)

        db.commit()
        db.refresh(meal)

        # Build response
        new_meal_response = MealResponse.from_orm_with_ingredients(meal)

        return SwapMealResponse(
            message="Meal swapped successfully",
            new_meal=new_meal_response
        )

    except Exception as e:
        db.rollback()
        logger.exception(f"Failed to swap meal {meal_id}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to swap meal. Please try again."
        )


@router.post("/{meal_id}/replace-custom", response_model=CustomMealResponse, status_code=status.HTTP_200_OK)
async def replace_with_custom_meal(
    meal_id: int,
    request: CustomMealRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Replace a meal with a user-described custom dish.

    For joint profiles, the AI prompt is augmented with per-member context so the
    model can produce member_servings. If the LLM omits member_servings, an
    equal-split fallback is applied. For solo profiles, the existing path is used.
    """
    meal = _verify_meal_ownership(db, meal_id, current_user)

    # Get daily plan and profile
    daily_plan = db.query(DailyPlan).filter(DailyPlan.id == meal.daily_plan_id).first()
    weekly_plan = db.query(WeeklyPlan).filter(WeeklyPlan.id == daily_plan.weekly_plan_id).first()
    profile = db.query(UserProfile).filter(UserProfile.id == weekly_plan.profile_id).first()

    ai_planner = AIMealPlanner()

    # -----------------------------------------------------------------------
    # JOINT PROFILE PATH
    # -----------------------------------------------------------------------
    if profile.is_joint:
        workflow       = current_user.family_meal_workflow
        if workflow not in ("hybrid", "llm_only"):
            workflow = "hybrid"
        # C4: canonical two-step pattern from services.family_helpers
        member_targets = build_member_targets(load_joint_members(db, profile))

        try:
            # Build an extended description that includes member context so the LLM
            # can produce per-member servings rather than a single aggregate entry.
            member_context = "\n".join([
                f"- {m['name']}: {m['target_calories']} kcal/day, "
                f"goals: {', '.join(m['medical_goals']) if m['medical_goals'] else 'none'}"
                for m in member_targets
            ])
            augmented_description = (
                f"{request.description}\n\n"
                f"[Family context — please provide member_servings for each member:\n"
                f"{member_context}]"
            )

            result = await ai_planner.analyze_custom_meal(
                description=augmented_description,
                meal_type=meal.meal_type,
                profile=profile,
                nutrition_targets=None,
            )
            new_meal_data = result["meal"]
            warnings      = result.get("warnings", [])

            # If the LLM returned member_servings, use them; otherwise apply equal-split
            # fallback: divide top-level totals equally among all members. This ensures
            # every joint-profile custom meal always has serving rows in the DB.
            if not new_meal_data.get("member_servings"):
                logger.warning(
                    f"[replace_with_custom_meal] LLM did not produce member_servings "
                    f"for joint profile {profile.id} — applying equal-split fallback."
                )
                n = len(member_targets)
                # Guard against division by zero (should never happen with a valid joint profile)
                if n < 1:
                    n = 1
                new_meal_data["member_servings"] = [
                    {
                        "member_name":         m["name"],
                        "adjustment":          "Standard equal portion",
                        "portion_description": "Equal share",
                        "calories": round(new_meal_data.get("calories", 0) / n, 1),
                        "protein":  round(new_meal_data.get("protein",  0) / n, 1),
                        "carbs":    round(new_meal_data.get("carbs",    0) / n, 1),
                        "fats":     round(new_meal_data.get("fats",     0) / n, 1),
                        "fiber":    round((new_meal_data.get("fiber") or 0) / n, 1),
                        "profile_id": m["profile_id"],
                    }
                    for m in member_targets
                ]

            # Update Meal row with household totals
            meal_totals = sum_member_servings(new_meal_data)
            meal.dish_name    = new_meal_data.get("dish_name", meal.dish_name)
            meal.description  = new_meal_data.get("description")
            meal.cuisine      = new_meal_data.get("cuisine")
            meal.portion_size = new_meal_data.get("portion_size")
            meal.calories     = meal_totals["calories"]
            meal.protein      = meal_totals["protein"]
            meal.carbs        = meal_totals["carbs"]
            meal.fats         = meal_totals["fats"]
            meal.fiber        = meal_totals.get("fiber")
            meal.sodium       = new_meal_data.get("sodium")
            meal.sugar        = new_meal_data.get("sugar")
            meal.prep_time    = new_meal_data.get("prep_time")
            # Clear old recipe — regenerated on demand
            meal.ingredients  = None
            meal.recipe_brief = None

            # Delete and re-insert MealMemberServing rows
            db.query(MealMemberServing).filter(
                MealMemberServing.meal_id == meal.id
            ).delete()
            store_member_servings(db, meal.id, new_meal_data, member_targets)

            # Recalculate daily plan totals
            meals_in_day = db.query(Meal).filter(
                Meal.daily_plan_id == daily_plan.id
            ).all()
            daily_plan.total_calories = sum(m.calories for m in meals_in_day)
            daily_plan.total_protein  = sum(m.protein  for m in meals_in_day)
            daily_plan.total_carbs    = sum(m.carbs    for m in meals_in_day)
            daily_plan.total_fats     = sum(m.fats     for m in meals_in_day)

            db.commit()
            db.refresh(meal)

            # Re-query freshly-committed MealMemberServing rows so the response
            # reflects the new per-member breakdown (equal-split or LLM-generated).
            fresh_servings = (
                db.query(MealMemberServing)
                .filter(MealMemberServing.meal_id == meal.id)
                .all()
            )
            servings_schemas = [
                MealMemberServingSchema.from_orm_serving(s)
                for s in fresh_servings
            ]
            return CustomMealResponse(
                message="Meal replaced with custom dish",
                new_meal=MealResponse.from_orm_with_ingredients(
                    meal,
                    member_servings=servings_schemas if servings_schemas else None,
                ),
                warnings=warnings if warnings else None,
            )

        except HTTPException:
            raise
        except Exception as e:
            db.rollback()
            logger.exception(f"Failed to replace custom meal in family plan for meal {meal_id}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to replace custom meal. Please try again."
            )

    # -----------------------------------------------------------------------
    # NON-JOINT PATH (unchanged from pre-Phase-4 behaviour)
    # -----------------------------------------------------------------------
    # Calculate nutrition targets for portion sizing guidance
    nutrition_targets = calculate_targets(profile)

    try:
        result = await ai_planner.analyze_custom_meal(
            description=request.description,
            meal_type=meal.meal_type,
            profile=profile,
            nutrition_targets=nutrition_targets
        )

        new_meal_data = result["meal"]
        warnings = result.get("warnings", [])

        # Update existing meal record with new data
        meal.dish_name = new_meal_data["dish_name"]
        meal.description = new_meal_data.get("description")
        meal.cuisine = new_meal_data.get("cuisine")
        meal.portion_size = new_meal_data.get("portion_size")
        meal.calories = new_meal_data["calories"]
        meal.protein = new_meal_data["protein"]
        meal.carbs = new_meal_data["carbs"]
        meal.fats = new_meal_data["fats"]
        meal.fiber = new_meal_data.get("fiber")
        meal.sodium = new_meal_data.get("sodium")
        meal.sugar = new_meal_data.get("sugar")
        meal.prep_time = new_meal_data.get("prep_time")
        meal.ingredients = None  # Clear old recipe — generated on demand
        meal.recipe_brief = None

        # Update daily plan totals
        meals_in_day = db.query(Meal).filter(Meal.daily_plan_id == daily_plan.id).all()
        daily_plan.total_calories = sum(m.calories for m in meals_in_day)
        daily_plan.total_protein  = sum(m.protein  for m in meals_in_day)
        daily_plan.total_carbs    = sum(m.carbs    for m in meals_in_day)
        daily_plan.total_fats     = sum(m.fats     for m in meals_in_day)

        db.commit()
        db.refresh(meal)

        new_meal_response = MealResponse.from_orm_with_ingredients(meal)

        return CustomMealResponse(
            message="Meal replaced with custom dish",
            new_meal=new_meal_response,
            warnings=warnings if warnings else None
        )

    except Exception as e:
        db.rollback()
        logger.exception(f"Failed to analyze custom meal for meal {meal_id}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to analyze custom meal. Please try again."
        )


@router.post("/{meal_id}/copy-to", response_model=CopyMealResponse, status_code=status.HTTP_200_OK)
async def copy_meal_to(
    meal_id: int,
    request: CopyMealRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Copy a meal's data to another meal slot. No AI call.

    For joint profile plans, MealMemberServing rows are copied from the source
    meal to the target meal so that per-member serving data is preserved. If the
    source belongs to a joint profile but the target does not (unusual edge case
    when copying across profiles), the serving copy is skipped.
    """
    source = _verify_meal_ownership(db, meal_id, current_user)
    target = _verify_meal_ownership(db, request.target_meal_id, current_user)

    if source.id == target.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot copy a meal onto itself"
        )

    # Copy display and nutritional fields
    target.dish_name    = source.dish_name
    target.description  = source.description
    target.cuisine      = source.cuisine
    target.portion_size = source.portion_size
    target.calories     = source.calories
    target.protein      = source.protein
    target.carbs        = source.carbs
    target.fats         = source.fats
    target.fiber        = source.fiber
    target.sodium       = source.sodium
    target.sugar        = source.sugar
    target.prep_time    = source.prep_time
    # Clear recipe — regenerated on demand
    target.ingredients  = None
    target.recipe_brief = None

    # -----------------------------------------------------------------------
    # Copy MealMemberServing rows for joint profile plans
    #
    # Determine whether the source meal belongs to a joint profile by
    # navigating the DailyPlan → WeeklyPlan → UserProfile chain.
    # -----------------------------------------------------------------------
    source_profile = (
        db.query(UserProfile)
        .join(WeeklyPlan, WeeklyPlan.profile_id == UserProfile.id)
        .join(DailyPlan, DailyPlan.weekly_plan_id == WeeklyPlan.id)
        .filter(DailyPlan.id == source.daily_plan_id)
        .first()
    )

    if source_profile and source_profile.is_joint:
        # Delete target's existing MealMemberServing rows (if any) before copying.
        # The UniqueConstraint on (meal_id, member_profile_id) prevents duplicates
        # if the target already had serving rows from a previous joint-profile generation.
        db.query(MealMemberServing).filter(
            MealMemberServing.meal_id == target.id
        ).delete()

        # Copy each source MealMemberServing row to the target meal
        source_servings = (
            db.query(MealMemberServing)
            .filter(MealMemberServing.meal_id == source.id)
            .all()
        )
        for s in source_servings:
            new_serving = MealMemberServing(
                meal_id=target.id,
                member_profile_id=s.member_profile_id,
                member_name=s.member_name,
                adjustment=s.adjustment,
                portion_description=s.portion_description,
                calories=s.calories,
                protein=s.protein,
                carbs=s.carbs,
                fats=s.fats,
                fiber=s.fiber,
            )
            db.add(new_serving)

    # Recalculate target day's daily totals
    target_daily_plan = db.query(DailyPlan).filter(DailyPlan.id == target.daily_plan_id).first()
    meals_in_day = db.query(Meal).filter(Meal.daily_plan_id == target_daily_plan.id).all()
    target_daily_plan.total_calories = sum(m.calories for m in meals_in_day)
    target_daily_plan.total_protein  = sum(m.protein  for m in meals_in_day)
    target_daily_plan.total_carbs    = sum(m.carbs    for m in meals_in_day)
    target_daily_plan.total_fats     = sum(m.fats     for m in meals_in_day)

    db.commit()
    db.refresh(target)

    # Re-query freshly-committed MealMemberServing rows on the target so the response
    # includes the copied per-member breakdown for joint profile plans. For solo plans,
    # fresh_servings will be empty and member_servings=None preserves backward compat.
    fresh_servings = (
        db.query(MealMemberServing)
        .filter(MealMemberServing.meal_id == target.id)
        .all()
    )
    servings_schemas = [
        MealMemberServingSchema.from_orm_serving(s)
        for s in fresh_servings
    ]
    return CopyMealResponse(
        message="Meal copied successfully",
        new_meal=MealResponse.from_orm_with_ingredients(
            target,
            member_servings=servings_schemas if servings_schemas else None,
        ),
    )


def _get_shares_for_meal(db: Session, meal_id: int) -> list[KidShareInfo]:
    """Return KidShareInfo list for a given meal."""
    shares = db.query(MealKidShare).filter(MealKidShare.meal_id == meal_id).all()
    result = []
    for s in shares:
        kid = db.query(UserProfile).filter(UserProfile.id == s.kid_profile_id).first()
        if kid:
            result.append(KidShareInfo(profile_id=kid.id, profile_name=kid.name, scale_ratio=s.scale_ratio))
    return result


def _recalculate_daily_totals(db: Session, daily_plan):
    """Recalculate a daily plan's nutrition totals from its meals."""
    meals = db.query(Meal).filter(Meal.daily_plan_id == daily_plan.id).all()
    daily_plan.total_calories = sum(m.calories for m in meals)
    daily_plan.total_protein  = sum(m.protein  for m in meals)
    daily_plan.total_carbs    = sum(m.carbs    for m in meals)
    daily_plan.total_fats     = sum(m.fats     for m in meals)


@router.post("/{meal_id}/share-with-kids", response_model=ShareWithKidsResponse, status_code=status.HTTP_200_OK)
def share_with_kids(
    meal_id: int,
    request: ShareWithKidsRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Share (or unshare) a meal with kid profiles.

    This endpoint is unchanged by the Phase 4 joint-profile redesign.
    MealKidShare and MealMemberServing are orthogonal features:
      - MealKidShare: adult shares a scaled version of their meal with a kid profile
      - MealMemberServing: joint profiles store per-household-member portion data

    Kid sharing is only meaningful for solo (non-joint) profiles. For joint profiles,
    all household members are already represented via MealMemberServing rows.
    """
    meal = _verify_meal_ownership(db, meal_id, current_user)

    # Navigate up to get the adult profile and week context
    daily_plan = db.query(DailyPlan).filter(DailyPlan.id == meal.daily_plan_id).first()
    weekly_plan = db.query(WeeklyPlan).filter(WeeklyPlan.id == daily_plan.weekly_plan_id).first()
    adult_profile = db.query(UserProfile).filter(UserProfile.id == weekly_plan.profile_id).first()

    # Current shares for this meal
    current_shares = db.query(MealKidShare).filter(MealKidShare.meal_id == meal_id).all()
    current_kid_ids = {s.kid_profile_id for s in current_shares}
    desired_kid_ids = set(request.kid_profile_ids)

    to_add = desired_kid_ids - current_kid_ids
    to_remove = current_kid_ids - desired_kid_ids

    # Calculate adult's target calories for ratio computation
    adult_targets = calculate_targets(adult_profile)
    adult_cal = adult_targets["target_calories"]

    try:
        # --- ADD new kids ---
        for kid_id in to_add:
            kid_profile = db.query(UserProfile).filter(UserProfile.id == kid_id).first()
            if not kid_profile:
                continue

            kid_targets = calculate_targets(kid_profile)
            kid_cal = kid_targets["target_calories"]
            scale_ratio = round(kid_cal / adult_cal, 4) if adult_cal else 1.0

            # Find kid's most-recent active weekly plan (the one they'd see in UI)
            kid_weekly = db.query(WeeklyPlan).filter(
                WeeklyPlan.profile_id == kid_id,
                WeeklyPlan.status == "active",
            ).order_by(WeeklyPlan.id.desc()).first()
            if not kid_weekly:
                kid_weekly = WeeklyPlan(
                    profile_id=kid_id,
                    week_start_date=weekly_plan.week_start_date,
                    status="active",
                )
                db.add(kid_weekly)
                db.flush()

            # Find or create kid's daily plan by calendar date (not day_of_week)
            kid_daily = db.query(DailyPlan).filter(
                DailyPlan.weekly_plan_id == kid_weekly.id,
                DailyPlan.day_date == daily_plan.day_date,
            ).first()
            if not kid_daily:
                day_offset = (daily_plan.day_date - kid_weekly.week_start_date).days
                kid_daily = DailyPlan(
                    weekly_plan_id=kid_weekly.id,
                    day_of_week=max(day_offset, 0),
                    day_date=daily_plan.day_date,
                    total_calories=0,
                    total_protein=0,
                    total_carbs=0,
                    total_fats=0,
                )
                db.add(kid_daily)
                db.flush()

            # Overwrite or create kid's meal in that slot
            kid_meal = db.query(Meal).filter(
                Meal.daily_plan_id == kid_daily.id,
                Meal.meal_type == meal.meal_type,
            ).first()

            scaled_fields = dict(
                dish_name=meal.dish_name,
                description=meal.description,
                cuisine=meal.cuisine,
                meal_type=meal.meal_type,
                portion_size=scale_portion_string(meal.portion_size, scale_ratio) if meal.portion_size else None,
                prep_time=meal.prep_time,
                calories=round(meal.calories * scale_ratio, 1),
                protein=round(meal.protein * scale_ratio, 1),
                carbs=round(meal.carbs * scale_ratio, 1),
                fats=round(meal.fats * scale_ratio, 1),
                fiber=round(meal.fiber * scale_ratio, 1) if meal.fiber else None,
                sodium=round(meal.sodium * scale_ratio, 1) if meal.sodium else None,
                sugar=round(meal.sugar * scale_ratio, 1) if meal.sugar else None,
                ingredients=None,
                recipe_brief=None,
            )

            if kid_meal:
                for k, v in scaled_fields.items():
                    setattr(kid_meal, k, v)
            else:
                kid_meal = Meal(daily_plan_id=kid_daily.id, **scaled_fields)
                db.add(kid_meal)

            _recalculate_daily_totals(db, kid_daily)

            # Create share record
            share = MealKidShare(meal_id=meal_id, kid_profile_id=kid_id, scale_ratio=scale_ratio)
            db.add(share)

        # --- REMOVE kids ---
        for kid_id in to_remove:
            # Delete the share record
            db.query(MealKidShare).filter(
                MealKidShare.meal_id == meal_id,
                MealKidShare.kid_profile_id == kid_id,
            ).delete()

            # Find kid's matching meal and delete it — search across all active plans by date
            kid_weekly = db.query(WeeklyPlan).filter(
                WeeklyPlan.profile_id == kid_id,
                WeeklyPlan.status == "active",
            ).order_by(WeeklyPlan.id.desc()).first()
            if not kid_weekly:
                continue

            kid_daily = db.query(DailyPlan).filter(
                DailyPlan.weekly_plan_id == kid_weekly.id,
                DailyPlan.day_date == daily_plan.day_date,
            ).first()
            if not kid_daily:
                continue

            kid_meal = db.query(Meal).filter(
                Meal.daily_plan_id == kid_daily.id,
                Meal.meal_type == meal.meal_type,
            ).first()
            if kid_meal:
                db.delete(kid_meal)
                _recalculate_daily_totals(db, kid_daily)

        db.commit()

        # Build response
        shares_info = _get_shares_for_meal(db, meal_id)
        meal_response = MealResponse.from_orm_with_ingredients(meal, kid_shares=shares_info)

        return ShareWithKidsResponse(
            message="Meal sharing updated",
            shares=shares_info,
            updated_meal=meal_response,
        )

    except Exception as e:
        db.rollback()
        logger.exception(f"Failed to share meal {meal_id} with kids")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to update meal sharing. Please try again."
        )
