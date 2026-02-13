"""
Prompts package for AI meal generation.

Contains system prompts and JSON schemas for OpenAI GPT-4o integration.
"""

from .meal_plan_system import (
    SYSTEM_PROMPT,
    MEAL_PLAN_JSON_SCHEMA,
    build_user_prompt
)

from .swap_meal import (
    SWAP_MEAL_JSON_SCHEMA,
    build_swap_prompt
)

__all__ = [
    "SYSTEM_PROMPT",
    "MEAL_PLAN_JSON_SCHEMA",
    "build_user_prompt",
    "SWAP_MEAL_JSON_SCHEMA",
    "build_swap_prompt"
]
