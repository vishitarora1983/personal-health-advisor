# Phase 5: Frontend Foundation — TypeScript Types and API Client

**Steps covered:** 12, 13
**Spec version:** 1.0
**Date:** 2026-02-22
**Audience:** Frontend developer

---

## Overview

This phase updates the TypeScript layer to match the backend schema changes introduced in Phase 2. No React components or pages are modified here — this phase establishes the type safety and API client contracts that all subsequent phases will depend on.

The changes fall into two files:

| File | Action |
|---|---|
| `frontend/src/types/index.ts` | Modify — add 4 new interfaces, update 4 existing interfaces |
| `frontend/src/lib/api.ts` | Modify — update 1 existing function, add 2 new functions |

---

## Task 5.1: Frontend Type Updates

**File:** `frontend/src/types/index.ts`

### Exact location for each change

The file is organized into sections with `// ===` banner comments. All profile-related interfaces live between lines 30 and 182 (the `// PROFILE TYPES` section). All meal plan interfaces live between lines 192 and 263 (the `// MEAL PLAN TYPES` section).

---

### 5.1.A — Add `MemberServing` interface (new)

**Where to insert:** Immediately after the closing brace of `KidShareInfo` (currently lines 177–181) and before `KidProfile` (currently lines 183–189). This groups it with the other joint/kid sharing types.

**New interface to insert:**

```typescript
/**
 * Per-member serving data for one meal in a family/joint plan.
 *
 * Populated by the hybrid generation workflow when the AI explicitly assigns
 * different portions or adjustments to different household members.
 *
 * adjustment: Free-text modifications for this member relative to the base dish.
 *   Example: "half rice, extra salad, add cucumber raita"
 *   Null if this member eats the standard household portion.
 *
 * portion_description: Human-readable description of the actual portion.
 *   Example: "1 katori rajma, 0.5 katori rice, 2 bowls salad"
 *   Null if the AI did not generate a description.
 *
 * Calorie and macro fields reflect this member's individual portion, not the
 * aggregate total for the meal.
 */
export interface MemberServing {
  member_profile_id: number;
  member_name: string;
  adjustment: string | null;
  portion_description: string | null;
  calories: number;
  protein: number;
  carbs: number;
  fats: number;
  fiber: number;
}
```

---

### 5.1.B — Update `Meal` interface — add `member_servings` field

**Current location:** Lines 207–232 of `frontend/src/types/index.ts`

**BEFORE — last two lines of the Meal interface (lines 230–232):**

```typescript
  // Kid sharing info (populated when meal is shared with kids)
  shared_with_kids?: KidShareInfo[] | null;
}
```

**AFTER — add one field:**

```typescript
  // Kid sharing info (populated when meal is shared with kids)
  shared_with_kids?: KidShareInfo[] | null;

  // Per-member portion breakdown for joint/family plans (null for individual profiles)
  member_servings?: MemberServing[] | null;
}
```

The `member_servings` field is intentionally optional (`?`) and nullable. Components rendering meals for individual profiles will never receive this field (the backend returns `null`), so no guard clauses are needed in existing meal display components.

---

### 5.1.C — Replace `JointProfileCreate` interface

**Current location:** Lines 147–153 of `frontend/src/types/index.ts`

**BEFORE (current code, lines 147–153):**

```typescript
/**
 * Request data for creating a joint profile.
 */
export interface JointProfileCreate {
  name: string;
  primary_profile_id: number;
  member_profile_ids: number[];
}
```

**AFTER (replacement):**

```typescript
/**
 * Request data for creating a joint profile.
 *
 * primary_profile_id is removed. All preferences are now specified explicitly
 * for the household rather than inherited from a single primary member.
 *
 * member_profile_ids must contain at least 2 IDs; duplicates are ignored by
 * the backend.
 *
 * All preference fields mirror ProfileFormData. Optional fields (allergies,
 * foods_to_avoid, foods_to_include, cuisines) may be omitted; the backend will
 * auto-merge them from individual member profiles in that case.
 */
export interface JointProfileCreate {
  name: string;
  member_profile_ids: number[];

  // Household-level dietary preferences
  diet_type: 'none' | 'vegetarian' | 'vegan' | 'keto' | 'paleo' | 'mediterranean' | 'pescatarian';
  allergies?: string[];
  foods_to_avoid?: string;
  foods_to_include?: string;
  spice_tolerance: 'mild' | 'medium' | 'hot';
  cooking_skill: 'beginner' | 'intermediate' | 'advanced';
  max_cook_time: number;
  cuisines?: string[];
  meals_per_day: string[];
  snacks_per_day: number;
  meals_to_repeat: number;
}
```

**Key differences from before:**
- `primary_profile_id: number` removed entirely.
- `member_profile_ids` minimum is now 2 (enforced by the backend; the UI wizard should validate this client-side too).
- Eleven new household preference fields added. Fields marked `?` are optional — the backend will auto-merge them from members if omitted.

---

### 5.1.D — Replace `JointProfileMember` interface

**Current location:** Lines 155–162 of `frontend/src/types/index.ts`

**BEFORE (current code, lines 155–162):**

```typescript
/**
 * A member within a joint profile.
 */
export interface JointProfileMember {
  profile_id: number;
  profile_name: string;
  is_primary: boolean;
}
```

**AFTER (replacement):**

```typescript
/**
 * Summary of one member within a joint profile.
 *
 * is_primary is removed — the primary-profile concept no longer exists and
 * all members are equal contributors to the household plan.
 *
 * target_calories, weight_goal, and medical_goals are added so the household
 * overview panel can display each member's individual goals without a
 * separate API call.
 */
export interface JointProfileMember {
  profile_id: number;
  profile_name: string;
  target_calories: number;
  weight_goal: 'lose' | 'maintain' | 'gain';
  medical_goals: string[] | null;
}
```

---

### 5.1.E — Replace `MemberNutritionTargets` interface

**Current location:** Lines 164–172 of `frontend/src/types/index.ts`

**BEFORE (current code, lines 164–172):**

```typescript
/**
 * Per-member nutrition targets with share ratio for proportional serving breakdown.
 */
export interface MemberNutritionTargets extends NutritionTargets {
  profile_id: number;
  profile_name: string;
  is_primary: boolean;
  share_ratio: number;
}
```

**AFTER (replacement):**

```typescript
/**
 * Full nutrition targets for one member of a joint profile.
 *
 * Returned by GET /profile/{id}/member-nutrition-targets as an array — one
 * entry per household member.
 *
 * is_primary and share_ratio are removed:
 *   - is_primary: the primary-profile concept is gone.
 *   - share_ratio: callers who need a ratio can compute it as
 *       member.target_calories / sum(all members' target_calories)
 *
 * weight_goal and medical_goals added for contextual display in the household
 * nutrition breakdown panel (e.g., "Alice — 1,450 kcal · losing weight").
 */
export interface MemberNutritionTargets extends NutritionTargets {
  profile_id: number;
  profile_name: string;
  weight_goal: 'lose' | 'maintain' | 'gain';
  medical_goals: string[] | null;
}
```

---

### 5.1.F — Add `UserSettings` interface (new)

**Where to insert:** At the end of the `// PROFILE TYPES` section, after `KidProfile` and before the `// MEAL PLAN TYPES` banner comment. This keeps all user-account-level types together.

**New interface to insert:**

```typescript
/**
 * User-level application settings persisted on the User account (not per-profile).
 *
 * family_meal_workflow controls how joint/family meal plans are generated:
 *   'hybrid'   — Two-step process: LLM generates the household dish; a
 *                deterministic second pass splits it into per-member portions
 *                based on MemberNutritionTargets. Faster and more consistent.
 *   'llm_only' — Single LLM call generates the full plan including per-member
 *                portions. Slower but allows the AI more creative latitude.
 *
 * Fetched once on app load via GET /settings and cached in a React context or
 * Zustand store. Updated via PUT /settings.
 */
export interface UserSettings {
  family_meal_workflow: 'hybrid' | 'llm_only';
}
```

---

### 5.1.G — Add `SSEProgressStep` interface (new)

**Where to insert:** Immediately after `UserSettings` (added in 5.1.F), still within the profile types section. SSE progress is tied to meal generation which is triggered from joint profiles, so keeping it near the other joint-profile types is logical.

**New interface to insert:**

```typescript
/**
 * A single progress event emitted by the SSE meal generation endpoint.
 *
 * The frontend's useSSEGeneration hook parses these events and exposes them
 * as a progress bar with step label.
 *
 * Backend emits events as:
 *   data: {"step": "generating_meals", "stepIndex": 2, "totalSteps": 4, "message": "Generating meals for Day 1..."}
 *
 * step: machine-readable step identifier, one of:
 *   "validating_profile" | "loading_members" | "generating_meals" |
 *   "saving_plan" | "complete" | "error"
 *
 * stepIndex: 0-based index of the current step.
 * totalSteps: total number of steps in the generation process.
 * message: human-readable status message for display in the progress UI.
 */
export interface SSEProgressStep {
  step: string;
  stepIndex: number;
  totalSteps: number;
  message: string;
}
```

---

### Summary of all type changes

After applying all changes above, the diff to `frontend/src/types/index.ts` should be:

| Change | Interface | Fields added | Fields removed |
|---|---|---|---|
| Replace | `JointProfileCreate` | `diet_type`, `allergies?`, `foods_to_avoid?`, `foods_to_include?`, `spice_tolerance`, `cooking_skill`, `max_cook_time`, `cuisines?`, `meals_per_day`, `snacks_per_day`, `meals_to_repeat` | `primary_profile_id` |
| Replace | `JointProfileMember` | `target_calories`, `weight_goal`, `medical_goals` | `is_primary` |
| Replace | `MemberNutritionTargets` | `weight_goal`, `medical_goals` | `is_primary`, `share_ratio` |
| Update | `Meal` | `member_servings?` | — |
| New | `MemberServing` | all fields | — |
| New | `UserSettings` | all fields | — |
| New | `SSEProgressStep` | all fields | — |

---

## Task 5.2: Frontend API Client Changes

**File:** `frontend/src/lib/api.ts`

### Context

The existing `api.ts` file uses an `axios` instance (`apiClient`) with a Bearer token interceptor and a 401 redirect interceptor. The existing `createJointProfile` function signature matches the old `JointProfileCreate` shape. Two new settings functions need to be added.

The SSE generation endpoint (introduced in Phase 3 of the backend) is **not** wrapped in an axios function — it uses the browser-native `EventSource` or `fetch` API to consume the streaming response. That consumption is handled entirely within the `useSSEGeneration` hook (covered in Phase 6). No axios wrapper is needed or appropriate here.

---

### 5.2.A — Add `UserSettings` to the import block

**Current location:** Lines 1–28 of `frontend/src/lib/api.ts`

**BEFORE — the type import block (lines 3–28):**

```typescript
import type {
  AuthUser,
  TokenResponse,
  SignupData,
  LoginData,
  UserProfile,
  ProfileFormData,
  ProfileListItem,
  NutritionTargets,
  JointProfileCreate,
  JointProfileMember,
  MemberNutritionTargets,
  KidProfile,
  KidShareInfo,
  WeeklyPlan,
  DailyPlan,
  Meal,
  MealTracking,
  DailyTracking,
  WeeklyTracking,
  GroceryList,
  DashboardData,
  SwapMealRequest,
  TrackingUpdateRequest,
  ApiError,
} from '@/types';
```

**AFTER — add `UserSettings` to the list:**

```typescript
import type {
  AuthUser,
  TokenResponse,
  SignupData,
  LoginData,
  UserProfile,
  ProfileFormData,
  ProfileListItem,
  NutritionTargets,
  JointProfileCreate,
  JointProfileMember,
  MemberNutritionTargets,
  KidProfile,
  KidShareInfo,
  WeeklyPlan,
  DailyPlan,
  Meal,
  MealTracking,
  DailyTracking,
  WeeklyTracking,
  GroceryList,
  DashboardData,
  SwapMealRequest,
  TrackingUpdateRequest,
  ApiError,
  UserSettings,           // NEW
} from '@/types';
```

---

### 5.2.B — Update `createJointProfile`

**Current location:** Lines 186–189 of `frontend/src/lib/api.ts`

The function signature and implementation do not change — only the data shape changes because `JointProfileCreate` itself changed in Task 5.1.C. The function body stays identical.

**BEFORE (current code, lines 185–189):**

```typescript
/**
 * Create a joint profile combining multiple individual profiles.
 */
export async function createJointProfile(data: JointProfileCreate): Promise<{ profile: UserProfile; members: JointProfileMember[] }> {
  const response = await apiClient.post<{ profile: UserProfile; members: JointProfileMember[] }>('/profile/joint', data);
  return response.data;
}
```

**AFTER (replacement with updated JSDoc):**

```typescript
/**
 * Create a joint (household) profile.
 *
 * The data object must include at least 2 member_profile_ids and explicit
 * household-level preferences. primary_profile_id is no longer part of the
 * request shape — see JointProfileCreate in types/index.ts.
 *
 * Returns the created joint UserProfile plus a members array where each entry
 * contains the member's target_calories, weight_goal, and medical_goals
 * (rather than is_primary from the old API).
 */
export async function createJointProfile(
  data: JointProfileCreate,
): Promise<{ profile: UserProfile; members: JointProfileMember[] }> {
  const response = await apiClient.post<{ profile: UserProfile; members: JointProfileMember[] }>(
    '/profile/joint',
    data,
  );
  return response.data;
}
```

The TypeScript compiler will catch any call sites that still pass `primary_profile_id` because `JointProfileCreate` no longer includes that field. The primary consumer today is `JointProfileWizard.tsx` — that component is updated in Phase 6.

---

### 5.2.C — Add `getUserSettings` and `updateUserSettings`

**Where to insert:** In the `// SETTINGS ENDPOINTS` section at the bottom of the file (currently lines 426–435). Insert before the existing `resetAllData` function.

**Current `// SETTINGS ENDPOINTS` section (lines 425–435):**

```typescript
// ============================================================================
// SETTINGS ENDPOINTS
// ============================================================================

/**
 * Reset all data in the database (profiles, plans, tracking, grocery).
 */
export async function resetAllData(): Promise<{ message: string }> {
  const response = await apiClient.delete<{ message: string }>('/settings/reset-all');
  return response.data;
}
```

**AFTER — full replacement of that section:**

```typescript
// ============================================================================
// SETTINGS ENDPOINTS
// ============================================================================

/**
 * Get the current user's application settings.
 *
 * Returns a UserSettings object. Called once on app load (e.g., inside
 * AuthContext or a top-level settings provider) and cached in React state.
 */
export async function getUserSettings(): Promise<UserSettings> {
  const response = await apiClient.get<UserSettings>('/settings');
  return response.data;
}

/**
 * Update one or more application settings for the current user.
 *
 * Accepts a Partial<UserSettings> so callers can update a single field:
 *   updateUserSettings({ family_meal_workflow: 'llm_only' })
 *
 * The backend uses model_dump(exclude_unset=True) so only provided fields
 * are written to the database.
 *
 * Returns the complete updated UserSettings object.
 */
export async function updateUserSettings(settings: Partial<UserSettings>): Promise<UserSettings> {
  const response = await apiClient.put<UserSettings>('/settings', settings);
  return response.data;
}

/**
 * Reset all data in the database (profiles, plans, tracking, grocery).
 * The user account and settings are preserved.
 */
export async function resetAllData(): Promise<{ message: string }> {
  const response = await apiClient.delete<{ message: string }>('/settings/reset-all');
  return response.data;
}
```

---

### 5.2.D — Note on SSE generation endpoint

The new streaming meal generation endpoint (`POST /meal-plans/generate-sse?profile_id={id}`) returns a `text/event-stream` response. Axios does not natively support SSE streaming — it buffers the entire response before resolving, which defeats the purpose of streaming progress.

**The SSE endpoint must not be wrapped in an axios function.**

Instead, the `useSSEGeneration` hook (defined in Phase 6 at `frontend/src/hooks/useSSEGeneration.ts`) opens the connection using the browser's native `EventSource` API or `fetch` with a `ReadableStream` reader. The hook handles:

- Opening and closing the connection
- Parsing `data:` lines into `SSEProgressStep` objects
- Exposing `progress`, `isGenerating`, `plan`, and `error` state to components
- Attaching the Bearer token (since `EventSource` does not support custom headers, the hook uses `fetch` with `{ headers: { Authorization: 'Bearer ...' } }` and reads `response.body` as a `ReadableStream`)

The existing `generateMealPlan` function at line 234 of `api.ts` is preserved unchanged for backward compatibility with any component not yet migrated to the streaming workflow:

```typescript
/**
 * Generate a new AI-powered weekly meal plan for a profile.
 *
 * LEGACY: This non-streaming version is kept for backward compatibility.
 * New code should use the useSSEGeneration hook for streaming progress.
 * This function blocks for 60–120s on joint/family profiles.
 */
export async function generateMealPlan(profileId: number): Promise<WeeklyPlan> {
  const response = await apiClient.post<WeeklyPlan>(`/meal-plans/generate?profile_id=${profileId}`);
  return response.data;
}
```

No changes to this function are needed in Phase 5.

---

## Validation Checklist

Before marking this phase complete, verify the following:

### TypeScript compilation
- [ ] Run `cd frontend && npx tsc --noEmit` — zero type errors
- [ ] `JointProfileCreate` no longer has `primary_profile_id`; any code that references `data.primary_profile_id` on a `JointProfileCreate` object produces a TS compile error (confirming the old field is gone)
- [ ] `JointProfileMember` no longer has `is_primary`; any code that reads `member.is_primary` produces a TS compile error
- [ ] `MemberNutritionTargets` no longer has `share_ratio`; any code reading `t.share_ratio` produces a TS compile error

### API function signatures
- [ ] `createJointProfile` accepts a `JointProfileCreate` object with `member_profile_ids` (min 2) and household preference fields — no `primary_profile_id`
- [ ] `getUserSettings()` returns `Promise<UserSettings>` (TypeScript infers `family_meal_workflow: 'hybrid' | 'llm_only'`)
- [ ] `updateUserSettings({ family_meal_workflow: 'hybrid' })` is accepted without TS error
- [ ] `updateUserSettings({ family_meal_workflow: 'invalid' as any })` would fail at runtime (backend validates)

### No regressions
- [ ] All other functions in `api.ts` are unchanged and have no TS errors
- [ ] `Meal` interface change is additive — existing component code destructuring `Meal` objects does not break
- [ ] `resetAllData`, `generateMealPlan`, `swapMeal`, etc. compile without changes

---

## Dependencies / Sequencing

**This phase depends on:** Phase 2 (backend schema changes) being complete. The TypeScript types in this file must mirror the backend Pydantic schemas exactly.

**The following phases depend on this phase:**

| Phase | File | What it needs from here |
|---|---|---|
| Phase 6 — JointProfileWizard rewrite | `frontend/src/components/joint-profile/JointProfileWizard.tsx` | Updated `JointProfileCreate` type (no `primary_profile_id`, with household prefs) |
| Phase 6 — useSSEGeneration hook | `frontend/src/hooks/useSSEGeneration.ts` | `SSEProgressStep` type, `UserSettings` type |
| Phase 7 — MealCard component | `frontend/src/components/meal-plan/MealCard.tsx` | `MemberServing` type, updated `Meal` interface |
| Phase 8 — Settings page | `frontend/src/app/app/settings/page.tsx` | `UserSettings` type, `getUserSettings`, `updateUserSettings` |

Do not begin any of Phase 6, 7, or 8 until this phase is complete and `npx tsc --noEmit` passes with zero errors.
