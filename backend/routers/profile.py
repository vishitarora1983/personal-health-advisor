"""
Profile router for multi-profile user management.

Handles profile CRUD operations and nutrition target calculations.
"""

import logging
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List
import json

logger = logging.getLogger(__name__)

from database import get_db
from models.user import User
from models.profile import UserProfile
from models.joint_profile import JointProfileMember
from schemas.profile import (
    ProfileCreate, ProfileUpdate, ProfileResponse,
    ProfileListItem, NutritionTargetsResponse,
    JointProfileCreate, JointProfileMemberResponse,
    JointProfileResponse, MemberNutritionTargetsResponse,
)
from services.nutrition_calculator import calculate_targets
from auth import get_current_user, get_user_profile_or_404


router = APIRouter(prefix="/profile", tags=["Profile"])


def _compute_profile_type(profile: UserProfile, db: Session) -> str:
    """Derive profile_type from age (and member ages for joint profiles)."""
    if not profile.is_joint:
        return "adult" if profile.age >= 18 else "kid"
    # Joint profile: check if any member is a minor
    assocs = db.query(JointProfileMember).filter(
        JointProfileMember.joint_profile_id == profile.id
    ).all()
    member_ids = [a.member_profile_id for a in assocs]
    members = db.query(UserProfile).filter(UserProfile.id.in_(member_ids)).all()
    has_minor = any(m.age < 18 for m in members)
    return "family" if has_minor else "adult"


def _profile_response(profile: UserProfile, db: Session) -> ProfileResponse:
    """Build a ProfileResponse with the correct profile_type."""
    resp = ProfileResponse.model_validate(profile)
    resp.profile_type = _compute_profile_type(profile, db)
    return resp


@router.get("", response_model=List[ProfileListItem], status_code=status.HTTP_200_OK)
def list_profiles(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Return all profiles owned by the current user."""
    profiles = db.query(UserProfile).filter(
        UserProfile.user_id == current_user.id
    ).order_by(UserProfile.created_at).all()
    return profiles


@router.get("/kids", status_code=status.HTTP_200_OK)
def list_kid_profiles(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Return all non-joint profiles where age < 18, owned by current user."""
    kids = (
        db.query(UserProfile)
        .filter(
            UserProfile.user_id == current_user.id,
            UserProfile.age < 18,
            UserProfile.is_joint == False,
        )
        .order_by(UserProfile.name)
        .all()
    )
    return [{"id": k.id, "name": k.name} for k in kids]


@router.get("/{profile_id}", response_model=ProfileResponse, status_code=status.HTTP_200_OK)
def get_profile(profile_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Get a single profile by ID (must belong to current user)."""
    profile = get_user_profile_or_404(db, profile_id, current_user)
    return _profile_response(profile, db)


@router.post("", response_model=ProfileResponse, status_code=status.HTTP_201_CREATED)
def create_profile(profile_data: ProfileCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Create a new profile owned by the current user."""
    try:
        profile_dict = profile_data.model_dump()

        # Serialize list fields to JSON
        list_fields = ['medical_goals', 'allergies', 'cuisines', 'meals_per_day']
        for field in list_fields:
            if profile_dict.get(field) is not None:
                profile_dict[field] = json.dumps(profile_dict[field])
            else:
                profile_dict[field] = None

        # is_member_only is a model field, not a JSON list — pass it through directly
        new_profile = UserProfile(**profile_dict, user_id=current_user.id)
        db.add(new_profile)
        db.commit()
        db.refresh(new_profile)

        return _profile_response(new_profile, db)

    except Exception as e:
        db.rollback()
        logger.exception("Failed to create profile")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to create profile. Please try again."
        )


@router.put("/{profile_id}", response_model=ProfileResponse, status_code=status.HTTP_200_OK)
def update_profile(profile_id: int, profile_update: ProfileUpdate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Update a specific profile by ID (must belong to current user)."""
    profile = get_user_profile_or_404(db, profile_id, current_user)

    try:
        update_data = profile_update.model_dump(exclude_unset=True)

        # Serialize list fields to JSON
        list_fields = ['medical_goals', 'allergies', 'cuisines', 'meals_per_day']
        for field in list_fields:
            if field in update_data and update_data[field] is not None:
                update_data[field] = json.dumps(update_data[field])

        for field, value in update_data.items():
            setattr(profile, field, value)

        db.commit()
        db.refresh(profile)

        return _profile_response(profile, db)

    except Exception as e:
        db.rollback()
        logger.exception(f"Failed to update profile {profile_id}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to update profile. Please try again."
        )


@router.delete("/{profile_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_profile(profile_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Delete a profile and cascade-delete its plans (must belong to current user)."""
    profile = get_user_profile_or_404(db, profile_id, current_user)

    try:
        db.delete(profile)
        db.commit()
    except Exception as e:
        db.rollback()
        logger.exception(f"Failed to delete profile {profile_id}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to delete profile. Please try again."
        )


@router.get("/{profile_id}/nutrition-targets", response_model=NutritionTargetsResponse, status_code=status.HTTP_200_OK)
def get_nutrition_targets(profile_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Calculate nutrition targets for a specific profile (must belong to current user)."""
    profile = get_user_profile_or_404(db, profile_id, current_user)

    targets = calculate_targets(profile)
    return NutritionTargetsResponse(**targets)


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


@router.get("/{profile_id}/joint-members", response_model=List[JointProfileMemberResponse])
def get_joint_members(profile_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Return the member list for a joint profile (must belong to current user)."""
    profile = get_user_profile_or_404(db, profile_id, current_user)
    if not profile.is_joint:
        raise HTTPException(status_code=400, detail="Profile is not a joint profile.")

    assocs = db.query(JointProfileMember).filter(
        JointProfileMember.joint_profile_id == profile_id
    ).all()

    member_ids = [a.member_profile_id for a in assocs]
    members = db.query(UserProfile).filter(UserProfile.id.in_(member_ids)).all()
    member_map = {m.id: m for m in members}

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


@router.get("/{profile_id}/member-nutrition-targets", response_model=List[MemberNutritionTargetsResponse])
def get_member_nutrition_targets(profile_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Calculate per-member nutrition targets with share ratios for a joint profile."""
    profile = get_user_profile_or_404(db, profile_id, current_user)
    if not profile.is_joint:
        raise HTTPException(status_code=400, detail="Profile is not a joint profile.")

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
