# Phase 4: Backend Orchestration Layer

**Spec document for the joint-profile redesign dev team.**
Last updated: 2026-02-22
Covers Steps 10–11 of the implementation plan.

---

## Overview

Phase 4 wires together every artifact from Phases 1–3 into the existing FastAPI routers. Two files receive changes:

| File | Nature of change |
|---|---|
| `backend/routers/meal_plan.py` | Add joint-profile branching to `generate_meal_plan`, `regenerate_day`, and `regenerate_meal_plan`; add `store_family_plan` helper; modify `_build_weekly_plan_response` to include `member_servings` |
| `backend/routers/meals.py` | Modify `swap_meal`, `replace_with_custom_meal`, and `copy_meal_to`; no change to `share_with_kids` |

### Pre-condition: `family_meal_workflow` field on User

Phase 4 assumes that Phase 2 (database schema) has already added a `family_meal_workflow` column to the `users` table (values: `"hybrid"` or `"llm_only"`, default `"hybrid"`), and that the `User` model at `backend/models/user.py` exposes this as:

```python
family_meal_workflow = Column(
    String(20),
    nullable=False,
    default="hybrid",
    server_default="hybrid",
)
```

This field is read as `current_user.family_meal_workflow` throughout this phase.

### Pre-condition: `MealMemberServing` model

Phase 4 assumes that Phase 2 has created the `MealMemberServing` ORM model at `backend/models/meal_member_serving.py`:

```python
class MealMemberServing(Base):
    __tablename__ = "meal_member_servings"

    id                = Column(Integer, primary_key=True, autoincrement=True)
    meal_id           = Column(Integer, ForeignKey("meals.id", ondelete="CASCADE"),
                               nullable=False, index=True)
    member_profile_id = Column(Integer, ForeignKey("user_profiles.id", ondelete="CASCADE"),
                               nullable=False)
    member_name       = Column(String(100), nullable=False)
    adjustment        = Column(Text, nullable=True)
    portion_description = Column(Text, nullable=True)
    calories          = Column(Float, nullable=False)
    protein           = Column(Float, nullable=False)
    carbs             = Column(Float, nullable=False)
    fats              = Column(Float, nullable=False)
    fiber             = Column(Float, nullable=True, default=0)

    meal           = relationship("Meal", back_populates="member_servings")
    member_profile = relationship("UserProfile")

    __table_args__ = (
        UniqueConstraint("meal_id", "member_profile_id", name="uq_meal_member_serving"),
    )
```

And that `backend/models/__init__.py` imports and exports `MealMemberServing`.

---

## Task 4.1 — Meal Plan Generation Router Changes

**File to modify:** `backend/routers/meal_plan.py`

### 4.1.1 New imports

Add the following imports at the top of `meal_plan.py` (after existing imports):

```python
from models.joint_profile import JointProfileMember
from models.meal_member_serving import MealMemberServing
from schemas.meal_plan import MealMemberServingSchema     # defined in Task 4.1.7
from services.portion_optimizer import PortionOptimizer
from services.family_plan_validator import FamilyPlanValidator
from services.ai_meal_planner import AIMealPlanner        # already imported
```

---

### 4.1.2 Helper — `load_joint_members`

Add this module-level function (not a method, just a plain function in `meal_plan.py`):

```python
def load_joint_members(db: Session, joint_profile) -> list:
    """
    Load all member UserProfile objects for a joint profile.

    Queries JointProfileMember to get all member_profile_ids linked to the
    given joint_profile, then loads those UserProfile objects.

    Args:
        db:            SQLAlchemy session.
        joint_profile: UserProfile ORM object where is_joint == True.

    Returns:
        List of UserProfile ORM objects (the individual member profiles).
        Ordered by JointProfileMember.is_primary DESC so the primary member
        is always first.

    Raises:
        HTTPException 404: If no members are found (joint profile is empty).
    """
    memberships = (
        db.query(JointProfileMember)
        .filter(JointProfileMember.joint_profile_id == joint_profile.id)
        .order_by(JointProfileMember.is_primary.desc())
        .all()
    )
    if not memberships:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Joint profile {joint_profile.id} has no member profiles configured."
        )
    member_ids = [m.member_profile_id for m in memberships]
    profiles = (
        db.query(UserProfile)
        .filter(UserProfile.id.in_(member_ids))
        .all()
    )
    # Preserve order (primary first)
    profile_map = {p.id: p for p in profiles}
    return [profile_map[mid] for mid in member_ids if mid in profile_map]
```

---

### 4.1.3 Helper — `build_member_targets`

```python
def build_member_targets(member_profiles: list) -> list:
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
        targets.append({
            "name":            profile.name,
            "target_calories": nutrition["target_calories"],
            "target_protein":  nutrition["target_protein"],
            "target_carbs":    nutrition["target_carbs"],
            "target_fats":     nutrition["target_fats"],
            "target_fiber":    nutrition["target_fiber"],
            "medical_goals":   profile.medical_goals_list,
            "weight_goal":     profile.weight_goal,
            "diet_type":       profile.diet_type,
            "profile_id":      profile.id,
        })
    return targets
```

---

### 4.1.4 `store_family_plan` — DB storage helper

```python
def store_family_plan(
    db: Session,
    profile,          # joint UserProfile
    raw_plan: Dict,   # {"weekly_plan": [...]} from AI planner (post-LP enrichment)
    week_start,       # datetime.date object
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
        db:         SQLAlchemy session (caller must call db.commit() after this returns).
        profile:    Joint UserProfile ORM object.
        raw_plan:   The fully-enriched plan dict. Each meal must have either:
                      - "per_member_nutrition" + "allocations" (hybrid)
                      - "member_servings" (llm_only)
                    If a meal has "per_member_nutrition" AND "member_servings",
                    "member_servings" takes precedence for text descriptions.
        week_start: date of the first day of the plan (week_start_date).

    Returns:
        The newly created WeeklyPlan ORM object (not yet committed).

    Design notes:
      - Uses db.flush() after each WeeklyPlan/DailyPlan insert to obtain DB-assigned IDs
        before creating child rows.
      - Does NOT call db.commit() — caller is responsible for the transaction.
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
    db.flush()

    for day_data in raw_plan["weekly_plan"]:
        day_of_week = day_data["day_of_week"]
        day_date    = week_start + timedelta(days=day_of_week)

        # Compute household-level daily totals from member serving sums
        day_totals = _sum_day_totals(day_data["meals"])

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
        db.flush()

        for meal_data in day_data["meals"]:
            # Compute meal-level totals as sum of member servings
            meal_totals = _sum_member_servings(meal_data)

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
                ingredients=None,
                recipe_brief=None,
            )
            db.add(meal_row)
            db.flush()

            # Store per-member servings
            _store_member_servings(db, meal_row.id, meal_data)

    return weekly_plan
```

**Private helpers used by `store_family_plan`:**

```python
def _sum_day_totals(meals: list) -> Dict[str, float]:
    """
    Sum household-level nutritional totals across all meals in a day.

    Reads from per-meal member_servings (preferred) or from top-level meal
    nutritional fields if member_servings are absent (non-joint fallback).
    """
    totals = {"calories": 0.0, "protein": 0.0, "carbs": 0.0, "fats": 0.0}
    for meal in meals:
        meal_totals = _sum_member_servings(meal)
        for k in totals:
            totals[k] += meal_totals.get(k, 0)
    return totals


def _sum_member_servings(meal_data: Dict) -> Dict[str, float]:
    """
    Compute meal-level nutritional totals from member servings or LP nutrition.

    Priority:
      1. "member_servings" list (llm_only — contains calories/protein/carbs/fats per member)
      2. "per_member_nutrition" dict (hybrid — produced by LP solver)
      3. Top-level meal fields (fallback for non-joint meals or LP-failed meals that
         used a direct fallback)
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
        totals = {"calories": 0.0, "protein": 0.0, "carbs": 0.0, "fats": 0.0, "fiber": 0.0}
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


def _store_member_servings(db: Session, meal_id: int, meal_data: Dict) -> None:
    """
    Insert MealMemberServing rows for a meal.

    Source priority (same as _sum_member_servings):
      1. "member_servings" list (llm_only output)
      2. "per_member_nutrition" + "allocations" (hybrid LP output)

    For hybrid meals that produced LP allocations, the adjustment text comes from
    the "member_adjustment_text" dict keyed by member_name (populated by the router
    after the describe_adjustments call — see 4.1.5 Step 4).

    Skips gracefully if no member data is present (should not happen in production
    but prevents hard crashes during partial-generation recovery).
    """
    if meal_data.get("member_servings"):
        for s in meal_data["member_servings"]:
            serving = MealMemberServing(
                meal_id=meal_id,
                member_profile_id=s.get("profile_id"),  # may be None if LLM omitted it
                member_name=s["member_name"],
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
        unit_map    = {c["name"]: c["unit"] for c in components}

        for member_name, nutrition in meal_data["per_member_nutrition"].items():
            # Build a human-readable portion_description from the LP allocations
            alloc = allocations.get(member_name, {})
            portion_parts = [
                f"{round(units, 2)} {unit_map.get(comp_name, '')} {comp_name}"
                for comp_name, units in alloc.items()
                if units > 0
            ]
            portion_desc = ", ".join(portion_parts) if portion_parts else None

            serving = MealMemberServing(
                meal_id=meal_id,
                member_profile_id=None,  # resolved by member_name lookup; set in caller if needed
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
```

---

### 4.1.5 `generate_meal_plan` — Complete branching logic

Replace the body of the existing `generate_meal_plan` endpoint in `meal_plan.py`. The function signature stays exactly the same:

```python
@router.post("/generate", response_model=WeeklyPlanResponse, status_code=status.HTTP_201_CREATED)
async def generate_meal_plan(
    profile_id: int,
    request: GenerateMealPlanRequest = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Generate a new 7-day meal plan using AI for a specific profile."""
```

**Step-by-step implementation:**

```python
    profile = get_user_profile_or_404(db, profile_id, current_user)

    # -----------------------------------------------------------------------
    # NON-JOINT PATH (unchanged)
    # -----------------------------------------------------------------------
    if not profile.is_joint:
        nutrition_targets = calculate_targets(profile)
        ai_planner = AIMealPlanner()
        try:
            meal_plan_data = await ai_planner.generate_meal_plan(profile, nutrition_targets)

            db.query(WeeklyPlan).filter(
                WeeklyPlan.profile_id == profile.id,
                WeeklyPlan.status == "active"
            ).update({"status": "archived"})

            today = date.today()
            week_start = today + timedelta(days=1)

            weekly_plan = WeeklyPlan(
                profile_id=profile.id,
                week_start_date=week_start,
                status="active",
            )
            db.add(weekly_plan)
            db.flush()

            for day_data in meal_plan_data["weekly_plan"]:
                day_of_week = day_data["day_of_week"]
                day_date    = week_start + timedelta(days=day_of_week)
                meals_in_day = day_data["meals"]

                daily_plan = DailyPlan(
                    weekly_plan_id=weekly_plan.id,
                    day_of_week=day_of_week,
                    day_date=day_date,
                    total_calories=sum(m.get("calories", 0) for m in meals_in_day),
                    total_protein=sum(m.get("protein",  0) for m in meals_in_day),
                    total_carbs=sum(m.get("carbs",   0) for m in meals_in_day),
                    total_fats=sum(m.get("fats",    0) for m in meals_in_day),
                )
                db.add(daily_plan)
                db.flush()

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
            db.refresh(weekly_plan)
            return _build_weekly_plan_response(db, weekly_plan)

        except Exception as e:
            db.rollback()
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Failed to generate meal plan: {str(e)}"
            )

    # -----------------------------------------------------------------------
    # JOINT PROFILE PATH
    # -----------------------------------------------------------------------
    member_profiles = load_joint_members(db, profile)
    member_targets  = build_member_targets(member_profiles)
    workflow        = current_user.family_meal_workflow  # "hybrid" | "llm_only"
    ai_planner      = AIMealPlanner()
    today           = date.today()
    week_start      = today + timedelta(days=1)

    try:
        if workflow == "hybrid":
            raw_plan = await _run_hybrid_workflow(ai_planner, profile, member_targets)
        else:
            raw_plan = await _run_llm_only_workflow(ai_planner, profile, member_targets)

        weekly_plan = store_family_plan(db, profile, raw_plan, week_start)
        db.commit()
        db.refresh(weekly_plan)
        return _build_weekly_plan_response(db, weekly_plan)

    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to generate family meal plan: {str(e)}"
        )
```

---

### 4.1.6 `_run_hybrid_workflow` — Internal async function

Define this as a module-level `async def` (not a class method) in `meal_plan.py`:

```python
async def _run_hybrid_workflow(
    ai_planner: AIMealPlanner,
    profile,
    member_targets: list,
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

    Returns:
        Enriched raw_plan dict. Every meal has either:
          "per_member_nutrition" + "allocations" + "member_adjustment_text" (LP succeeded)
          "member_servings" (LP failed after supplement retry → direct fallback)
    """
    logger.info(f"[Hybrid] Starting hybrid workflow for joint profile {profile.id}")

    # -----------------------------------------------------------------------
    # Step 1: LLM generates component plan
    # -----------------------------------------------------------------------
    raw_plan = await ai_planner.generate_family_components(profile, member_targets)
    optimizer = PortionOptimizer()

    # -----------------------------------------------------------------------
    # Steps 2–3: LP allocation per meal, with supplement retry
    # -----------------------------------------------------------------------
    for day in raw_plan["weekly_plan"]:
        for meal in day["meals"]:
            result = optimizer.allocate(
                components=meal["components"],
                member_targets=member_targets,
                meal_type=meal["meal_type"],
            )

            if not result.feasible:
                logger.warning(
                    f"[Hybrid] LP infeasible for '{meal['dish_name']}', "
                    f"attempting supplement rounds. Gap: {result.gap}"
                )
                # Supplement retry loop — max 2 rounds
                for attempt in range(2):
                    supplements = await ai_planner.suggest_supplements(
                        components=meal["components"],
                        gap=result.gap,
                        profile=profile,
                    )
                    meal["components"].extend(supplements)
                    result = optimizer.allocate(
                        components=meal["components"],
                        member_targets=member_targets,
                        meal_type=meal["meal_type"],
                    )
                    if result.feasible:
                        logger.info(
                            f"[Hybrid] LP feasible after supplement round {attempt + 1} "
                            f"for '{meal['dish_name']}'"
                        )
                        break

                if not result.feasible:
                    # All supplement rounds exhausted — fall back to LLM-only for this meal
                    logger.error(
                        f"[Hybrid] LP still infeasible after 2 supplement rounds for "
                        f"'{meal['dish_name']}'. Falling back to direct generation."
                    )
                    fallback = await ai_planner.swap_family_meal(
                        meal=meal,
                        day_meals=day["meals"],
                        profile=profile,
                        member_targets=member_targets,
                        workflow="llm_only",
                        reason="Nutritional optimisation could not converge — regenerating",
                    )
                    # Replace meal in-place with the fallback's member_servings
                    meal["member_servings"] = fallback["meal"]["member_servings"]
                    # Remove components so _store_member_servings uses member_servings path
                    meal.pop("components", None)
                    continue  # skip LP result attachment

            # Attach LP results to the meal dict
            meal["allocations"]          = result.allocations
            meal["per_member_nutrition"] = result.per_member_nutrition

    # -----------------------------------------------------------------------
    # Step 4: LLM describes adjustments (batched per day — one call per day)
    # -----------------------------------------------------------------------
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

    logger.info(f"[Hybrid] Workflow complete for joint profile {profile.id}")
    return raw_plan
```

---

### 4.1.7 `_run_llm_only_workflow` — Internal async function

```python
async def _run_llm_only_workflow(
    ai_planner: AIMealPlanner,
    profile,
    member_targets: list,
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

    Returns:
        raw_plan dict where every meal has a "member_servings" array.
    """
    logger.info(f"[LLM-Only] Starting llm_only workflow for joint profile {profile.id}")
    validator = FamilyPlanValidator()

    # Initial generation attempt
    raw_plan = await ai_planner.generate_family_meal_plan_direct(profile, member_targets)
    passed, warnings = validator.validate(
        daily_plans=raw_plan["weekly_plan"],
        member_targets=member_targets,
        workflow="llm_only",
    )

    if passed:
        logger.info(f"[LLM-Only] Plan passed validation on first attempt")
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
            return raw_plan

    # All retries exhausted — use the last generated plan regardless
    # (better to return a slightly imperfect plan than fail the whole request)
    logger.error(
        f"[LLM-Only] Plan failed validation after all retries for joint profile "
        f"{profile.id}. Using last generated plan. Residual warnings:\n"
        + "\n".join(warnings)
    )
    return raw_plan
```

---

### 4.1.8 `_build_weekly_plan_response` — Changes

The existing function must be extended to pre-load and include `MealMemberServing` data.

**Locate the existing function** (`_build_weekly_plan_response` in `meal_plan.py`) and apply the following changes:

**Change 1:** After the existing block that builds `shares_map` for `MealKidShare`, add a parallel block for `MealMemberServing`:

```python
# Pre-load all MealMemberServing rows for efficiency (avoids N+1 queries)
all_member_servings = (
    db.query(MealMemberServing)
    .filter(MealMemberServing.meal_id.in_(all_meal_ids))
    .all()
    if all_meal_ids else []
)
# Build a map: meal_id -> list of MealMemberServingSchema
servings_map: dict[int, list] = {}
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
```

**Change 2:** In the inner loop where `MealResponse.from_orm_with_ingredients` is called, pass the member servings:

```python
meals_data = [
    MealResponse.from_orm_with_ingredients(
        meal,
        kid_shares=shares_map.get(meal.id),
        member_servings=servings_map.get(meal.id),   # NEW
    )
    for meal in meals
]
```

**Change 3:** Update `MealResponse.from_orm_with_ingredients` in `backend/schemas/meal_plan.py` to accept and pass through the new `member_servings` parameter:

```python
# In schemas/meal_plan.py — add to MealResponse
member_servings: Optional[List["MealMemberServingSchema"]] = None

# In from_orm_with_ingredients static method — add parameter and assignment
@staticmethod
def from_orm_with_ingredients(meal_obj, kid_shares=None, member_servings=None):
    ...
    return MealResponse(
        ...
        shared_with_kids=kid_shares,
        member_servings=member_servings,   # NEW
    )
```

**New schema class** to add to `backend/schemas/meal_plan.py`:

```python
class MealMemberServingSchema(BaseModel):
    """Per-member serving breakdown for a single meal in a joint profile plan."""
    member_name:        str
    member_profile_id:  Optional[int]   = None
    adjustment:         Optional[str]   = None
    portion_description: Optional[str] = None
    calories:           float
    protein:            float
    carbs:              float
    fats:               float
    fiber:              Optional[float] = 0
```

Add a forward reference update at the bottom of `schemas/meal_plan.py`:

```python
MealResponse.model_rebuild()
```

---

### 4.1.9 `regenerate_day` — Joint-profile branching

The existing `regenerate_day` endpoint must check `profile.is_joint` and branch. Apply this change to the `try` block inside `regenerate_day`:

```python
    # After: profile = db.query(UserProfile).filter(...).first()
    if profile.is_joint:
        # Joint profile path
        member_profiles = load_joint_members(db, profile)
        member_targets  = build_member_targets(member_profiles)
        workflow        = current_user.family_meal_workflow

        meals_in_day = await ai_planner.generate_family_single_day(
            profile=profile,
            member_targets=member_targets,
            workflow=workflow,
            day_of_week=day_index,
            existing_dishes=[
                m.dish_name for m in
                db.query(Meal).join(DailyPlan).filter(
                    DailyPlan.weekly_plan_id == plan_id,
                    DailyPlan.day_of_week != day_index
                ).all()
            ],
        )

        # Delete existing meals AND their member servings for this day
        old_meals = db.query(Meal).filter(Meal.daily_plan_id == daily_plan.id).all()
        for old_meal in old_meals:
            db.query(MealMemberServing).filter(
                MealMemberServing.meal_id == old_meal.id
            ).delete()
        db.query(Meal).filter(Meal.daily_plan_id == daily_plan.id).delete()

        # If hybrid, run LP on the fresh meals
        if workflow == "hybrid":
            optimizer = PortionOptimizer()
            for meal_data in meals_in_day:
                if meal_data.get("components"):
                    result = optimizer.allocate(
                        components=meal_data["components"],
                        member_targets=member_targets,
                        meal_type=meal_data["meal_type"],
                    )
                    if result.feasible:
                        meal_data["allocations"]          = result.allocations
                        meal_data["per_member_nutrition"] = result.per_member_nutrition
                    else:
                        # Supplement retry (same logic as _run_hybrid_workflow)
                        for attempt in range(2):
                            supplements = await ai_planner.suggest_supplements(
                                components=meal_data["components"],
                                gap=result.gap,
                                profile=profile,
                            )
                            meal_data["components"].extend(supplements)
                            result = optimizer.allocate(
                                components=meal_data["components"],
                                member_targets=member_targets,
                                meal_type=meal_data["meal_type"],
                            )
                            if result.feasible:
                                meal_data["allocations"]          = result.allocations
                                meal_data["per_member_nutrition"] = result.per_member_nutrition
                                break

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
            meal_totals = _sum_member_servings(meal_data)
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
                ingredients=None,
                recipe_brief=None,
            )
            db.add(meal_row)
            db.flush()
            _store_member_servings(db, meal_row.id, meal_data)

        # Recalculate daily plan totals
        day_totals = _sum_day_totals(meals_in_day)
        daily_plan.total_calories = day_totals["calories"]
        daily_plan.total_protein  = day_totals["protein"]
        daily_plan.total_carbs    = day_totals["carbs"]
        daily_plan.total_fats     = day_totals["fats"]

    else:
        # Non-joint path (existing code — unchanged)
        ...
```

---

### 4.1.10 `regenerate_meal_plan` — Joint-profile branching

Apply the same joint/non-joint branching pattern as `generate_meal_plan`. After loading `profile`, add:

```python
    if profile.is_joint:
        member_profiles = load_joint_members(db, profile)
        member_targets  = build_member_targets(member_profiles)
        workflow        = current_user.family_meal_workflow

        try:
            if workflow == "hybrid":
                raw_plan = await _run_hybrid_workflow(ai_planner, profile, member_targets)
            else:
                raw_plan = await _run_llm_only_workflow(ai_planner, profile, member_targets)

            old_plan.status = "archived"
            week_start = date.today() + timedelta(days=1)
            weekly_plan = store_family_plan(db, profile, raw_plan, week_start)
            db.commit()
            db.refresh(weekly_plan)
            return _build_weekly_plan_response(db, weekly_plan)

        except Exception as e:
            db.rollback()
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Failed to regenerate family meal plan: {str(e)}"
            )
    # else: existing non-joint code continues below
```

---

## Task 4.2 — Meal Operations for Family Plans

**File to modify:** `backend/routers/meals.py`

### 4.2.1 New imports

Add at the top of `meals.py`:

```python
from models.joint_profile import JointProfileMember
from models.meal_member_serving import MealMemberServing
from services.portion_optimizer import PortionOptimizer
```

---

### 4.2.2 Helper — `load_member_targets` (local to meals.py)

```python
def load_member_targets(db: Session, profile) -> list:
    """
    Convenience wrapper for meals.py — loads member profiles and computes targets.

    Equivalent to calling load_joint_members() + build_member_targets() from
    meal_plan.py, but defined locally to avoid cross-router imports.

    Args:
        db:      SQLAlchemy session.
        profile: Joint UserProfile ORM object.

    Returns:
        List of member target dicts (same schema as build_member_targets output).

    Raises:
        HTTPException 404: If no member profiles are found.
    """
    memberships = (
        db.query(JointProfileMember)
        .filter(JointProfileMember.joint_profile_id == profile.id)
        .order_by(JointProfileMember.is_primary.desc())
        .all()
    )
    if not memberships:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Joint profile {profile.id} has no members configured."
        )
    member_ids = [m.member_profile_id for m in memberships]
    profiles   = (
        db.query(UserProfile)
        .filter(UserProfile.id.in_(member_ids))
        .all()
    )
    profile_map = {p.id: p for p in profiles}
    ordered     = [profile_map[mid] for mid in member_ids if mid in profile_map]

    targets = []
    for mp in ordered:
        nutrition = calculate_targets(mp)
        targets.append({
            "name":            mp.name,
            "target_calories": nutrition["target_calories"],
            "target_protein":  nutrition["target_protein"],
            "target_carbs":    nutrition["target_carbs"],
            "target_fats":     nutrition["target_fats"],
            "target_fiber":    nutrition["target_fiber"],
            "medical_goals":   mp.medical_goals_list,
            "weight_goal":     mp.weight_goal,
            "diet_type":       mp.diet_type,
            "profile_id":      mp.id,
        })
    return targets
```

---

### 4.2.3 `swap_meal` — Joint-profile changes

Locate the existing `swap_meal` endpoint. After the block that retrieves `profile` (the join from `DailyPlan → WeeklyPlan → UserProfile`), insert the following joint-profile branch **before** the existing `meal_dict` construction:

```python
    # Check if the owning profile is a joint profile
    if profile.is_joint:
        workflow       = current_user.family_meal_workflow
        member_targets = load_member_targets(db, profile)

        # Build meal dict (same as existing code)
        meal_dict = {
            "id": meal.id,
            "meal_type": meal.meal_type,
            "dish_name": meal.dish_name,
            "calories":  meal.calories,
            "protein":   meal.protein,
            "carbs":     meal.carbs,
            "fats":      meal.fats,
            "fiber":     meal.fiber,
        }
        day_meals_list = [
            {"id": m.id, "meal_type": m.meal_type, "dish_name": m.dish_name,
             "calories": m.calories, "protein": m.protein, "carbs": m.carbs, "fats": m.fats}
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

            # If hybrid: run LP on the new meal's components
            if workflow == "hybrid" and new_meal_inner.get("components"):
                optimizer = PortionOptimizer()
                result = optimizer.allocate(
                    components=new_meal_inner["components"],
                    member_targets=member_targets,
                    meal_type=meal.meal_type,
                )
                if result.feasible:
                    new_meal_inner["allocations"]          = result.allocations
                    new_meal_inner["per_member_nutrition"] = result.per_member_nutrition
                else:
                    # LP infeasible on swap — fall back to llm_only for this meal
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
            meal_totals = _sum_member_servings(new_meal_inner)
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
            meal.ingredients  = None
            meal.recipe_brief = None

            # Delete old MealMemberServing rows for this meal
            db.query(MealMemberServing).filter(
                MealMemberServing.meal_id == meal.id
            ).delete()

            # Insert new MealMemberServing rows from the swapped meal data
            _store_member_servings(db, meal.id, new_meal_inner)

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

            new_meal_response = MealResponse.from_orm_with_ingredients(meal)
            return SwapMealResponse(
                message="Meal swapped successfully",
                new_meal=new_meal_response,
            )

        except Exception as e:
            db.rollback()
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Failed to swap family meal: {str(e)}"
            )

    # Non-joint path continues here (existing code — unchanged)
```

Note: `_sum_member_servings` and `_store_member_servings` are defined in `meal_plan.py`. Import them in `meals.py`:

```python
from routers.meal_plan import _sum_member_servings, _store_member_servings
```

---

### 4.2.4 `replace_with_custom_meal` — Joint-profile changes

For joint profiles, the custom meal prompt must be augmented with member information so the AI can produce per-member servings. Insert the following joint-profile branch after loading `profile` and before the `calculate_targets` call:

```python
    if profile.is_joint:
        workflow       = current_user.family_meal_workflow
        member_targets = load_member_targets(db, profile)

        try:
            # Build an extended description that includes member context
            member_context = "\n".join([
                f"- {m['name']}: {m['target_calories']} kcal/day, "
                f"goals: {', '.join(m['medical_goals']) or 'none'}"
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

            # If the LLM returned member_servings, use them; otherwise generate defaults
            if not new_meal_data.get("member_servings"):
                # LLM did not produce member_servings — equal-split fallback:
                # Divide top-level totals equally among members
                n = len(member_targets)
                new_meal_data["member_servings"] = [
                    {
                        "member_name":        m["name"],
                        "adjustment":         "Standard equal portion",
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

            # Update Meal row
            meal_totals = _sum_member_servings(new_meal_data)
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
            meal.ingredients  = None
            meal.recipe_brief = None

            # Delete and re-insert MealMemberServing rows
            db.query(MealMemberServing).filter(
                MealMemberServing.meal_id == meal.id
            ).delete()
            _store_member_servings(db, meal.id, new_meal_data)

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

            return CustomMealResponse(
                message="Meal replaced with custom dish",
                new_meal=MealResponse.from_orm_with_ingredients(meal),
                warnings=warnings if warnings else None,
            )

        except Exception as e:
            db.rollback()
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Failed to replace custom meal in family plan: {str(e)}"
            )

    # Non-joint path continues here (existing code — unchanged)
```

---

### 4.2.5 `copy_meal_to` — Joint-profile changes

The `copy_meal_to` endpoint must copy `MealMemberServing` rows from source to target. Insert this block immediately **before** `db.commit()` inside the existing endpoint body:

```python
    # Copy MealMemberServing rows for joint profile plans
    # Check if either the source OR target belongs to a joint profile
    source_profile = (
        db.query(UserProfile)
        .join(WeeklyPlan, WeeklyPlan.profile_id == UserProfile.id)
        .join(DailyPlan, DailyPlan.weekly_plan_id == WeeklyPlan.id)
        .filter(DailyPlan.id == source.daily_plan_id)
        .first()
    )

    if source_profile and source_profile.is_joint:
        # Delete target's old MealMemberServing rows
        db.query(MealMemberServing).filter(
            MealMemberServing.meal_id == target.id
        ).delete()

        # Copy source's MealMemberServing rows to target
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
```

Place this block after all the field copies (`target.dish_name = source.dish_name`, etc.) and before `db.commit()`.

---

### 4.2.6 `share_with_kids` — No change required

The `share_with_kids` endpoint in `meals.py` handles a different data model (scaling adult meals to kid profiles via the `MealKidShare` table). Joint profiles manage household members via `JointProfileMember` and `MealMemberServing` — these are orthogonal concepts. The existing `share_with_kids` code is unchanged.

---

## Transaction Boundaries

All write operations follow the existing pattern in `meal_plan.py` and `meals.py`:

1. Use `db.flush()` after inserting `WeeklyPlan` and `DailyPlan` to obtain auto-generated IDs before creating child rows.
2. Call `db.commit()` once at the end of a successful operation.
3. Call `db.rollback()` in the `except` block on failure.
4. Do NOT call `db.commit()` inside `store_family_plan` or `_store_member_servings` — the caller (the endpoint function) owns the transaction.

---

## Error Handling Strategy

| Error condition | Behaviour |
|---|---|
| `load_joint_members` finds no members | `HTTPException 404` — surface to caller |
| `generate_family_components` fails after retries | `Exception` propagates, router's `except` block returns `HTTP 500` |
| LP infeasible after supplement rounds | Fallback to `swap_family_meal` with `workflow="llm_only"` for that specific meal |
| `describe_adjustments` fails | Log warning, continue without adjustment text (cosmetic failure only) |
| Validator fails all retries (llm_only) | Last generated plan stored anyway; error logged |
| `generate_family_meal_plan_direct` fails | `Exception` propagates, router returns `HTTP 500` |
| `MealMemberServing` insert fails | Transaction rolled back, `HTTP 500` returned |

---

## File Summary

| File | Action | Key changes |
|---|---|---|
| `backend/routers/meal_plan.py` | MODIFY | Add `load_joint_members`, `build_member_targets`, `store_family_plan`, `_run_hybrid_workflow`, `_run_llm_only_workflow`; modify `generate_meal_plan`, `regenerate_day`, `regenerate_meal_plan`, `_build_weekly_plan_response` |
| `backend/routers/meals.py` | MODIFY | Add `load_member_targets`; modify `swap_meal`, `replace_with_custom_meal`, `copy_meal_to` |
| `backend/schemas/meal_plan.py` | MODIFY | Add `MealMemberServingSchema`; add `member_servings` field to `MealResponse`; update `from_orm_with_ingredients` |
