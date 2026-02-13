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
from schemas.profile import (
    ProfileCreate, ProfileUpdate, ProfileResponse,
    ProfileListItem, NutritionTargetsResponse,
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
