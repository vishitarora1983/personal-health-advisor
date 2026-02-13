"""
Profile router for multi-profile user management.

Handles profile CRUD operations and nutrition target calculations.
"""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List
import json

from database import get_db
from models.profile import UserProfile
from models.joint_profile import JointProfileMember
from schemas.profile import (
    ProfileCreate, ProfileUpdate, ProfileResponse,
    ProfileListItem, NutritionTargetsResponse,
    JointProfileCreate, JointProfileMemberResponse,
    JointProfileResponse, MemberNutritionTargetsResponse,
)
from services.nutrition_calculator import calculate_targets


router = APIRouter(prefix="/profile", tags=["Profile"])


@router.get("", response_model=List[ProfileListItem], status_code=status.HTTP_200_OK)
def list_profiles(db: Session = Depends(get_db)):
    """Return all profiles (lightweight list)."""
    profiles = db.query(UserProfile).order_by(UserProfile.created_at).all()
    return profiles


@router.get("/{profile_id}", response_model=ProfileResponse, status_code=status.HTTP_200_OK)
def get_profile(profile_id: int, db: Session = Depends(get_db)):
    """Get a single profile by ID."""
    profile = db.query(UserProfile).filter(UserProfile.id == profile_id).first()

    if not profile:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Profile with id {profile_id} not found."
        )

    return profile


@router.post("", response_model=ProfileResponse, status_code=status.HTTP_201_CREATED)
def create_profile(profile_data: ProfileCreate, db: Session = Depends(get_db)):
    """Create a new profile. Multiple profiles are allowed."""
    try:
        profile_dict = profile_data.model_dump()

        # Serialize list fields to JSON
        list_fields = ['medical_goals', 'allergies', 'cuisines', 'meals_per_day']
        for field in list_fields:
            if profile_dict.get(field) is not None:
                profile_dict[field] = json.dumps(profile_dict[field])
            else:
                profile_dict[field] = None

        new_profile = UserProfile(**profile_dict)
        db.add(new_profile)
        db.commit()
        db.refresh(new_profile)

        return new_profile

    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to create profile: {str(e)}"
        )


@router.put("/{profile_id}", response_model=ProfileResponse, status_code=status.HTTP_200_OK)
def update_profile(profile_id: int, profile_update: ProfileUpdate, db: Session = Depends(get_db)):
    """Update a specific profile by ID."""
    profile = db.query(UserProfile).filter(UserProfile.id == profile_id).first()

    if not profile:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Profile with id {profile_id} not found."
        )

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

        return profile

    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to update profile: {str(e)}"
        )


@router.delete("/{profile_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_profile(profile_id: int, db: Session = Depends(get_db)):
    """Delete a profile and cascade-delete its plans."""
    profile = db.query(UserProfile).filter(UserProfile.id == profile_id).first()

    if not profile:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Profile with id {profile_id} not found."
        )

    try:
        db.delete(profile)
        db.commit()
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to delete profile: {str(e)}"
        )


@router.get("/{profile_id}/nutrition-targets", response_model=NutritionTargetsResponse, status_code=status.HTTP_200_OK)
def get_nutrition_targets(profile_id: int, db: Session = Depends(get_db)):
    """Calculate nutrition targets for a specific profile."""
    profile = db.query(UserProfile).filter(UserProfile.id == profile_id).first()

    if not profile:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Profile with id {profile_id} not found."
        )

    targets = calculate_targets(profile)
    return NutritionTargetsResponse(**targets)


@router.post("/joint", response_model=JointProfileResponse, status_code=status.HTTP_201_CREATED)
def create_joint_profile(data: JointProfileCreate, db: Session = Depends(get_db)):
    """Create a joint profile combining multiple individual profiles."""
    # Validate primary profile exists and is not itself a joint profile
    primary = db.query(UserProfile).filter(UserProfile.id == data.primary_profile_id).first()
    if not primary:
        raise HTTPException(status_code=404, detail="Primary profile not found.")
    if primary.is_joint:
        raise HTTPException(status_code=400, detail="Primary profile cannot be a joint profile.")

    # Validate all member profiles
    all_member_ids = list(set([data.primary_profile_id] + data.member_profile_ids))
    members = db.query(UserProfile).filter(UserProfile.id.in_(all_member_ids)).all()
    found_ids = {m.id for m in members}
    missing = set(all_member_ids) - found_ids
    if missing:
        raise HTTPException(status_code=404, detail=f"Profiles not found: {missing}")
    for m in members:
        if m.is_joint:
            raise HTTPException(status_code=400, detail=f"Profile '{m.name}' is a joint profile and cannot be a member.")

    if len(all_member_ids) < 2:
        raise HTTPException(status_code=400, detail="A joint profile requires at least 2 members.")

    # Calculate summed nutrition targets from all members
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
        sum_protein += t["target_protein"]
        sum_carbs += t["target_carbs"]
        sum_fats += t["target_fats"]
        sum_fiber += t["target_fiber"]
        sum_sodium += t["target_sodium"]
        sum_sugar += t["target_sugar"]

    # Create the joint profile by copying primary's settings + summed targets
    joint = UserProfile(
        name=data.name,
        is_joint=True,
        age=primary.age,
        gender=primary.gender,
        height_cm=primary.height_cm,
        weight_kg=primary.weight_kg,
        activity_level=primary.activity_level,
        household_size=len(all_member_ids),
        weight_goal=primary.weight_goal,
        medical_goals=primary.medical_goals,
        diet_type=primary.diet_type,
        allergies=primary.allergies,
        foods_to_avoid=primary.foods_to_avoid,
        spice_tolerance=primary.spice_tolerance,
        cooking_skill=primary.cooking_skill,
        max_cook_time=primary.max_cook_time,
        cuisines=primary.cuisines,
        meals_per_day=primary.meals_per_day,
        snacks_per_day=primary.snacks_per_day,
        # Summed nutrition targets so meal plan generation covers all members
        target_calories=sum_calories,
        target_protein=sum_protein,
        target_carbs=sum_carbs,
        target_fats=sum_fats,
        target_fiber=sum_fiber,
        target_sodium=sum_sodium,
        target_sugar=sum_sugar,
    )
    db.add(joint)
    db.flush()  # Get the ID

    # Create member associations
    member_responses = []
    for mid in all_member_ids:
        is_primary = mid == data.primary_profile_id
        assoc = JointProfileMember(
            joint_profile_id=joint.id,
            member_profile_id=mid,
            is_primary=is_primary,
        )
        db.add(assoc)
        profile = next(m for m in members if m.id == mid)
        member_responses.append(JointProfileMemberResponse(
            profile_id=mid,
            profile_name=profile.name,
            is_primary=is_primary,
        ))

    db.commit()
    db.refresh(joint)

    return JointProfileResponse(
        profile=ProfileResponse.model_validate(joint),
        members=member_responses,
    )


@router.get("/{profile_id}/joint-members", response_model=List[JointProfileMemberResponse])
def get_joint_members(profile_id: int, db: Session = Depends(get_db)):
    """Return the member list for a joint profile."""
    profile = db.query(UserProfile).filter(UserProfile.id == profile_id).first()
    if not profile:
        raise HTTPException(status_code=404, detail="Profile not found.")
    if not profile.is_joint:
        raise HTTPException(status_code=400, detail="Profile is not a joint profile.")

    assocs = db.query(JointProfileMember).filter(
        JointProfileMember.joint_profile_id == profile_id
    ).all()

    member_ids = [a.member_profile_id for a in assocs]
    members = db.query(UserProfile).filter(UserProfile.id.in_(member_ids)).all()
    member_map = {m.id: m for m in members}

    return [
        JointProfileMemberResponse(
            profile_id=a.member_profile_id,
            profile_name=member_map[a.member_profile_id].name,
            is_primary=a.is_primary,
        )
        for a in assocs
        if a.member_profile_id in member_map
    ]


@router.get("/{profile_id}/member-nutrition-targets", response_model=List[MemberNutritionTargetsResponse])
def get_member_nutrition_targets(profile_id: int, db: Session = Depends(get_db)):
    """Calculate per-member nutrition targets with share ratios for a joint profile."""
    profile = db.query(UserProfile).filter(UserProfile.id == profile_id).first()
    if not profile:
        raise HTTPException(status_code=404, detail="Profile not found.")
    if not profile.is_joint:
        raise HTTPException(status_code=400, detail="Profile is not a joint profile.")

    assocs = db.query(JointProfileMember).filter(
        JointProfileMember.joint_profile_id == profile_id
    ).all()

    member_ids = [a.member_profile_id for a in assocs]
    members = db.query(UserProfile).filter(UserProfile.id.in_(member_ids)).all()
    member_map = {m.id: m for m in members}
    assoc_map = {a.member_profile_id: a.is_primary for a in assocs}

    # Calculate targets for each member
    member_targets = []
    for mid in member_ids:
        member = member_map.get(mid)
        if not member:
            continue
        targets = calculate_targets(member)
        member_targets.append((mid, member.name, assoc_map.get(mid, False), targets))

    # Calculate share ratios based on calorie targets
    total_calories = sum(t[3]["target_calories"] for t in member_targets)
    if total_calories == 0:
        total_calories = 1  # Prevent division by zero

    return [
        MemberNutritionTargetsResponse(
            profile_id=mid,
            profile_name=name,
            is_primary=is_primary,
            share_ratio=round(targets["target_calories"] / total_calories, 4),
            **targets,
        )
        for mid, name, is_primary, targets in member_targets
    ]
