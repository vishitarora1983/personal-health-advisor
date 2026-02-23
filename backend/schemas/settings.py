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
    Request body for PUT /settings.

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
