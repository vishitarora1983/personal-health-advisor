"""
Portion Optimizer — Linear Programming solver for family meal portion allocation.

Uses PuLP (CBC solver) to find the optimal per-member portion of each meal
component, satisfying individual calorie and macro targets while respecting
minimum sharing floors and maximum sanity caps.

The LP always remains feasible by including calorie deviation variables (dev_plus,
dev_minus) in the objective function. Medical constraints (diabetes carb cap,
high-protein floor) may make the problem structurally infeasible in edge cases
that involve extreme component compositions; in those cases the solver returns
a non-optimal status and the caller falls back to the supplement path.

Dependency: pulp==2.8.0  (add to backend/requirements.txt)

Example usage for testing:

    components = [
        {"name": "Rajma",       "unit": "cup",  "cal_per_unit": 220, "protein_per_unit": 13,
         "carbs_per_unit": 35, "fats_per_unit": 8,   "fiber_per_unit": 11},
        {"name": "Brown Rice",  "unit": "cup",  "cal_per_unit": 200, "protein_per_unit": 4,
         "carbs_per_unit": 45, "fats_per_unit": 1,   "fiber_per_unit": 3},
        {"name": "Mixed Salad", "unit": "bowl", "cal_per_unit": 50,  "protein_per_unit": 2,
         "carbs_per_unit": 10, "fats_per_unit": 0.5, "fiber_per_unit": 3},
    ]

    member_targets = [
        {"name": "Dad", "target_calories": 2200, "target_protein": 165, "target_carbs": 220,
         "target_fats": 73, "medical_goals": ["diabetes_management"]},
        {"name": "Mom", "target_calories": 1700, "target_protein": 127, "target_carbs": 170,
         "target_fats": 57, "medical_goals": []},
    ]

    optimizer = PortionOptimizer()
    result = optimizer.allocate(components, member_targets, meal_type="dinner")

    # Expected (approximate):
    # result.feasible == True
    # result.allocations == {
    #     "Dad": {"Rajma": ~1.2, "Brown Rice": ~0.5, "Mixed Salad": ~2.0},
    #     "Mom": {"Rajma": ~1.0, "Brown Rice": ~1.0, "Mixed Salad": ~1.5},
    # }
    # result.per_member_nutrition == {
    #     "Dad": {"calories": ~660, "protein": ~21, "carbs": ~77, "fats": ~13, "fiber": ~21},
    #     "Mom": {"calories": ~510, "protein": ~17, "carbs": ~70, "fats": ~10, "fiber": ~16},
    # }
"""

import logging
from dataclasses import dataclass, field
from typing import Dict, List, Optional

import pulp

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

# Meal-type share of daily calorie budget (fractions must sum to 1.0 across
# a full day when breakfast + lunch + dinner + snack are all present).
MEAL_CALORIE_DISTRIBUTION: Dict[str, float] = {
    "breakfast": 0.25,
    "lunch":     0.35,
    "dinner":    0.30,
    "snack":     0.10,
}

# Hard calorie tolerance band (±15% of per-meal calorie target).
# When medical constraints (e.g., high-protein floor) conflict with soft calorie
# balance, the LP used to sacrifice calories entirely. With hard bounds the LP
# goes infeasible instead, triggering the supplement recovery path which adds a
# targeted side dish to close the gap.
CAL_TOLERANCE: float = 0.15

# Hard macro tolerance band (±25% of per-meal macro target).
# Prevents egregious macro overshoots (e.g., carbs +36%) for ALL profiles,
# not just those with medical constraints. Generous enough for LP feasibility
# with typical Indian meal components.
MACRO_TOLERANCE: float = 0.25

# Minimum units a member must take of any base component.
# Set to 0.25 to prevent degenerate zero-portion solutions while still
# allowing a very small allocation when a component is calorie-dense.
MIN_COMPONENT_UNITS: float = 0.25

# Absolute maximum units of any single component per member per meal.
# 3.0 corresponds to a triple portion — beyond this the meal becomes
# nutritionally unrealistic and the solver should instead add supplements.
MAX_COMPONENT_UNITS: float = 3.0

# Near-zero allocation threshold for filtering LP results.
# CBC solver sometimes returns tiny positive values (e.g., 1e-7) due to
# floating-point precision. Values below this are nutritionally meaningless
# and are pruned from the allocations dict to keep results clean.
NEAR_ZERO_THRESHOLD: float = 0.01


# ---------------------------------------------------------------------------
# Result dataclass
# ---------------------------------------------------------------------------

@dataclass
class PortionResult:
    """
    Output of a single PortionOptimizer.allocate() call.

    Attributes:
        feasible:             True if CBC found an optimal solution.
        allocations:          Nested dict — member name → component name → units allocated.
                              Example: {"Dad": {"Rajma": 1.0, "Brown Rice": 0.5}}
        per_member_nutrition: Nested dict — member name → macro name → computed value.
                              Example: {"Dad": {"calories": 510, "protein": 21, ...}}
        gap:                  If not feasible, describes what each member is missing.
                              Example: {"Dad": "needs 140 more cal with ≤5g additional carbs"}
                              None when feasible.
    """
    feasible: bool
    allocations: Dict[str, Dict[str, float]]
    per_member_nutrition: Dict[str, Dict[str, float]]
    gap: Optional[Dict[str, str]] = None


# ---------------------------------------------------------------------------
# Optimizer class
# ---------------------------------------------------------------------------

class PortionOptimizer:
    """
    Allocates meal component portions to family members using Linear Programming.

    The solver minimises the total weighted deviation from each member's individual
    per-meal calorie and macro targets, subject to:
      - Non-negativity of portions
      - Minimum sharing floor (each member gets at least MIN_COMPONENT_UNITS of
        every component to ensure a coherent, complete plate)
      - Maximum sanity cap (no more than MAX_COMPONENT_UNITS per component per member)
      - Universal macro bands (±MACRO_TOLERANCE on protein, carbs, fats for ALL members)
      - Optional medical constraints (stack on top of universal bands):
          diabetes_management  → carb cap at 35% of meal calories
          high_protein / muscle_building → protein floor at 30% of meal calories

    Objective weights:
      1.0 × calorie deviation  (primary driver — hits individual calorie targets)
      0.3 × protein deviation  (secondary)
      0.2 × carbs deviation
      0.2 × fats deviation
    """

    def allocate(
        self,
        components: List[Dict],
        member_targets: List[Dict],
        meal_type: str,
        meal_fraction: float = None,
        _enforce_hard_cal: bool = True,
    ) -> PortionResult:
        """
        Run the LP and return allocations.

        Hard calorie bounds (±CAL_TOLERANCE) and universal macro bands
        (±MACRO_TOLERANCE on protein/carbs/fats) prevent the LP from massively
        overshooting any target. When these hard bounds conflict with medical
        constraints, the LP goes infeasible and the caller triggers the
        supplement recovery path.

        Args:
            components:     List of component dicts. Required keys per dict:
                              name           (str)
                              unit           (str)  — for labelling only
                              cal_per_unit   (float)
                              protein_per_unit (float)
                              carbs_per_unit (float)
                              fats_per_unit  (float)
                              fiber_per_unit (float)
            member_targets: List of member target dicts. Required keys per dict:
                              name             (str)
                              target_calories  (int)
                              target_protein   (int)
                              target_carbs     (int)
                              target_fats      (int)
                              medical_goals    (List[str])
            meal_type:      One of "breakfast", "lunch", "dinner", "snack".
                            Controls the calorie fraction via MEAL_CALORIE_DISTRIBUTION.
            meal_fraction:  Pre-computed normalized fraction of daily calories for
                            this meal. When None, falls back to the raw fraction
                            from MEAL_CALORIE_DISTRIBUTION (no normalization).
            _enforce_hard_cal: When True (default), adds hard ±CAL_TOLERANCE calorie
                            bounds. Set to False for the diagnostic re-solve that
                            computes the "natural" overshoot without calorie caps.

        Returns:
            PortionResult with feasible=True if CBC converged to an optimal solution,
            else feasible=False with a gap dict describing why the LP failed.
        """
        # Use caller-provided normalized fraction, or fall back to raw lookup
        if meal_fraction is None:
            meal_fraction = MEAL_CALORIE_DISTRIBUTION.get(meal_type, 0.30)

        # Convenience name lists
        member_names = [m["name"] for m in member_targets]
        comp_names = [c["name"] for c in components]

        # Build a lookup from name → component dict for quick attribute access
        comp_map: Dict[str, Dict] = {c["name"]: c for c in components}

        # ----------------------------------------------------------------
        # Decision variables
        # ----------------------------------------------------------------

        # x[m][c] — units of component c allocated to member m (continuous, >= 0)
        x: Dict[str, Dict[str, pulp.LpVariable]] = {
            m_name: {
                c_name: pulp.LpVariable(
                    f"x_{m_name}_{c_name}".replace(" ", "_"),
                    lowBound=0,
                )
                for c_name in comp_names
            }
            for m_name in member_names
        }

        # Calorie deviation variables — allow the LP to remain always feasible.
        # dev_minus[m]: how many kcal below target this member is
        # dev_plus[m]:  how many kcal above target this member is
        dev_minus: Dict[str, pulp.LpVariable] = {
            m_name: pulp.LpVariable(f"dev_minus_{m_name}".replace(" ", "_"), lowBound=0)
            for m_name in member_names
        }
        dev_plus: Dict[str, pulp.LpVariable] = {
            m_name: pulp.LpVariable(f"dev_plus_{m_name}".replace(" ", "_"), lowBound=0)
            for m_name in member_names
        }

        # Macro deviation variables (absolute deviations from per-meal macro targets)
        protein_dev: Dict[str, pulp.LpVariable] = {
            m_name: pulp.LpVariable(f"protein_dev_{m_name}".replace(" ", "_"), lowBound=0)
            for m_name in member_names
        }
        carbs_dev: Dict[str, pulp.LpVariable] = {
            m_name: pulp.LpVariable(f"carbs_dev_{m_name}".replace(" ", "_"), lowBound=0)
            for m_name in member_names
        }
        fats_dev: Dict[str, pulp.LpVariable] = {
            m_name: pulp.LpVariable(f"fats_dev_{m_name}".replace(" ", "_"), lowBound=0)
            for m_name in member_names
        }

        # ----------------------------------------------------------------
        # Problem definition
        # ----------------------------------------------------------------

        prob = pulp.LpProblem("FamilyPortionAllocation", pulp.LpMinimize)

        # ----------------------------------------------------------------
        # Objective: minimise weighted sum of all deviations
        # ----------------------------------------------------------------

        # Primary: calorie deviation (weight 1.0 — most important target)
        # Secondary: protein, carbs, fats deviations (weights 0.3, 0.2, 0.2)
        prob += (
            1.0 * pulp.lpSum(dev_plus[m] + dev_minus[m] for m in member_names)
            + 0.3 * pulp.lpSum(protein_dev[m] for m in member_names)
            + 0.2 * pulp.lpSum(carbs_dev[m] for m in member_names)
            + 0.2 * pulp.lpSum(fats_dev[m] for m in member_names)
        ), "TotalWeightedDeviation"

        # ----------------------------------------------------------------
        # Constraints — applied once per member
        # ----------------------------------------------------------------

        for m in member_targets:
            m_name = m["name"]
            goals = m.get("medical_goals", []) or []

            # Per-meal calorie target for this member
            meal_target_cal = m["target_calories"] * meal_fraction
            meal_target_protein = m.get("target_protein", 0) * meal_fraction
            meal_target_carbs = m.get("target_carbs", 0) * meal_fraction
            meal_target_fats = m.get("target_fats", 0) * meal_fraction

            # Total calories from allocated components for this member
            member_cal = pulp.lpSum(
                x[m_name][c_name] * comp_map[c_name]["cal_per_unit"]
                for c_name in comp_names
            )
            member_protein = pulp.lpSum(
                x[m_name][c_name] * comp_map[c_name]["protein_per_unit"]
                for c_name in comp_names
            )
            member_carbs = pulp.lpSum(
                x[m_name][c_name] * comp_map[c_name]["carbs_per_unit"]
                for c_name in comp_names
            )
            member_fats = pulp.lpSum(
                x[m_name][c_name] * comp_map[c_name]["fats_per_unit"]
                for c_name in comp_names
            )

            # 1. Calorie balance with deviation variables (soft — fine-tunes within band)
            #    member_cal + dev_minus[m] - dev_plus[m] == meal_target_cal
            prob += (
                member_cal + dev_minus[m_name] - dev_plus[m_name] == meal_target_cal,
                f"CalBalance_{m_name}",
            )

            # 1b. Hard calorie bounds — prevent massive overshoot when medical
            #     constraints (e.g., protein floor) push calories way past target.
            #     When _enforce_hard_cal is False (diagnostic re-solve), these are
            #     omitted so we can observe the "natural" unconstrained solution.
            if _enforce_hard_cal:
                cal_ceiling = meal_target_cal * (1 + CAL_TOLERANCE)
                cal_floor   = meal_target_cal * (1 - CAL_TOLERANCE)
                prob += (member_cal <= cal_ceiling, f"CalCeiling_{m_name}")
                prob += (member_cal >= cal_floor,   f"CalFloor_{m_name}")

            # 2. Medical constraint — diabetes_management: carbs ≤ 35% of meal calories
            #    (4 kcal/g for carbs)
            if "diabetes_management" in goals:
                carb_cap = meal_target_cal * 0.35 / 4
                prob += (
                    member_carbs <= carb_cap,
                    f"DiabetesCarb_{m_name}",
                )
                logger.debug(
                    f"[LP] diabetes carb cap applied to '{m_name}': {carb_cap:.1f}g "
                    f"for {meal_type} (meal_target_cal={meal_target_cal:.0f})"
                )

            # 3. Medical constraint — high_protein / muscle_building: protein ≥ 30%
            #    of meal calories (4 kcal/g for protein)
            if "high_protein" in goals or "muscle_building" in goals:
                protein_floor = meal_target_cal * 0.30 / 4
                prob += (
                    member_protein >= protein_floor,
                    f"HighProtein_{m_name}",
                )
                logger.debug(
                    f"[LP] high-protein floor applied to '{m_name}': {protein_floor:.1f}g "
                    f"for {meal_type}"
                )

            # 3b. Universal macro bands — prevent egregious macro deviation
            #     for ALL members regardless of medical goals. Medical constraints
            #     above stack on top (LP satisfies the tightest bound).
            if _enforce_hard_cal:
                for macro_name, member_macro_expr, meal_macro_target in [
                    ("Protein", member_protein, meal_target_protein),
                    ("Carbs",   member_carbs,   meal_target_carbs),
                    ("Fats",    member_fats,    meal_target_fats),
                ]:
                    if meal_macro_target > 0:
                        macro_ceiling = meal_macro_target * (1 + MACRO_TOLERANCE)
                        macro_floor   = meal_macro_target * (1 - MACRO_TOLERANCE)
                        prob += (member_macro_expr <= macro_ceiling, f"{macro_name}Ceiling_{m_name}")
                        prob += (member_macro_expr >= macro_floor,   f"{macro_name}Floor_{m_name}")

            # 4. Protein deviation linearisation (absolute value)
            #    protein_actual - protein_target <=  protein_dev
            #    protein_target - protein_actual <=  protein_dev
            prob += (
                member_protein - meal_target_protein <= protein_dev[m_name],
                f"ProtDevPos_{m_name}",
            )
            prob += (
                meal_target_protein - member_protein <= protein_dev[m_name],
                f"ProtDevNeg_{m_name}",
            )

            # 5. Carbs deviation linearisation
            prob += (
                member_carbs - meal_target_carbs <= carbs_dev[m_name],
                f"CarbDevPos_{m_name}",
            )
            prob += (
                meal_target_carbs - member_carbs <= carbs_dev[m_name],
                f"CarbDevNeg_{m_name}",
            )

            # 6. Fats deviation linearisation
            prob += (
                member_fats - meal_target_fats <= fats_dev[m_name],
                f"FatDevPos_{m_name}",
            )
            prob += (
                meal_target_fats - member_fats <= fats_dev[m_name],
                f"FatDevNeg_{m_name}",
            )

            # 7. Minimum sharing floor — each member gets at least 0.25 units
            #    of every BASE component to avoid degenerate zero-portion solutions.
            #    Supplements (is_supplement=True) are excluded: their lower bound
            #    stays at 0 so the LP assigns them only to members who need them.
            for c_name in comp_names:
                if comp_map[c_name].get("is_supplement"):
                    continue
                prob += (
                    x[m_name][c_name] >= MIN_COMPONENT_UNITS,
                    f"MinFloor_{m_name}_{c_name}".replace(" ", "_"),
                )

            # 8. Sanity cap — no more than MAX_COMPONENT_UNITS per component.
            for c_name in comp_names:
                prob += (
                    x[m_name][c_name] <= MAX_COMPONENT_UNITS,
                    f"MaxCap_{m_name}_{c_name}".replace(" ", "_"),
                )

        # ----------------------------------------------------------------
        # Solve
        # ----------------------------------------------------------------

        logger.info(
            f"[PortionOptimizer] Solving LP for {len(member_names)} member(s), "
            f"{len(comp_names)} component(s), meal_type={meal_type}"
        )
        # msg=0 suppresses CBC solver output to stdout
        prob.solve(pulp.PULP_CBC_CMD(msg=0))

        # ----------------------------------------------------------------
        # Check result
        # ----------------------------------------------------------------

        if prob.status != pulp.constants.LpStatusOptimal:
            logger.warning(
                f"[PortionOptimizer] LP did not converge (status={pulp.LpStatus[prob.status]}). "
                f"{'Computing diagnostic gap' if _enforce_hard_cal else 'Relaxed LP also infeasible'}."
            )
            # Only compute the diagnostic gap from the hard-bound LP.
            # When _enforce_hard_cal is False this IS the relaxed re-solve —
            # calling _compute_diagnostic_gap again would cause infinite recursion.
            gap = (
                self._compute_diagnostic_gap(
                    components, member_targets, meal_type, meal_fraction
                )
                if _enforce_hard_cal
                else {}  # Sentinel: _compute_diagnostic_gap handles this case
            )
            return PortionResult(
                feasible=False,
                allocations={},
                per_member_nutrition={},
                gap=gap,
            )

        # ----------------------------------------------------------------
        # Extract results
        # ----------------------------------------------------------------

        allocations: Dict[str, Dict[str, float]] = {}
        per_member_nutrition: Dict[str, Dict[str, float]] = {}

        for m in member_targets:
            m_name = m["name"]
            raw_alloc = {
                c_name: round(pulp.value(x[m_name][c_name]), 3)
                for c_name in comp_names
            }
            # Filter out near-zero allocations to keep results clean.
            # Prevents entries like "0.0 cup Sprouts" from leaking into
            # adjustment descriptions and portion labels.
            allocations[m_name] = {
                c_name: units for c_name, units in raw_alloc.items()
                if units >= NEAR_ZERO_THRESHOLD
            }
            per_member_nutrition[m_name] = self._compute_nutrition(
                allocations[m_name], components
            )

        logger.info(
            f"[PortionOptimizer] LP solved successfully for {meal_type}. "
            f"Members: {member_names}"
        )

        return PortionResult(
            feasible=True,
            allocations=allocations,
            per_member_nutrition=per_member_nutrition,
        )

    # -----------------------------------------------------------------------
    # Private helpers
    # -----------------------------------------------------------------------

    def _compute_diagnostic_gap(
        self,
        components: List[Dict],
        member_targets: List[Dict],
        meal_type: str,
        meal_fraction: float = None,
    ) -> Dict[str, str]:
        """
        Compute a rich diagnostic gap description per member when the hard-bound LP
        is infeasible.

        Strategy: re-solve the LP *without* hard calorie bounds (_enforce_hard_cal=False)
        to see where the "natural" unconstrained solution lands. Then compare each
        member's actual nutrition from that relaxed solve to their per-meal targets
        and produce an actionable description for the supplement prompt.

        If the relaxed LP also fails (rare — means even medical constraints alone are
        unsatisfiable with these components), falls back to a simple heuristic estimate.

        Args:
            components:     Component list for the meal.
            member_targets: Per-member target dicts.
            meal_type:      Controls the meal calorie fraction.
            meal_fraction:  Pre-computed normalized fraction (or None for raw lookup).

        Returns:
            Dict mapping member name to a rich gap description string, e.g.:
            "Calories +977 surplus (1725 vs 748 target). Protein OK (56g vs 56g target). "
            "Active goals: muscle_building, high_protein. "
            "Recommendation: needs high-protein, low-calorie side dish (yogurt, sprouts, egg whites)"
        """
        if meal_fraction is None:
            meal_fraction = MEAL_CALORIE_DISTRIBUTION.get(meal_type, 0.30)

        # Re-solve without hard calorie bounds to observe the natural solution
        relaxed = self.allocate(
            components=components,
            member_targets=member_targets,
            meal_type=meal_type,
            meal_fraction=meal_fraction,
            _enforce_hard_cal=False,
        )

        gap: Dict[str, str] = {}

        if not relaxed.feasible:
            # Even the relaxed LP failed — fall back to heuristic estimate
            logger.warning(
                "[PortionOptimizer] Relaxed LP also infeasible — using heuristic gap."
            )
            max_achievable_cal = sum(
                MAX_COMPONENT_UNITS * c["cal_per_unit"] for c in components
            )
            for m in member_targets:
                m_name = m["name"]
                target_cal = m["target_calories"] * meal_fraction
                goals = m.get("medical_goals", []) or []
                goals_str = ", ".join(goals) if goals else "none"
                shortfall = target_cal - max_achievable_cal
                if shortfall > 0:
                    gap[m_name] = (
                        f"Calorie shortfall: needs {round(shortfall)} more kcal. "
                        f"Active goals: {goals_str}. "
                        f"Components cannot satisfy targets even at max portions."
                    )
                else:
                    gap[m_name] = (
                        f"Calories achievable but medical constraints conflict. "
                        f"Active goals: {goals_str}."
                    )
            return gap

        # Relaxed LP succeeded — compare actual vs target per member
        for m in member_targets:
            m_name = m["name"]
            goals = m.get("medical_goals", []) or []
            target_cal     = m["target_calories"] * meal_fraction
            target_protein = m.get("target_protein", 0) * meal_fraction
            target_carbs   = m.get("target_carbs", 0) * meal_fraction
            target_fats    = m.get("target_fats", 0) * meal_fraction

            actual = relaxed.per_member_nutrition.get(m_name, {})
            actual_cal     = actual.get("calories", 0)
            actual_protein = actual.get("protein", 0)
            actual_carbs   = actual.get("carbs", 0)
            actual_fats    = actual.get("fats", 0)

            # Build delta descriptions
            parts = []

            cal_delta = actual_cal - target_cal
            if cal_delta > 0:
                parts.append(
                    f"Calories +{round(cal_delta)} surplus "
                    f"({round(actual_cal)} vs {round(target_cal)} target)"
                )
            else:
                parts.append(
                    f"Calories {round(cal_delta)} deficit "
                    f"({round(actual_cal)} vs {round(target_cal)} target)"
                )

            prot_delta = actual_protein - target_protein
            if abs(prot_delta) > 5:
                sign = "+" if prot_delta > 0 else ""
                parts.append(
                    f"Protein {sign}{round(prot_delta)}g "
                    f"({round(actual_protein)}g vs {round(target_protein)}g target)"
                )
            else:
                parts.append(
                    f"Protein OK ({round(actual_protein)}g vs {round(target_protein)}g target)"
                )

            carb_delta = actual_carbs - target_carbs
            if abs(carb_delta) > 5:
                sign = "+" if carb_delta > 0 else ""
                parts.append(
                    f"Carbs {sign}{round(carb_delta)}g "
                    f"({round(actual_carbs)}g vs {round(target_carbs)}g target)"
                )

            fat_delta = actual_fats - target_fats
            if abs(fat_delta) > 5:
                sign = "+" if fat_delta > 0 else ""
                parts.append(
                    f"Fats {sign}{round(fat_delta)}g "
                    f"({round(actual_fats)}g vs {round(target_fats)}g target)"
                )

            goals_str = ", ".join(goals) if goals else "none"
            parts.append(f"Active goals: {goals_str}")

            # Actionable recommendation (describe the nutritional profile needed,
            # NOT specific dishes — the supplement prompt handles dish selection)
            if cal_delta > 50 and prot_delta < -5:
                parts.append(
                    "Recommendation: needs high-protein, low-calorie side dish"
                )
            elif cal_delta < -50 and "diabetes_management" in goals:
                carb_budget = round(target_cal * 0.35 / 4)
                parts.append(
                    f"Recommendation: needs high-calorie, low-carb side dish; "
                    f"carb budget ≤{carb_budget}g"
                )
            elif cal_delta < -50:
                parts.append(
                    "Recommendation: needs calorie-dense side dish"
                )
            elif cal_delta > 50:
                parts.append(
                    "Recommendation: needs low-calorie, nutrient-dense side dish"
                )
            else:
                parts.append(
                    "Recommendation: minor gap — light side dish should suffice"
                )

            gap[m_name] = ". ".join(parts)

        return gap

    def _compute_nutrition(
        self,
        member_allocations: Dict[str, float],
        components: List[Dict],
    ) -> Dict[str, float]:
        """
        Compute total nutrition for a member from their LP-assigned allocation.

        Multiplies each component's per-unit nutrient values by the allocated units
        and sums across all components to produce daily-meal-level macros.

        Args:
            member_allocations: {component_name: units_allocated}
            components:         Full component list (for per-unit nutrient data).

        Returns:
            Dict with keys: calories, protein, carbs, fats, fiber.
            All values are rounded to 1 decimal place.
        """
        comp_map = {c["name"]: c for c in components}
        result = {
            "calories": 0.0,
            "protein":  0.0,
            "carbs":    0.0,
            "fats":     0.0,
            "fiber":    0.0,
        }

        for comp_name, units in member_allocations.items():
            c = comp_map.get(comp_name)
            if c is None:
                # Should not happen in normal operation, but guard defensively
                logger.warning(
                    f"[PortionOptimizer] Component '{comp_name}' not found in "
                    f"component map during nutrition calculation — skipping."
                )
                continue
            result["calories"] += units * c["cal_per_unit"]
            result["protein"]  += units * c["protein_per_unit"]
            result["carbs"]    += units * c["carbs_per_unit"]
            result["fats"]     += units * c["fats_per_unit"]
            result["fiber"]    += units * c["fiber_per_unit"]

        return {k: round(v, 1) for k, v in result.items()}
