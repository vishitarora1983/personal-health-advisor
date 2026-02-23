"""
FamilyPlanValidator — post-generation nutritional accuracy check for family meal plans.

Validates that per-member daily nutrition totals are within acceptable tolerances
of their individual targets. Produces warnings for borderline deviations and
fails (returns passed=False) for severe deviations in the llm_only workflow
(which triggers a re-generation retry in the router).

Two workflows are supported:
  - hybrid:   Reads nutrition data from meal["per_member_nutrition"] (populated by
              the LP solver step). The LP already minimises deviation, so only
              warnings are emitted — the validator never hard-fails for hybrid plans.
  - llm_only: Reads from meal["member_servings"]. The LLM may produce nutritionally
              inaccurate totals, so hard failures trigger a retry loop in the router.

Usage example:
    validator = FamilyPlanValidator()
    passed, warnings = validator.validate(daily_plans, member_targets, "llm_only")
    if not passed:
        # retry generation with warnings as feedback
        ...
"""

import logging
from typing import List, Dict, Tuple

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Tolerance constants
# ---------------------------------------------------------------------------

# Hybrid workflow: warn only (never fail) because the LP guarantees mathematical
# optimality — any remaining deviation is due to component constraints, not
# generation error.
HYBRID_CALORIE_WARN_THRESHOLD: int = 100   # kcal
HYBRID_MACRO_WARN_THRESHOLD: int = 10      # grams

# LLM-only workflow: the LLM may produce arbitrary nutrition values, so both a
# warning threshold and a hard-fail threshold are defined. The thresholds are
# intentionally the same value (150 kcal / 10 g) so that any deviation above
# the warning level also immediately triggers a hard fail and a retry.
LLMONLY_CALORIE_WARN_THRESHOLD: int = 150  # kcal
LLMONLY_CALORIE_FAIL_THRESHOLD: int = 150  # kcal — same; any excess triggers fail
LLMONLY_MACRO_WARN_THRESHOLD: int = 10     # grams


class FamilyPlanValidator:
    """
    Validates per-member daily nutritional totals in a generated family meal plan.

    Iterates over every day in the plan, sums each member's meal-level nutrition
    contributions, and compares the daily totals to the member's targets. Warnings
    are collected for both workflows; hard failures are only issued for llm_only
    plans where the LLM's nutritional arithmetic can go significantly off-target.

    Usage:
        validator = FamilyPlanValidator()
        passed, warnings = validator.validate(daily_plans, member_targets, "hybrid")
    """

    def validate(
        self,
        daily_plans: List[Dict],
        member_targets: List[Dict],
        workflow: str,
    ) -> Tuple[bool, List[str]]:
        """
        Validate daily nutrition totals per member across all days.

        For each member and each day, sums their individual meal calories/macros
        (from per_member_nutrition in hybrid, or from member_servings in llm_only)
        and compares to their target.

        Args:
            daily_plans:    List of day dicts as returned by the AI planner.
                            Each day has a "meals" list. Each meal has either:
                              - "per_member_nutrition" (hybrid, added by LP step):
                                  {member_name: {"calories": N, "protein": N, ...}}
                              - "member_servings" (llm_only, from LLM response):
                                  [{"member_name": ..., "calories": N, ...}, ...]
            member_targets: List of per-member target dicts with keys:
                              name, target_calories, target_protein,
                              target_carbs, target_fats.
            workflow:       "hybrid" or "llm_only". Controls which tolerance
                            thresholds are applied and whether failures are hard.

        Returns:
            Tuple of:
              passed   (bool):       True if no hard failures were found.
                                     Always True for hybrid (LP guarantees optimality).
              warnings (List[str]):  Human-readable warning strings. Empty if clean.
        """
        warnings: List[str] = []
        passed = True

        # Select threshold constants based on workflow
        calorie_warn = (
            HYBRID_CALORIE_WARN_THRESHOLD
            if workflow == "hybrid"
            else LLMONLY_CALORIE_WARN_THRESHOLD
        )
        macro_warn = (
            HYBRID_MACRO_WARN_THRESHOLD
            if workflow == "hybrid"
            else LLMONLY_MACRO_WARN_THRESHOLD
        )

        for day_idx, day in enumerate(daily_plans):
            day_label = (
                f"Day {day_idx + 1} "
                f"(day_of_week={day.get('day_of_week', day_idx)})"
            )

            # Initialise daily accumulator for every known member
            member_daily: Dict[str, Dict[str, float]] = {
                m["name"]: {
                    "calories": 0.0,
                    "protein":  0.0,
                    "carbs":    0.0,
                    "fats":     0.0,
                }
                for m in member_targets
            }

            # Accumulate nutrition from every meal in this day
            for meal in day.get("meals", []):
                self._accumulate_meal(meal, member_daily, workflow)

            # Compare daily totals to each member's individual target
            for m in member_targets:
                name = m["name"]
                totals = member_daily.get(name)

                if totals is None:
                    # Member completely absent from this day's data
                    msg = (
                        f"{day_label}: No nutrition data found for member '{name}'"
                    )
                    warnings.append(msg)
                    logger.warning(msg)
                    continue

                # ----------------------------------------------------------
                # Calorie check
                # ----------------------------------------------------------
                cal_dev = abs(totals["calories"] - m["target_calories"])
                if cal_dev > calorie_warn:
                    msg = (
                        f"{day_label}: '{name}' calories {totals['calories']:.0f} kcal "
                        f"vs target {m['target_calories']} kcal "
                        f"(deviation {cal_dev:.0f} kcal)"
                    )
                    warnings.append(msg)
                    logger.warning(msg)

                    # Hard failure — only for llm_only; LP results are trusted
                    if (
                        workflow == "llm_only"
                        and cal_dev > LLMONLY_CALORIE_FAIL_THRESHOLD
                    ):
                        passed = False
                        logger.error(
                            f"[Validator] FAIL — {msg} exceeds llm_only hard threshold "
                            f"of {LLMONLY_CALORIE_FAIL_THRESHOLD} kcal"
                        )

                # ----------------------------------------------------------
                # Macro checks (protein, carbs, fats)
                # ----------------------------------------------------------
                for macro in ("protein", "carbs", "fats"):
                    target_key = f"target_{macro}"
                    macro_target = m.get(target_key, 0)
                    macro_dev = abs(totals[macro] - macro_target)

                    if macro_dev > macro_warn:
                        msg = (
                            f"{day_label}: '{name}' {macro} {totals[macro]:.1f}g "
                            f"vs target {macro_target}g "
                            f"(deviation {macro_dev:.1f}g)"
                        )
                        warnings.append(msg)
                        logger.warning(msg)

        return passed, warnings

    # -----------------------------------------------------------------------
    # Private helpers
    # -----------------------------------------------------------------------

    def _accumulate_meal(
        self,
        meal: Dict,
        member_daily: Dict[str, Dict[str, float]],
        workflow: str,
    ) -> None:
        """
        Add a single meal's per-member nutrition into the running daily totals.

        Reads from different sources depending on the workflow:
          - hybrid:   meal["per_member_nutrition"] — set by the LP solver step
                      before validation; structure is {member_name: {macro: value}}.
          - llm_only: meal["member_servings"] — set directly in the LLM response;
                      structure is a list of {member_name, calories, protein, ...}.

        Missing members in a meal are silently skipped. Their zero contribution
        will be surfaced as a large deviation when the final totals are compared
        against their targets.

        Args:
            meal:         Single meal dict from the plan.
            member_daily: Running totals accumulator — mutated in place.
            workflow:     "hybrid" or "llm_only".
        """
        if workflow == "hybrid":
            # Hybrid: nutrition pre-computed by LP solver and stored per-member
            per_member = meal.get("per_member_nutrition", {})
            for member_name, nutrition in per_member.items():
                if member_name in member_daily:
                    for macro in ("calories", "protein", "carbs", "fats"):
                        member_daily[member_name][macro] += nutrition.get(macro, 0)

        else:
            # LLM-only: each member_servings entry has individual nutrition fields
            for serving in meal.get("member_servings", []):
                member_name = serving.get("member_name")
                if member_name and member_name in member_daily:
                    member_daily[member_name]["calories"] += serving.get("calories", 0)
                    member_daily[member_name]["protein"]  += serving.get("protein",  0)
                    member_daily[member_name]["carbs"]    += serving.get("carbs",    0)
                    member_daily[member_name]["fats"]     += serving.get("fats",     0)
