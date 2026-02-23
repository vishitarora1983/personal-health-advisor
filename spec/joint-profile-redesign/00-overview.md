# Joint Profile Redesign — Overview Spec

**Document version:** 1.0
**Date:** 2026-02-22
**Status:** Handed to dev team — do not modify without review
**Companion docs:** `01-phase-1-data-layer.md` (and subsequent phase files)

---

## Table of Contents

1. [Problem Statement](#1-problem-statement)
2. [What Changes — High-Level](#2-what-changes--high-level)
3. [Tech Stack](#3-tech-stack)
4. [Phase Summary Table](#4-phase-summary-table)
5. [Workflow Architectures](#5-workflow-architectures)
6. [Field Categorization](#6-field-categorization)
7. [New & Modified Files](#7-new--modified-files)
8. [Backward Compatibility Contract](#8-backward-compatibility-contract)
9. [Verification Checklist](#9-verification-checklist)

---

## 1. Problem Statement

### Current Behavior (Broken)

The existing joint profile system is implemented in `backend/routers/profile.py` and is fundamentally flawed in how it merges household member data.

**Current merge logic (simplified):**

```python
# backend/routers/profile.py — current (BROKEN) joint profile creation
primary = next(m for m in members if m.is_primary)
joint_profile.diet_type = primary.diet_type        # ignores all non-primary members
joint_profile.allergies = primary.allergies         # DANGEROUS: nut allergy silently dropped
joint_profile.medical_goals = primary.medical_goals # child's diabetes needs silently dropped
joint_profile.weight_goal = primary.weight_goal     # everyone gets same goal

# Only calorie/macro targets are summed (member targets):
joint_profile.target_calories = sum(calculate_targets(m).target_calories for m in members)
```

**Concrete failure scenarios this creates:**

| Scenario | Current result | Correct result |
|---|---|---|
| Household: adult (non-veg) + vegetarian spouse | Spouse silently gets meat dishes | Strictly vegetarian base meals |
| Household: adult + peanut-allergic child | Child gets peanuts | Peanuts excluded for entire household |
| Adult on keto + child who needs carbs | Child gets keto macros | Child gets age-appropriate carbs |
| Member on low-sodium diet | Sodium constraint dropped | Low-sodium across all shared meals |

The root cause: **non-primary members' qualitative constraints are silently discarded.** The system treats joint profiles as "one person with summed calories" rather than a real household.

### Desired Behavior (After Redesign)

1. **Household-level preferences** (cooking style, cuisine, meal structure) are shared and merged once across all members.
2. **Individual health constraints** (allergies, diet type, medical goals, weight goals) are honored per-member. The most restrictive constraints propagate to the base meal.
3. **Base meal** is something everyone can eat (union of all allergies excluded, strictest diet type applied).
4. **Per-member servings** are stored individually: each person gets the right portion with any personal adjustments noted (e.g., "half the rice for Alice's keto goal, no garnish peanuts for Bob").
5. **Nutritional targets** are tracked per-member, not as a household aggregate.

---

## 2. What Changes — High-Level

The redesign touches three layers:

### Data Layer
- New `MealMemberServing` table stores per-member portion, adjustments, and nutrition for every meal.
- `User` model gains `family_meal_workflow` column (`"hybrid"` or `"llm_only"`).
- `JointProfileMember.is_primary` column is retired from ORM (stays in DB for backward compat).
- `Meal` model gets an explicit `member_servings` relationship.

### Backend Services
- New `PortionOptimizer` service wraps PuLP LP solver to allocate portions across members.
- New `FamilyPlanValidator` checks daily totals per-member against targets.
- New `SSEProgressService` streams generation progress events to the frontend.
- `AIMealPlanner` gains four new methods for family-aware generation.
- Two new prompt files: `family_meal_plan.py` and `family_swap_meal.py`.
- `meal_plan.py` router is extended (not rewritten) with a new SSE endpoint and family-aware generation path.
- `settings.py` router gains a `GET/PATCH /settings/workflow` endpoint.

### Frontend
- TypeScript types extended: `MemberServing`, updated `Meal`, `JointProfileMember` (remove `is_primary`), new `GenerationProgressEvent`.
- `api.ts`: new `generateFamilyMealPlan()` and `getWorkflowSetting()` functions.
- `JointProfileWizard` updated to remove "primary member" concept.
- `MealCard` updated to render per-member serving panels.
- `DayColumn` updated to render per-member daily nutrition summaries.
- New `GenerationProgress` component subscribes to SSE stream.
- `useSSEGeneration` hook manages SSE connection lifecycle.

---

## 3. Tech Stack

| Layer | Technology | Version / Notes |
|---|---|---|
| Backend framework | FastAPI | 0.115.6 |
| Backend runtime | Python + uvicorn | `backend/venv/` |
| ORM | SQLAlchemy | 2.0.36 |
| Database | SQLite | Dev; production can swap to Postgres |
| AI provider | OpenAI GPT-4o | via `AsyncOpenAI`; OCI provider also supported |
| LP solver | **PuLP** | New dependency — add to `requirements.txt` |
| Frontend framework | Next.js | 15 (App Router) |
| Frontend runtime | React | 19 |
| Styling | Tailwind CSS | v4 via `@tailwindcss/postcss` |
| HTTP streaming | Server-Sent Events (SSE) | Native `EventSource` on frontend, `StreamingResponse` on backend |

**New dependency to add:**

```
# backend/requirements.txt — add this line
pulp==2.9.0
```

PuLP bundles the CBC solver binary, so no additional system packages are needed. Verify the CBC binary is available after install with:

```bash
backend/venv/bin/python -c "import pulp; print(pulp.listSolvers(onlyAvailable=True))"
# Expected: ['PULP_CBC_CMD']
```

---

## 4. Phase Summary Table

| Phase | Name | Steps | Dependencies | Key Files Changed/Created |
|---|---|---|---|---|
| **1** | Data Layer Foundation | 1–2 | None | `models/meal_member_serving.py` (new), `models/__init__.py`, `models/joint_profile.py`, `models/user.py`, `models/meal_plan.py` |
| **2** | Backend Schemas & APIs | 3–5 | Phase 1 complete | `schemas/meal_plan.py`, `schemas/settings.py` (new), `routers/settings.py`, `routers/profile.py`, `schemas/profile.py` |
| **3** | AI & Optimization Engine | 6–9 | Phase 1 complete | `prompts/family_meal_plan.py` (new), `prompts/family_swap_meal.py` (new), `services/portion_optimizer.py` (new), `services/family_plan_validator.py` (new), `services/ai_meal_planner.py` |
| **4** | Backend Orchestration | 10–11 | Phases 1–3 complete | `routers/meal_plan.py`, `routers/meals.py`, `services/sse_progress.py` (new) |
| **5** | Frontend Foundation | 12–13 | Phase 2 API contracts finalized | `frontend/src/types/index.ts`, `frontend/src/lib/api.ts` |
| **6** | Frontend UI Components | 14–18 | Phase 5 complete | `components/joint-profile/JointProfileWizard.tsx`, `components/meal-plan/MealCard.tsx`, `components/meal-plan/DayColumn.tsx`, `app/app/profile/page.tsx`, `app/app/settings/page.tsx`, `components/meal-plan/GenerationProgress.tsx` (new) |
| **7** | SSE Progress System | 19 | Phase 4 (backend SSE), Phase 6 (frontend components) | `services/sse_progress.py` (new), `hooks/useSSEGeneration.ts` (new), `components/meal-plan/GenerationProgress.tsx` (new), `app/app/meal-plan/page.tsx` |

**Phase execution order:** Phases 1 → 2 → 3 → 4 must be done in order (each depends on the previous). Phase 5 can begin in parallel with Phase 3/4 once Phase 2 API contracts are written. Phase 6 requires Phase 5. Phase 7 requires Phases 4 and 6.

---

## 5. Workflow Architectures

Joint profile meal plan generation supports two modes, controlled by `User.family_meal_workflow`.

### Workflow A: Hybrid (LLM + LP) — Default (`"hybrid"`)

This is the default and recommended workflow. It uses GPT-4o to generate meals and PuLP (a linear programming solver) to mathematically allocate the optimal portion per member given their individual targets.

```
┌─────────────────────────────────────────────────────────────────┐
│  Workflow A: Hybrid (LLM + LP)                                  │
│                                                                 │
│  INPUT: Joint UserProfile + member UserProfiles                 │
│                                                                 │
│  Step 1 — LLM generates base meal plan                          │
│    • Prompt includes union-merged household constraints         │
│    • Each meal returns per-COMPONENT nutrition:                 │
│      [{"component": "dal", "cal": 150, "p": 10, "c": 20, "f": 4}│
│       {"component": "rice", "cal": 200, "p": 4, "c": 44, "f": 1}│
│       {"component": "salad", "cal": 40, "p": 2, "c": 6, "f": 3}]│
│                                                                 │
│  Step 2 — LP Solver (PuLP) allocates portions per member        │
│    • Decision variables: x[member][component] = fraction (0–2)  │
│    • Constraints:                                               │
│        sum(x[m][c] * component_cal[c]) ≈ member_target[m]      │
│        x[m][c] >= 0                                             │
│        exclude component if allergen for member                 │
│    • Objective: minimize(sum of squared deviations from targets)│
│    • Solver: PULP_CBC_CMD                                       │
│                                                                 │
│  Step 3 — If LP infeasible (e.g., too few components)           │
│    • LLM suggests supplement foods (e.g., "add protein shake")  │
│    • New components appended, LP re-runs                        │
│    • Max 2 supplement rounds before fallback to LLM-only        │
│                                                                 │
│  Step 4 — LLM converts numeric allocations → human text         │
│    • Input: {"Alice": {"rice": 0.5, "dal": 1.0, "salad": 1.5}} │
│    • Output: "Alice: half rice, full dal, extra salad"          │
│    • Stored in MealMemberServing.adjustment                     │
│                                                                 │
│  Step 5 — Validator checks daily per-member totals              │
│    • Sums each member's MealMemberServing.calories across meals │
│    • Tolerance: ±150 kcal from member's target_calories         │
│    • Fails: log warning (do not block — LP already optimized)   │
│                                                                 │
│  OUTPUT: WeeklyPlan with MealMemberServings populated           │
└─────────────────────────────────────────────────────────────────┘
```

**LP formulation details:**

```
Minimize:   Σ_m (deviation_m)²                     [minimize squared calorie deviation per member]

Subject to:
  Σ_c x[m][c] * cal[c]  = target_cal[m] + slack_m  ∀ member m
  Σ_c x[m][c] * prot[c] ≥ target_prot[m] * 0.85   ∀ member m  [≥85% of protein target]
  x[m][c] = 0                                        if component c is allergen for member m
  x[m][c] ≥ 0                                        ∀ m, c
  x[m][c] ≤ 2.5                                      ∀ m, c     [max 2.5x base portion]
  deviation_m ≥ Σ_c x[m][c] * cal[c] - target_cal[m]
  deviation_m ≥ target_cal[m] - Σ_c x[m][c] * cal[c]
```

**Decision variable semantics:** `x[m][c] = 1.0` means member m gets exactly the base portion of component c. `x[m][c] = 0.5` means half portion. `x[m][c] = 2.0` means double.

### Workflow B: LLM-Only (`"llm_only"`)

Simpler but less precise. Suitable for users who find LP reasoning opaque or whose households have simple differences.

```
┌─────────────────────────────────────────────────────────────────┐
│  Workflow B: LLM-Only                                           │
│                                                                 │
│  INPUT: Joint UserProfile + member UserProfiles                 │
│                                                                 │
│  Step 1 — LLM generates base meal plan + per-member adjustments │
│    • Single prompt asks for meals AND member servings           │
│    • Prompt includes each member's targets and constraints      │
│    • LLM outputs:                                               │
│      {                                                          │
│        "meal": {...base_meal...},                               │
│        "member_servings": [                                     │
│          {"member_id": 1, "adjustment": "...", "calories": 480} │
│          {"member_id": 2, "adjustment": "...", "calories": 360} │
│        ]                                                        │
│      }                                                          │
│                                                                 │
│  Step 2 — Validator checks daily per-member totals              │
│    • Sum each member's calories across all meals for the day    │
│    • Tolerance: ±150 kcal from member's target_calories         │
│                                                                 │
│  Step 3 — If any member >150 kcal off target                    │
│    • Retry entire day with validation feedback appended          │
│    • Feedback: "Alice was 280 kcal over target — reduce portions"│
│    • Max 2 retries per day                                      │
│                                                                 │
│  OUTPUT: WeeklyPlan with MealMemberServings populated           │
└─────────────────────────────────────────────────────────────────┘
```

**Workflow selection:** Set via `PATCH /settings/workflow` endpoint (see Phase 2 spec). Stored on `User.family_meal_workflow`. Non-joint profile generation paths are **not affected** by this setting.

---

## 6. Field Categorization

This categorization determines which fields drive the base meal (shared constraints) vs. which fields drive per-member serving allocations.

### Household-Level Fields

These are stored on the **joint `UserProfile`** and apply to the shared base meal. They represent cooking logistics and group preferences.

| Field | Type | Source | Notes |
|---|---|---|---|
| `diet_type` | `String(30)` | Auto-merged | Strictest diet wins. Hierarchy: `vegan > vegetarian > pescatarian > paleo > keto > mediterranean > none`. If any member is vegan, base meals are vegan. |
| `allergies` | `Text` (JSON) | Auto-merged union | Set union of all members' allergies. If any member is allergic to peanuts, peanuts are excluded from ALL base meals. |
| `foods_to_avoid` | `Text` | Auto-merged union | Concatenated comma-separated list from all members' `foods_to_avoid`. Deduped. |
| `foods_to_include` | `Text` | Auto-merged | Concatenated from all members. Duplicates removed. |
| `cuisines` | `Text` (JSON) | Auto-merged intersection | Intersection of preferred cuisines. If intersection is empty, use union with a warning. |
| `cooking_skill` | `String(20)` | Min skill level | Use the lowest skill level among members (beginner < intermediate < advanced). |
| `max_cook_time` | `Integer` | Min value | Use the lowest max cook time among members. |
| `spice_tolerance` | `String(10)` | Min tolerance | Hierarchy: `mild < medium < hot`. Use the mildest. |
| `meals_per_day` | `Text` (JSON) | From primary profile | The household-designated meal structure (breakfast/lunch/dinner). |
| `snacks_per_day` | `Integer` | From primary profile | Snacks per day for the household. |
| `meals_to_repeat` | `Integer` | From primary profile | How many meals to repeat across the week. |

**"Primary profile" for household logistics** in the new system: after `is_primary` is retired, the system uses the first-added member as the household anchor for fields that cannot be merged (meals_per_day, snacks_per_day, meals_to_repeat). This is determined by the lowest `JointProfileMember.id` for the given `joint_profile_id`.

### Per-Member Fields

These come from **individual member `UserProfile` rows** and drive portion allocation and adjustment text.

| Field | Type | How Used |
|---|---|---|
| `name` | `String(100)` | Display; stored denormalized in `MealMemberServing.member_name` |
| `age` | `Integer` | Passed to `calculate_targets()` for BMR |
| `gender` | `String(10)` | Passed to `calculate_targets()` for BMR |
| `height_cm` | `Float` | Passed to `calculate_targets()` |
| `weight_kg` | `Float` | Passed to `calculate_targets()` |
| `activity_level` | `String(20)` | Passed to `calculate_targets()` |
| `weight_goal` | `String(20)` | Passed to `calculate_targets()` for calorie adjustment |
| `medical_goals` | `Text` (JSON) | Passed to LLM as per-member constraint |

**`calculate_targets()` is called once per member.** The result is used as that member's LP constraints and validator thresholds. The function in `services/nutrition_calculator.py` is unchanged.

---

## 7. New & Modified Files

### New Files (9 total)

| File | Purpose |
|---|---|
| `backend/models/meal_member_serving.py` | SQLAlchemy ORM model for per-member meal portions |
| `backend/prompts/family_meal_plan.py` | System + user prompts for household-aware full week generation |
| `backend/prompts/family_swap_meal.py` | Prompts for swapping a single meal in a joint profile plan |
| `backend/services/portion_optimizer.py` | PuLP LP solver wrapping portion allocation logic |
| `backend/services/family_plan_validator.py` | Per-member daily calorie validation with retry logic |
| `backend/services/sse_progress.py` | SSE event queue and progress message helpers |
| `backend/schemas/settings.py` | Pydantic schemas for workflow settings GET/PATCH |
| `frontend/src/hooks/useSSEGeneration.ts` | React hook managing `EventSource` lifecycle for SSE progress |
| `frontend/src/components/meal-plan/GenerationProgress.tsx` | Progress UI component rendering SSE events |

### Modified Backend Files (12 total)

| File | What Changes |
|---|---|
| `backend/requirements.txt` | Add `pulp==2.9.0` |
| `backend/models/__init__.py` | Import and export `MealMemberServing` |
| `backend/models/joint_profile.py` | Remove `is_primary` Column, remove `Boolean` import |
| `backend/models/user.py` | Add `family_meal_workflow` Column |
| `backend/models/meal_plan.py` | Add explicit `member_servings` relationship on `Meal` class |
| `backend/schemas/profile.py` | Update `JointProfileCreate` — remove `primary_profile_id`, add merge-rule documentation |
| `backend/schemas/meal_plan.py` | Add `MemberServingResponse`, update `MealResponse` to include `member_servings` |
| `backend/routers/profile.py` | Rewrite joint profile creation/update to use new merge logic, remove is_primary handling |
| `backend/routers/settings.py` | Add `GET /settings/workflow` and `PATCH /settings/workflow` endpoints |
| `backend/routers/meal_plan.py` | Add SSE `/generate-family` endpoint, update `_build_weekly_plan_response` to include member_servings |
| `backend/routers/meals.py` | Update swap/custom-meal endpoints to handle joint profile member servings |
| `backend/services/ai_meal_planner.py` | Add `generate_family_meal_plan()`, `generate_family_single_day()`, `suggest_supplements()`, `format_lp_allocations()` methods |

### Modified Frontend Files (8 total)

| File | What Changes |
|---|---|
| `frontend/src/types/index.ts` | Add `MemberServing`, update `Meal` (add `member_servings`), update `JointProfileMember` (remove `is_primary`, remove `MemberNutritionTargets.is_primary`), add `GenerationProgressEvent`, add `WorkflowSetting` |
| `frontend/src/lib/api.ts` | Add `generateFamilyMealPlan()`, `getWorkflowSetting()`, `updateWorkflowSetting()` |
| `frontend/src/components/joint-profile/JointProfileWizard.tsx` | Remove primary member selection step; update API call shape |
| `frontend/src/components/meal-plan/MealCard.tsx` | Add collapsible per-member serving panel below meal details |
| `frontend/src/components/meal-plan/DayColumn.tsx` | Add per-member daily calorie summary row below total |
| `frontend/src/app/app/profile/page.tsx` | Update joint profile display — remove "Primary" badge |
| `frontend/src/app/app/settings/page.tsx` | Add Workflow section (Hybrid / LLM-Only radio) |
| `frontend/src/app/app/meal-plan/page.tsx` | Use SSE generation for joint profiles; show `GenerationProgress` |

---

## 8. Backward Compatibility Contract

This section is a hard contract — every item must be true after implementation. QA should verify each one.

### Non-Joint Profiles: Completely Unchanged

- `UserProfile` rows where `is_joint = false` follow the exact existing code path in every router.
- `calculate_targets()` is called identically; nothing changes.
- No `MealMemberServing` rows are created for non-joint plans.
- The `MealCard`, `DayColumn` components render identically when `meal.member_servings` is `null` or empty.
- The `family_meal_workflow` column on `User` is ignored entirely for non-joint profile generation.

### Existing Joint Profiles (Created Before This Redesign)

- `is_primary` column stays in the SQLite database. SQLAlchemy simply ignores columns present in the DB but not in the ORM model — no migration breakage.
- Existing joint profile `WeeklyPlan` rows that have no `MealMemberServing` data render using the existing ratio-based calorie display (show total calories only; no member panel). The `MealCard` component handles this gracefully: `if (!meal.member_servings || meal.member_servings.length === 0) { /* render old UI */ }`.
- When an old joint plan is **regenerated**, the new format is produced (with `MealMemberServing` rows). The old plan is archived as usual.
- The `_build_weekly_plan_response()` helper in `routers/meal_plan.py` is updated to also load `member_servings` for each meal, but this is an additive change — old plans simply return an empty `member_servings: []` array.

### `calculate_targets()` Function

- Signature unchanged: `calculate_targets(profile: UserProfile) -> Dict[str, Any]`.
- Called per-member (same as it is today for individual profiles).
- Return value structure unchanged.

### `MealKidShare` / Share-With-Kids Feature

- `MealKidShare` model, `MealKidShare` table, and all `share_with_kids` endpoints are **not touched**.
- Kid sharing is still functional for non-joint profiles.
- For joint profiles, kid sharing is disabled (joint profiles already represent the full household). The `MealCard` should not show the "Share with Kids" button when `is_joint = true`.

### Users Without `family_meal_workflow` Column

- If the column is missing from the DB (i.e., migration hasn't run yet), SQLAlchemy will throw `OperationalError` on startup.
- Migration must run before backend starts. See Phase 1 spec for migration instructions.
- The column default `"hybrid"` ensures all new users and post-migration users have a valid value.
- API code should treat any value other than `"hybrid"` or `"llm_only"` as `"hybrid"`.

---

## 9. Verification Checklist

After all 7 phases are implemented, QA must verify each item.

### Data Layer

- [ ] **V1 — MealMemberServing table exists:** `sqlite3 health_advisor.db ".tables"` shows `meal_member_servings`.
- [ ] **V2 — UniqueConstraint enforced:** Inserting a duplicate `(meal_id, member_profile_id)` into `meal_member_servings` raises an `IntegrityError`.
- [ ] **V3 — Cascade delete works:** Deleting a `Meal` row cascades and removes all child `MealMemberServing` rows.
- [ ] **V4 — `family_meal_workflow` column exists on users:** `sqlite3 health_advisor.db "PRAGMA table_info(users);"` shows `family_meal_workflow` column with default `'hybrid'`.
- [ ] **V5 — Old joint profile data intact:** Existing `joint_profile_members` rows with `is_primary=1` in DB still exist; querying them via raw SQL works; ORM simply doesn't expose the column.

### Backend API

- [ ] **V6 — `GET /settings/workflow` returns `{workflow: "hybrid"}` for new users.**
- [ ] **V7 — `PATCH /settings/workflow` with `{workflow: "llm_only"}` persists and is returned on next GET.**
- [ ] **V8 — Joint profile creation no longer requires `primary_profile_id`:** `POST /profile/joint` without `primary_profile_id` field returns 201.
- [ ] **V9 — Non-joint `POST /meal-plans/generate` unchanged:** Returns `WeeklyPlanResponse` with no `member_servings` field in meals (or empty array), same as before.

### AI & Optimization

- [ ] **V10 — Hybrid workflow produces `MealMemberServing` rows:** After `POST /meal-plans/generate-family` on a 2-member joint profile, querying `meal_member_servings` returns 2 rows per meal × number of meals.
- [ ] **V11 — Member allergy honored in LP:** If member B is allergic to peanuts, LP sets `x[B]["peanut_chutney"] = 0`. Validate by checking `MealMemberServing.adjustment` does not reference the allergen component for that member.

### Frontend UI

- [ ] **V12 — MealCard shows per-member panel for joint plans:** Open a joint profile meal plan; each `MealCard` shows a collapsible section listing each member's portion and calorie count.
- [ ] **V13 — MealCard hides member panel for solo plans:** Open a solo profile meal plan; `MealCard` renders identically to pre-redesign.
- [ ] **V14 — DayColumn shows per-member calorie summary for joint plans.**
- [ ] **V15 — Settings page shows Workflow toggle:** Navigate to Settings > Household Workflow; radio buttons for Hybrid and LLM-Only are visible and functional.
- [ ] **V16 — JointProfileWizard has no "Primary Member" step:** Create a new joint profile via the wizard; there is no step asking which member is primary.

### SSE Progress

- [ ] **V17 — SSE events stream during generation:** Open browser DevTools > Network; initiate a joint plan generation; an `EventStream` connection to `/meal-plans/generate-family` is visible with progress events appearing.
- [ ] **V18 — `GenerationProgress` component renders each event:** Each SSE event produces a visible progress line in the UI (e.g., "Generating Day 1 of 7...", "Running LP solver...", "Done!").
