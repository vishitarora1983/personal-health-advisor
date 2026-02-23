# Phase 3: AI & Optimization Engine

**Spec document for the joint-profile redesign dev team.**
Last updated: 2026-02-22
Covers Steps 6–9 of the implementation plan.

---

## Overview

Phase 3 adds the AI and mathematical optimization layer that powers family meal plans. The work splits across two workflows that the router chooses at runtime based on `current_user.family_meal_workflow`:

| Workflow | Description | Token budget |
|---|---|---|
| `hybrid` | LLM generates component-level data; a PuLP LP solver allocates portions per member mathematically | ~16 000 tokens for plan generation |
| `llm_only` | LLM generates complete per-member servings directly in a single pass | ~24 000 tokens for plan generation |

Both workflows share the validator (Task 3.5) and the swap/single-day helpers (Task 3.4 shared methods).

---

## Task 3.1 — Family Meal Plan Prompts

**New file:** `backend/prompts/family_meal_plan.py`

This file contains four prompt strings and two dynamic builder functions. Do not import anything from other prompt files; keep this module self-contained.

```python
"""
Prompts for AI-powered FAMILY meal plan generation.

Two distinct workflows are supported:
  - Hybrid:   LLM produces component-level breakdowns; LP solver handles portion allocation.
  - LLM-only: LLM produces per-member servings directly in one pass.

Supplement and adjustment description helpers are also defined here.
"""

from typing import List, Dict, Any
```

---

### 3.1.1 `FAMILY_COMPONENTS_SYSTEM_PROMPT` (Hybrid workflow)

This is the `system` message sent to the LLM for the hybrid plan generation call. It must be a module-level string constant.

**Full prompt text the developer must implement:**

```
You are an expert nutritionist and family meal planner. Your task is to design a
7-day family meal plan expressed as BASE MEALS with PER-COMPONENT nutritional data.
A separate optimization engine will compute the exact portion allocated to each
family member; you only need to provide the nutritional density per unit.

## WHY COMPONENTS MATTER

Each dish must be broken into its constituent components (e.g., rice, dal, salad).
A linear-programming solver will later assign each family member a quantity of every
component so that their individual calorie and macro targets are met. The quality of
that allocation depends entirely on how accurately you model each component.

## OUTPUT JSON SCHEMA

Return valid JSON matching this exact structure:

{
  "weekly_plan": [
    {
      "day_of_week": 0,
      "meals": [
        {
          "meal_type": "dinner",
          "dish_name": "Rajma + Brown Rice + Salad",
          "description": "Hearty north-Indian dinner with legume protein and complex carbs.",
          "cuisine": "Indian",
          "prep_time": 35,
          "components": [
            {
              "name": "Rajma",
              "unit": "katori",
              "cal_per_unit": 220,
              "protein_per_unit": 13,
              "carbs_per_unit": 35,
              "fats_per_unit": 8,
              "fiber_per_unit": 11
            },
            {
              "name": "Brown Rice",
              "unit": "katori",
              "cal_per_unit": 200,
              "protein_per_unit": 4,
              "carbs_per_unit": 45,
              "fats_per_unit": 1,
              "fiber_per_unit": 3
            },
            {
              "name": "Mixed Salad",
              "unit": "bowl",
              "cal_per_unit": 50,
              "protein_per_unit": 2,
              "carbs_per_unit": 10,
              "fats_per_unit": 0.5,
              "fiber_per_unit": 3
            }
          ]
        }
      ]
    }
  ]
}

## COMPONENT RULES

1. QUANTITY: Each meal MUST have between 2 and 5 components. Never fewer than 2,
   never more than 5.

2. UNITS: Every component unit MUST be one of the following standard Indian/metric
   measures: katori, bowl, roti, cup, piece, glass.
   - katori  ≈ 150 ml cooked volume (standard Indian serving cup)
   - bowl    ≈ 250 ml volume
   - cup     ≈ 240 ml
   - roti    = 1 whole roti (~35 g)
   - piece   = 1 discrete piece (paratha, idli, etc.)
   - glass   = 250 ml liquid

3. NUTRITIONAL VALUES: All cal_per_unit, protein_per_unit, carbs_per_unit,
   fats_per_unit, and fiber_per_unit are PER ONE UNIT of that component.
   Use USDA nutritional database values as reference. Do NOT scale to household size.

4. NUTRITIONAL COVERAGE: The component set for each meal must collectively cover
   at least three distinct nutritional profiles:
   - A starch source   (e.g., rice, roti, bread, oats)
   - A protein source  (e.g., dal, paneer, eggs, chicken, tofu)
   - A fibre/vegetable source (e.g., salad, sabzi, cooked vegetables)

5. DIETARY COMPLIANCE: ALL household allergens listed in the user prompt MUST be
   completely absent from every component across all 7 days. The household diet_type
   restriction (vegetarian, vegan, etc.) applies to every component.

6. VARIETY: No two days of the same week should repeat an identical combination of
   dish components. Vary protein sources — do not use the same primary protein more
   than 3 times in 7 days.

7. OMIT TOTALS: Do NOT include meal-level calories, protein, carbs, fats, or fiber
   totals. The LP solver will compute per-member totals from the component data.

## QUALITY ASSURANCE

Before returning, verify:
1. Exactly 7 entries in weekly_plan (day_of_week 0 through 6).
2. Every meal has a "components" array with 2–5 entries.
3. Every component has all six numeric fields (cal_per_unit through fiber_per_unit).
4. No allergens appear in any component name.
5. prep_time is present and within the household's max_cook_time constraint.
```

---

### 3.1.2 `build_family_components_prompt(joint_profile, member_targets) -> str`

Dynamic user-message builder for the hybrid workflow.

**Signature:**

```python
def build_family_components_prompt(
    joint_profile,          # UserProfile ORM object where joint_profile.is_joint == True
    member_targets: List[Dict[str, Any]],
    # Each dict: {
    #   "name": str,
    #   "target_calories": int,
    #   "target_protein":  int,
    #   "target_carbs":    int,
    #   "target_fats":     int,
    #   "target_fiber":    int,
    #   "medical_goals":   List[str],
    #   "weight_goal":     str,   # "lose" | "maintain" | "gain"
    #   "diet_type":       str,
    # }
) -> str:
```

**What the function must include in the returned prompt string:**

1. **Household-level context block** — rendered from `joint_profile` fields:
   - `diet_type` (primary household restriction — dietary rules from this apply to ALL components)
   - `allergies_list` (MUST NEVER appear in any component)
   - `cuisines_list` (ALL meals must come from these cuisines only; if empty, allow variety)
   - `cooking_skill` ("beginner" | "intermediate" | "advanced")
   - `max_cook_time` (minutes; all prep_time values must respect this)
   - `spice_tolerance` ("mild" | "medium" | "hot")
   - `meals_per_day_list` (e.g., `["breakfast", "lunch", "dinner"]`)
   - `snacks_per_day` (integer; add this many snack meals per day)
   - `foods_to_avoid` (free text, avoid these in component names/dish names)
   - `foods_to_include` (free text, prefer these where appropriate)

2. **Per-member nutritional targets table** — rendered as a Markdown table with columns:
   `Member | Daily Calories | Protein (g) | Carbs (g) | Fats (g) | Fiber (g) | Medical Goals | Weight Goal`

   Example row: `| Dad | 2200 | 165 | 220 | 73 | 25 | diabetes_management | lose |`

3. **Meal structure reminder** — how many meals per day and their types.

4. **Final instruction** — "Generate a 7-day family component plan now. Return ONLY valid JSON."

**Implementation note:** Parse allergies and cuisines using the existing `.allergies_list` and `.cuisines_list` property helpers on the `UserProfile` model (already implemented in `backend/models/profile.py`). If a list is empty, emit the "no restriction" variant of that clause.

---

### 3.1.3 `SUPPLEMENT_PROMPT` (Hybrid workflow — infeasibility recovery)

Module-level string constant. Sent as the `system` message when the LP solver cannot find a feasible allocation and the router needs 2–3 extra components to plug the gap.

**Full prompt text:**

```
You are a clinical nutritionist adding supplementary food components to a family meal.
The meal already has a set of base components, but a linear-programming solver could
not find a feasible portion allocation for at least one family member.

Your task: propose 2–3 small, practical supplement components that help close the
nutritional gap described below, without dramatically changing the dish's character.

## SUPPLEMENT GUIDELINES

- Each supplement must follow the standard unit vocabulary:
  katori, bowl, roti, cup, piece, glass.
- Prefer high-density single-macro supplements (e.g., a side of Greek yogurt for
  protein, a slice of whole-grain bread for carbs, a small handful of nuts for fats).
- Do NOT repeat any component already listed in the base components.
- All household allergens remain off-limits.
- Return nutritional values per unit using USDA database accuracy.

## INPUT FORMAT (provided in user message)

Gap description per member:
  "Member 'Dad' needs 140 more calories with ≤5 g additional carbs"
  "Member 'Mom' is 80 kcal over target — no change needed for her"

Base components already in the meal (provided in user message as JSON array).

## OUTPUT JSON SCHEMA

{
  "supplements": [
    {
      "name": "Greek Yogurt",
      "unit": "bowl",
      "cal_per_unit": 100,
      "protein_per_unit": 17,
      "carbs_per_unit": 6,
      "fats_per_unit": 0.7,
      "fiber_per_unit": 0
    }
  ]
}

Return ONLY valid JSON. 2–3 supplement objects. No explanatory text.
```

**Corresponding user-message builder — `build_supplement_prompt`:**

```python
def build_supplement_prompt(
    base_components: List[Dict],   # existing component dicts for the meal
    gap: Dict[str, str],           # {member_name: human-readable gap description}
    joint_profile,                 # for allergy/diet_type context
) -> str:
    """
    Build the user message for the supplement call.

    Args:
        base_components: Component list already in the meal (name, unit, cal_per_unit, ...).
        gap:             Dict mapping member name to gap description string produced by
                         PortionOptimizer when the LP is infeasible.
        joint_profile:   UserProfile ORM object (joint profile).

    Returns:
        str: User message to send alongside SUPPLEMENT_PROMPT.
    """
```

The returned string must include:
- A "Gap Descriptions" section listing each `member_name: gap_text` pair.
- A "Base Components" section with the JSON array of existing components.
- A reminder of household allergens and diet_type.

---

### 3.1.4 `ADJUSTMENT_DESCRIPTION_PROMPT` (Hybrid workflow — human-readable descriptions)

Module-level string constant. Sent as the `system` message after the LP solver produces numeric allocations, to turn those numbers into natural-language meal adjustments per member.

**Full prompt text:**

```
You are a friendly nutritionist describing personalised meal adjustments to each
family member. You will receive a list of meals for one day with the exact portion
quantities allocated to each member by an optimiser.

Your task: convert the numeric allocations into a short, natural-language
adjustment description for each member per meal.

## RULES

- Write from the member's perspective ("Your portion is …").
- Use natural language: avoid raw numbers unless helpful.
  Good: "Half a katori of rice, a full serving of rajma, and an extra bowl of salad."
  Bad:  "rice=0.5, rajma=1.0, salad=2.0"
- Where a member's allocation differs significantly from a "standard" serving,
  note it: "extra salad", "half the usual rice", "double protein".
- Keep each description to 1–2 sentences maximum.
- Do NOT mention calories or grams explicitly; this text is displayed to users.

## OUTPUT JSON SCHEMA

{
  "adjustments": {
    "MealType_DishName": {
      "MemberName": "Full portion of rajma, half rice, extra salad to meet your low-carb targets.",
      "AnotherMember": "Standard portions across the board — everything balanced for your goal."
    }
  }
}

The key format for each meal is "{meal_type}_{dish_name}" with spaces replaced by
underscores and all lowercase. Example: "dinner_rajma_brown_rice_salad".

Return ONLY valid JSON.
```

**Corresponding user-message builder — `build_adjustment_description_prompt`:**

```python
def build_adjustment_description_prompt(
    meals_with_allocations: List[Dict],
    # Each dict has:
    # {
    #   "meal_type": str,
    #   "dish_name": str,
    #   "components": [...],
    #   "allocations": {
    #       "Dad": {"Rajma": 1.0, "Brown Rice": 0.5, "Mixed Salad": 2.0},
    #       "Mom": {"Rajma": 1.0, "Brown Rice": 0.0, "Mixed Salad": 1.0}
    #   }
    # }
    member_targets: List[Dict],    # for context (name, weight_goal, medical_goals)
) -> str:
    """
    Build the user message for the adjustment description call.

    Args:
        meals_with_allocations: List of meals that have LP allocations attached.
                                Only meals where "allocations" key is present should
                                be included.
        member_targets:         Per-member target metadata for brief context.

    Returns:
        str: User message listing all allocations, formatted as a readable table.
    """
```

The returned string must format each meal's allocations as:
```
Meal: dinner — Rajma + Brown Rice + Salad
  Dad: Rajma 1.0 katori, Brown Rice 0.5 katori, Mixed Salad 2.0 bowls
  Mom: Rajma 1.0 katori, Brown Rice 0.0 katori, Mixed Salad 1.0 bowl
```

---

### 3.1.5 `FAMILY_DIRECT_SYSTEM_PROMPT` (LLM-only workflow)

Module-level string constant. Used when `workflow == "llm_only"`. The LLM must produce per-member servings directly, without a separate LP step.

**Full prompt text the developer must implement:**

```
You are an expert nutritionist and family meal planner. Generate a complete 7-day
meal plan for a household with multiple members. For EVERY meal, provide individual
portion instructions for EVERY household member.

## OUTPUT JSON SCHEMA

{
  "weekly_plan": [
    {
      "day_of_week": 0,
      "meals": [
        {
          "meal_type": "dinner",
          "dish_name": "Rajma + Brown Rice + Salad",
          "description": "Hearty north-Indian dinner.",
          "cuisine": "Indian",
          "prep_time": 35,
          "portion_size": "4 katori rajma, 4 katori rice, 4 bowls salad",
          "calories": 2100,
          "protein": 78,
          "carbs": 310,
          "fats": 42,
          "fiber": 38,
          "member_servings": [
            {
              "member_name": "Dad",
              "adjustment": "Half rice, extra salad, add cucumber raita",
              "portion_description": "1 katori rajma, 0.5 katori rice, 2 bowls salad, 1 bowl raita",
              "calories": 520,
              "protein": 22,
              "carbs": 65,
              "fats": 12,
              "fiber": 14
            },
            {
              "member_name": "Mom",
              "adjustment": "No rice, extra veggies, 1 roti instead",
              "portion_description": "1 katori rajma, 1 roti, 1 bowl salad, 1 bowl sautéed veggies",
              "calories": 480,
              "protein": 20,
              "carbs": 58,
              "fats": 10,
              "fiber": 12
            }
          ]
        }
      ]
    }
  ]
}

## FIELD DEFINITIONS

meal-level fields:
  portion_size       — TOTAL household quantity (all members combined), expressed in
                       natural units with gram weight, e.g., "4 katori rajma (600g),
                       4 katori rice (800g)". NEVER use "1 serving".
  calories/protein/carbs/fats/fiber — TOTAL for ALL members combined.

member_servings fields (one entry per household member — NEVER skip a member):
  member_name        — must exactly match the name provided in the user prompt.
  adjustment         — concise natural-language description of what differs from a
                       standard equal share (e.g., "Half rice, extra salad").
                       Write "Standard portions" if no adjustment is needed.
  portion_description — exact units and quantities for this member's plate.
  calories/protein/carbs/fats/fiber — for THIS member's serving only.
                       The sum across all member_servings must equal (within ±5%)
                       the meal-level totals.

## NUTRITIONAL ACCURACY RULES

1. Each member's daily total across all meals must be within ±150 kcal of their
   individual target_calories.
2. Each member's daily protein must be within ±15 g of their target_protein.
3. Each member's daily carbs must be within ±20 g of their target_carbs.
4. Each member's daily fats must be within ±10 g of their target_fats.
5. ALL household allergens are completely forbidden from every meal and adjustment.
6. The household diet_type applies to ALL members and ALL meals.
7. Member-level medical goals (diabetes_management, high_protein, etc.) must be
   reflected in their individual portion_description and adjustment.

## MEAL DISTRIBUTION
  breakfast: 25% of member's daily calories
  lunch:     35% of member's daily calories
  dinner:    30% of member's daily calories
  snack:     10% of member's daily calories (per snack)

## QUALITY ASSURANCE

Before returning, verify:
1. Exactly 7 entries in weekly_plan (day_of_week 0–6).
2. EVERY meal has member_servings with ONE entry per household member — no omissions.
3. Sum of member calories ≈ meal-level calories (±5%).
4. Allergens absent from all portion_description and adjustment text.
5. prep_time ≤ household max_cook_time (unless advanced cooking skill).
6. portion_size at meal level uses explicit quantities with gram weights.
```

---

### 3.1.6 `build_family_direct_prompt(joint_profile, member_targets) -> str`

Dynamic user-message builder for the LLM-only workflow.

**Signature:**

```python
def build_family_direct_prompt(
    joint_profile,
    member_targets: List[Dict[str, Any]],
) -> str:
```

The function must include identical household-level context and per-member table as `build_family_components_prompt` (see 3.1.2). The only difference is the closing instruction, which must read:

> "Generate a complete 7-day family meal plan now. Every meal must include a `member_servings` array with exactly {N} entries (one per member listed above). Return ONLY valid JSON."

Where `{N}` is `len(member_targets)`.

**Optional feedback parameter for retry calls** (used by the LLM-only validation loop):

```python
def build_family_direct_prompt(
    joint_profile,
    member_targets: List[Dict[str, Any]],
    feedback: List[str] = None,   # validator warning strings from previous attempt
) -> str:
```

When `feedback` is provided and non-empty, append a section at the end:

```
## CORRECTIONS REQUIRED (from previous attempt — fix these)

{each warning on its own bullet line}

Regenerate the complete 7-day plan addressing all corrections above.
```

---

## Task 3.2 — Family Swap Meal Prompt

**New file:** `backend/prompts/family_swap_meal.py`

This file contains the system prompt and user-message builder for swapping a single meal in a family plan. It branches on workflow type.

```python
"""
Prompts for swapping a single meal in a family (joint profile) meal plan.

Branches on workflow:
  - hybrid:    returns components (same schema as FAMILY_COMPONENTS_SYSTEM_PROMPT
               but for a single meal).
  - llm_only:  returns member_servings directly.
"""

from typing import List, Dict, Any, Optional
```

### 3.2.1 `FAMILY_SWAP_COMPONENTS_SYSTEM_PROMPT`

Same component rules and unit vocabulary as `FAMILY_COMPONENTS_SYSTEM_PROMPT` but scoped to a single meal.

**Output schema (hybrid):**

```json
{
  "meal": {
    "meal_type": "dinner",
    "dish_name": "Dal Makhani + Jeera Rice + Cucumber Raita",
    "description": "...",
    "cuisine": "Indian",
    "prep_time": 30,
    "components": [
      {"name": "Dal Makhani", "unit": "katori", "cal_per_unit": 250, "protein_per_unit": 11,
       "carbs_per_unit": 32, "fats_per_unit": 10, "fiber_per_unit": 8},
      {"name": "Jeera Rice",  "unit": "katori", "cal_per_unit": 190, "protein_per_unit": 3,
       "carbs_per_unit": 42, "fats_per_unit": 2,  "fiber_per_unit": 1},
      {"name": "Cucumber Raita", "unit": "bowl", "cal_per_unit": 80, "protein_per_unit": 5,
       "carbs_per_unit": 8,  "fats_per_unit": 3,  "fiber_per_unit": 1}
    ]
  }
}
```

### 3.2.2 `FAMILY_SWAP_DIRECT_SYSTEM_PROMPT`

Same per-member servings rules as `FAMILY_DIRECT_SYSTEM_PROMPT` but scoped to a single meal.

**Output schema (llm_only):**

```json
{
  "meal": {
    "meal_type": "dinner",
    "dish_name": "Dal Makhani + Jeera Rice + Cucumber Raita",
    "description": "...",
    "cuisine": "Indian",
    "prep_time": 30,
    "portion_size": "3 katori dal, 3 katori rice, 3 bowls raita",
    "calories": 1560,
    "protein": 57,
    "carbs": 246,
    "fats": 45,
    "fiber": 30,
    "member_servings": [
      {
        "member_name": "Dad",
        "adjustment": "Extra dal, half rice",
        "portion_description": "1.5 katori dal makhani, 0.5 katori jeera rice, 1 bowl raita",
        "calories": 580,
        "protein": 22,
        "carbs": 70,
        "fats": 18,
        "fiber": 11
      }
    ]
  }
}
```

### 3.2.3 `build_family_swap_prompt(meal, day_meals, joint_profile, member_targets, workflow, reason) -> str`

```python
def build_family_swap_prompt(
    meal: Dict[str, Any],            # ORM meal dict (meal_type, dish_name, calories, ...)
    day_meals: List[Dict[str, Any]], # other meals on the same day (to avoid duplication)
    joint_profile,                   # UserProfile ORM object
    member_targets: List[Dict],      # same format as in build_family_components_prompt
    workflow: str,                   # "hybrid" | "llm_only"
    reason: Optional[str] = None,    # optional user-supplied reason for the swap
) -> str:
    """
    Build the user message for a family meal swap.

    The system prompt is chosen by the caller based on workflow:
      hybrid   → FAMILY_SWAP_COMPONENTS_SYSTEM_PROMPT
      llm_only → FAMILY_SWAP_DIRECT_SYSTEM_PROMPT

    Args:
        meal:           The meal being replaced (from _verify_meal_ownership result,
                        serialised to dict).
        day_meals:      All other meals for the same day (to avoid duplication).
        joint_profile:  Joint UserProfile ORM object.
        member_targets: Per-member nutrition target dicts.
        workflow:       Controls what the LLM must output.
        reason:         Optional reason for the swap (shown verbatim to the LLM).

    Returns:
        str: User message.
    """
```

The returned prompt must include:
1. **Meal being replaced** — meal_type, dish_name, cuisine, existing calories/macros.
2. **Other meals today** — dish names to avoid duplication.
3. **Swap reason** (if provided) — "User reason: {reason}. Honor this preference while meeting nutritional targets."
4. **Household constraints** — diet_type, allergies, cuisines, max_cook_time.
5. **Per-member targets table** — identical to other builders.
6. **Workflow-specific output instruction**:
   - hybrid: "Return a single `meal` object with a `components` array."
   - llm_only: "Return a single `meal` object with a `member_servings` array containing exactly {N} entries."

---

## Task 3.3 — Portion Optimizer (LP with PuLP)

**New file:** `backend/services/portion_optimizer.py`
**New dependency:** add `pulp==2.8.0` to `backend/requirements.txt` (pin the version for reproducibility).

### 3.3.1 Complete module skeleton

```python
"""
Portion Optimizer — Linear Programming solver for family meal portion allocation.

Uses PuLP (CBC solver) to find the optimal per-member portion of each meal
component, satisfying individual calorie and macro targets while respecting
minimum sharing floors and maximum sanity caps.

Dependency: pulp==2.8.0  (add to backend/requirements.txt)
"""

import logging
from dataclasses import dataclass, field
from typing import Dict, List, Optional

import pulp

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

# Meal-type share of daily calorie budget (must sum to 1.0 across a full day)
MEAL_CALORIE_DISTRIBUTION: Dict[str, float] = {
    "breakfast": 0.25,
    "lunch":     0.35,
    "dinner":    0.30,
    "snack":     0.10,
}

# Minimum units a member must take of any base component (prevents zero-portion edge cases)
MIN_COMPONENT_UNITS: float = 0.25

# Absolute maximum units of any single component per member per meal
MAX_COMPONENT_UNITS: float = 3.0

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
```

### 3.3.2 Complete LP formulation

```python
class PortionOptimizer:
    """
    Allocates meal component portions to family members using Linear Programming.

    The solver minimises the total deviation from each member's individual
    per-meal calorie and macro targets, subject to:
      - Non-negativity of portions
      - Minimum sharing floor (each member gets at least 0.25 units of every component)
      - Maximum sanity cap (no more than 3.0 units per component per member)
      - Optional medical constraints (diabetes carb cap, high-protein floor)
    """

    def allocate(
        self,
        components: List[Dict],
        member_targets: List[Dict],
        meal_type: str,
    ) -> PortionResult:
        """
        Run the LP and return allocations.

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

        Returns:
            PortionResult with feasible=True if CBC converged, else feasible=False
            with gap information.
        """
```

**Decision variables:**

```
x[m][c]         >= 0   # units of component c allocated to member m
dev_minus[m]    >= 0   # calorie shortfall for member m (under target)
dev_plus[m]     >= 0   # calorie surplus  for member m (over target)
protein_dev[m]  >= 0   # absolute protein deviation for member m
carbs_dev[m]    >= 0   # absolute carbs deviation for member m
fats_dev[m]     >= 0   # absolute fats deviation for member m
```

**Per-member meal calorie target:**

```
meal_target_cal[m] = member_targets[m]["target_calories"]
                     * MEAL_CALORIE_DISTRIBUTION[meal_type]
```

**Constraints per member `m`:**

1. **Calorie balance with deviation variables**
   ```
   sum(x[m][c] * cal_per_unit[c] for c in components)
       + dev_minus[m] - dev_plus[m]  ==  meal_target_cal[m]
   ```
   This makes the LP always feasible by allowing deviation; the objective penalises it.

2. **Medical goal — diabetes_management** (apply if `"diabetes_management"` is in `member_targets[m]["medical_goals"]`):
   ```
   sum(x[m][c] * carbs_per_unit[c] for c in components)
       <=  meal_target_cal[m] * 0.35 / 4
   ```
   Rationale: limits carbs to ≤35% of meal calories (4 kcal/g for carbs).

3. **Medical goal — high_protein or muscle_building** (apply if either string is in `medical_goals`):
   ```
   sum(x[m][c] * protein_per_unit[c] for c in components)
       >=  meal_target_cal[m] * 0.30 / 4
   ```
   Rationale: at least 30% of meal calories from protein (4 kcal/g).

4. **Minimum sharing floor** (for every component `c`):
   ```
   x[m][c]  >=  MIN_COMPONENT_UNITS   (= 0.25)
   ```

5. **Sanity cap** (for every component `c`):
   ```
   x[m][c]  <=  MAX_COMPONENT_UNITS   (= 3.0)
   ```

6. **Protein deviation linearisation:**
   Let `protein_actual[m] = sum(x[m][c] * protein_per_unit[c] for c)`.
   Let `protein_target_meal[m] = member_targets[m]["target_protein"] * MEAL_CALORIE_DISTRIBUTION[meal_type]`.
   Add two constraints:
   ```
   protein_actual[m] - protein_target_meal[m]  <=  protein_dev[m]
   protein_target_meal[m] - protein_actual[m]  <=  protein_dev[m]
   ```
   (Standard absolute-value linearisation for minimisation.)

   Apply the same pattern for `carbs_dev[m]` and `fats_dev[m]`.

**Objective (minimise):**

```
Minimize:
    1.0 * sum(dev_plus[m] + dev_minus[m] for m in members)   # calorie deviation
  + 0.3 * sum(protein_dev[m] for m in members)               # protein deviation
  + 0.2 * sum(carbs_dev[m] for m in members)                 # carbs deviation
  + 0.2 * sum(fats_dev[m] for m in members)                  # fats deviation
```

**PuLP invocation:**

```python
prob = pulp.LpProblem("FamilyPortionAllocation", pulp.LpMinimize)
# ... add variables, constraints, objective ...
prob.solve(pulp.PULP_CBC_CMD(msg=0))  # msg=0 suppresses CBC output to stdout
```

**Feasibility check and PortionResult construction:**

```python
if prob.status != pulp.constants.LpStatusOptimal:
    # Compute gap dict by running a relaxed LP or by simple arithmetic:
    # For each member m, find how many calories the unconstrained optimum
    # would require vs. what the existing components can provide.
    gap = self._compute_gap(components, member_targets, meal_type)
    return PortionResult(
        feasible=False,
        allocations={},
        per_member_nutrition={},
        gap=gap,
    )

# Extract allocations
allocations = {}
per_member_nutrition = {}
for m in member_targets:
    name = m["name"]
    allocations[name] = {
        c["name"]: round(pulp.value(x[name][c["name"]]), 3)
        for c in components
    }
    per_member_nutrition[name] = self._compute_nutrition(
        allocations[name], components
    )

return PortionResult(feasible=True, allocations=allocations,
                     per_member_nutrition=per_member_nutrition)
```

### 3.3.3 `_compute_gap` helper

```python
def _compute_gap(
    self,
    components: List[Dict],
    member_targets: List[Dict],
    meal_type: str,
) -> Dict[str, str]:
    """
    Compute a human-readable gap description per member when the LP is infeasible.

    For each member, estimate the maximum achievable calories from the current
    component set (sum of MAX_COMPONENT_UNITS * cal_per_unit for all components)
    and compare to the meal calorie target.

    Returns:
        Dict mapping member name to a gap description string such as:
        "needs 140 more cal with ≤5g additional carbs"
        "10 kcal over target — no supplement needed"
    """
    gap: Dict[str, str] = {}
    max_achievable_cal = sum(
        MAX_COMPONENT_UNITS * c["cal_per_unit"] for c in components
    )
    max_achievable_protein = sum(
        MAX_COMPONENT_UNITS * c["protein_per_unit"] for c in components
    )
    for m in member_targets:
        name = m["name"]
        target = m["target_calories"] * MEAL_CALORIE_DISTRIBUTION[meal_type]
        shortfall_cal = target - max_achievable_cal
        if shortfall_cal > 0:
            # Estimate carb headroom using diabetes constraint if present
            if "diabetes_management" in m.get("medical_goals", []):
                carb_budget = target * 0.35 / 4
                gap[name] = (
                    f"needs {round(shortfall_cal)} more cal with "
                    f"≤{round(carb_budget)}g additional carbs"
                )
            else:
                gap[name] = f"needs {round(shortfall_cal)} more cal"
        else:
            gap[name] = f"{round(abs(shortfall_cal))} kcal over target — no supplement needed"
    return gap
```

### 3.3.4 `_compute_nutrition` helper

```python
def _compute_nutrition(
    self,
    member_allocations: Dict[str, float],  # {component_name: units}
    components: List[Dict],
) -> Dict[str, float]:
    """
    Compute total nutrition for a member from their allocation.

    Returns dict with keys: calories, protein, carbs, fats, fiber.
    All values rounded to 1 decimal place.
    """
    comp_map = {c["name"]: c for c in components}
    result = {"calories": 0.0, "protein": 0.0, "carbs": 0.0, "fats": 0.0, "fiber": 0.0}
    for comp_name, units in member_allocations.items():
        c = comp_map[comp_name]
        result["calories"] += units * c["cal_per_unit"]
        result["protein"]  += units * c["protein_per_unit"]
        result["carbs"]    += units * c["carbs_per_unit"]
        result["fats"]     += units * c["fats_per_unit"]
        result["fiber"]    += units * c["fiber_per_unit"]
    return {k: round(v, 1) for k, v in result.items()}
```

### 3.3.5 Working end-to-end example (include as module docstring or comment block)

```python
# Example usage for testing:
#
# components = [
#     {"name": "Rajma",       "unit": "katori", "cal_per_unit": 220, "protein_per_unit": 13,
#      "carbs_per_unit": 35, "fats_per_unit": 8,   "fiber_per_unit": 11},
#     {"name": "Brown Rice",  "unit": "katori", "cal_per_unit": 200, "protein_per_unit": 4,
#      "carbs_per_unit": 45, "fats_per_unit": 1,   "fiber_per_unit": 3},
#     {"name": "Mixed Salad", "unit": "bowl",   "cal_per_unit": 50,  "protein_per_unit": 2,
#      "carbs_per_unit": 10, "fats_per_unit": 0.5, "fiber_per_unit": 3},
# ]
#
# member_targets = [
#     {"name": "Dad", "target_calories": 2200, "target_protein": 165, "target_carbs": 220,
#      "target_fats": 73, "medical_goals": ["diabetes_management"]},
#     {"name": "Mom", "target_calories": 1700, "target_protein": 127, "target_carbs": 170,
#      "target_fats": 57, "medical_goals": []},
# ]
#
# optimizer = PortionOptimizer()
# result = optimizer.allocate(components, member_targets, meal_type="dinner")
#
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
```

---

## Task 3.4 — AI Meal Planner Service Changes

**File to modify:** `backend/services/ai_meal_planner.py`

The existing `AIMealPlanner` class gains six new async methods. The class constructor and the `_chat`, `_strip_code_fences`, existing `generate_meal_plan`, `swap_meal`, `generate_single_day`, `generate_recipe`, `estimate_nutrition`, and `analyze_custom_meal` methods are UNCHANGED.

Import additions at the top of the file:

```python
from prompts.family_meal_plan import (
    FAMILY_COMPONENTS_SYSTEM_PROMPT,
    build_family_components_prompt,
    build_supplement_prompt,
    build_adjustment_description_prompt,
    FAMILY_DIRECT_SYSTEM_PROMPT,
    build_family_direct_prompt,
)
from prompts.family_swap_meal import (
    FAMILY_SWAP_COMPONENTS_SYSTEM_PROMPT,
    FAMILY_SWAP_DIRECT_SYSTEM_PROMPT,
    build_family_swap_prompt,
)
```

---

### 3.4.1 `generate_family_components` (Hybrid workflow)

```python
async def generate_family_components(
    self,
    profile,                       # UserProfile ORM object (joint profile)
    member_targets: List[Dict],    # per-member target dicts
) -> Dict:
    """
    Generate a 7-day family meal plan with per-component nutritional breakdowns.

    Called exclusively by the hybrid workflow path in the meal_plan router.
    The LP solver (PortionOptimizer) will subsequently allocate component portions
    to each member — this method is only responsible for the component structure.

    Args:
        profile:        Joint UserProfile (is_joint == True).
        member_targets: List of per-member target dicts as defined in Task 3.1.2.

    Returns:
        Dict with "weekly_plan" key containing 7 day dicts, each with "meals" array
        where every meal has a "components" array.

    Raises:
        Exception: After self.max_retries failed attempts or JSON parse errors.
    """
    user_prompt = build_family_components_prompt(profile, member_targets)
    logger.info(f"[Family Components] Generating 7-day component plan for joint profile {profile.id}")

    last_error = None
    for attempt in range(1, self.max_retries + 1):
        try:
            logger.info(f"[Family Components] Attempt {attempt}/{self.max_retries}")
            response_text = await self._chat(
                system_content=FAMILY_COMPONENTS_SYSTEM_PROMPT,
                user_content=user_prompt,
                temperature=self.temperature,
                max_tokens=16000,   # component data is verbose but still less than member_servings
            )
            data = json.loads(response_text)

            # Normalise key — LLM sometimes returns "days" or "meal_plan"
            weekly_plan = self._extract_weekly_plan(data)

            if len(weekly_plan) != 7:
                last_error = ValueError(f"Expected 7 days, got {len(weekly_plan)}")
                continue

            # Validate every meal has a non-empty components array
            for day in weekly_plan:
                for meal in day.get("meals", []):
                    if not meal.get("components"):
                        raise ValueError(
                            f"Meal '{meal.get('dish_name')}' missing components array"
                        )
                    if not (2 <= len(meal["components"]) <= 5):
                        raise ValueError(
                            f"Meal '{meal.get('dish_name')}' has {len(meal['components'])} "
                            f"components (must be 2–5)"
                        )

            logger.info("[Family Components] Successfully generated 7-day component plan")
            return {"weekly_plan": weekly_plan}

        except (json.JSONDecodeError, ValueError) as e:
            logger.error(f"[Family Components] Attempt {attempt} failed: {e}")
            last_error = e
            continue

    raise Exception(
        f"Failed to generate family component plan after {self.max_retries} attempts: {last_error}"
    )
```

**Private helper `_extract_weekly_plan`** (add to the class):

```python
@staticmethod
def _extract_weekly_plan(data: Dict) -> list:
    """Extract the weekly_plan list from an LLM JSON response, tolerating key variants."""
    for key in ["weekly_plan", "days", "meal_plan", "week"]:
        if key in data and isinstance(data[key], list):
            return data[key]
    if isinstance(data, list) and len(data) == 7:
        return data
    raise ValueError(f"Cannot find weekly_plan in response keys: {list(data.keys())}")
```

---

### 3.4.2 `suggest_supplements` (Hybrid workflow)

```python
async def suggest_supplements(
    self,
    components: List[Dict],   # existing base components for the meal
    gap: Dict[str, str],      # {member_name: gap description from PortionResult.gap}
    profile,                  # joint UserProfile (for allergy context)
) -> List[Dict]:
    """
    Ask the LLM for 2–3 supplement components to address an LP infeasibility gap.

    Called when PortionOptimizer.allocate() returns feasible=False. The returned
    components are appended to the meal's existing component list and the LP is
    re-run.

    Args:
        components: Existing component list for the meal.
        gap:        Dict from PortionResult.gap mapping member name to gap string.
        profile:    Joint UserProfile (used for allergy/diet_type context).

    Returns:
        List of component dicts (name, unit, cal_per_unit, protein_per_unit,
        carbs_per_unit, fats_per_unit, fiber_per_unit). 2–3 items.

    Raises:
        Exception: On JSON parse failure or missing "supplements" key.
    """
    user_prompt = build_supplement_prompt(components, gap, profile)
    logger.info(f"[Supplements] Requesting supplements for gap: {gap}")

    response_text = await self._chat(
        system_content=SUPPLEMENT_PROMPT,
        user_content=user_prompt,
        temperature=0.5,    # lower temperature for more precise nutritional output
        max_tokens=800,
    )
    data = json.loads(response_text)

    supplements = data.get("supplements", [])
    if not supplements:
        logger.warning("[Supplements] LLM returned no supplements")
        return []

    logger.info(f"[Supplements] Received {len(supplements)} supplement(s)")
    return supplements
```

---

### 3.4.3 `describe_adjustments` (Hybrid workflow)

```python
async def describe_adjustments(
    self,
    meals_with_allocations: List[Dict],   # meals that have "allocations" key populated
    member_targets: List[Dict],
) -> Dict[str, Dict[str, str]]:
    """
    Convert LP numeric allocations to human-readable per-member adjustment text.

    Called once per day after the LP has allocated portions for all meals in that
    day. Batches all meals in a single LLM call to reduce API round-trips.

    Args:
        meals_with_allocations: List of meal dicts each containing:
            meal_type, dish_name, components, allocations (nested dict).
        member_targets: Per-member target dicts (for name and medical_goals context).

    Returns:
        Nested dict: {meal_key: {member_name: adjustment_text}}
        Where meal_key = f"{meal_type}_{dish_name}".replace(" ", "_").lower()

    Raises:
        Exception: On JSON parse failure.
    """
    user_prompt = build_adjustment_description_prompt(meals_with_allocations, member_targets)
    logger.info(f"[Adjustments] Describing adjustments for {len(meals_with_allocations)} meal(s)")

    response_text = await self._chat(
        system_content=ADJUSTMENT_DESCRIPTION_PROMPT,
        user_content=user_prompt,
        temperature=0.6,
        max_tokens=1500,
    )
    data = json.loads(response_text)
    adjustments = data.get("adjustments", {})
    logger.info(f"[Adjustments] Received adjustments for {len(adjustments)} meal key(s)")
    return adjustments
```

---

### 3.4.4 `generate_family_meal_plan_direct` (LLM-only workflow)

```python
async def generate_family_meal_plan_direct(
    self,
    profile,
    member_targets: List[Dict],
    feedback: List[str] = None,   # validator warnings from a previous failed attempt
) -> Dict:
    """
    Generate a 7-day family plan with per-member servings in one LLM call.

    Called exclusively by the llm_only workflow path. Generates all 7 days
    including member_servings for every meal in a single prompt. Token budget
    is high (24 000) because each meal has N member_serving objects.

    Args:
        profile:        Joint UserProfile (is_joint == True).
        member_targets: Per-member target dicts.
        feedback:       Optional list of validator warning strings from a previous
                        attempt; passed to build_family_direct_prompt to include
                        a corrections section.

    Returns:
        Dict with "weekly_plan" key. Every meal within has a "member_servings" list
        with exactly len(member_targets) entries.

    Raises:
        Exception: After self.max_retries failed attempts.
    """
    user_prompt = build_family_direct_prompt(profile, member_targets, feedback=feedback)
    logger.info(
        f"[Family Direct] Generating 7-day direct plan for joint profile {profile.id}"
        + (" (with feedback)" if feedback else "")
    )

    last_error = None
    for attempt in range(1, self.max_retries + 1):
        try:
            logger.info(f"[Family Direct] Attempt {attempt}/{self.max_retries}")
            response_text = await self._chat(
                system_content=FAMILY_DIRECT_SYSTEM_PROMPT,
                user_content=user_prompt,
                temperature=self.temperature,
                max_tokens=24000,   # member_servings doubles output vs component plan
            )
            data = json.loads(response_text)
            weekly_plan = self._extract_weekly_plan(data)

            if len(weekly_plan) != 7:
                last_error = ValueError(f"Expected 7 days, got {len(weekly_plan)}")
                continue

            expected_member_count = len(member_targets)
            member_names = {m["name"] for m in member_targets}

            for day in weekly_plan:
                for meal in day.get("meals", []):
                    servings = meal.get("member_servings", [])
                    if len(servings) != expected_member_count:
                        raise ValueError(
                            f"Meal '{meal.get('dish_name')}' has {len(servings)} "
                            f"member_servings, expected {expected_member_count}"
                        )
                    serving_names = {s["member_name"] for s in servings}
                    missing = member_names - serving_names
                    if missing:
                        raise ValueError(
                            f"Meal '{meal.get('dish_name')}' missing servings for: {missing}"
                        )

            logger.info("[Family Direct] Successfully generated 7-day direct plan")
            return {"weekly_plan": weekly_plan}

        except (json.JSONDecodeError, ValueError) as e:
            logger.error(f"[Family Direct] Attempt {attempt} failed: {e}")
            last_error = e
            continue

    raise Exception(
        f"Failed to generate family direct plan after {self.max_retries} attempts: {last_error}"
    )
```

---

### 3.4.5 `swap_family_meal` (Shared)

```python
async def swap_family_meal(
    self,
    meal: Dict[str, Any],          # ORM Meal serialised to dict
    day_meals: List[Dict],         # other meals on the same day
    profile,                       # joint UserProfile
    member_targets: List[Dict],
    workflow: str,                 # "hybrid" | "llm_only"
    reason: Optional[str] = None,
) -> Dict:
    """
    Swap a single meal in a family plan, branching on workflow type.

    For hybrid: returns a dict with "meal" key containing a "components" array.
    For llm_only: returns a dict with "meal" key containing a "member_servings" array.

    The router is responsible for running the LP (hybrid) or storing member_servings
    directly (llm_only) after this method returns.

    Args:
        meal:           The meal being replaced (dict with meal_type, dish_name, etc.).
        day_meals:      All other meals for the same day.
        profile:        Joint UserProfile ORM object.
        member_targets: Per-member target dicts.
        workflow:       "hybrid" or "llm_only".
        reason:         Optional user-supplied reason for the swap.

    Returns:
        Dict with "meal" key.

    Raises:
        Exception: On JSON parse failure or missing required fields.
    """
    system_prompt = (
        FAMILY_SWAP_COMPONENTS_SYSTEM_PROMPT
        if workflow == "hybrid"
        else FAMILY_SWAP_DIRECT_SYSTEM_PROMPT
    )
    user_prompt = build_family_swap_prompt(
        meal, day_meals, profile, member_targets, workflow, reason
    )

    logger.info(
        f"[Family Swap] Swapping '{meal.get('dish_name')}' "
        f"(workflow={workflow}, reason={reason!r})"
    )

    response_text = await self._chat(
        system_content=system_prompt,
        user_content=user_prompt,
        temperature=self.temperature,
        max_tokens=4000,   # single meal but possibly many member_servings
    )
    data = json.loads(response_text)

    new_meal = data.get("meal", data)

    # Validate based on workflow
    if workflow == "hybrid":
        if not new_meal.get("components"):
            raise ValueError("Swap response missing 'components' array (hybrid workflow)")
    else:
        servings = new_meal.get("member_servings", [])
        if len(servings) != len(member_targets):
            raise ValueError(
                f"Swap returned {len(servings)} member_servings, "
                f"expected {len(member_targets)}"
            )

    logger.info(f"[Family Swap] Successfully swapped to '{new_meal.get('dish_name')}'")
    return {"meal": new_meal}
```

---

### 3.4.6 `generate_family_single_day` (Shared)

```python
async def generate_family_single_day(
    self,
    profile,
    member_targets: List[Dict],
    workflow: str,
    day_of_week: int,
    existing_dishes: List[str] = None,
) -> List[Dict]:
    """
    Generate meals for a single day in a family plan (used by regenerate_day).

    Branches on workflow to use the appropriate system prompt.
    Returns the "meals" list for one day, NOT the full weekly_plan structure.

    Args:
        profile:          Joint UserProfile ORM object.
        member_targets:   Per-member target dicts.
        workflow:         "hybrid" | "llm_only".
        day_of_week:      0–6, used only for the prompt context string.
        existing_dishes:  Dish names already in the plan (to avoid duplicates).

    Returns:
        List of meal dicts for the requested day.
        Each meal has either "components" (hybrid) or "member_servings" (llm_only).

    Raises:
        Exception: On parse failure.
    """
    system_prompt = (
        FAMILY_COMPONENTS_SYSTEM_PROMPT
        if workflow == "hybrid"
        else FAMILY_DIRECT_SYSTEM_PROMPT
    )

    # Build a condensed single-day prompt by reusing the weekly builder
    # and appending a "generate only day N" instruction.
    base_prompt = (
        build_family_components_prompt(profile, member_targets)
        if workflow == "hybrid"
        else build_family_direct_prompt(profile, member_targets)
    )

    avoid_text = ""
    if existing_dishes:
        avoid_text = (
            f"\n\nDo NOT repeat any of these dishes already in the plan:\n"
            + "\n".join(f"- {d}" for d in existing_dishes)
        )

    single_day_instruction = (
        f"\n\nIMPORTANT: Generate meals for ONE DAY ONLY (day_of_week={day_of_week}).\n"
        f"Return JSON with a single 'meals' key (array of meal objects), NOT weekly_plan.\n"
        f"{avoid_text}"
    )

    user_prompt = base_prompt + single_day_instruction

    logger.info(
        f"[Family Single Day] Generating day {day_of_week} for joint profile {profile.id} "
        f"(workflow={workflow})"
    )

    response_text = await self._chat(
        system_content=system_prompt,
        user_content=user_prompt,
        temperature=self.temperature,
        max_tokens=6000,
    )
    data = json.loads(response_text)

    # Accept "meals" key directly or fall back to extracting from weekly_plan[0]
    if "meals" in data and isinstance(data["meals"], list):
        meals = data["meals"]
    elif "weekly_plan" in data and data["weekly_plan"]:
        meals = data["weekly_plan"][0].get("meals", [])
    else:
        raise ValueError(f"Cannot extract meals from response keys: {list(data.keys())}")

    if not meals:
        raise ValueError("LLM returned an empty meals array for single-day generation")

    logger.info(f"[Family Single Day] Generated {len(meals)} meal(s) for day {day_of_week}")
    return meals
```

---

## Task 3.5 — Family Plan Validator

**New file:** `backend/services/family_plan_validator.py`

```python
"""
FamilyPlanValidator — post-generation nutritional accuracy check for family meal plans.

Validates that per-member daily nutrition totals are within acceptable tolerances
of their individual targets. Produces warnings for borderline deviations and
fails (returns passed=False) for severe deviations in the llm_only workflow
(which triggers a re-generation retry in the router).
"""

import logging
from typing import List, Dict, Tuple

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Tolerance constants
# ---------------------------------------------------------------------------

# Hybrid workflow: warn only (never fail) because LP guarantees mathematical optimality
HYBRID_CALORIE_WARN_THRESHOLD  = 100   # kcal
HYBRID_MACRO_WARN_THRESHOLD    = 10    # grams

# LLM-only workflow: warn at lower threshold; fail if deviation is large
LLMONLY_CALORIE_WARN_THRESHOLD = 150   # kcal
LLMONLY_CALORIE_FAIL_THRESHOLD = 150   # kcal (same value — any excess triggers fail)
LLMONLY_MACRO_WARN_THRESHOLD   = 10    # grams


class FamilyPlanValidator:
    """
    Validates per-member daily nutritional totals in a generated family meal plan.

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
        (from member_servings in llm_only, or from per_member_nutrition in hybrid)
        and compares to their target.

        Args:
            daily_plans:    List of day dicts as returned by the AI planner.
                            Each day has a "meals" list. Each meal has either:
                              - "per_member_nutrition" (hybrid, added by LP step)
                              - "member_servings" (llm_only, from LLM response)
            member_targets: List of per-member target dicts with keys:
                              name, target_calories, target_protein,
                              target_carbs, target_fats.
            workflow:       "hybrid" or "llm_only".

        Returns:
            Tuple of:
              passed   (bool):       True if no hard failures were found.
              warnings (List[str]):  Human-readable warning strings. Empty if clean.
        """
        warnings: List[str] = []
        passed = True

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
            day_label = f"Day {day_idx + 1} (day_of_week={day.get('day_of_week', day_idx)})"

            # Accumulate per-member daily totals
            member_daily: Dict[str, Dict[str, float]] = {
                m["name"]: {"calories": 0.0, "protein": 0.0, "carbs": 0.0, "fats": 0.0}
                for m in member_targets
            }

            for meal in day.get("meals", []):
                self._accumulate_meal(meal, member_daily, workflow)

            # Compare totals to targets
            for m in member_targets:
                name   = m["name"]
                totals = member_daily.get(name)
                if totals is None:
                    warnings.append(
                        f"{day_label}: No nutrition data found for member '{name}'"
                    )
                    continue

                cal_dev = abs(totals["calories"] - m["target_calories"])
                if cal_dev > calorie_warn:
                    msg = (
                        f"{day_label}: '{name}' calories {totals['calories']:.0f} kcal "
                        f"vs target {m['target_calories']} kcal "
                        f"(deviation {cal_dev:.0f} kcal)"
                    )
                    warnings.append(msg)
                    logger.warning(msg)

                    # llm_only hard failure
                    if workflow == "llm_only" and cal_dev > LLMONLY_CALORIE_FAIL_THRESHOLD:
                        passed = False
                        logger.error(
                            f"[Validator] FAIL — {msg} exceeds llm_only hard threshold "
                            f"of {LLMONLY_CALORIE_FAIL_THRESHOLD} kcal"
                        )

                for macro in ("protein", "carbs", "fats"):
                    macro_dev = abs(totals[macro] - m.get(f"target_{macro}", 0))
                    if macro_dev > macro_warn:
                        msg = (
                            f"{day_label}: '{name}' {macro} {totals[macro]:.1f}g "
                            f"vs target {m.get(f'target_{macro}', 0)}g "
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

        For hybrid workflow: reads from meal["per_member_nutrition"] (set by LP step).
        For llm_only workflow: reads from meal["member_servings"] directly.

        Missing members in a meal are silently skipped (validator will surface the
        zero-contribution in the final deviation check).
        """
        if workflow == "hybrid":
            per_member = meal.get("per_member_nutrition", {})
            for member_name, nutrition in per_member.items():
                if member_name in member_daily:
                    for macro in ("calories", "protein", "carbs", "fats"):
                        member_daily[member_name][macro] += nutrition.get(macro, 0)

        else:  # llm_only
            for serving in meal.get("member_servings", []):
                member_name = serving.get("member_name")
                if member_name and member_name in member_daily:
                    member_daily[member_name]["calories"] += serving.get("calories", 0)
                    member_daily[member_name]["protein"]  += serving.get("protein",  0)
                    member_daily[member_name]["carbs"]    += serving.get("carbs",    0)
                    member_daily[member_name]["fats"]     += serving.get("fats",     0)
```

---

## Dependency Addition

Add the following line to `backend/requirements.txt`:

```
pulp==2.8.0
```

Insert it after the `openai` line to maintain alphabetical-ish grouping. The full updated block:

```
fastapi==0.115.6
uvicorn[standard]==0.34.0
sqlalchemy==2.0.36
pydantic==2.10.3
pydantic-settings==2.7.0
openai>=1.30.0
pulp==2.8.0
oci>=2.133.0
openpyxl==3.1.5
python-dotenv==1.0.1
python-jose[cryptography]==3.3.0
bcrypt>=4.0.0
google-auth==2.38.0
slowapi==0.1.9
```

Install in the backend venv: `backend/venv/bin/pip install pulp==2.8.0`

---

## File Summary

| File | Action |
|---|---|
| `backend/prompts/family_meal_plan.py` | CREATE — four prompt constants + two builder functions |
| `backend/prompts/family_swap_meal.py` | CREATE — two prompt constants + one builder function |
| `backend/services/portion_optimizer.py` | CREATE — PortionOptimizer class with full LP |
| `backend/services/ai_meal_planner.py` | MODIFY — add six methods to AIMealPlanner class |
| `backend/services/family_plan_validator.py` | CREATE — FamilyPlanValidator class |
| `backend/requirements.txt` | MODIFY — add `pulp==2.8.0` |
