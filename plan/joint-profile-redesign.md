# Joint Profile Redesign: Family Meal Planning

## Context

The current joint profile system is fundamentally broken for families with different health goals. It copies ALL qualitative preferences (diet_type, allergies, medical_goals, weight_goal) from a "primary" member and only sums calorie/macro targets. This means non-primary members' health constraints are silently ignored — a vegetarian could get meat, a nut-allergic child could get peanuts.

The redesign transforms joint profiles into true household meal planning: shared cooking preferences + individual health goals, producing a base meal everyone shares with per-member adjustments (portion scaling, additions, subtractions) to meet each person's targets.

**Two workflow options** (user-selectable in Settings):
- **Hybrid (LLM + LP)** — default. LLM chooses dishes and provides per-component nutrition; PuLP LP solver allocates optimal portions per member; LLM describes adjustments in natural language. Guarantees constraint satisfaction.
- **LLM-Only** — LLM generates per-member servings directly in one shot. Post-generation validator checks targets. Faster, simpler, but nutrition precision depends on LLM arithmetic.

---

## Field Categorization

**Household-level** (stored on joint UserProfile, specified in wizard):
- `diet_type` — one dietary identity for the household
- `allergies` — auto-merged union from all members (editable)
- `foods_to_avoid`, `foods_to_include` — auto-merged from members (editable)
- `cuisines`, `cooking_skill`, `max_cook_time`, `spice_tolerance`
- `meals_per_day`, `snacks_per_day`, `meals_to_repeat`

**Per-member** (from individual profiles):
- `name`, `age`, `gender`, `height_cm`, `weight_kg`, `activity_level`
- `weight_goal`, `medical_goals`

---

## Two Workflow Architectures

### Workflow A: Hybrid (LLM + LP) — Default

```
Step 1: LLM generates base meals with per-component nutritional breakdown
        → {dish_name, components: [{name, unit, cal_per_unit, protein_per_unit, carbs_per_unit, fats_per_unit, fiber_per_unit}]}

Step 2: LP (PuLP) allocates portions per member per component
        → Decision vars: portions[member][component] >= 0
        → Constraints: per-member calorie targets (±tolerance), medical constraints (diabetes: carbs ≤ limit),
           minimum base sharing (everyone gets ≥ 0.25 of each component)
        → Objective: minimize total deviation from each member's targets

Step 3: If LP infeasible → LLM suggests supplement components (low-carb sides, protein additions, etc.)
        → LP re-runs with expanded component set
        → Max 2 supplement rounds before falling back to LLM-only

Step 4: LLM converts LP's numeric solution into human-readable adjustments
        → Input: "Dad: 0.5 katori rice, 1 katori rajma, 2 bowls salad, 1 bowl raita"
        → Output: "Half rice, extra salad, add cucumber raita"

Step 5: Validator checks daily totals per member
```

### Workflow B: LLM-Only

```
Step 1: LLM generates base meals + per-member adjustments in one shot
        → {dish_name, member_servings: [{member_name, adjustment, portion_description, calories, ...}]}

Step 2: Validator checks daily totals per member
        → If any member >150 kcal off target, retry with feedback (max 2 retries)
```

Both workflows produce the same output format stored in `MealMemberServing` rows.

---

## Implementation Plan

### Step 1: New Model — `MealMemberServing`

**Create** `backend/models/meal_member_serving.py`

Stores per-member serving data for each meal in a joint profile's plan:
- `meal_id` (FK → meals), `member_profile_id` (FK → user_profiles)
- `member_name` (denormalized for display)
- `adjustment` (text: "half rice, extra salad, add cucumber raita")
- `portion_description` (text with gram weights)
- `calories`, `protein`, `carbs`, `fats`, `fiber` (individual nutrition)
- Unique constraint on (meal_id, member_profile_id)

**Modify** `backend/models/__init__.py` — register the new model in imports and `__all__`.

**Modify** `backend/models/meal_plan.py` — add `member_servings` relationship on `Meal` class with cascade delete.

### Step 2: Update Joint Profile Model + User Settings

**Modify** `backend/models/joint_profile.py` — remove `is_primary` column from ORM (leave in DB for backward compat; SQLAlchemy ignores extra DB columns).

**Modify** `backend/models/user.py` — add workflow preference column:
- `family_meal_workflow = Column(String(20), nullable=False, default="hybrid")` — values: `"hybrid"` or `"llm_only"`

### Step 3: Backend Schema Changes

**Modify** `backend/schemas/profile.py`:
- Replace `JointProfileCreate`: remove `primary_profile_id`, add household-level preference fields (`diet_type`, `allergies`, `cuisines`, `cooking_skill`, `max_cook_time`, `spice_tolerance`, `meals_per_day`, `snacks_per_day`, `meals_to_repeat`, `foods_to_avoid`, `foods_to_include`)
- Update `JointProfileMemberResponse`: remove `is_primary`, add `target_calories`, `medical_goals`, `weight_goal`
- Update `MemberNutritionTargetsResponse`: remove `is_primary` and `share_ratio`, add `medical_goals` and `weight_goal`

**Modify** `backend/schemas/meal_plan.py`:
- Add `MemberServingSchema` (member_profile_id, member_name, adjustment, portion_description, calories, protein, carbs, fats, fiber)
- Add `member_servings: Optional[List[MemberServingSchema]]` to `MealResponse`
- Update `from_orm_with_ingredients()` to accept and include member_servings

**Create** `backend/schemas/settings.py`:
- `UserSettingsResponse` — `family_meal_workflow: str`
- `UserSettingsUpdate` — `family_meal_workflow: Optional[str]` (validated: "hybrid" | "llm_only")

### Step 4: Settings API

**Modify** `backend/routers/settings.py` — add two new endpoints:

- `GET /settings` — returns current user's settings (`family_meal_workflow`)
- `PUT /settings` — updates user settings, validates allowed values

### Step 5: Rewrite Joint Profile Creation API

**Modify** `backend/routers/profile.py` — rewrite `POST /profile/joint`:
1. Validate all member profiles exist and belong to current user, none are joint, minimum 2
2. Auto-merge allergies (union of all members') if not explicitly provided
3. Auto-merge `foods_to_avoid` and `foods_to_include` from members if not provided
4. Create joint `UserProfile` with household-level fields from request body (NOT copied from a primary)
5. Body vitals (NOT NULL columns) set to first member's values as inert placeholders
6. Sum nutrition targets from all members (same as current)
7. Create `JointProfileMember` rows (no `is_primary`)

Also update `GET /{profile_id}/joint-members` and `GET /{profile_id}/member-nutrition-targets` to remove `is_primary` from responses and add `medical_goals`/`weight_goal`.

### Step 6: Family Meal Plan Prompts

**Create** `backend/prompts/family_meal_plan.py` — contains prompts for BOTH workflows:

**For Hybrid workflow (LLM generates components):**

`FAMILY_COMPONENTS_SYSTEM_PROMPT` — instructs LLM to return base meals with per-component nutritional breakdown:
```json
{
  "weekly_plan": [{
    "day_of_week": 0,
    "meals": [{
      "meal_type": "dinner",
      "dish_name": "Rajma + Brown Rice + Salad",
      "description": "...",
      "cuisine": "Indian",
      "prep_time": 35,
      "components": [
        {"name": "Rajma", "unit": "katori", "cal_per_unit": 220, "protein_per_unit": 13, "carbs_per_unit": 35, "fats_per_unit": 8, "fiber_per_unit": 11},
        {"name": "Brown Rice", "unit": "katori", "cal_per_unit": 200, "protein_per_unit": 4, "carbs_per_unit": 45, "fats_per_unit": 1, "fiber_per_unit": 3},
        {"name": "Mixed Salad", "unit": "bowl", "cal_per_unit": 50, "protein_per_unit": 2, "carbs_per_unit": 10, "fats_per_unit": 0.5, "fiber_per_unit": 3}
      ]
    }]
  }]
}
```

`build_family_components_prompt(joint_profile, member_targets)` — lists household prefs + member targets, asks for component breakdowns.

`SUPPLEMENT_PROMPT` — given infeasibility gap (e.g., "Dad needs 140 more cal with ≤5g carbs"), asks LLM to suggest 2-3 supplement components with their nutritional data.

`ADJUSTMENT_DESCRIPTION_PROMPT` — given LP's numeric solution per member, asks LLM to produce human-readable adjustment text.

**For LLM-Only workflow:**

`FAMILY_DIRECT_SYSTEM_PROMPT` — instructs LLM to return base meals with `member_servings` directly (same prompt structure as original plan).

`build_family_direct_prompt(joint_profile, member_targets)` — asks for per-member servings in one shot.

**Create** `backend/prompts/family_swap_meal.py` — family-aware swap prompt. For hybrid: returns components. For LLM-only: returns member_servings directly.

### Step 7: Portion Optimizer (LP with PuLP)

**Add** `pulp` to `backend/requirements.txt`.

**Create** `backend/services/portion_optimizer.py`:

```python
class PortionOptimizer:
    """LP-based portion allocation for family meals using PuLP."""

    def allocate(
        self,
        components: List[Dict],       # [{name, unit, cal_per_unit, protein_per_unit, ...}]
        member_targets: List[Dict],    # [{name, target_calories, target_protein, ..., medical_goals}]
        meal_type: str,                # "breakfast"|"lunch"|"dinner"|"snack"
    ) -> PortionResult:
        """
        Allocate portions of each component to each member.

        Returns PortionResult with:
          - feasible: bool
          - allocations: {member_name: {component_name: units}}
          - per_member_nutrition: {member_name: {calories, protein, carbs, fats, fiber}}
          - gap: Optional dict describing what's missing if infeasible
        """
```

**LP formulation per meal:**

Decision variables:
- `x[member][component]` >= 0 (portions of component for member)

Constraints per member:
- Calorie target: `sum(x[m][c] * cal_per_unit[c]) - dev_plus[m] + dev_minus[m] == meal_target_cal[m]`
  - Where `meal_target_cal` = daily target * meal distribution % (breakfast 25%, lunch 35%, dinner 30%, snack 10%)
- Medical constraints:
  - `diabetes_management`: `sum(x[m][c] * carbs_per_unit[c]) <= meal_target_cal[m] * 0.35 / 4` (carbs ≤ 35% of meal calories)
  - `heart_health`: favor low-sodium, but since components don't have sodium data, enforce via LLM component selection
  - `high_protein`/`muscle_building`: `sum(x[m][c] * protein_per_unit[c]) >= meal_target_cal[m] * 0.30 / 4`
- Minimum sharing: `x[m][c] >= 0.25` for all base components (everyone eats some of each dish)
- Maximum sanity: `x[m][c] <= 3.0` (nobody eats more than 3 units of any component)

Objective:
- `Minimize sum(dev_plus[m] + dev_minus[m])` for all members (minimize calorie deviation)
- Secondary: minimize protein/carbs/fats deviation with lower weights

If infeasible: return `gap` dict describing what's missing per member (e.g., "Dad needs 140 more cal with ≤5g additional carbs").

### Step 8: AI Meal Planner Service Changes

**Modify** `backend/services/ai_meal_planner.py`:

**For Hybrid workflow:**
- `generate_family_components(joint_profile, member_targets)` — calls LLM with components prompt, returns meals with component breakdowns
- `suggest_supplements(components, gap, profile)` — calls LLM to suggest 2-3 supplement components for the infeasible gap
- `describe_adjustments(allocations, member_targets)` — calls LLM to convert LP's numeric output to readable text (batch call for all meals in a day)

**For LLM-Only workflow:**
- `generate_family_meal_plan_direct(joint_profile, member_targets)` — calls LLM with direct prompt, returns meals with member_servings
  - `max_tokens=24000` (member_servings roughly double output size)
  - Validates every meal has correct number of member_servings

**Shared:**
- `swap_family_meal(...)` — branches on workflow type
- `generate_family_single_day(...)` — branches on workflow type

### Step 9: Family Plan Validator

**Create** `backend/services/family_plan_validator.py`:

Deterministic post-generation check (used by BOTH workflows):
- For each day, sum each member's calories across all meals
- Warn if any member is >100 kcal off their daily target (hybrid) or >150 kcal (LLM-only)
- Warn if any member's macro is >10g off target
- Return list of warning strings (logged; non-critical ones tolerated)
- For LLM-only: if any member >150 kcal off, trigger retry with validator feedback

### Step 10: Meal Plan Generation Router — Orchestrator

**Modify** `backend/routers/meal_plan.py`:

In `generate_meal_plan`: after loading profile, branch on `profile.is_joint`:
- If not joint: existing logic unchanged
- If joint:
  1. Load member profiles and calculate per-member targets
  2. Read user's `family_meal_workflow` setting from `current_user`
  3. Branch:

  **Hybrid path:**
  ```
  a. LLM → base meals with components (7 days)
  b. For each meal: LP allocate portions
  c. If any meal infeasible: LLM suggest supplements → LP retry (max 2 rounds)
  d. If still infeasible after retries: fall back to LLM-only for that meal
  e. LLM → adjustment descriptions (batched per day)
  f. Validator checks daily totals
  g. Store Meal + MealMemberServing rows
  ```

  **LLM-only path:**
  ```
  a. LLM → base meals with member_servings directly (7 days)
  b. Validator checks daily totals
  c. If validation fails: retry with feedback (max 2)
  d. Store Meal + MealMemberServing rows
  ```

- In `_build_weekly_plan_response`: pre-load `MealMemberServing` data for all meals, include in `MealResponse` as `member_servings`
- In `regenerate_day` and `regenerate_meal_plan`: same branching by workflow type

### Step 11: Meal Operations for Family Plans

**Modify** `backend/routers/meals.py`:

- `swap_meal`: detect if owning profile is joint → use family-aware swap (branches on workflow) → delete old `MealMemberServing` rows, insert new ones
- `replace_with_custom_meal`: for joint profiles, augment custom meal prompt with member info, store member_servings
- `copy_meal_to`: copy `MealMemberServing` rows from source to target meal (delete target's old ones first)
- `share_with_kids`: unchanged (only applies to non-joint profiles; joint profiles handle kids as members)

### Step 12: Frontend Type Updates

**Modify** `frontend/src/types/index.ts`:
- Add `MemberServing` interface (member_profile_id, member_name, adjustment, portion_description, calories, protein, carbs, fats, fiber)
- Add `member_servings?: MemberServing[] | null` to `Meal`
- Update `JointProfileCreate` — remove `primary_profile_id`, add household preference fields
- Update `JointProfileMember` — remove `is_primary`
- Update `MemberNutritionTargets` — remove `share_ratio`, `is_primary`; add `medical_goals`, `weight_goal`
- Add `UserSettings` interface (`family_meal_workflow: "hybrid" | "llm_only"`)

### Step 13: Frontend API Client

**Modify** `frontend/src/lib/api.ts`:
- Update `createJointProfile` to accept new `JointProfileCreate` shape
- Add `getUserSettings()` and `updateUserSettings(settings)` API calls

### Step 14: Redesign JointProfileWizard

**Modify** `frontend/src/components/joint-profile/JointProfileWizard.tsx`

New 3-step flow (replaces current name → primary → members):

**Step 1: Name + Select Members**
- Profile name input
- Member list area showing selected members (chips/cards with remove button)
- Two ways to add members:
  - **Select existing**: Grid of individual (non-joint) profiles. Click to toggle selection. Shows name, age, weight_goal, medical_goals on each card.
  - **Create new inline**: A "+ Create New Member" button below the existing profiles grid. Clicking it expands an inline form (accordion/collapsible section) within the wizard — NOT a separate modal. The inline form collects the per-member fields only:
    - Name, age, gender, height_cm, weight_kg, activity_level
    - Weight goal, medical goals
    - Diet type, allergies (these pre-populate household prefs in Step 2)
    - A "Save Member" button that calls `POST /profile` to create the individual profile, then auto-selects it in the member list
    - On save, the inline form collapses and the new profile appears in the grid as selected
  - Reuse the existing profile form field components from `frontend/src/app/app/profile/page.tsx` — extract shared field groups (basic info, health goals, dietary prefs) into reusable components if not already extracted
- Minimum 2 members required to proceed
- No "primary" concept

**Step 2: Household Dietary Preferences**
- Diet type dropdown (pre-filled with most common among selected members)
- Allergies multi-select (pre-populated as union of all selected members' allergies)
- Foods to avoid (pre-merged from members)
- Foods to include (pre-merged from members)
- Info callout: "These apply to ALL meals. Individual health goals are handled per-person."

**Step 3: Cooking & Meal Structure**
- Cooking skill, max cook time, spice tolerance (pre-filled from most restrictive member)
- Cuisines multi-select
- Meals per day, snacks per day, meals to repeat

### Step 15: Settings Page — Workflow Toggle

**Modify** `frontend/src/app/app/settings/page.tsx`:

Replace the placeholder "Application Settings" card with a real settings section:

**Family Meal Planning Workflow** — radio group or segmented toggle:
- **Hybrid (LP + AI)** — "Uses linear programming to compute mathematically optimal portions per person, with AI for dish selection and supplement suggestions. More precise nutrition targeting." (default)
- **AI-Only** — "AI generates portion adjustments directly. Faster generation, but nutrition targets are approximate."

Calls `PUT /settings` on change. Shows a brief toast confirming the update.

### Step 16: Redesign MealCard Per-Member Display

**Modify** `frontend/src/components/meal-plan/MealCard.tsx`:

Replace the current `share_ratio`-based scaling with actual `member_servings` data:
- When `meal.member_servings` exists: show a per-member table with each person's adjustment, portion description, and individual macros
- When absent (non-joint profiles): render exactly as today (backward compatible)

### Step 17: Redesign DayColumn Per-Member Totals

**Modify** `frontend/src/components/meal-plan/DayColumn.tsx`:

Replace `share_ratio * daily_total` computation with actual summed member serving data:
- For each member, sum calories/macros from their `member_servings` across all meals in the day
- Compare against their individual targets
- Display actual vs target with color coding

### Step 18: Update Joint Profile Page

**Modify** `frontend/src/app/app/profile/page.tsx`:
- Remove "primary member" display (crown icon, primary badge)
- Show all members equally with their individual goals
- Show household preferences section

### Step 19: SSE Progress Indicator for Meal Plan Generation

Currently, meal plan generation shows a static spinner for 60-120 seconds with no intermediate feedback. The hybrid workflow will be even longer (multiple LLM + LP steps). Add real-time step-based progress via Server-Sent Events (SSE).

**Create** `backend/services/sse_progress.py` — `ProgressEmitter` class:
- Async queue-based emitter. Generation code calls `emit(step, message)` to push events; SSE endpoint drains the queue via `async generator`.
- `ProgressEvent` dataclass: `event` (progress/complete/error), `step`, `step_index`, `total_steps`, `message`, optional `data`
- `complete(data)` sends the final meal plan JSON as the last event's `data` field (avoids extra HTTP round-trip)
- 15-second keepalive heartbeat (SSE comment `: keepalive\n\n`) to prevent proxy/browser timeouts
- Step definitions per workflow type:
  - `STEPS_STANDARD = ["started", "generating", "saving", "complete"]`
  - `STEPS_HYBRID = ["started", "generating_components", "optimizing_portions", "generating_descriptions", "validating", "saving", "complete"]`
  - `STEPS_LLM_ONLY = ["started", "generating_meals", "validating", "saving", "complete"]`

**Modify** `backend/routers/meal_plan.py` — add new `POST /meal-plans/generate-stream` endpoint:
- Returns `StreamingResponse(emitter.stream(), media_type="text/event-stream")`
- Launches generation via `asyncio.ensure_future(run_generation())` so the coroutine runs independently of the HTTP connection
- `run_generation()` wraps existing generation logic with `emitter.emit()` calls at each step boundary
- Selects step list based on `profile.is_joint` and workflow type
- Keeps existing `POST /meal-plans/generate` untouched as fallback
- The `complete` event includes the full `WeeklyPlanResponse` JSON in its `data` field

SSE wire format:
```
event: progress
data: {"step":"generating","stepIndex":1,"totalSteps":4,"message":"AI is crafting your 7-day meal plan..."}

event: complete
data: {"step":"complete","stepIndex":3,"totalSteps":4,"message":"Your meal plan is ready!","data":{...weeklyPlanJSON...}}
```

**Create** `frontend/src/hooks/useSSEGeneration.ts` — generic SSE consumption hook:
- Uses `fetch` + `ReadableStream` (not `EventSource`, because we need POST + auth headers)
- Attaches `Authorization: Bearer <token>` header from localStorage
- Exposes: `start()`, `abort()`, `isStreaming`, `progress: SSEProgressStep | null`
- Parses SSE events, updates `progress` state on `progress` events, calls `onComplete(data)` on `complete` event
- AbortController for cancellation

**Create** `frontend/src/components/meal-plan/GenerationProgress.tsx` — progress UI:
- Renders step circles with connecting lines (reuse visual pattern from JointProfileWizard step indicator)
- Completed steps show green checkmark, current step pulses with spinner, future steps are muted
- Animated message text transitions between steps using framer-motion
- Fully driven by `stepIndex` / `totalSteps` from SSE — no hardcoded step names in the UI

**Modify** `frontend/src/app/app/meal-plan/page.tsx`:
- Replace the static spinner block with `useSSEGeneration` hook + `GenerationProgress` component
- `handleGeneratePlan` calls `startGeneration()` instead of `await generateMealPlan()`
- `onComplete` sets `weeklyPlan` state directly from the SSE `complete` event data
- Fallback: show simple "Connecting..." spinner before first SSE event arrives

**Error handling / reconnection:**
- If SSE connection drops mid-generation, generation continues server-side (fire-and-forget coroutine)
- Frontend `onError` shows toast, then auto-checks for the plan via `GET /meal-plans/current` after 5 seconds
- If plan found (server completed in the background), display it; otherwise offer Retry button

---

## Backward Compatibility

- Non-joint profiles: completely unchanged at every layer
- Existing joint profiles in DB: `is_primary` column stays in DB but ORM ignores it. Old plans without `member_servings` render with existing ratio-based display. Regenerating a plan produces the new format.
- `calculate_targets()`: unchanged; called per-member for joint profiles
- `MealKidShare` / share-with-kids: unchanged for non-joint profiles
- Users without `family_meal_workflow` column: defaults to `"hybrid"`

---

## Files Summary

**New files (9):**
- `backend/models/meal_member_serving.py` — per-member serving model
- `backend/prompts/family_meal_plan.py` — prompts for both workflows
- `backend/prompts/family_swap_meal.py` — family-aware swap prompt
- `backend/services/portion_optimizer.py` — PuLP LP solver
- `backend/services/family_plan_validator.py` — post-generation validation
- `backend/services/sse_progress.py` — SSE ProgressEmitter + step definitions
- `backend/schemas/settings.py` — settings request/response schemas
- `frontend/src/hooks/useSSEGeneration.ts` — generic SSE fetch hook
- `frontend/src/components/meal-plan/GenerationProgress.tsx` — step-based progress UI

**Modified backend (9):**
- `backend/requirements.txt` — add `pulp`
- `backend/models/__init__.py` — register MealMemberServing
- `backend/models/joint_profile.py` — remove is_primary from ORM
- `backend/models/user.py` — add `family_meal_workflow` column
- `backend/models/meal_plan.py` — add member_servings relationship
- `backend/schemas/profile.py` — rewrite JointProfileCreate, update responses
- `backend/schemas/meal_plan.py` — add MemberServingSchema, update MealResponse
- `backend/routers/profile.py` — rewrite joint creation, update member endpoints
- `backend/routers/settings.py` — add GET/PUT settings endpoints
- `backend/routers/meal_plan.py` — orchestrate hybrid/LLM-only workflows
- `backend/routers/meals.py` — family-aware swap/custom/copy
- `backend/services/ai_meal_planner.py` — add family generation methods

**Modified frontend (8):**
- `frontend/src/types/index.ts` — new types
- `frontend/src/lib/api.ts` — updated API calls + settings endpoints
- `frontend/src/components/joint-profile/JointProfileWizard.tsx` — redesigned wizard
- `frontend/src/components/meal-plan/MealCard.tsx` — per-member servings display
- `frontend/src/components/meal-plan/DayColumn.tsx` — actual per-member daily totals
- `frontend/src/app/app/profile/page.tsx` — remove primary concept
- `frontend/src/app/app/settings/page.tsx` — workflow toggle
- `frontend/src/app/app/meal-plan/page.tsx` — SSE progress integration

---

## Verification

1. **Backend unit**: Create 2 individual profiles (Person A: lose weight + diabetes; Person B: gain weight + high_protein). Create joint profile via new API. Verify allergies auto-merged, household prefs stored correctly.

2. **Hybrid workflow**: Set `family_meal_workflow=hybrid`. Generate plan for joint profile. Verify:
   - LLM returns per-component nutritional data
   - LP allocates different portions per member
   - Each member's daily calories within ~50 kcal of target (LP precision)
   - Member servings have readable adjustment descriptions

3. **LP infeasibility → supplement flow**: Create a scenario where base components can't satisfy a constraint (e.g., diabetes member with very low carb limit + high-carb base). Verify LLM suggests supplements and LP re-runs successfully.

4. **LLM-only workflow**: Set `family_meal_workflow=llm_only`. Generate plan. Verify member_servings exist but may have wider deviation (~100-150 kcal).

5. **Settings toggle**: Open Settings page. Toggle between Hybrid and AI-Only. Verify setting persists across page reloads. Generate plans with each setting and compare precision.

6. **Non-joint regression**: Generate a plan for a non-joint profile. Verify identical behavior to before (no member_servings, same output format).

7. **Frontend display**: View meal plan for joint profile — verify per-member adjustments display correctly. View day summary — verify actual per-member daily totals vs targets.

8. **Swap/regenerate**: Swap a meal in a family plan (both workflows). Verify new meal has member_servings. Regenerate a day — verify all new meals have member_servings.

9. **SSE progress (non-joint)**: Generate a plan for a non-joint profile. Verify step circles appear (started → generating → saving → complete), messages update in real-time, and the final plan loads from the `complete` event data.

10. **SSE progress (joint hybrid)**: Generate a plan for a joint profile with hybrid workflow. Verify more steps appear (generating_components → optimizing_portions → generating_descriptions → validating → saving → complete).

11. **SSE connection drop**: Start generation, kill the browser tab mid-way, reopen. Verify the plan was still saved server-side and appears on page load.
