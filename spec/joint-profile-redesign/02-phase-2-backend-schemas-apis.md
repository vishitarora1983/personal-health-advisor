# Phase 2: Backend Schema Changes, Settings API, and Joint Profile API Rewrite

**Steps covered:** 3, 4, 5
**Spec version:** 1.0
**Date:** 2026-02-22
**Audience:** Backend developer

---

## Overview

This phase eliminates the concept of a "primary profile" from joint profiles and replaces it with explicit household-level preferences captured at creation time. It also introduces a proper Settings API so the frontend can read and write user-level configuration (e.g., `family_meal_workflow`), and it adds a `MemberServing` schema so meal plan responses can carry per-member nutrition breakdowns.

### Files changed in this phase

| File | Action |
|---|---|
| `backend/schemas/profile.py` | Modify — rewrite 3 classes |
| `backend/schemas/meal_plan.py` | Modify — add `MemberServingSchema`, update `MealResponse` |
| `backend/schemas/settings.py` | Create new file |
| `backend/routers/settings.py` | Modify — add 2 new endpoints |
| `backend/routers/profile.py` | Modify — rewrite `POST /joint`, update 2 GET endpoints |

---

## Task 2.1: Rewrite Profile Schemas

**File:** `backend/schemas/profile.py`

### Context

Three classes in this file need to change. All other classes (`ProfileCreate`, `ProfileUpdate`, `ProfileResponse`, `ProfileListItem`, `NutritionTargetsResponse`, `JointProfileResponse`) remain untouched.

---

### 2.1.A — Replace `JointProfileCreate`

**Current location:** Lines 218–222 of `backend/schemas/profile.py`

**BEFORE (current code, lines 218–222):**

```python
class JointProfileCreate(BaseModel):
    """Schema for creating a joint profile from existing individual profiles."""
    name: str = Field(min_length=1, max_length=100)
    primary_profile_id: int
    member_profile_ids: List[int] = Field(min_length=1)
```

**AFTER (replacement):**

```python
class JointProfileCreate(BaseModel):
    """
    Schema for creating a joint profile with household-level preferences.

    The caller selects which individual profiles to include and specifies the
    household's shared cooking/dietary preferences directly. There is no concept
    of a 'primary' profile — all members are equal contributors to the plan.

    member_profile_ids must contain at least 2 IDs; each must belong to the
    current user and must not itself be a joint profile.

    Household preferences (diet_type, allergies, etc.) override or supplement
    any individual member preferences when the AI generates a meal plan.
    """
    name: str = Field(min_length=1, max_length=100)
    member_profile_ids: List[int] = Field(
        min_length=2,
        description="IDs of individual profiles to include (minimum 2, none can be joint profiles)"
    )

    # ---- Household-level dietary preferences --------------------------------
    # These become the joint profile's own preference fields and are stored on
    # the UserProfile row (same columns used by individual profiles).

    diet_type: str = Field(
        default="none",
        pattern="^(none|vegetarian|vegan|keto|paleo|mediterranean|pescatarian)$",
        description="Household dietary pattern"
    )
    allergies: Optional[List[str]] = Field(
        default=None,
        description=(
            "Explicit allergy list for the household. "
            "If omitted, the backend auto-merges (union) all members' allergies."
        )
    )
    foods_to_avoid: Optional[str] = Field(
        default=None,
        max_length=500,
        description=(
            "Household-level foods to avoid. "
            "If omitted, the backend concatenates each member's foods_to_avoid."
        )
    )
    foods_to_include: Optional[str] = Field(
        default=None,
        max_length=500,
        description=(
            "Household-level foods to actively include. "
            "If omitted, the backend concatenates each member's foods_to_include."
        )
    )
    spice_tolerance: str = Field(
        default="medium",
        pattern="^(mild|medium|hot)$",
        description="Household spice heat preference"
    )
    cooking_skill: str = Field(
        default="intermediate",
        pattern="^(beginner|intermediate|advanced)$",
        description="Household cooking skill level"
    )
    max_cook_time: int = Field(
        ge=10,
        le=120,
        default=45,
        description="Maximum cooking time in minutes for the household"
    )
    cuisines: Optional[List[str]] = Field(
        default=None,
        description="Preferred cuisines for the household"
    )
    meals_per_day: List[str] = Field(
        default=["breakfast", "lunch", "dinner"],
        description="Which meal slots to plan for the household"
    )
    snacks_per_day: int = Field(
        ge=0,
        le=3,
        default=1,
        description="Number of snack slots per day for the household"
    )
    meals_to_repeat: int = Field(
        default=4,
        ge=0,
        le=7,
        description="Number of meals repeated across the week for simplicity"
    )
```

**Key differences from before:**

- `primary_profile_id: int` is removed entirely.
- `member_profile_ids` minimum changes from `1` to `2` (enforced at schema level, not just in the router).
- Twelve new preference fields added (same set as `ProfileCreate`) so the household preferences are explicit, not inferred from a primary member.

---

### 2.1.B — Replace `JointProfileMemberResponse`

**Current location:** Lines 225–229 of `backend/schemas/profile.py`

**BEFORE (current code, lines 225–229):**

```python
class JointProfileMemberResponse(BaseModel):
    """A member within a joint profile."""
    profile_id: int
    profile_name: str
    is_primary: bool
```

**AFTER (replacement):**

```python
class JointProfileMemberResponse(BaseModel):
    """
    Summary of one member within a joint profile.

    Exposes each member's individual nutrition goals so the frontend can display
    them in the household overview panel without a separate API call.
    is_primary is removed because the primary concept no longer exists.
    """
    profile_id: int
    profile_name: str
    target_calories: int
    weight_goal: str            # 'lose' | 'maintain' | 'gain'
    medical_goals: Optional[List[str]] = None
```

**Key differences from before:**

- `is_primary: bool` removed.
- `target_calories: int`, `weight_goal: str`, `medical_goals: Optional[List[str]]` added.

---

### 2.1.C — Replace `MemberNutritionTargetsResponse`

**Current location:** Lines 238–253 of `backend/schemas/profile.py`

**BEFORE (current code, lines 238–253):**

```python
class MemberNutritionTargetsResponse(BaseModel):
    """Per-member nutrition targets with share ratio for proportional serving breakdown."""
    profile_id: int
    profile_name: str
    is_primary: bool
    share_ratio: float
    bmr: float
    tdee: float
    target_calories: int
    target_protein: int
    target_carbs: int
    target_fats: int
    target_fiber: int
    target_sodium: int
    target_sugar: int
    macro_split: dict
```

**AFTER (replacement):**

```python
class MemberNutritionTargetsResponse(BaseModel):
    """
    Full nutrition targets for one member of a joint profile.

    Used by the household nutrition breakdown panel and by the meal generation
    service to understand how many calories each member needs.

    is_primary and share_ratio are removed:
    - is_primary: the primary concept is gone.
    - share_ratio: callers who need a ratio can compute it from target_calories
      across the list; baking it into the response was fragile and redundant.

    weight_goal and medical_goals are added so the UI can label each member's
    context (e.g. "Alice — losing weight, heart health").
    """
    profile_id: int
    profile_name: str
    weight_goal: str                    # 'lose' | 'maintain' | 'gain'
    medical_goals: Optional[List[str]] = None
    bmr: float
    tdee: float
    target_calories: int
    target_protein: int
    target_carbs: int
    target_fats: int
    target_fiber: int
    target_sodium: int
    target_sugar: int
    macro_split: dict
```

**Key differences from before:**

- `is_primary: bool` removed.
- `share_ratio: float` removed.
- `weight_goal: str` added.
- `medical_goals: Optional[List[str]]` added.

---

### 2.1.D — Required import additions

The top-level imports in `backend/schemas/profile.py` already include `Optional` and `List` from `typing`. No new imports are needed for these changes.

---

## Task 2.2: Update Meal Plan Schemas

**File:** `backend/schemas/meal_plan.py`

### Context

A new `MemberServingSchema` class is needed to represent the caloric/macro breakdown for a single household member within a meal. `MealResponse` gains an optional `member_servings` field and the static factory method gains a corresponding parameter.

---

### 2.2.A — Add `MemberServingSchema` (new class)

Insert after the closing of `KidShareInfo` (currently line 53) and before `class MealResponse` (currently line 56).

**New class to insert:**

```python
class MemberServingSchema(BaseModel):
    """
    Per-member serving data for one meal in a family/joint plan.

    Populated by the hybrid generation workflow when the AI explicitly
    assigns different portions or adjustments to different household members.
    For example, a meal of "Rajma Rice + Salad" might produce:
        - Adult (Vishit): 1 katori rajma, 1 katori rice, 1 bowl salad | 520 kcal
        - Adult (Priya):  1 katori rajma, 0.5 katori rice, 2 bowls salad | 430 kcal
        - Kid (Arya):     0.5 katori rajma, 0.5 katori rice, 1 bowl salad | 280 kcal

    adjustment: Free-text modifications from the household plan for this member,
        e.g. "half rice, extra salad, add cucumber raita". Null if the member
        eats the standard portion.

    portion_description: Human-readable description of the actual portion,
        e.g. "1 katori rajma, 0.5 katori rice, 2 bowls salad". Null if the
        AI did not generate a description.

    Calorie/macro fields reflect this member's individual portion, not the
    aggregate meal total.
    """
    member_profile_id: int
    member_name: str
    adjustment: Optional[str] = None
    portion_description: Optional[str] = None
    calories: float
    protein: float
    carbs: float
    fats: float
    fiber: Optional[float] = 0
```

---

### 2.2.B — Update `MealResponse` — add `member_servings` field

**Current location:** Lines 56–106 of `backend/schemas/meal_plan.py`

**BEFORE — class body fields (lines 62–65):**

```python
    id: int = Field(description="Database ID of the meal")
    daily_plan_id: int = Field(description="Parent daily plan ID")
    shared_with_kids: Optional[List[KidShareInfo]] = None

    model_config = {"from_attributes": True}
```

**AFTER — class body fields (add one line):**

```python
    id: int = Field(description="Database ID of the meal")
    daily_plan_id: int = Field(description="Parent daily plan ID")
    shared_with_kids: Optional[List[KidShareInfo]] = None
    member_servings: Optional[List[MemberServingSchema]] = None  # Per-member breakdown for joint/family plans

    model_config = {"from_attributes": True}
```

---

### 2.2.C — Update `from_orm_with_ingredients()` static method signature and body

**Current location:** Lines 68–106 of `backend/schemas/meal_plan.py`

**BEFORE — full method (lines 68–106):**

```python
    @staticmethod
    def from_orm_with_ingredients(meal_obj, kid_shares=None):
        """
        Convert ORM meal object to response schema, deserializing ingredients.

        Args:
            meal_obj: SQLAlchemy Meal model instance
            kid_shares: Optional list of KidShareInfo dicts for this meal

        Returns:
            MealResponse with deserialized ingredients
        """
        # Deserialize ingredients from JSON
        ingredients = []
        if meal_obj.ingredients:
            try:
                ingredients_data = json.loads(meal_obj.ingredients) if isinstance(meal_obj.ingredients, str) else meal_obj.ingredients
                ingredients = [IngredientSchema(**ing) for ing in ingredients_data]
            except (json.JSONDecodeError, TypeError):
                ingredients = []

        return MealResponse(
            id=meal_obj.id,
            daily_plan_id=meal_obj.daily_plan_id,
            meal_type=meal_obj.meal_type,
            dish_name=meal_obj.dish_name,
            description=meal_obj.description,
            cuisine=meal_obj.cuisine,
            portion_size=meal_obj.portion_size,
            calories=meal_obj.calories,
            protein=meal_obj.protein,
            carbs=meal_obj.carbs,
            fats=meal_obj.fats,
            fiber=meal_obj.fiber,
            prep_time=meal_obj.prep_time,
            ingredients=ingredients,
            recipe_brief=meal_obj.recipe_brief,
            shared_with_kids=kid_shares,
        )
```

**AFTER — updated method:**

```python
    @staticmethod
    def from_orm_with_ingredients(meal_obj, kid_shares=None, member_servings=None):
        """
        Convert ORM meal object to response schema, deserializing ingredients.

        Args:
            meal_obj: SQLAlchemy Meal model instance
            kid_shares: Optional list of KidShareInfo objects for this meal
            member_servings: Optional list of MemberServingSchema objects for joint/family plans.
                             Pass None (default) for individual profiles — the field will be
                             omitted from the JSON response.

        Returns:
            MealResponse with deserialized ingredients and optional per-member servings
        """
        # Deserialize ingredients from JSON
        ingredients = []
        if meal_obj.ingredients:
            try:
                ingredients_data = (
                    json.loads(meal_obj.ingredients)
                    if isinstance(meal_obj.ingredients, str)
                    else meal_obj.ingredients
                )
                ingredients = [IngredientSchema(**ing) for ing in ingredients_data]
            except (json.JSONDecodeError, TypeError):
                ingredients = []

        return MealResponse(
            id=meal_obj.id,
            daily_plan_id=meal_obj.daily_plan_id,
            meal_type=meal_obj.meal_type,
            dish_name=meal_obj.dish_name,
            description=meal_obj.description,
            cuisine=meal_obj.cuisine,
            portion_size=meal_obj.portion_size,
            calories=meal_obj.calories,
            protein=meal_obj.protein,
            carbs=meal_obj.carbs,
            fats=meal_obj.fats,
            fiber=meal_obj.fiber,
            prep_time=meal_obj.prep_time,
            ingredients=ingredients,
            recipe_brief=meal_obj.recipe_brief,
            shared_with_kids=kid_shares,
            member_servings=member_servings,   # None for individual profiles; list for joint
        )
```

**Note for callers:** All existing callers of `from_orm_with_ingredients(meal_obj, kid_shares)` continue to work unchanged because `member_servings` defaults to `None`. Only the new hybrid meal plan generation service will pass a value for `member_servings`.

---

## Task 2.3: Create Settings Schema

**File to create:** `backend/schemas/settings.py`

This file does not exist yet. Create it with the following full content:

```python
"""
Pydantic schemas for user-level application settings.

Settings are persisted on the User model row (not per-profile) so they apply
across all profiles owned by a user.
"""

from typing import Optional
from pydantic import BaseModel, Field, field_validator


class UserSettingsResponse(BaseModel):
    """
    Response schema for the current user's settings.

    family_meal_workflow controls how joint/family meal plans are generated:
        'hybrid'   — Step 1: LLM generates a single household meal (dish name,
                     total calories). Step 2: a second deterministic pass
                     calculates per-member portions based on
                     MemberNutritionTargets. Faster and more consistent.
        'llm_only' — Single LLM call generates the full plan including
                     per-member portions in one shot. Slower but allows the
                     AI more creative latitude over individual portions.
    """
    family_meal_workflow: str = Field(
        description="Joint profile meal generation mode: 'hybrid' or 'llm_only'"
    )


class UserSettingsUpdate(BaseModel):
    """
    Request body for PATCH/PUT /settings.

    All fields are optional so callers can update a single setting without
    providing the full settings object (partial update semantics).
    """
    family_meal_workflow: Optional[str] = Field(
        default=None,
        description="Set to 'hybrid' or 'llm_only'"
    )

    @field_validator('family_meal_workflow')
    @classmethod
    def validate_workflow(cls, v: Optional[str]) -> Optional[str]:
        """Reject any value that is not one of the supported workflow modes."""
        if v is not None and v not in ('hybrid', 'llm_only'):
            raise ValueError(
                f"family_meal_workflow must be 'hybrid' or 'llm_only', got '{v}'"
            )
        return v
```

---

## Task 2.4: Settings API Endpoints

**File to modify:** `backend/routers/settings.py`

### Context

The existing file at `backend/routers/settings.py` contains only one endpoint:

```
DELETE /settings/reset-all
```

Two new endpoints must be added: `GET /settings` and `PUT /settings`.

### Required import additions

At the top of the file, after the existing imports, add:

```python
from schemas.settings import UserSettingsResponse, UserSettingsUpdate
```

The existing imports already bring in `Session`, `Depends`, `get_db`, `User`, and `get_current_user`. No other additions are needed.

### New endpoint 1: `GET /settings`

Add after the existing imports and before the `DELETE /reset-all` handler:

```python
@router.get("", response_model=UserSettingsResponse, status_code=200)
def get_settings(current_user: User = Depends(get_current_user)):
    """
    Return the current user's application settings.

    Does not require a db Session because all settings are already loaded
    on the current_user object by get_current_user.
    """
    return UserSettingsResponse(
        family_meal_workflow=current_user.family_meal_workflow,
    )
```

### New endpoint 2: `PUT /settings`

Add immediately after the `GET /settings` handler:

```python
@router.put("", response_model=UserSettingsResponse, status_code=200)
def update_settings(
    settings: UserSettingsUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Update the current user's application settings.

    Uses model_dump(exclude_unset=True) so only fields explicitly provided in
    the request body are written to the database. This allows partial updates:
    a caller can send {"family_meal_workflow": "llm_only"} without touching
    any other settings that may be added in future.
    """
    update_data = settings.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(current_user, field, value)
    db.commit()
    db.refresh(current_user)
    return UserSettingsResponse(
        family_meal_workflow=current_user.family_meal_workflow,
    )
```

### Prerequisite: `family_meal_workflow` column on the `User` model

The `User` model at `backend/models/user.py` currently does not have a `family_meal_workflow` column. This column must be added before these endpoints will work. The column definition to add to `backend/models/user.py`:

```python
from sqlalchemy import Column, String

# Inside the User class, after the existing columns:
family_meal_workflow = Column(
    String(20),
    nullable=False,
    default="hybrid",
    server_default="hybrid",
)
```

**Migration note:** Because the project uses SQLite with `create_all` (not Alembic), the new column will only appear on freshly created databases. For an existing database, run the following one-time SQL against `backend/health_advisor.db`:

```sql
ALTER TABLE users ADD COLUMN family_meal_workflow VARCHAR(20) NOT NULL DEFAULT 'hybrid';
```

The backend team should run this before deploying the updated app, or arrange for an Alembic migration if the project adopts one.

### Full updated `backend/routers/settings.py`

After all changes the file should look exactly like this (the dev team should replace the entire file):

```python
"""
Settings router for user-level application configuration and admin operations.
"""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from database import get_db
from models.user import User
from models.profile import UserProfile
from models.meal_plan import WeeklyPlan, DailyPlan, Meal
from models.tracking import MealTracking
from models.grocery import GroceryItem
from auth import get_current_user
from schemas.settings import UserSettingsResponse, UserSettingsUpdate

router = APIRouter(prefix="/settings", tags=["Settings"])


@router.get("", response_model=UserSettingsResponse, status_code=200)
def get_settings(current_user: User = Depends(get_current_user)):
    """
    Return the current user's application settings.

    Does not require a db Session because all settings are already loaded
    on the current_user object by get_current_user.
    """
    return UserSettingsResponse(
        family_meal_workflow=current_user.family_meal_workflow,
    )


@router.put("", response_model=UserSettingsResponse, status_code=200)
def update_settings(
    settings: UserSettingsUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Update the current user's application settings.

    Uses model_dump(exclude_unset=True) so only fields explicitly provided in
    the request body are written to the database. This allows partial updates:
    a caller can send {"family_meal_workflow": "llm_only"} without touching
    any other settings that may be added in future.
    """
    update_data = settings.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(current_user, field, value)
    db.commit()
    db.refresh(current_user)
    return UserSettingsResponse(
        family_meal_workflow=current_user.family_meal_workflow,
    )


@router.delete("/reset-all", status_code=status.HTTP_200_OK)
def reset_all_data(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """
    Delete all data belonging to the current user.

    Deletes: tracking, grocery items, meals, daily plans, weekly plans, user profiles.
    User account and settings are preserved.
    """
    try:
        # Get all profile IDs owned by this user
        profile_ids = [p.id for p in db.query(UserProfile.id).filter(UserProfile.user_id == current_user.id).all()]

        if profile_ids:
            # Get all weekly plan IDs for these profiles
            plan_ids = [p.id for p in db.query(WeeklyPlan.id).filter(WeeklyPlan.profile_id.in_(profile_ids)).all()]

            if plan_ids:
                # Get all daily plan IDs
                daily_ids = [d.id for d in db.query(DailyPlan.id).filter(DailyPlan.weekly_plan_id.in_(plan_ids)).all()]

                if daily_ids:
                    # Get all meal IDs
                    meal_ids = [m.id for m in db.query(Meal.id).filter(Meal.daily_plan_id.in_(daily_ids)).all()]

                    if meal_ids:
                        db.query(MealTracking).filter(MealTracking.meal_id.in_(meal_ids)).delete(synchronize_session=False)

                    db.query(Meal).filter(Meal.daily_plan_id.in_(daily_ids)).delete(synchronize_session=False)

                db.query(GroceryItem).filter(GroceryItem.weekly_plan_id.in_(plan_ids)).delete(synchronize_session=False)
                db.query(DailyPlan).filter(DailyPlan.weekly_plan_id.in_(plan_ids)).delete(synchronize_session=False)

            db.query(WeeklyPlan).filter(WeeklyPlan.profile_id.in_(profile_ids)).delete(synchronize_session=False)

        db.query(UserProfile).filter(UserProfile.user_id == current_user.id).delete(synchronize_session=False)
        db.commit()
        return {"message": "All your data has been cleared successfully"}
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to reset data: {str(e)}"
        )
```

---

## Task 2.5: Rewrite Joint Profile Creation and Related GET Endpoints

**File to modify:** `backend/routers/profile.py`

### Context

Three endpoints in this file change:

1. `POST /profile/joint` — full rewrite (lines 166–265)
2. `GET /profile/{profile_id}/joint-members` — update response construction (lines 268–291)
3. `GET /profile/{profile_id}/member-nutrition-targets` — update response construction (lines 294–333)

All other endpoints (`GET /profile`, `GET /profile/kids`, `GET /profile/{id}`, `POST /profile`, `PUT /profile/{id}`, `DELETE /profile/{id}`, `GET /profile/{id}/nutrition-targets`) remain unchanged.

---

### 2.5.A — Updated imports

The import block at the top of the file (lines 16–21) currently reads:

```python
from schemas.profile import (
    ProfileCreate, ProfileUpdate, ProfileResponse,
    ProfileListItem, NutritionTargetsResponse,
    JointProfileCreate, JointProfileMemberResponse,
    JointProfileResponse, MemberNutritionTargetsResponse,
)
```

No new schema imports are needed — all referenced schemas are already imported. However, the `json` import at line 11 is already present and will be needed by the new endpoint's auto-merge logic.

---

### 2.5.B — Rewrite `POST /profile/joint` (Step 5)

**Current code:** Lines 166–265 of `backend/routers/profile.py`

Replace the entire handler (from the `@router.post` decorator through the final `return` statement) with:

```python
@router.post("/joint", response_model=JointProfileResponse, status_code=status.HTTP_201_CREATED)
def create_joint_profile(
    data: JointProfileCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Create a joint profile for a household, combining multiple individual profiles.

    The caller explicitly provides household-level preferences (diet_type,
    allergies, etc.) rather than inheriting them from a single 'primary' profile.
    Nutrition targets are summed across all members so the AI generates enough
    food for the entire household.

    Validation rules:
    - All member_profile_ids must belong to the current user.
    - None of the member profiles may themselves be joint profiles.
    - At least 2 members are required (enforced by schema and re-checked here).
    - Duplicate IDs in member_profile_ids are silently de-duplicated.

    Auto-merge logic (applied when the corresponding field is None in the request):
    - allergies: union of all members' allergy lists (deduplicated, sorted).
    - foods_to_avoid: members' foods_to_avoid values joined by "; ".
    - foods_to_include: members' foods_to_include values joined by "; ".
    """
    # -------------------------------------------------------------------------
    # Step 1: De-duplicate member IDs and enforce minimum count
    # -------------------------------------------------------------------------
    member_ids = list(dict.fromkeys(data.member_profile_ids))  # preserves order, removes dupes
    if len(member_ids) < 2:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="A joint profile requires at least 2 distinct member profiles.",
        )

    # -------------------------------------------------------------------------
    # Step 2: Load all member profiles and validate ownership / type
    # -------------------------------------------------------------------------
    members = (
        db.query(UserProfile)
        .filter(
            UserProfile.id.in_(member_ids),
            UserProfile.user_id == current_user.id,
        )
        .all()
    )

    found_ids = {m.id for m in members}
    missing = set(member_ids) - found_ids
    if missing:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Profile(s) not found or not owned by you: {sorted(missing)}",
        )

    for m in members:
        if m.is_joint:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=(
                    f"Profile '{m.name}' (id={m.id}) is itself a joint profile "
                    "and cannot be a member of another joint profile."
                ),
            )

    member_map = {m.id: m for m in members}

    # -------------------------------------------------------------------------
    # Step 3: Auto-merge allergies if not explicitly provided
    # -------------------------------------------------------------------------
    if data.allergies is None:
        merged_allergies: set = set()
        for m in members:
            raw = m.allergies  # stored as JSON string in DB
            if raw:
                try:
                    parsed = json.loads(raw) if isinstance(raw, str) else raw
                    if isinstance(parsed, list):
                        merged_allergies.update(parsed)
                except (json.JSONDecodeError, TypeError):
                    pass
        allergies_value = json.dumps(sorted(merged_allergies)) if merged_allergies else None
    else:
        allergies_value = json.dumps(data.allergies) if data.allergies else None

    # -------------------------------------------------------------------------
    # Step 4: Auto-merge foods_to_avoid and foods_to_include if not provided
    # -------------------------------------------------------------------------
    if data.foods_to_avoid is None:
        avoid_parts = [m.foods_to_avoid for m in members if m.foods_to_avoid]
        foods_to_avoid_value = "; ".join(avoid_parts) if avoid_parts else None
    else:
        foods_to_avoid_value = data.foods_to_avoid or None

    if data.foods_to_include is None:
        include_parts = [m.foods_to_include for m in members if m.foods_to_include]
        foods_to_include_value = "; ".join(include_parts) if include_parts else None
    else:
        foods_to_include_value = data.foods_to_include or None

    # -------------------------------------------------------------------------
    # Step 5: Sum nutrition targets across all members via calculate_targets()
    #
    # calculate_targets() uses the member's own body vitals (weight, height,
    # age, gender, activity_level) and goals to compute their personal targets.
    # Summing ensures the joint meal plan covers the entire household's needs.
    # -------------------------------------------------------------------------
    sum_calories = 0
    sum_protein = 0
    sum_carbs = 0
    sum_fats = 0
    sum_fiber = 0
    sum_sodium = 0
    sum_sugar = 0

    for m in members:
        t = calculate_targets(m)
        sum_calories += t["target_calories"]
        sum_protein  += t["target_protein"]
        sum_carbs    += t["target_carbs"]
        sum_fats     += t["target_fats"]
        sum_fiber    += t["target_fiber"]
        sum_sodium   += t["target_sodium"]
        sum_sugar    += t["target_sugar"]

    # -------------------------------------------------------------------------
    # Step 6: Create the joint UserProfile row
    #
    # Household preferences come from the request body.
    # Body vitals (age, gender, height_cm, weight_kg, activity_level) are
    # copied from the first member purely to satisfy the NOT NULL database
    # constraints on those columns. They are inert placeholders — the joint
    # profile's nutrition targets are set explicitly via the summed values
    # above and are never recalculated from these vitals.
    #
    # weight_goal is similarly a placeholder; it is not used for joint profiles.
    # -------------------------------------------------------------------------
    first_member = member_map[member_ids[0]]

    joint = UserProfile(
        name=data.name,
        is_joint=True,
        user_id=current_user.id,

        # Household-level preferences (from request body)
        diet_type=data.diet_type,
        allergies=allergies_value,
        foods_to_avoid=foods_to_avoid_value,
        foods_to_include=foods_to_include_value,
        spice_tolerance=data.spice_tolerance,
        cooking_skill=data.cooking_skill,
        max_cook_time=data.max_cook_time,
        cuisines=json.dumps(data.cuisines) if data.cuisines else None,
        meals_per_day=json.dumps(data.meals_per_day),
        snacks_per_day=data.snacks_per_day,
        meals_to_repeat=data.meals_to_repeat,
        household_size=len(member_ids),

        # Placeholder vitals copied from first member (satisfy NOT NULL constraints only)
        age=first_member.age,
        gender=first_member.gender,
        height_cm=first_member.height_cm,
        weight_kg=first_member.weight_kg,
        activity_level=first_member.activity_level,
        weight_goal=first_member.weight_goal,   # placeholder — not semantically used
        medical_goals=None,                      # household has no aggregate medical goal

        # Summed nutrition targets covering the entire household
        target_calories=sum_calories,
        target_protein=sum_protein,
        target_carbs=sum_carbs,
        target_fats=sum_fats,
        target_fiber=sum_fiber,
        target_sodium=sum_sodium,
        target_sugar=sum_sugar,
    )
    db.add(joint)
    db.flush()  # obtain joint.id before creating member associations

    # -------------------------------------------------------------------------
    # Step 7: Create JointProfileMember association rows (no is_primary field)
    # -------------------------------------------------------------------------
    member_responses = []
    for mid in member_ids:
        assoc = JointProfileMember(
            joint_profile_id=joint.id,
            member_profile_id=mid,
            # is_primary intentionally omitted — the column still exists in the
            # database (Boolean, default=False) but is no longer semantically used.
            # All members are equal. The column can be dropped in a future migration.
        )
        db.add(assoc)

        profile = member_map[mid]
        member_targets = calculate_targets(profile)
        member_responses.append(
            JointProfileMemberResponse(
                profile_id=mid,
                profile_name=profile.name,
                target_calories=member_targets["target_calories"],
                weight_goal=profile.weight_goal,
                medical_goals=(
                    json.loads(profile.medical_goals)
                    if isinstance(profile.medical_goals, str) and profile.medical_goals
                    else (profile.medical_goals or None)
                ),
            )
        )

    db.commit()
    db.refresh(joint)

    return JointProfileResponse(
        profile=_profile_response(joint, db),
        members=member_responses,
    )
```

**Key behavioral differences from the old implementation:**

| Concern | Old behavior | New behavior |
|---|---|---|
| Primary profile | Required; copies all preferences from it | Removed; preferences come from request body |
| Member IDs | `[primary] + member_profile_ids` merged in router | `member_profile_ids` only (min 2, from schema) |
| Allergy merging | No merging; only primary's allergies used | Union of all members' allergies if field omitted |
| foods_to_avoid merging | Primary's value only | Concatenation of all members' values if field omitted |
| foods_to_include merging | Not set on joint profile | Concatenation of all members' values if field omitted |
| JointProfileMember rows | `is_primary` set per row | `is_primary` left at DB default `False`; col is vestigial |
| Response members | `JointProfileMemberResponse(is_primary=...)` | `JointProfileMemberResponse(target_calories=..., weight_goal=..., medical_goals=...)` |

---

### 2.5.C — Update `GET /profile/{profile_id}/joint-members`

**Current code:** Lines 268–291 of `backend/routers/profile.py`

**BEFORE — return statement (lines 283–291):**

```python
    return [
        JointProfileMemberResponse(
            profile_id=a.member_profile_id,
            profile_name=member_map[a.member_profile_id].name,
            is_primary=a.is_primary,
        )
        for a in assocs
        if a.member_profile_id in member_map
    ]
```

**AFTER — replacement return statement:**

```python
    result = []
    for a in assocs:
        if a.member_profile_id not in member_map:
            continue
        profile = member_map[a.member_profile_id]
        member_targets = calculate_targets(profile)
        # Deserialize medical_goals from JSON string if stored as text
        raw_goals = profile.medical_goals
        medical_goals = None
        if raw_goals:
            try:
                medical_goals = json.loads(raw_goals) if isinstance(raw_goals, str) else raw_goals
            except (json.JSONDecodeError, TypeError):
                medical_goals = None

        result.append(
            JointProfileMemberResponse(
                profile_id=a.member_profile_id,
                profile_name=profile.name,
                target_calories=member_targets["target_calories"],
                weight_goal=profile.weight_goal,
                medical_goals=medical_goals,
            )
        )
    return result
```

Also remove the line `assoc_map = {a.member_profile_id: a.is_primary for a in assocs}` if it appears in this handler (it does not in the current code, so this is just a note for awareness).

---

### 2.5.D — Update `GET /profile/{profile_id}/member-nutrition-targets`

**Current code:** Lines 294–333 of `backend/routers/profile.py`

The handler currently:
1. Builds an `assoc_map` tracking `is_primary` per member.
2. Collects `(mid, name, is_primary, targets)` tuples.
3. Calculates `share_ratio` for each member.
4. Returns `MemberNutritionTargetsResponse(is_primary=..., share_ratio=..., ...)`.

**AFTER — replace the body of the handler from the `assocs` query through the return statement:**

```python
    assocs = db.query(JointProfileMember).filter(
        JointProfileMember.joint_profile_id == profile_id
    ).all()

    member_ids = [a.member_profile_id for a in assocs]
    members = db.query(UserProfile).filter(UserProfile.id.in_(member_ids)).all()
    member_map = {m.id: m for m in members}

    result = []
    for mid in member_ids:
        member = member_map.get(mid)
        if not member:
            # Member profile was deleted after the joint profile was created; skip gracefully
            continue

        targets = calculate_targets(member)

        # Deserialize medical_goals from JSON string if stored as text
        raw_goals = member.medical_goals
        medical_goals = None
        if raw_goals:
            try:
                medical_goals = json.loads(raw_goals) if isinstance(raw_goals, str) else raw_goals
            except (json.JSONDecodeError, TypeError):
                medical_goals = None

        result.append(
            MemberNutritionTargetsResponse(
                profile_id=mid,
                profile_name=member.name,
                weight_goal=member.weight_goal,
                medical_goals=medical_goals,
                **targets,   # bmr, tdee, target_*, macro_split
            )
        )

    return result
```

The `assoc_map` variable tracking `is_primary`, the `total_calories` division for `share_ratio`, and the tuple-based accumulation are all removed.

---

## Validation Checklist

Before marking this phase complete, verify the following manually or via automated tests:

### Schema validation
- [ ] `POST /profile/joint` with `member_profile_ids: [1]` (only one ID) returns HTTP 422 (caught by Pydantic `min_length=2` on the schema)
- [ ] `POST /profile/joint` with `member_profile_ids: [1, 1]` (duplicates) de-duplicates to one ID and then returns HTTP 400 from the router's `< 2` check
- [ ] `POST /profile/joint` with `allergies: null` auto-merges member allergies
- [ ] `POST /profile/joint` with `allergies: ["peanuts"]` uses the explicit value, not the merged value
- [ ] `POST /profile/joint` with `member_profile_ids` containing a joint profile ID returns HTTP 400

### Settings API
- [ ] `GET /settings` returns `{"family_meal_workflow": "hybrid"}` for a new user
- [ ] `PUT /settings` with `{"family_meal_workflow": "llm_only"}` updates and returns the new value
- [ ] `PUT /settings` with `{"family_meal_workflow": "invalid"}` returns HTTP 422

### Response shape
- [ ] `POST /profile/joint` response contains `members[].target_calories`, `members[].weight_goal`, `members[].medical_goals`
- [ ] `POST /profile/joint` response does NOT contain `members[].is_primary`
- [ ] `GET /profile/{id}/joint-members` response shape matches the new `JointProfileMemberResponse`
- [ ] `GET /profile/{id}/member-nutrition-targets` response does NOT contain `is_primary` or `share_ratio`

### Backward compatibility
- [ ] `GET /profile`, `POST /profile`, `PUT /profile/{id}`, `DELETE /profile/{id}`, `GET /profile/{id}/nutrition-targets` all return unchanged shapes
- [ ] `DELETE /settings/reset-all` still works
- [ ] `MealResponse.from_orm_with_ingredients(meal_obj)` (no `member_servings` arg) still works; `member_servings` is `null` in JSON output

---

## Dependencies / Sequencing

This phase has one hard prerequisite outside its own files:

- The `family_meal_workflow` column must exist on the `users` table before the Settings API endpoints are deployed. Run the one-time `ALTER TABLE` statement documented in Task 2.4 against any existing SQLite database.

Phase 3 (SSE meal generation service) depends on `MemberServingSchema` and `MemberNutritionTargetsResponse` from this phase. Do not begin Phase 3 until Phase 2 is merged and tests pass.
