"""
Post-generation content filter — deterministic scan of LLM-generated meal plans
for forbidden cuisine-specific items.

Runs AFTER the LLM produces a weekly plan or single meal, catching violations
that the probabilistic model missed despite explicit prompt instructions.

Usage:
    from services.cuisine_filter import scan_plan_for_violations, violations_to_feedback
    violations = scan_plan_for_violations(plan_data, ["indian", "punjabi"])
    if violations:
        feedback = violations_to_feedback(violations)
        # pass feedback into retry prompt
"""

import re
from dataclasses import dataclass
from typing import Dict, List, Set

from prompts.cuisine_library import get_forbidden_items, get_meal_type_restrictions


@dataclass
class ContentViolation:
    """A single forbidden-content match found in a generated plan."""
    day_of_week: int
    meal_type: str
    dish_name: str
    field_name: str
    matched_term: str
    field_value: str


def _build_regex(terms: Set[str]) -> re.Pattern | None:
    """Build a word-boundary regex alternation from a set of terms."""
    if not terms:
        return None
    escaped = [re.escape(t) for t in sorted(terms, key=len, reverse=True)]
    pattern = r"\b(?:" + "|".join(escaped) + r")\b"
    return re.compile(pattern, re.IGNORECASE)


def _scan_fields(
    meal: Dict,
    day_of_week: int,
    regex: re.Pattern,
) -> List[ContentViolation]:
    """Scan relevant text fields of a meal dict against a compiled regex."""
    violations: List[ContentViolation] = []
    meal_type = meal.get("meal_type", "unknown")
    dish_name = meal.get("dish_name", "unknown")

    # Fields to scan at the meal level
    for field_name in ("dish_name", "description", "portion_size"):
        value = meal.get(field_name, "")
        if not value or not isinstance(value, str):
            continue
        for match in regex.finditer(value):
            violations.append(ContentViolation(
                day_of_week=day_of_week,
                meal_type=meal_type,
                dish_name=dish_name,
                field_name=field_name,
                matched_term=match.group(),
                field_value=value,
            ))

    # Hybrid workflow: components[i].name
    for comp in meal.get("components", []):
        name = comp.get("name", "")
        if name and isinstance(name, str):
            for match in regex.finditer(name):
                violations.append(ContentViolation(
                    day_of_week=day_of_week,
                    meal_type=meal_type,
                    dish_name=dish_name,
                    field_name="component.name",
                    matched_term=match.group(),
                    field_value=name,
                ))

    # LLM-only workflow: member_servings[i].adjustment, portion_description
    for serving in meal.get("member_servings", []):
        for field_name in ("adjustment", "portion_description"):
            value = serving.get(field_name, "")
            if not value or not isinstance(value, str):
                continue
            member = serving.get("member_name", "?")
            for match in regex.finditer(value):
                violations.append(ContentViolation(
                    day_of_week=day_of_week,
                    meal_type=meal_type,
                    dish_name=dish_name,
                    field_name=f"member_servings.{member}.{field_name}",
                    matched_term=match.group(),
                    field_value=value,
                ))

    return violations


def scan_plan_for_violations(
    plan_data: Dict,
    selected_cuisines: List[str],
) -> List[ContentViolation]:
    """Scan a full weekly plan with two passes (global + meal-type-specific).

    Args:
        plan_data: Dict with "weekly_plan" key containing day dicts.
        selected_cuisines: User's selected cuisines.

    Returns:
        List of ContentViolation objects (empty if clean).
    """
    if not selected_cuisines:
        return []

    # Build regexes
    global_forbidden = get_forbidden_items(selected_cuisines)
    global_regex = _build_regex(global_forbidden)

    meal_restrictions = get_meal_type_restrictions(selected_cuisines)
    meal_regexes: Dict[str, re.Pattern] = {}
    for meal_type, terms in meal_restrictions.items():
        rgx = _build_regex(terms)
        if rgx:
            meal_regexes[meal_type] = rgx

    violations: List[ContentViolation] = []

    for day in plan_data.get("weekly_plan", []):
        day_of_week = day.get("day_of_week", 0)
        for meal in day.get("meals", []):
            # Pass 1: Global forbidden items — matches in ANY meal type
            if global_regex:
                violations.extend(_scan_fields(meal, day_of_week, global_regex))

            # Pass 2: Meal-type-specific restrictions
            mt = (meal.get("meal_type") or "").lower()
            if mt in meal_regexes:
                violations.extend(_scan_fields(meal, day_of_week, meal_regexes[mt]))

    return violations


def scan_single_meal_for_violations(
    meal_data: Dict,
    selected_cuisines: List[str],
    day_of_week: int = 0,
) -> List[ContentViolation]:
    """Scan a single meal dict by wrapping it in a fake weekly plan."""
    fake_plan = {
        "weekly_plan": [
            {"day_of_week": day_of_week, "meals": [meal_data]}
        ]
    }
    return scan_plan_for_violations(fake_plan, selected_cuisines)


def violations_to_feedback(violations: List[ContentViolation]) -> List[str]:
    """Convert violations to human-readable strings for LLM retry prompts."""
    feedback: List[str] = []
    for v in violations:
        feedback.append(
            f"Day {v.day_of_week} {v.meal_type} '{v.dish_name}': "
            f"found forbidden item '{v.matched_term}' in {v.field_name}. "
            f"Remove or replace this item."
        )
    return feedback
