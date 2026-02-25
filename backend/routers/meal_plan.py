"""
Meal plan router for AI-powered weekly meal planning.

Handles meal plan generation, retrieval, regeneration, and individual meal swaps.

Phase 4 (Joint Profile Orchestration) adds:
  - store_family_plan DB helper (private _sum_* and _store_* utilities now live in
    services.family_helpers and are imported under their public names)
  - _run_hybrid_workflow / _run_llm_only_workflow async orchestrators
  - _allocate_with_retry helper (C3: de-duplicated LP + supplement retry logic)
  - store_solo_plan helper (C2: de-duplicated non-joint plan persistence)
  - Joint-profile branching in generate_meal_plan, regenerate_day, regenerate_meal_plan
  - Member-serving pre-load in _build_weekly_plan_response

Architecture notes:
  C1 — SSE endpoint (generate_family_meal_plan_stream): run_generation() creates its
       own SessionLocal() session and never touches the request-scoped `db`.  This
       prevents a use-after-close bug where FastAPI might recycle the request session
       before the background coroutine finishes committing.
  C2 — store_solo_plan() centralises the WeeklyPlan/DailyPlan/Meal creation path for
       non-joint (solo) profiles that was previously copy-pasted in generate_meal_plan
       and regenerate_meal_plan.
  C3 — _allocate_with_retry() wraps the LP allocate → infeasibility check →
       supplement suggestion → re-allocate → LLM fallback flow that was duplicated
       inside _run_hybrid_workflow (per-meal loop) and regenerate_day (per-meal loop).
  C4 — load_joint_members, build_member_targets, sum_member_servings, sum_day_totals,
       and store_member_servings are imported from services.family_helpers (public names,
       no leading underscore).  The old private copies have been removed.
"""

import asyncio
import logging
import traceback
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from datetime import date, timedelta
from typing import Dict, Optional, Tuple
import json

from database import get_db, SessionLocal
from models.user import User
from models.profile import UserProfile
from models.meal_plan import WeeklyPlan, DailyPlan, Meal
from models.meal_kid_share import MealKidShare
from models.joint_profile import JointProfileMember
from models.meal_member_serving import MealMemberServing
from schemas.meal_plan import (
    WeeklyPlanResponse,
    DailyPlanSchema,
    MealResponse,
    KidShareInfo,
    MealMemberServingSchema,
    GenerateMealPlanRequest,
    SwapMealRequest,
    SwapMealResponse,
)
from services.nutrition_calculator import calculate_targets
from services.ai_meal_planner import AIMealPlanner
from services.portion_optimizer import PortionOptimizer, MEAL_CALORIE_DISTRIBUTION
from services.cuisine_filter import scan_plan_for_violations, violations_to_feedback
from prompts.cuisine_library import get_forbidden_items
from services.family_plan_validator import FamilyPlanValidator
from services.sse_progress import ProgressEmitter, STEPS_HYBRID, STEPS_LLM_ONLY
# C4: import shared helpers from the canonical module (public names, no underscores)
from services.family_helpers import (
    load_joint_members,
    build_member_targets,
    sum_member_servings,
    sum_day_totals,
    store_member_servings,
)
from auth import get_current_user, get_user_profile_or_404


logger = logging.getLogger(__name__)


# =============================================================================
# Ownership helper
# =============================================================================

def _verify_plan_ownership(db: Session, plan_id: int, user: User) -> WeeklyPlan:
    """Get a weekly plan, verifying it belongs to the current user via profile."""
    plan = db.query(WeeklyPlan).filter(WeeklyPlan.id == plan_id).first()
    if not plan:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Weekly plan with id {plan_id} not found")
    profile = db.query(UserProfile).filter(UserProfile.id == plan.profile_id).first()
    if not profile or profile.user_id != user.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Weekly plan with id {plan_id} not found")
    return plan


# =============================================================================
# C2: store_solo_plan — DB persistence helper for non-joint (solo) profiles
# =============================================================================

def store_solo_plan(
    db: Session,
    profile,               # non-joint UserProfile ORM object
    meal_plan_data: Dict,  # {"weekly_plan": [...]} from AIMealPlanner.generate_meal_plan()
    week_start,            # datetime.date object (first day of the plan week)
) -> WeeklyPlan:
    """
    Persist a solo (non-joint) meal plan to the database.

    Creates:
      - 1 WeeklyPlan row (status="active")
      - 7 DailyPlan rows (one per day)
      - N Meal rows per day (one per meal slot)

    Args:
        db:             SQLAlchemy session (caller must call db.commit() after this
                        returns).
        profile:        Solo (non-joint) UserProfile ORM object.
        meal_plan_data: Plan dict with key "weekly_plan" — a list of day dicts,
                        each with "day_of_week" (int) and "meals" (list of meal
                        dicts).  Meal dicts must have at minimum: meal_type,
                        dish_name, calories, protein, carbs, fats.
        week_start:     date of the first day of the plan.

    Returns:
        The newly created WeeklyPlan ORM object (not yet committed).

    Design notes:
      - Uses db.flush() after WeeklyPlan/DailyPlan inserts to obtain DB-assigned
        IDs before creating child rows.
      - Does NOT call db.commit() — caller owns the transaction.
      - Archives any existing active plans for this profile before inserting the
        new one (idempotent — safe to call multiple times).
    """
    # Archive any existing active plans for this profile
    db.query(WeeklyPlan).filter(
        WeeklyPlan.profile_id == profile.id,
        WeeklyPlan.status == "active",
    ).update({"status": "archived"})

    weekly_plan = WeeklyPlan(
        profile_id=profile.id,
        week_start_date=week_start,
        status="active",
    )
    db.add(weekly_plan)
    db.flush()  # Obtain weekly_plan.id before inserting DailyPlan children

    for day_data in meal_plan_data["weekly_plan"]:
        day_of_week  = day_data["day_of_week"]
        day_date     = week_start + timedelta(days=day_of_week)
        meals_in_day = day_data["meals"]

        daily_plan = DailyPlan(
            weekly_plan_id=weekly_plan.id,
            day_of_week=day_of_week,
            day_date=day_date,
            total_calories=sum(m.get("calories", 0) for m in meals_in_day),
            total_protein=sum(m.get("protein",   0) for m in meals_in_day),
            total_carbs=sum(m.get("carbs",       0) for m in meals_in_day),
            total_fats=sum(m.get("fats",         0) for m in meals_in_day),
        )
        db.add(daily_plan)
        db.flush()  # Obtain daily_plan.id before inserting Meal children

        for meal_data in meals_in_day:
            meal = Meal(
                daily_plan_id=daily_plan.id,
                meal_type=meal_data["meal_type"],
                dish_name=meal_data["dish_name"],
                description=meal_data.get("description"),
                cuisine=meal_data.get("cuisine"),
                portion_size=meal_data.get("portion_size"),
                calories=meal_data["calories"],
                protein=meal_data["protein"],
                carbs=meal_data["carbs"],
                fats=meal_data["fats"],
                fiber=meal_data.get("fiber"),
                sodium=meal_data.get("sodium"),
                sugar=meal_data.get("sugar"),
                prep_time=meal_data.get("prep_time"),
                # ingredients and recipe_brief are generated on demand
                ingredients=None,
                recipe_brief=None,
            )
            db.add(meal)

    return weekly_plan


# =============================================================================
# store_family_plan — DB persistence helper for joint/family plans
# =============================================================================

def store_family_plan(
    db: Session,
    profile,          # joint UserProfile
    raw_plan: Dict,   # {"weekly_plan": [...]} from AI planner (post-LP enrichment)
    week_start,       # datetime.date object
    member_targets: list = None,  # passed through for profile_id resolution
) -> WeeklyPlan:
    """
    Persist a family meal plan to the database.

    Creates:
      - 1 WeeklyPlan row (status="active")
      - 7 DailyPlan rows (one per day)
      - N Meal rows per day (one per meal slot)
      - M MealMemberServing rows per meal (one per family member)

    Meal-level nutritional fields (calories, protein, carbs, fats) are set to the
    SUM of all member servings for that meal, reflecting the true household total.
    This preserves compatibility with the existing DailyPlan totals and the
    non-joint code path.

    Args:
        db:             SQLAlchemy session (caller must call db.commit() after this returns).
        profile:        Joint UserProfile ORM object.
        raw_plan:       The fully-enriched plan dict. Each meal must have either:
                          - "per_member_nutrition" + "allocations" (hybrid)
                          - "member_servings" (llm_only)
                        If a meal has "per_member_nutrition" AND "member_servings",
                        "member_servings" takes precedence for text descriptions.
        week_start:     date of the first day of the plan (week_start_date).
        member_targets: Per-member target dicts for profile_id resolution. If None,
                        profile_id resolution relies solely on data embedded in raw_plan.

    Returns:
        The newly created WeeklyPlan ORM object (not yet committed).

    Design notes:
      - Uses db.flush() after each WeeklyPlan/DailyPlan insert to obtain DB-assigned IDs
        before creating child rows.
      - Does NOT call db.commit() — caller is responsible for the transaction.
      - Archives any existing active plans before creating the new one.
    """
    # Archive any existing active plans for this profile
    db.query(WeeklyPlan).filter(
        WeeklyPlan.profile_id == profile.id,
        WeeklyPlan.status == "active"
    ).update({"status": "archived"})

    weekly_plan = WeeklyPlan(
        profile_id=profile.id,
        week_start_date=week_start,
        status="active",
    )
    db.add(weekly_plan)
    db.flush()  # Obtain weekly_plan.id before inserting children

    for day_data in raw_plan["weekly_plan"]:
        day_of_week = day_data["day_of_week"]
        day_date    = week_start + timedelta(days=day_of_week)

        # Compute household-level daily totals from member serving sums
        day_totals = sum_day_totals(day_data["meals"])

        daily_plan = DailyPlan(
            weekly_plan_id=weekly_plan.id,
            day_of_week=day_of_week,
            day_date=day_date,
            total_calories=day_totals["calories"],
            total_protein=day_totals["protein"],
            total_carbs=day_totals["carbs"],
            total_fats=day_totals["fats"],
        )
        db.add(daily_plan)
        db.flush()  # Obtain daily_plan.id before inserting meals

        for meal_data in day_data["meals"]:
            # Compute meal-level totals as sum of member servings
            meal_totals = sum_member_servings(meal_data)

            # Determine allocation method: explicit tag from _allocate_with_retry,
            # or infer from data shape (per_member_nutrition → lp, else → llm)
            alloc_method = meal_data.get("allocation_method")
            if not alloc_method:
                alloc_method = "lp" if meal_data.get("per_member_nutrition") else "llm"

            # Serialize supplement names (if any) as JSON for the DB column
            _supp_names = meal_data.get("supplement_names")
            _supp_json = json.dumps(_supp_names) if _supp_names else None

            meal_row = Meal(
                daily_plan_id=daily_plan.id,
                meal_type=meal_data["meal_type"],
                dish_name=meal_data["dish_name"],
                description=meal_data.get("description"),
                cuisine=meal_data.get("cuisine"),
                portion_size=meal_data.get("portion_size"),
                calories=meal_totals["calories"],
                protein=meal_totals["protein"],
                carbs=meal_totals["carbs"],
                fats=meal_totals["fats"],
                fiber=meal_totals.get("fiber"),
                prep_time=meal_data.get("prep_time"),
                allocation_method=alloc_method,
                supplement_names=_supp_json,
                # ingredients and recipe_brief are generated on demand
                ingredients=None,
                recipe_brief=None,
            )
            db.add(meal_row)
            db.flush()  # Obtain meal_row.id before inserting member servings

            # Store per-member servings — passes member_targets for profile_id resolution
            store_member_servings(db, meal_row.id, meal_data, member_targets)

    return weekly_plan


# =============================================================================
# C3: _allocate_with_retry — LP allocation with supplement retry + LLM fallback
# =============================================================================

async def _allocate_with_retry(
    optimizer: PortionOptimizer,
    ai_planner: AIMealPlanner,
    meal: Dict,
    components: list,
    member_targets: list,
    profile,
    day_meals: list,
    meal_fraction: float = None,
    used_supplements: list[str] | None = None,
) -> Tuple[Optional[object], Optional[list]]:
    """
    Allocate portions with supplement retry, falling back to LLM-only if LP exhausted.

    This helper de-duplicates the allocate → check feasibility → suggest supplements →
    re-allocate → fallback-to-LLM-only pattern that previously existed verbatim in
    both _run_hybrid_workflow (inner day/meal loop) and regenerate_day (inner meal loop).

    Algorithm:
      1. Run LP.allocate() on the provided components.
      2. If feasible, return (result, components) immediately.
      3. If infeasible, attempt up to 2 supplement rounds:
           a. Ask the AI planner to suggest supplement components.
           b. Extend the components list and re-run LP.
           c. Return early if now feasible.
      4. If still infeasible after 2 rounds, call swap_family_meal(workflow="llm_only")
         to regenerate the meal entirely:
           - Mutates meal["member_servings"] in-place with the LLM-only servings.
           - Removes meal["components"] so store_member_servings routes through the
             member_servings path rather than the LP/allocation path.
           - Returns (None, None) to signal that the caller should skip attaching
             LP results (the meal is already populated via the fallback path).

    Args:
        optimizer:      PortionOptimizer instance (reused across calls for efficiency).
        ai_planner:     AIMealPlanner instance.
        meal:           Meal dict (mutated in-place on LLM fallback).
        components:     List of component dicts for this meal (may be extended by
                        supplement rounds).
        member_targets: Per-member target dicts.
        profile:        Joint UserProfile ORM object (for AI calls).
        day_meals:      All meal dicts for the same day (context for the AI fallback call).
        meal_fraction:  Pre-computed normalized fraction of daily calories for this meal.
                        When None, the optimizer falls back to raw MEAL_CALORIE_DISTRIBUTION.

    Returns:
        (result, components) on success:
            result      — LP AllocationResult object (feasible=True)
            components  — Possibly-extended list of component dicts after supplement rounds
        (None, None) on LLM-only fallback:
            Signals the caller to skip LP result attachment; meal dict already updated.
    """
    result = optimizer.allocate(
        components=components,
        member_targets=member_targets,
        meal_type=meal.get("meal_type", "lunch"),
        meal_fraction=meal_fraction,
    )

    if result.feasible:
        meal["allocation_method"] = "lp"
        return result, components

    logger.warning(
        f"[_allocate_with_retry] LP infeasible for '{meal.get('dish_name', '?')}', "
        f"attempting supplement rounds. Gap: {result.gap}"
    )

    # Supplement retry loop — max 2 rounds
    if used_supplements is None:
        used_supplements = []
    added_supplement_names: list[str] = []
    for attempt in range(2):
        supplements = await ai_planner.suggest_supplements(
            components=components,
            gap=result.gap,
            profile=profile,
            already_used_supplements=used_supplements,
            meal_type=meal.get("meal_type"),
        )
        # Filter out supplements whose names contain forbidden cuisine items
        cuisines = profile.cuisines_list if hasattr(profile, "cuisines_list") else []
        forbidden = get_forbidden_items(cuisines) if cuisines else set()
        if forbidden:
            clean_supplements = []
            for s in supplements:
                name_lower = (s.get("name") or "").lower()
                if any(term in name_lower for term in forbidden):
                    logger.warning(
                        f"[_allocate_with_retry] Discarding forbidden supplement "
                        f"'{s.get('name')}' (matched cuisine filter)"
                    )
                    used_supplements.append(s["name"])
                else:
                    clean_supplements.append(s)
            supplements = clean_supplements
        for s in supplements:
            if s.get("name"):
                added_supplement_names.append(s["name"])
                used_supplements.append(s["name"])
            s["is_supplement"] = True
        components.extend(supplements)
        result = optimizer.allocate(
            components=components,
            member_targets=member_targets,
            meal_type=meal.get("meal_type", "lunch"),
            meal_fraction=meal_fraction,
        )
        if result.feasible:
            meal["allocation_method"] = "lp"
            # Update dish_name to include supplement side dishes
            if added_supplement_names:
                original_name = meal.get("dish_name", "")
                meal["dish_name"] = original_name + " + " + " + ".join(added_supplement_names)
                meal["supplement_names"] = added_supplement_names
            logger.info(
                f"[_allocate_with_retry] LP feasible after supplement round {attempt + 1} "
                f"for '{meal.get('dish_name', '?')}'"
            )
            return result, components

    # All supplement rounds exhausted — fall back to LLM-only for this meal
    logger.error(
        f"[_allocate_with_retry] LP still infeasible after 2 supplement rounds for "
        f"'{meal.get('dish_name', '?')}'. Falling back to LLM-only direct generation."
    )
    fallback = await ai_planner.swap_family_meal(
        meal=meal,
        day_meals=day_meals,
        profile=profile,
        member_targets=member_targets,
        workflow="llm_only",
        reason="Nutritional optimisation could not converge — regenerating",
    )
    # Replace meal in-place with the fallback's full meal data.
    # Copy ALL meal-level fields (dish_name, description, cuisine, etc.) so the
    # stored meal reflects the LLM's replacement, not the original dish that the
    # LP couldn't solve. Without this, we'd keep "Paneer Sandwich" as dish_name
    # but show Dal Makhani portion descriptions — a mismatch.
    fallback_meal = fallback["meal"]
    for key in ("dish_name", "description", "cuisine", "portion_size", "prep_time"):
        if key in fallback_meal:
            meal[key] = fallback_meal[key]
    fallback_servings = fallback_meal["member_servings"]

    # Post-hoc calorie scaling: the LLM-only fallback doesn't respect LP calorie
    # bounds, so scale each member's servings to fit within the per-meal target
    # ±CAL_TOLERANCE. This prevents fallback meals from blowing up daily totals.
    from services.portion_optimizer import CAL_TOLERANCE
    frac = meal_fraction if meal_fraction else MEAL_CALORIE_DISTRIBUTION.get(
        meal.get("meal_type", "lunch"), 0.30
    )
    target_by_name = {m["name"]: m for m in member_targets}
    for serving in fallback_servings:
        m_name = serving.get("member_name", "")
        m_target = target_by_name.get(m_name)
        if not m_target:
            continue
        meal_target_cal = m_target["target_calories"] * frac
        cal_ceiling = meal_target_cal * (1 + CAL_TOLERANCE)
        actual_cal = serving.get("calories", 0)
        if actual_cal > cal_ceiling and actual_cal > 0:
            scale = cal_ceiling / actual_cal
            for macro in ("calories", "protein", "carbs", "fats", "fiber"):
                if serving.get(macro):
                    serving[macro] = round(serving[macro] * scale, 1)
            logger.info(
                f"[_allocate_with_retry] Scaled LLM fallback for '{m_name}' "
                f"from {actual_cal:.0f} to {serving['calories']:.0f} cal "
                f"(meal target {meal_target_cal:.0f}, ceiling {cal_ceiling:.0f})"
            )

    meal["member_servings"] = fallback_servings
    meal["allocation_method"] = "llm"
    # Remove components so store_member_servings uses the member_servings path
    meal.pop("components", None)
    # Return (None, None) to signal LLM-only fallback was used
    return None, None


# =============================================================================
# Workflow orchestrators
# =============================================================================

async def _run_hybrid_workflow(
    ai_planner: AIMealPlanner,
    profile,
    member_targets: list,
    emitter: Optional[ProgressEmitter] = None,
) -> Dict:
    """
    Execute the hybrid family plan generation workflow.

    Step 1: LLM generates 7-day component plan.
    Step 2-3: LP allocates portions per meal (with supplement retry on infeasibility).
    Step 4: LLM describes adjustments (batched per day).
    Step 5: Validator logs warnings (never blocks for hybrid).

    Args:
        ai_planner:     AIMealPlanner instance.
        profile:        Joint UserProfile ORM object.
        member_targets: Per-member target dicts.
        emitter:        Optional ProgressEmitter for SSE progress streaming.
                        When provided, emits progress events at each major step.
                        When None (synchronous call path), all emit calls are skipped.

    Returns:
        Enriched raw_plan dict. Every meal has either:
          "per_member_nutrition" + "allocations" + "member_adjustment_text" (LP succeeded)
          "member_servings" (LP failed after supplement retry → direct fallback)
    """
    logger.info(f"[Hybrid] Starting hybrid workflow for joint profile {profile.id}")

    # -----------------------------------------------------------------------
    # Step 1: LLM generates component plan
    # -----------------------------------------------------------------------
    if emitter:
        await emitter.emit(
            "generating_components",
            "AI is generating base meals for all 7 days...",
        )
    raw_plan  = await ai_planner.generate_family_components(profile, member_targets)

    # Content filter: scan for cuisine-specific forbidden items
    cuisines = profile.cuisines_list if hasattr(profile, "cuisines_list") else []
    if cuisines:
        content_violations = scan_plan_for_violations(raw_plan, cuisines)
        if content_violations:
            feedback = violations_to_feedback(content_violations)
            logger.warning(
                f"[Hybrid] Content filter found {len(content_violations)} violation(s), "
                f"regenerating with feedback: {feedback}"
            )
            raw_plan = await ai_planner.generate_family_components(
                profile, member_targets, content_feedback=feedback,
            )
            # Re-check after retry (log only, don't retry again)
            retry_violations = scan_plan_for_violations(raw_plan, cuisines)
            if retry_violations:
                logger.error(
                    f"[Hybrid] Content filter still found {len(retry_violations)} "
                    f"violation(s) after retry: {violations_to_feedback(retry_violations)}"
                )

    optimizer = PortionOptimizer()

    # -----------------------------------------------------------------------
    # Steps 2-3: LP allocation per meal, with supplement retry
    # C3: delegates to _allocate_with_retry — no more inline retry logic here
    # Normalize meal fractions per day so they always sum to 1.0, preventing
    # systematic calorie overshoot when there are multiple snacks.
    # -----------------------------------------------------------------------
    for day in raw_plan["weekly_plan"]:
        # Compute normalized fractions for this day's meal types.
        # Snacks share a fixed 10% budget; main meals keep raw fractions.
        # E.g. breakfast(25%) + lunch(35%) + dinner(30%) + 2 snacks(5% each) = 100%
        day_meal_types = [m["meal_type"] for m in day["meals"]]
        num_snacks = sum(1 for mt in day_meal_types if mt == "snack")
        SNACK_TOTAL = 0.10
        normalized_fractions = {}
        for i, mt in enumerate(day_meal_types):
            if mt == "snack":
                normalized_fractions[i] = SNACK_TOTAL / num_snacks if num_snacks else 0.10
            else:
                normalized_fractions[i] = MEAL_CALORIE_DISTRIBUTION.get(mt, 0.30)

        day_used_supplements: list[str] = []  # shared across meals in this day
        for i, meal in enumerate(day["meals"]):
            result, components = await _allocate_with_retry(
                optimizer=optimizer,
                ai_planner=ai_planner,
                meal=meal,
                components=meal["components"],
                member_targets=member_targets,
                profile=profile,
                day_meals=day["meals"],
                meal_fraction=normalized_fractions[i],
                used_supplements=day_used_supplements,
            )
            if result is not None:
                # LP succeeded (possibly after supplement rounds) — attach results
                meal["allocations"]          = result.allocations
                meal["per_member_nutrition"] = result.per_member_nutrition
            # else: LLM fallback path — meal dict already mutated by _allocate_with_retry

    # -----------------------------------------------------------------------
    # Step 4: LLM describes adjustments (batched per day — one call per day)
    # -----------------------------------------------------------------------
    if emitter:
        await emitter.emit(
            "optimizing_portions",
            "LP solver is computing optimal portions per household member...",
        )
    if emitter:
        await emitter.emit(
            "generating_descriptions",
            "Converting portion allocations to serving descriptions...",
        )
    for day in raw_plan["weekly_plan"]:
        meals_with_allocations = [
            m for m in day["meals"] if "allocations" in m
        ]
        if meals_with_allocations:
            try:
                adjustments = await ai_planner.describe_adjustments(
                    meals_with_allocations=meals_with_allocations,
                    member_targets=member_targets,
                )
                # Merge adjustment text into each meal
                for meal in meals_with_allocations:
                    meal_key = (
                        f"{meal['meal_type']}_{meal['dish_name']}"
                        .replace(" ", "_")
                        .lower()
                    )
                    meal["member_adjustment_text"] = adjustments.get(meal_key, {})
            except Exception as e:
                # Adjustment descriptions are cosmetic — log and continue
                logger.warning(
                    f"[Hybrid] describe_adjustments failed for day "
                    f"{day['day_of_week']}: {e}. Continuing without descriptions."
                )

    # -----------------------------------------------------------------------
    # Step 5: Validator (hybrid — warns only, never fails)
    # -----------------------------------------------------------------------
    if emitter:
        await emitter.emit(
            "validating",
            "Validating daily nutrition totals for each member...",
        )
    validator = FamilyPlanValidator()
    passed, warnings = validator.validate(
        daily_plans=raw_plan["weekly_plan"],
        member_targets=member_targets,
        workflow="hybrid",
    )
    if warnings:
        logger.warning(
            f"[Hybrid] Validator produced {len(warnings)} warning(s) for joint "
            f"profile {profile.id}:\n" + "\n".join(warnings)
        )
    # passed is always True for hybrid — we continue regardless

    # Emit "saving" before returning so the SSE endpoint can save and then
    # call emitter.complete(). The caller is responsible for the DB commit.
    if emitter:
        await emitter.emit("saving", "Saving your meal plan...")

    logger.info(f"[Hybrid] Workflow complete for joint profile {profile.id}")
    return raw_plan


async def _run_llm_only_workflow(
    ai_planner: AIMealPlanner,
    profile,
    member_targets: list,
    emitter: Optional[ProgressEmitter] = None,
) -> Dict:
    """
    Execute the LLM-only family plan generation workflow.

    Step 1: LLM generates 7-day plan with member_servings.
    Step 2: Validator checks per-member daily totals.
    Step 3: If validator fails, retry up to 2 times with feedback.

    Args:
        ai_planner:     AIMealPlanner instance.
        profile:        Joint UserProfile ORM object.
        member_targets: Per-member target dicts.
        emitter:        Optional ProgressEmitter for SSE progress streaming.
                        When provided, emits progress events at each major step.
                        When None (synchronous call path), all emit calls are skipped.

    Returns:
        raw_plan dict where every meal has a "member_servings" array.
    """
    logger.info(f"[LLM-Only] Starting llm_only workflow for joint profile {profile.id}")
    validator = FamilyPlanValidator()

    # Emit generating_meals before the LLM call
    if emitter:
        await emitter.emit(
            "generating_meals",
            "AI is generating meals with per-member portions for all 7 days...",
        )

    # Initial generation attempt
    raw_plan = await ai_planner.generate_family_meal_plan_direct(profile, member_targets)

    # Emit validating before running the validator
    if emitter:
        await emitter.emit(
            "validating",
            "Validating nutrition targets for each member...",
        )

    passed, warnings = validator.validate(
        daily_plans=raw_plan["weekly_plan"],
        member_targets=member_targets,
        workflow="llm_only",
    )

    # Content filter: merge cuisine violations into warnings
    cuisines = profile.cuisines_list if hasattr(profile, "cuisines_list") else []
    if cuisines:
        content_violations = scan_plan_for_violations(raw_plan, cuisines)
        if content_violations:
            content_feedback = violations_to_feedback(content_violations)
            logger.warning(
                f"[LLM-Only] Content filter found {len(content_violations)} violation(s): "
                + "; ".join(content_feedback)
            )
            warnings.extend(content_feedback)
            passed = False

    if passed:
        logger.info(f"[LLM-Only] Plan passed validation on first attempt")
        if emitter:
            await emitter.emit("saving", "Saving your meal plan...")
        return raw_plan

    # Retry loop (max 2 retries after initial failure)
    for retry in range(2):
        logger.warning(
            f"[LLM-Only] Validation failed (retry {retry + 1}/2). "
            f"Warnings:\n" + "\n".join(warnings)
        )
        raw_plan = await ai_planner.generate_family_meal_plan_direct(
            profile,
            member_targets,
            feedback=warnings,    # include validator warnings in the prompt
        )
        passed, warnings = validator.validate(
            daily_plans=raw_plan["weekly_plan"],
            member_targets=member_targets,
            workflow="llm_only",
        )
        if passed:
            logger.info(f"[LLM-Only] Plan passed validation on retry {retry + 1}")
            if emitter:
                await emitter.emit("saving", "Saving your meal plan...")
            return raw_plan

    # All retries exhausted — use the last generated plan regardless
    # (better to return a slightly imperfect plan than fail the whole request)
    logger.error(
        f"[LLM-Only] Plan failed validation after all retries for joint profile "
        f"{profile.id}. Using last generated plan. Residual warnings:\n"
        + "\n".join(warnings)
    )
    if emitter:
        await emitter.emit("saving", "Saving your meal plan...")
    return raw_plan


# =============================================================================
# Router
# =============================================================================

router = APIRouter(prefix="/meal-plans", tags=["Meal Plans"])


@router.post("/generate", response_model=WeeklyPlanResponse, status_code=status.HTTP_201_CREATED)
async def generate_meal_plan(
    profile_id: int,
    request: GenerateMealPlanRequest = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Generate a new 7-day meal plan using AI for a specific profile.

    For non-joint profiles, the existing single-profile generation path is used
    unchanged. For joint profiles, branches to the family workflow orchestrator
    (hybrid or llm_only) as configured by current_user.family_meal_workflow.
    """
    profile = get_user_profile_or_404(db, profile_id, current_user)

    # -----------------------------------------------------------------------
    # NON-JOINT PATH
    # C2: persistence delegated to store_solo_plan()
    # -----------------------------------------------------------------------
    if not profile.is_joint:
        nutrition_targets = calculate_targets(profile)
        ai_planner = AIMealPlanner()

        try:
            meal_plan_data = await ai_planner.generate_meal_plan(profile, nutrition_targets)

            # Content filter: scan for cuisine-specific forbidden items
            solo_cuisines = profile.cuisines_list if hasattr(profile, "cuisines_list") else []
            if solo_cuisines:
                solo_violations = scan_plan_for_violations(meal_plan_data, solo_cuisines)
                if solo_violations:
                    feedback = violations_to_feedback(solo_violations)
                    logger.warning(
                        f"[Solo] Content filter found {len(solo_violations)} violation(s), "
                        f"regenerating with feedback: {feedback}"
                    )
                    meal_plan_data = await ai_planner.generate_meal_plan(
                        profile, nutrition_targets, content_feedback=feedback,
                    )

            # Week starts tomorrow
            week_start  = date.today() + timedelta(days=1)
            # C2: store_solo_plan archives old plans and creates the full plan tree
            weekly_plan = store_solo_plan(db, profile, meal_plan_data, week_start)
            db.commit()
            db.refresh(weekly_plan)
            return _build_weekly_plan_response(db, weekly_plan)

        except Exception as e:
            db.rollback()
            logger.exception("Failed to generate solo meal plan for profile %s", profile_id)
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to generate meal plan. Please try again."
            )

    # -----------------------------------------------------------------------
    # JOINT PROFILE PATH
    # -----------------------------------------------------------------------
    member_profiles = load_joint_members(db, profile)
    member_targets  = build_member_targets(member_profiles)
    # Treat any value other than "llm_only" as "hybrid" for safety
    workflow = current_user.family_meal_workflow
    if workflow not in ("hybrid", "llm_only"):
        workflow = "hybrid"
    ai_planner = AIMealPlanner()
    today      = date.today()
    week_start = today + timedelta(days=1)

    try:
        if workflow == "hybrid":
            raw_plan = await _run_hybrid_workflow(ai_planner, profile, member_targets)
        else:
            raw_plan = await _run_llm_only_workflow(ai_planner, profile, member_targets)

        weekly_plan = store_family_plan(db, profile, raw_plan, week_start, member_targets)
        db.commit()
        db.refresh(weekly_plan)
        return _build_weekly_plan_response(db, weekly_plan)

    except Exception as e:
        db.rollback()
        logger.exception("Failed to generate family meal plan for profile %s", profile_id)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to generate family meal plan. Please try again."
        )


@router.get("/current", response_model=WeeklyPlanResponse, status_code=status.HTTP_200_OK)
def get_current_meal_plan(profile_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Get the current active weekly meal plan for a specific profile."""
    get_user_profile_or_404(db, profile_id, current_user)
    weekly_plan = db.query(WeeklyPlan).filter(
        WeeklyPlan.profile_id == profile_id,
        WeeklyPlan.status == "active"
    ).order_by(WeeklyPlan.id.desc()).first()

    if not weekly_plan:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No active meal plan found. Please generate a meal plan first."
        )

    return _build_weekly_plan_response(db, weekly_plan)


@router.post("/{plan_id}/regenerate-day/{day_index}", response_model=DailyPlanSchema, status_code=status.HTTP_200_OK)
async def regenerate_day(
    plan_id: int,
    day_index: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Regenerate meals for a single day in the weekly plan.

    For joint profiles, calls generate_family_single_day and runs the LP solver
    (hybrid) or uses member_servings directly (llm_only). For solo profiles,
    the existing single-profile path is used unchanged.

    Args:
        plan_id:   Weekly plan ID
        day_index: Day of week to regenerate (0=Monday, 6=Sunday)
        db:        Database session dependency

    Returns:
        DailyPlanSchema: Regenerated daily plan

    Raises:
        HTTPException 404: If plan or day not found
        HTTPException 400: If day_index is invalid
        HTTPException 500: If AI generation fails
    """
    if day_index < 0 or day_index > 6:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="day_index must be between 0 (Monday) and 6 (Sunday)"
        )

    # Get weekly plan (verifies ownership)
    weekly_plan = _verify_plan_ownership(db, plan_id, current_user)

    # Get daily plan for this day
    daily_plan = db.query(DailyPlan).filter(
        DailyPlan.weekly_plan_id == plan_id,
        DailyPlan.day_of_week == day_index
    ).first()

    if not daily_plan:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Day {day_index} not found in plan {plan_id}"
        )

    # Get profile
    profile = db.query(UserProfile).filter(UserProfile.id == weekly_plan.profile_id).first()

    # Initialize AI planner
    ai_planner = AIMealPlanner()

    try:
        # -----------------------------------------------------------------------
        # JOINT PROFILE PATH
        # -----------------------------------------------------------------------
        if profile.is_joint:
            member_profiles = load_joint_members(db, profile)
            member_targets  = build_member_targets(member_profiles)
            workflow = current_user.family_meal_workflow
            if workflow not in ("hybrid", "llm_only"):
                workflow = "hybrid"

            # Collect existing dish names from other days to avoid duplicates
            existing_dishes = [
                m.dish_name for m in
                db.query(Meal).join(DailyPlan).filter(
                    DailyPlan.weekly_plan_id == plan_id,
                    DailyPlan.day_of_week != day_index
                ).all()
            ]

            meals_in_day = await ai_planner.generate_family_single_day(
                profile=profile,
                member_targets=member_targets,
                workflow=workflow,
                day_of_week=day_index,
                existing_dishes=existing_dishes,
            )

            # Delete existing meals AND their member servings for this day
            old_meals = db.query(Meal).filter(Meal.daily_plan_id == daily_plan.id).all()
            for old_meal in old_meals:
                db.query(MealMemberServing).filter(
                    MealMemberServing.meal_id == old_meal.id
                ).delete()
            db.query(Meal).filter(Meal.daily_plan_id == daily_plan.id).delete()

            # If hybrid, run LP on the fresh meals
            # C3: each meal's LP + supplement retry now delegated to _allocate_with_retry
            # Normalize meal fractions so they sum to 1.0 for this day
            if workflow == "hybrid":
                optimizer = PortionOptimizer()
                day_meal_types = [m["meal_type"] for m in meals_in_day]
                num_snacks = sum(1 for mt in day_meal_types if mt == "snack")
                SNACK_TOTAL = 0.10
                normalized_fractions = {}
                for i, mt in enumerate(day_meal_types):
                    if mt == "snack":
                        normalized_fractions[i] = SNACK_TOTAL / num_snacks if num_snacks else 0.10
                    else:
                        normalized_fractions[i] = MEAL_CALORIE_DISTRIBUTION.get(mt, 0.30)

                day_used_supplements: list[str] = []
                for i, meal_data in enumerate(meals_in_day):
                    if meal_data.get("components"):
                        result, _ = await _allocate_with_retry(
                            optimizer=optimizer,
                            ai_planner=ai_planner,
                            meal=meal_data,
                            components=meal_data["components"],
                            member_targets=member_targets,
                            profile=profile,
                            day_meals=meals_in_day,
                            meal_fraction=normalized_fractions[i],
                            used_supplements=day_used_supplements,
                        )
                        if result is not None:
                            # LP succeeded — attach results
                            meal_data["allocations"]          = result.allocations
                            meal_data["per_member_nutrition"] = result.per_member_nutrition
                        # else: LLM fallback path — meal_data already mutated

                # Describe adjustments for the newly generated day
                meals_with_alloc = [m for m in meals_in_day if "allocations" in m]
                if meals_with_alloc:
                    try:
                        adjustments = await ai_planner.describe_adjustments(
                            meals_with_allocations=meals_with_alloc,
                            member_targets=member_targets,
                        )
                        for meal_data in meals_with_alloc:
                            meal_key = (
                                f"{meal_data['meal_type']}_{meal_data['dish_name']}"
                                .replace(" ", "_").lower()
                            )
                            meal_data["member_adjustment_text"] = adjustments.get(meal_key, {})
                    except Exception as e:
                        logger.warning(f"[regenerate_day] describe_adjustments failed: {e}")

            # Persist the new meals
            for meal_data in meals_in_day:
                meal_totals = sum_member_servings(meal_data)
                alloc_method = meal_data.get("allocation_method")
                if not alloc_method:
                    alloc_method = "lp" if meal_data.get("per_member_nutrition") else "llm"
                _sn = meal_data.get("supplement_names")
                _sn_json = json.dumps(_sn) if _sn else None
                meal_row = Meal(
                    daily_plan_id=daily_plan.id,
                    meal_type=meal_data["meal_type"],
                    dish_name=meal_data["dish_name"],
                    description=meal_data.get("description"),
                    cuisine=meal_data.get("cuisine"),
                    portion_size=meal_data.get("portion_size"),
                    calories=meal_totals["calories"],
                    protein=meal_totals["protein"],
                    carbs=meal_totals["carbs"],
                    fats=meal_totals["fats"],
                    fiber=meal_totals.get("fiber"),
                    prep_time=meal_data.get("prep_time"),
                    allocation_method=alloc_method,
                    supplement_names=_sn_json,
                    ingredients=None,
                    recipe_brief=None,
                )
                db.add(meal_row)
                db.flush()
                store_member_servings(db, meal_row.id, meal_data, member_targets)

            # Recalculate daily plan totals from household sums
            day_totals = sum_day_totals(meals_in_day)
            daily_plan.total_calories = day_totals["calories"]
            daily_plan.total_protein  = day_totals["protein"]
            daily_plan.total_carbs    = day_totals["carbs"]
            daily_plan.total_fats     = day_totals["fats"]

            db.commit()
            db.refresh(daily_plan)

            # Build response — load the freshly-persisted meals and their member servings
            meals = db.query(Meal).filter(Meal.daily_plan_id == daily_plan.id).all()
            all_meal_ids = [m.id for m in meals]
            # Pre-load member servings for efficiency
            servings_rows = (
                db.query(MealMemberServing)
                .filter(MealMemberServing.meal_id.in_(all_meal_ids))
                .all()
                if all_meal_ids else []
            )
            servings_map: dict = {}
            for s in servings_rows:
                schema = MealMemberServingSchema(
                    member_name=s.member_name,
                    member_profile_id=s.member_profile_id,
                    adjustment=s.adjustment,
                    portion_description=s.portion_description,
                    calories=s.calories,
                    protein=s.protein,
                    carbs=s.carbs,
                    fats=s.fats,
                    fiber=s.fiber or 0,
                )
                servings_map.setdefault(s.meal_id, []).append(schema)

            meals_data = [
                MealResponse.from_orm_with_ingredients(
                    meal,
                    member_servings=servings_map.get(meal.id),
                )
                for meal in meals
            ]

            return DailyPlanSchema(
                id=daily_plan.id,
                day_of_week=daily_plan.day_of_week,
                day_date=daily_plan.day_date,
                meals=meals_data,
                total_calories=daily_plan.total_calories,
                total_protein=daily_plan.total_protein,
                total_carbs=daily_plan.total_carbs,
                total_fats=daily_plan.total_fats,
                total_fiber=daily_plan.total_fiber or 0,
                total_sodium=daily_plan.total_sodium or 0,
                total_sugar=daily_plan.total_sugar or 0,
            )

        # -----------------------------------------------------------------------
        # NON-JOINT PATH (unchanged from pre-Phase-4 behaviour)
        # -----------------------------------------------------------------------
        nutrition_targets = calculate_targets(profile)

        # Collect existing dish names from other days to avoid duplicates
        all_meals = db.query(Meal).join(DailyPlan).filter(
            DailyPlan.weekly_plan_id == plan_id,
            DailyPlan.day_of_week != day_index
        ).all()
        existing_dishes = [m.dish_name for m in all_meals]

        # Generate meals for just this one day (fast — single day, not full week)
        meals_in_day = await ai_planner.generate_single_day(
            profile, nutrition_targets, existing_dishes=existing_dishes
        )

        # Delete existing meals for this day
        db.query(Meal).filter(Meal.daily_plan_id == daily_plan.id).delete()

        # Update daily plan totals
        daily_plan.total_calories = sum(m.get("calories", 0) for m in meals_in_day)
        daily_plan.total_protein  = sum(m.get("protein",  0) for m in meals_in_day)
        daily_plan.total_carbs    = sum(m.get("carbs",    0) for m in meals_in_day)
        daily_plan.total_fats     = sum(m.get("fats",     0) for m in meals_in_day)

        # Create new meals for this day (no ingredients/recipe_brief — generated on demand)
        for meal_data in meals_in_day:
            meal = Meal(
                daily_plan_id=daily_plan.id,
                meal_type=meal_data["meal_type"],
                dish_name=meal_data["dish_name"],
                description=meal_data.get("description"),
                cuisine=meal_data.get("cuisine"),
                portion_size=meal_data.get("portion_size"),
                calories=meal_data["calories"],
                protein=meal_data["protein"],
                carbs=meal_data["carbs"],
                fats=meal_data["fats"],
                fiber=meal_data.get("fiber"),
                sodium=meal_data.get("sodium"),
                sugar=meal_data.get("sugar"),
                prep_time=meal_data.get("prep_time"),
                ingredients=None,
                recipe_brief=None,
            )
            db.add(meal)

        db.commit()
        db.refresh(daily_plan)

        # Build and return just the regenerated day
        meals = db.query(Meal).filter(Meal.daily_plan_id == daily_plan.id).all()
        meals_data = [MealResponse.from_orm_with_ingredients(meal) for meal in meals]

        return DailyPlanSchema(
            id=daily_plan.id,
            day_of_week=daily_plan.day_of_week,
            day_date=daily_plan.day_date,
            meals=meals_data,
            total_calories=daily_plan.total_calories,
            total_protein=daily_plan.total_protein,
            total_carbs=daily_plan.total_carbs,
            total_fats=daily_plan.total_fats,
            total_fiber=daily_plan.total_fiber or 0,
            total_sodium=daily_plan.total_sodium or 0,
            total_sugar=daily_plan.total_sugar or 0,
        )

    except HTTPException:
        # Re-raise HTTP exceptions (e.g., from load_joint_members 404)
        raise
    except Exception as e:
        db.rollback()
        logger.exception("Failed to regenerate day for plan %s", plan_id)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to regenerate day. Please try again."
        )


@router.post("/{plan_id}/regenerate", response_model=WeeklyPlanResponse, status_code=status.HTTP_200_OK)
async def regenerate_meal_plan(
    plan_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Regenerate the entire weekly meal plan.

    Archives the old plan and creates a completely new 7-day meal plan.
    For joint profiles, uses the configured family workflow (hybrid or llm_only).
    For solo profiles, the existing single-profile path is used unchanged.

    Args:
        plan_id: Weekly plan ID to regenerate
        db:      Database session dependency

    Returns:
        WeeklyPlanResponse: New weekly plan

    Raises:
        HTTPException 404: If plan not found
        HTTPException 500: If AI generation fails
    """
    # Get existing weekly plan (verifies ownership)
    old_plan = _verify_plan_ownership(db, plan_id, current_user)

    # Get profile
    profile = db.query(UserProfile).filter(UserProfile.id == old_plan.profile_id).first()

    # Initialize AI meal planner
    ai_planner = AIMealPlanner()

    # -----------------------------------------------------------------------
    # JOINT PROFILE PATH
    # -----------------------------------------------------------------------
    if profile.is_joint:
        member_profiles = load_joint_members(db, profile)
        member_targets  = build_member_targets(member_profiles)
        workflow = current_user.family_meal_workflow
        if workflow not in ("hybrid", "llm_only"):
            workflow = "hybrid"

        try:
            if workflow == "hybrid":
                raw_plan = await _run_hybrid_workflow(ai_planner, profile, member_targets)
            else:
                raw_plan = await _run_llm_only_workflow(ai_planner, profile, member_targets)

            # Archive the old plan
            old_plan.status = "archived"
            week_start = date.today() + timedelta(days=1)
            # store_family_plan also archives any other active plans — that's fine
            # because old_plan.status = "archived" above already set it; the
            # bulk update in store_family_plan is idempotent.
            weekly_plan = store_family_plan(db, profile, raw_plan, week_start, member_targets)
            db.commit()
            db.refresh(weekly_plan)
            return _build_weekly_plan_response(db, weekly_plan)

        except HTTPException:
            raise
        except Exception as e:
            db.rollback()
            logger.exception("Failed to regenerate family meal plan for plan %s", plan_id)
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to regenerate family meal plan. Please try again."
            )

    # -----------------------------------------------------------------------
    # NON-JOINT PATH
    # C2: persistence delegated to store_solo_plan()
    # -----------------------------------------------------------------------
    # Archive old plan
    old_plan.status = "archived"

    # Calculate nutrition targets
    nutrition_targets = calculate_targets(profile)

    try:
        meal_plan_data = await ai_planner.generate_meal_plan(profile, nutrition_targets)

        week_start  = date.today() + timedelta(days=1)
        # C2: store_solo_plan archives any remaining active plans and creates the new tree
        weekly_plan = store_solo_plan(db, profile, meal_plan_data, week_start)
        db.commit()
        db.refresh(weekly_plan)

        return _build_weekly_plan_response(db, weekly_plan)

    except Exception as e:
        db.rollback()
        logger.exception("Failed to regenerate solo meal plan for plan %s", plan_id)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to regenerate meal plan. Please try again."
        )


# =============================================================================
# Response builder
# =============================================================================

def _build_weekly_plan_response(db: Session, weekly_plan: WeeklyPlan) -> WeeklyPlanResponse:
    """
    Build WeeklyPlanResponse from WeeklyPlan ORM object.

    Helper function to construct the response with nested daily plans and meals.
    Pre-loads both MealKidShare and MealMemberServing rows for all meals in a
    single batch query each, avoiding N+1 queries.

    For non-joint plans, servings_map will be empty for all meal IDs, so
    member_servings=None is passed to from_orm_with_ingredients — the field
    is omitted from the JSON response entirely, preserving backward compatibility.

    Args:
        db:          Database session
        weekly_plan: WeeklyPlan ORM object

    Returns:
        WeeklyPlanResponse: Complete weekly plan with all nested data
    """
    # Get all daily plans for this week
    daily_plans = db.query(DailyPlan).filter(
        DailyPlan.weekly_plan_id == weekly_plan.id
    ).order_by(DailyPlan.day_of_week).all()

    # Collect all meal IDs in one pass to enable batch pre-loading
    all_meal_ids = []
    # Keep a mapping daily_plan.id -> [meals] for the response loop below
    meals_by_daily_plan: dict = {}
    for dp in daily_plans:
        dp_meals = db.query(Meal).filter(Meal.daily_plan_id == dp.id).all()
        meals_by_daily_plan[dp.id] = dp_meals
        for m in dp_meals:
            all_meal_ids.append(m.id)

    # -----------------------------------------------------------------------
    # Pre-load MealKidShare rows (avoids N+1 queries for kid-share data)
    # -----------------------------------------------------------------------
    all_shares = (
        db.query(MealKidShare)
        .filter(MealKidShare.meal_id.in_(all_meal_ids))
        .all()
        if all_meal_ids else []
    )
    # Build a map: meal_id -> list of KidShareInfo
    shares_map: dict = {}
    kid_ids = list({s.kid_profile_id for s in all_shares})
    kid_profiles = (
        {p.id: p.name for p in db.query(UserProfile).filter(UserProfile.id.in_(kid_ids)).all()}
        if kid_ids else {}
    )
    for s in all_shares:
        info = KidShareInfo(
            profile_id=s.kid_profile_id,
            profile_name=kid_profiles.get(s.kid_profile_id, ""),
            scale_ratio=s.scale_ratio,
        )
        shares_map.setdefault(s.meal_id, []).append(info)

    # -----------------------------------------------------------------------
    # Pre-load MealMemberServing rows (avoids N+1 queries for joint-profile data)
    # Only joint-profile plans will have rows in this table; solo plans will
    # return an empty list and servings_map will have no entries.
    # -----------------------------------------------------------------------
    all_member_servings = (
        db.query(MealMemberServing)
        .filter(MealMemberServing.meal_id.in_(all_meal_ids))
        .all()
        if all_meal_ids else []
    )
    # Build a map: meal_id -> list of MealMemberServingSchema
    servings_map: dict = {}
    for s in all_member_servings:
        schema = MealMemberServingSchema(
            member_name=s.member_name,
            member_profile_id=s.member_profile_id,
            adjustment=s.adjustment,
            portion_description=s.portion_description,
            calories=s.calories,
            protein=s.protein,
            carbs=s.carbs,
            fats=s.fats,
            fiber=s.fiber or 0,
        )
        servings_map.setdefault(s.meal_id, []).append(schema)

    # -----------------------------------------------------------------------
    # Build the nested response structure
    # -----------------------------------------------------------------------
    daily_plans_data = []

    for daily_plan in daily_plans:
        meals = meals_by_daily_plan.get(daily_plan.id, [])

        # Convert meals to schema format, attaching both kid-share and member-serving data.
        # servings_map.get(meal.id) returns None when no MealMemberServing rows exist
        # for that meal (i.e., solo profile plans), so member_servings=None is passed
        # and the field is omitted from JSON — fully backward compatible.
        meals_data = [
            MealResponse.from_orm_with_ingredients(
                meal,
                kid_shares=shares_map.get(meal.id),
                member_servings=servings_map.get(meal.id),
            )
            for meal in meals
        ]

        daily_plan_schema = DailyPlanSchema(
            id=daily_plan.id,
            day_of_week=daily_plan.day_of_week,
            day_date=daily_plan.day_date,
            meals=meals_data,
            total_calories=daily_plan.total_calories,
            total_protein=daily_plan.total_protein,
            total_carbs=daily_plan.total_carbs,
            total_fats=daily_plan.total_fats,
            total_fiber=daily_plan.total_fiber or 0,
            total_sodium=daily_plan.total_sodium or 0,
            total_sugar=daily_plan.total_sugar or 0,
        )

        daily_plans_data.append(daily_plan_schema)

    return WeeklyPlanResponse(
        id=weekly_plan.id,
        profile_id=weekly_plan.profile_id,
        week_start_date=weekly_plan.week_start_date,
        status=weekly_plan.status,
        days=daily_plans_data,
        created_at=weekly_plan.created_at,
    )


def _build_weekly_plan_response_dict(db: Session, weekly_plan: WeeklyPlan) -> dict:
    """
    Build a plain Python dict representation of a WeeklyPlanResponse.

    This is the SSE-compatible variant of _build_weekly_plan_response().
    It returns a dict (not a Pydantic model) so it can be passed directly
    to json.dumps() inside ProgressEvent.data without Pydantic serialization
    overhead.

    The structure mirrors WeeklyPlanResponse field-for-field and is safe
    to pass as the "data" payload of an SSE "complete" event.

    Args:
        db:          Database session.
        weekly_plan: WeeklyPlan ORM object (must already be committed/flushed).

    Returns:
        Plain dict with keys: id, profile_id, week_start_date, status,
        days (list of daily plan dicts, each with meals and member_servings).
    """
    # Delegate to the existing Pydantic response builder, then convert to dict.
    # model_dump() on the Pydantic model produces a fully serializable dict
    # (all nested models, dates, and enums are recursively converted).
    response = _build_weekly_plan_response(db, weekly_plan)
    return response.model_dump(mode="json")


# =============================================================================
# SSE Endpoint — Joint Profile Family Meal Plan Generation
# =============================================================================

@router.post("/generate-family", status_code=200)
async def generate_family_meal_plan_stream(
    profile_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    SSE endpoint for joint profile meal plan generation.

    Streams progress events as the plan is generated, then emits a "complete"
    event with the full WeeklyPlanResponse JSON payload.

    This endpoint is only for joint profiles. For individual profiles,
    use POST /generate (non-streaming).

    Workflow selection:
        current_user.family_meal_workflow == "hybrid"   -> STEPS_HYBRID
        current_user.family_meal_workflow == "llm_only" -> STEPS_LLM_ONLY
        (any other value treated as "hybrid")

    Error handling:
        If generation raises an exception, an SSE "error" event is emitted and
        the stream ends. The exception is logged. The DB transaction is rolled back.
        The frontend should check for a saved plan after receiving an error event
        (fire-and-forget pattern: if the error occurs after the plan was saved,
        the plan is still retrievable via GET /meal-plans/current).

    Headers:
        Cache-Control: no-cache      — prevents proxy caching of the stream
        Connection: keep-alive       — keeps the TCP connection open
        X-Accel-Buffering: no        — disables nginx response buffering for SSE

    C1 — DB session lifecycle:
        The request-scoped `db` session is used ONLY for the initial profile
        validation (get_user_profile_or_404) before the StreamingResponse is
        returned.  All DB work inside run_generation() uses a dedicated
        SessionLocal() session (local_db) that is created, committed/rolled back,
        and closed in a finally block entirely within the background coroutine.
        This prevents a use-after-close bug: FastAPI may recycle the request-scoped
        session as soon as the response generator starts, before run_generation()
        finishes.
    """
    # Validate that profile belongs to the current user.
    # This is the only use of the request-scoped `db` — safe because it
    # completes synchronously before we return the StreamingResponse.
    profile = get_user_profile_or_404(db, profile_id, current_user)

    if not profile.is_joint:
        # For non-joint profiles, client should use the regular /generate endpoint.
        # Return 400 with a JSON error (not SSE) so the client can handle gracefully.
        raise HTTPException(
            status_code=400,
            detail="This endpoint is for joint profiles only. Use POST /generate for individual profiles.",
        )

    # Select step list based on the user's workflow preference
    workflow = getattr(current_user, "family_meal_workflow", "hybrid")
    if workflow not in ("hybrid", "llm_only"):
        workflow = "hybrid"

    if workflow == "llm_only":
        steps = STEPS_LLM_ONLY
    else:
        steps = STEPS_HYBRID

    emitter = ProgressEmitter(steps)

    # Capture only scalar IDs from the request-scoped session for use inside
    # run_generation(), which operates on its own local_db session.  Never pass
    # ORM objects across session boundaries — doing so risks DetachedInstanceError
    # because SQLAlchemy tracks object ownership per session.
    captured_profile_id = profile_id
    captured_workflow   = workflow

    async def run_generation():
        """
        Background coroutine that performs the actual meal plan generation
        and emits SSE progress events.

        This runs concurrently with emitter.stream() via asyncio.ensure_future().
        The emitter's asyncio.Queue bridges the two coroutines:
          - run_generation() pushes events via emitter.emit() / emitter.complete()
            / emitter.error()
          - emitter.stream() (consumed by StreamingResponse) pulls events from
            the queue

        C1 — DB session ownership:
            run_generation() creates its own local_db session via SessionLocal().
            This session is fully self-contained: opened here, committed or rolled
            back here, and closed in the finally block — regardless of whether the
            request-scoped `db` is still alive.
        """
        # C1: Create a dedicated session owned entirely by this coroutine.
        local_db = SessionLocal()
        try:
            await emitter.emit("started")

            # Re-load the profile inside local_db to avoid DetachedInstanceError.
            # The profile was originally loaded in the request-scoped `db`; we
            # must reload it in local_db before passing to helper functions that
            # will issue further queries on this session.
            local_profile = local_db.query(UserProfile).filter(
                UserProfile.id == captured_profile_id
            ).first()
            if not local_profile:
                # Profile was deleted between validation and background start —
                # unlikely but handled to avoid an opaque AttributeError downstream.
                await emitter.error(f"Profile {captured_profile_id} not found.")
                return

            # Load member profiles and build per-member nutrition targets
            member_profiles = load_joint_members(local_db, local_profile)
            member_targets  = build_member_targets(member_profiles)
            ai_planner      = AIMealPlanner()
            week_start      = date.today() + timedelta(days=1)

            # Execute the appropriate workflow, which emits all intermediate steps
            if captured_workflow == "llm_only":
                raw_plan = await _run_llm_only_workflow(
                    ai_planner=ai_planner,
                    profile=local_profile,
                    member_targets=member_targets,
                    emitter=emitter,
                )
            else:
                raw_plan = await _run_hybrid_workflow(
                    ai_planner=ai_planner,
                    profile=local_profile,
                    member_targets=member_targets,
                    emitter=emitter,
                )

            # Persist the plan. The workflow helpers already emitted "saving";
            # this is the actual DB write that follows that event.
            weekly_plan = store_family_plan(
                local_db, local_profile, raw_plan, week_start, member_targets
            )
            local_db.commit()
            local_db.refresh(weekly_plan)

            # Build a plain dict for JSON serialization in the SSE payload
            plan_dict = _build_weekly_plan_response_dict(local_db, weekly_plan)

            # Signal completion — this also pushes the None sentinel to end stream()
            await emitter.complete(data=plan_dict)

        except Exception as exc:
            # Roll back any partial DB writes before signalling the error
            local_db.rollback()
            logger.error(
                f"[SSE] Family meal plan generation failed for profile "
                f"{captured_profile_id}: {traceback.format_exc()}"
            )
            # Emit a user-friendly error message then end the stream
            await emitter.error(f"Generation failed: {str(exc)}")

        finally:
            # Always close the dedicated session — prevents connection pool exhaustion
            local_db.close()

    # Schedule run_generation() as a background task on the current event loop.
    # ensure_future() does NOT await — StreamingResponse immediately starts
    # consuming emitter.stream(), and run_generation() runs concurrently,
    # pushing events as it progresses through the workflow.
    asyncio.ensure_future(run_generation())

    return StreamingResponse(
        emitter.stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            # X-Accel-Buffering: no disables nginx response buffering so SSE
            # events reach the client immediately rather than being held in a
            # proxy buffer until it fills (default nginx behaviour for responses
            # without Content-Length).
            "X-Accel-Buffering": "no",
        },
    )
