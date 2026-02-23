"""
Shared helper functions for joint/family profile meal plan operations.

This module is the single source of truth for the three categories of shared
logic that were previously duplicated between routers/meal_plan.py and
routers/meals.py:

  1. Member loading & target building
       - load_joint_members   — queries JointProfileMember and loads UserProfiles
       - build_member_targets — calls calculate_targets() per member and enriches

  2. Nutritional summation (pure functions — no DB access)
       - sum_member_servings  — meal-level totals from member_servings / per_member_nutrition
       - sum_day_totals       — day-level totals by summing across meals

  3. DB persistence
       - store_member_servings — inserts MealMemberServing rows for a single meal

All names are "public" (no leading underscore) because they are intended for
import by multiple modules. Callers should NOT call db.commit() inside these
helpers — transaction ownership stays with the caller.
"""

import logging
from typing import Dict, List, Optional

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from models.joint_profile import JointProfileMember
from models.meal_member_serving import MealMemberServing
from models.profile import UserProfile
from services.nutrition_calculator import calculate_targets


logger = logging.getLogger(__name__)


# =============================================================================
# 1. Member loading and target building
# =============================================================================

def load_joint_members(db: Session, joint_profile) -> List:
    """
    Load all member UserProfile objects for a joint profile.

    Queries JointProfileMember to get all member_profile_ids linked to the
    given joint_profile, then loads those UserProfile objects.

    Args:
        db:            SQLAlchemy session.
        joint_profile: UserProfile ORM object where is_joint == True.

    Returns:
        List of UserProfile ORM objects (the individual member profiles).
        Ordered by JointProfileMember.id ASC so the first-added member (the
        household anchor for non-mergeable fields) is always first.

    Raises:
        HTTPException 404: If no members are found (joint profile is empty).
    """
    memberships = (
        db.query(JointProfileMember)
        .filter(JointProfileMember.joint_profile_id == joint_profile.id)
        .order_by(JointProfileMember.id.asc())  # First-added = household anchor
        .all()
    )
    if not memberships:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Joint profile {joint_profile.id} has no member profiles configured.",
        )
    member_ids = [m.member_profile_id for m in memberships]
    profiles = (
        db.query(UserProfile)
        .filter(UserProfile.id.in_(member_ids))
        .all()
    )
    # Preserve insertion order (household anchor first)
    profile_map = {p.id: p for p in profiles}
    return [profile_map[mid] for mid in member_ids if mid in profile_map]


def build_member_targets(member_profiles: List) -> List[Dict]:
    """
    Build per-member target dicts from a list of UserProfile objects.

    Calls calculate_targets() for each member profile and enriches the result
    with the name, medical_goals, weight_goal, and diet_type fields needed
    by the AI planner and LP solver.

    Args:
        member_profiles: List of UserProfile ORM objects (individual members).

    Returns:
        List of dicts, one per member, with keys:
            name            (str)
            target_calories (int)
            target_protein  (int)
            target_carbs    (int)
            target_fats     (int)
            target_fiber    (int)
            medical_goals   (List[str])
            weight_goal     (str)
            diet_type       (str)
            profile_id      (int)   — needed for DB storage
    """
    targets = []
    for profile in member_profiles:
        nutrition = calculate_targets(profile)
        medical_goals = (
            profile.medical_goals_list
            if hasattr(profile, "medical_goals_list")
            else []
        )
        targets.append({
            "name":            profile.name,
            "target_calories": nutrition["target_calories"],
            "target_protein":  nutrition["target_protein"],
            "target_carbs":    nutrition["target_carbs"],
            "target_fats":     nutrition["target_fats"],
            "target_fiber":    nutrition["target_fiber"],
            "medical_goals":   medical_goals,
            "weight_goal":     profile.weight_goal,
            "diet_type":       profile.diet_type,
            "profile_id":      profile.id,
        })
    return targets


# =============================================================================
# 2. Nutritional summation helpers (pure — no DB access)
# =============================================================================

def sum_member_servings(meal_data: Dict) -> Dict[str, float]:
    """
    Compute meal-level nutritional totals from member servings or LP nutrition.

    Priority:
      1. "member_servings" list (llm_only — contains calories/protein/carbs/fats per member)
      2. "per_member_nutrition" dict (hybrid — produced by LP solver)
      3. Top-level meal fields (fallback for non-joint meals or LP-failed meals that
         used a direct fallback)

    Args:
        meal_data: Meal dict as produced by AIMealPlanner or post-LP enrichment.

    Returns:
        Dict with keys: calories, protein, carbs, fats, fiber — all floats.
    """
    if meal_data.get("member_servings"):
        return {
            "calories": sum(s.get("calories", 0) for s in meal_data["member_servings"]),
            "protein":  sum(s.get("protein",  0) for s in meal_data["member_servings"]),
            "carbs":    sum(s.get("carbs",    0) for s in meal_data["member_servings"]),
            "fats":     sum(s.get("fats",     0) for s in meal_data["member_servings"]),
            "fiber":    sum(s.get("fiber",    0) for s in meal_data["member_servings"]),
        }
    elif meal_data.get("per_member_nutrition"):
        totals: Dict[str, float] = {
            "calories": 0.0, "protein": 0.0, "carbs": 0.0, "fats": 0.0, "fiber": 0.0,
        }
        for nutrition in meal_data["per_member_nutrition"].values():
            for k in totals:
                totals[k] += nutrition.get(k, 0)
        return totals
    else:
        # Non-joint fallback: use meal-level fields directly
        return {
            "calories": meal_data.get("calories", 0),
            "protein":  meal_data.get("protein",  0),
            "carbs":    meal_data.get("carbs",    0),
            "fats":     meal_data.get("fats",     0),
            "fiber":    meal_data.get("fiber",    0),
        }


def sum_day_totals(meals: List[Dict]) -> Dict[str, float]:
    """
    Sum household-level nutritional totals across all meals in a day.

    Reads from per-meal member_servings (preferred) or from top-level meal
    nutritional fields if member_servings are absent (non-joint fallback).

    Args:
        meals: List of meal dicts for a single day (from AIMealPlanner output
               or post-LP enrichment).

    Returns:
        Dict with keys: calories, protein, carbs, fats — all floats.
    """
    totals: Dict[str, float] = {
        "calories": 0.0, "protein": 0.0, "carbs": 0.0, "fats": 0.0,
    }
    for meal in meals:
        meal_totals = sum_member_servings(meal)
        for k in totals:
            totals[k] += meal_totals.get(k, 0)
    return totals


# =============================================================================
# 3. DB persistence helper
# =============================================================================

def store_member_servings(
    db: Session,
    meal_id: int,
    meal_data: Dict,
    member_targets: Optional[List[Dict]] = None,
) -> None:
    """
    Insert MealMemberServing rows for a meal.

    Source priority (same as sum_member_servings):
      1. "member_servings" list (llm_only output)
      2. "per_member_nutrition" + "allocations" (hybrid LP output)

    For hybrid meals that produced LP allocations, the adjustment text comes from
    the "member_adjustment_text" dict keyed by member_name (populated by the router
    after the describe_adjustments call — see _run_hybrid_workflow Step 4).

    member_profile_id is resolved from member_targets (keyed by name) when available.
    The MealMemberServing.member_profile_id column is NOT NULL, so every insert must
    supply a valid profile ID. When the LLM omits profile_id (llm_only path) or the
    LP path allocates by name only, we fall back to looking up by name in member_targets.
    If resolution fails, the serving row is skipped and a warning is logged — this
    prevents hard crashes during partial-generation recovery without losing all servings.

    Skips gracefully if no member data is present (should not happen in production
    but prevents hard crashes during partial-generation recovery).

    Args:
        db:             SQLAlchemy session (no commit — caller owns the transaction).
        meal_id:        ID of the parent Meal row.
        meal_data:      Dict containing either "member_servings" or
                        "per_member_nutrition" + "allocations" keys.
        member_targets: Optional list of member target dicts (used for profile_id
                        resolution when the LLM/LP omits it). Each dict must have
                        "name" and "profile_id" keys.
    """
    # Build a name → profile_id lookup from member_targets for resolution
    profile_id_by_name: Dict[str, int] = {}
    if member_targets:
        for m in member_targets:
            if m.get("name") and m.get("profile_id"):
                profile_id_by_name[m["name"]] = m["profile_id"]

    if meal_data.get("member_servings"):
        for s in meal_data["member_servings"]:
            member_name = s.get("member_name", "")
            # Prefer explicit profile_id from the LLM, fall back to lookup by name
            profile_id = s.get("profile_id") or profile_id_by_name.get(member_name)
            if not profile_id:
                logger.warning(
                    f"[store_member_servings] Cannot resolve profile_id for member "
                    f"'{member_name}' in meal_id={meal_id} — skipping serving row."
                )
                continue
            serving = MealMemberServing(
                meal_id=meal_id,
                member_profile_id=profile_id,
                member_name=member_name,
                adjustment=s.get("adjustment"),
                portion_description=s.get("portion_description"),
                calories=s.get("calories", 0),
                protein=s.get("protein",  0),
                carbs=s.get("carbs",    0),
                fats=s.get("fats",      0),
                fiber=s.get("fiber",    0),
            )
            db.add(serving)

    elif meal_data.get("per_member_nutrition"):
        allocations = meal_data.get("allocations", {})
        adj_text    = meal_data.get("member_adjustment_text", {})
        components  = meal_data.get("components", [])
        unit_map    = {c["name"]: c.get("unit", "") for c in components}

        for member_name, nutrition in meal_data["per_member_nutrition"].items():
            profile_id = profile_id_by_name.get(member_name)
            if not profile_id:
                logger.warning(
                    f"[store_member_servings] Cannot resolve profile_id for member "
                    f"'{member_name}' in meal_id={meal_id} (LP path) — skipping serving row."
                )
                continue

            # Build a human-readable portion_description from the LP allocations
            alloc = allocations.get(member_name, {})
            portion_parts = [
                f"{round(units, 2)} {unit_map.get(comp_name, '')} {comp_name}".strip()
                for comp_name, units in alloc.items()
                if units > 0
            ]
            portion_desc = ", ".join(portion_parts) if portion_parts else None

            serving = MealMemberServing(
                meal_id=meal_id,
                member_profile_id=profile_id,
                member_name=member_name,
                adjustment=adj_text.get(member_name),
                portion_description=portion_desc,
                calories=nutrition.get("calories", 0),
                protein=nutrition.get("protein",  0),
                carbs=nutrition.get("carbs",    0),
                fats=nutrition.get("fats",      0),
                fiber=nutrition.get("fiber",    0),
            )
            db.add(serving)
