# Phase 6 — Frontend UI Components

**Document version:** 1.0
**Date:** 2026-02-22
**Status:** Handed to dev team — do not modify without review
**Prerequisite:** Phase 5 complete (types and api.ts updated)
**Steps covered:** 14 – 18

---

## Table of Contents

1. [Task 6.1 — Redesign JointProfileWizard](#task-61--redesign-jointprofilewizard)
2. [Task 6.2 — Settings Page: Workflow Toggle](#task-62--settings-page-workflow-toggle)
3. [Task 6.3 — MealCard Per-Member Serving Display](#task-63--mealcard-per-member-serving-display)
4. [Task 6.4 — DayColumn Per-Member Daily Totals](#task-64--daycolumn-per-member-daily-totals)
5. [Task 6.5 — Joint Profile Page Update](#task-65--joint-profile-page-update)
6. [New Type Definitions Required](#new-type-definitions-required)
7. [Shared Constants & Helpers](#shared-constants--helpers)

---

## Task 6.1 — Redesign JointProfileWizard

**File to modify:** `frontend/src/components/joint-profile/JointProfileWizard.tsx`

### Before vs After

**Before:**
- Step 1: Profile name input only → Next
- Step 2: Single-select primary member (crown badge) → Next (auto-selects remaining as members)
- Step 3: Multi-select additional members → Create Joint Profile

**After:**
- Step 1: Profile name + multi-select/create members (unified, no "primary" concept)
- Step 2: Household dietary preferences (pre-populated from member data)
- Step 3: Cooking and meal structure settings (pre-populated from member data)

The "primary member" concept is **fully removed** from the wizard. There is no crown icon, no single-select primary step, and no `primary_profile_id` in the API payload.

---

### Step Indicator (shared across all steps)

The step indicator at the top of the modal is already implemented and must remain. It renders three numbered circles connected by lines, with the current step highlighted via green gradient and completed steps showing a `Check` icon. No changes required here — it already uses the correct design tokens.

```tsx
// Step indicator — no change needed from current implementation
{[1, 2, 3].map((s) => (
  <div key={s} className="flex items-center gap-2">
    <div
      className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-all"
      style={{
        background: s <= step
          ? 'linear-gradient(135deg, var(--brand-green), var(--brand-green-light))'
          : 'var(--surface-glass)',
        color: s <= step ? 'white' : 'var(--text-muted)',
      }}
    >
      {s < step ? <Check className="h-4 w-4" /> : s}
    </div>
    {s < 3 && (
      <div
        className="w-12 h-0.5 rounded"
        style={{
          background: s < step ? 'var(--brand-green)' : 'var(--surface-glass)',
        }}
      />
    )}
  </div>
))}
```

---

### Step 1: Name + Select/Create Members

#### State for this step

```typescript
// Top-level wizard state (replace current state declarations entirely)
const [step, setStep] = useState(1);
const [name, setName] = useState('');

// Step 1 state
const [selectedMemberIds, setSelectedMemberIds] = useState<number[]>([]);
const [showInlineForm, setShowInlineForm] = useState(false);
const [inlineFormData, setInlineFormData] = useState<Partial<ProfileFormData>>(getDefaultProfileFormData());
const [savingMember, setSavingMember] = useState(false);

// Step 2 state (household dietary preferences)
const [householdDiet, setHouseholdDiet] = useState<{
  diet_type: ProfileFormData['diet_type'];
  allergies: string[];
  foods_to_avoid: string;
  foods_to_include: string;
}>({
  diet_type: 'none',
  allergies: [],
  foods_to_avoid: '',
  foods_to_include: '',
});

// Step 3 state (cooking & meal structure)
const [householdCooking, setHouseholdCooking] = useState<{
  cooking_skill: ProfileFormData['cooking_skill'];
  max_cook_time: number;
  spice_tolerance: ProfileFormData['spice_tolerance'];
  cuisines: string[];
  meals_per_day: string[];
  snacks_per_day: number;
  meals_to_repeat: number;
}>({
  cooking_skill: 'intermediate',
  max_cook_time: 45,
  spice_tolerance: 'medium',
  cuisines: [],
  meals_per_day: ['breakfast', 'lunch', 'dinner'],
  snacks_per_day: 1,
  meals_to_repeat: 4,
});

// Loading state for step 2 pre-population
const [loadingPreferences, setLoadingPreferences] = useState(false);

// Saving state for final submit
const [saving, setSaving] = useState(false);
```

`getDefaultProfileFormData()` is a helper function (see [Shared Constants & Helpers](#shared-constants--helpers)).

#### Layout — Step 1

The step 1 panel renders the following elements in vertical order:

```
[ Profile Name input — full width ]
[ "Select Family Members" heading + selected count badge ]
[ Member selection grid — 2 columns on sm+, 1 column on xs ]
[ "+ Create New Member" button — full width, dashed border style ]
[ Inline accordion form — conditionally visible ]
[ "Next" button — right-aligned ]
```

**Profile Name Input:**

```tsx
<Input
  label="Joint Profile Name"
  type="text"
  value={name}
  onChange={(e) => setName(e.target.value)}
  placeholder="e.g., Family Plan, Our Household"
  fullWidth
  autoFocus
/>
```

**Member selection header:**

```tsx
<div className="flex items-center justify-between">
  <p className="text-sm font-semibold" style={{ color: 'var(--text-secondary)' }}>
    Select Family Members
  </p>
  {selectedMemberIds.length > 0 && (
    <span
      className="text-xs font-semibold px-2 py-0.5 rounded-full"
      style={{
        background: 'var(--brand-green-subtle)',
        color: 'var(--brand-green)',
        border: '1px solid var(--brand-green-border)',
      }}
    >
      {selectedMemberIds.length} of {individualProfiles.length} selected
    </span>
  )}
</div>
```

**Member grid:**

Render `individualProfiles` (filtered: `profiles.filter((p) => !p.is_joint)`) as a 2-column grid of selectable profile cards. Each card is a `button` element.

Each card displays:
- Avatar circle with first letter of name (green gradient when selected, muted when not)
- Name (bold, truncated)
- Age badge: small pill showing `${profile.age}y` — only if `profile.age` is available (note: `ProfileListItem` does not include `age`; this requires loading full profile data or extending the list endpoint. For Phase 6, display only the name from `ProfileListItem` if age is not available, and skip the age/weight_goal/medical_goals sub-details. The deeper profile data is loaded asynchronously in step 2 via `getProfile(id)` calls. Do not load it eagerly in step 1 to keep the wizard fast.)
- Selected indicator: green border + green checkbox (top-right corner or overlay)
- Deselect: clicking a selected card toggles it off; there is also an `X` button visible on hover on selected cards

```tsx
// Member card — selected style
style={{
  background: selected
    ? 'linear-gradient(135deg, var(--brand-green-border), var(--brand-green-subtle))'
    : 'var(--surface-glass)',
  border: selected
    ? '2px solid var(--brand-green)'
    : '1px solid var(--surface-border)',
  boxShadow: selected ? '0 0 0 1px var(--brand-green)' : 'var(--shadow-sm)',
}}
```

The `toggleMember` handler for step 1:

```typescript
const toggleMember = (id: number) => {
  setSelectedMemberIds((prev) =>
    prev.includes(id) ? prev.filter((m) => m !== id) : [...prev, id]
  );
};
```

**Empty state when no individual profiles exist:**

```tsx
{individualProfiles.length === 0 && (
  <div
    className="rounded-xl p-4 text-sm text-center"
    style={{
      background: 'var(--brand-amber-subtle)',
      border: '1px solid var(--brand-amber-glow)',
      color: 'var(--text-muted)',
    }}
  >
    No individual profiles found. Create profiles for each family member first using
    the &quot;+ Create New Member&quot; button below.
  </div>
)}
```

**"+ Create New Member" button:**

```tsx
<button
  type="button"
  onClick={() => setShowInlineForm((prev) => !prev)}
  className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-medium transition-all"
  style={{
    border: '1.5px dashed var(--brand-green-border)',
    background: showInlineForm ? 'var(--brand-green-subtle)' : 'transparent',
    color: 'var(--brand-green)',
  }}
>
  <PlusCircle className="h-4 w-4" />
  {showInlineForm ? 'Cancel' : '+ Create New Member'}
</button>
```

#### Inline Member Creation Form (Accordion)

This form expands below the "+ Create New Member" button with an animation. It is NOT a modal — it opens inline within the existing modal content, pushing the "Next" button further down.

Animation: use `animate-slide-down` (existing CSS animation in the app) or a simple `transition-all` with max-height approach if framer-motion is not available in this component.

**Form layout (within a rounded card with green-subtle background):**

```
┌─────────────────────────────────────────────────────────────────┐
│  New Member Details                                             │
│  ───────────────────────────────────────────────────────────── │
│  [ Name* ]                  [ Age* ]                           │
│  [ Gender* dropdown ]       [ Height cm* ]                     │
│  [ Weight kg* ]             [ Activity Level dropdown ]        │
│  [ Weight Goal dropdown ]                                      │
│  Medical Goals (checkboxes — adult or kid options based on age) │
│  [ Diet Type dropdown ]                                        │
│  Allergies (checkboxes — 2-col grid)                           │
│  ───────────────────────────────────────────────────────────── │
│  [ Save Member button ]     [ Cancel button ]                  │
└─────────────────────────────────────────────────────────────────┘
```

The form reuses the exact same field structures, option arrays, and `CheckboxItem` helper component defined in `frontend/src/app/app/profile/page.tsx`. Do not duplicate logic — extract them into shared utilities. See the [Shared Constants & Helpers](#shared-constants--helpers) section for details on what to extract.

**Age-based medical goals:** The inline form must show different medical goal checkboxes based on `inlineFormData.age`:
- Age < 18: `['healthy_growth', 'brain_development', 'bone_health', 'immune_support', 'picky_eater_support', 'general_wellness']`
- Age >= 18: `['diabetes_management', 'heart_health', 'high_protein', 'muscle_building', 'general_wellness']`

This mirrors the existing profile page logic exactly. The inline form does NOT include the "cooking preferences" section (cooking_skill, max_cook_time, cuisines, meals_per_day) — those are household-level and collected in Step 3.

**Save Member handler:**

```typescript
const handleSaveMember = async () => {
  // Basic validation
  if (
    !inlineFormData.name?.trim() ||
    !inlineFormData.age ||
    !inlineFormData.gender ||
    !inlineFormData.height_cm ||
    !inlineFormData.weight_kg
  ) {
    toast.error('Please fill in all required fields');
    return;
  }

  setSavingMember(true);
  try {
    // Build full ProfileFormData with defaults for household-level fields
    const profileData: ProfileFormData = {
      name: inlineFormData.name!.trim(),
      age: inlineFormData.age!,
      gender: inlineFormData.gender!,
      height_cm: inlineFormData.height_cm!,
      weight_kg: inlineFormData.weight_kg!,
      activity_level: inlineFormData.activity_level ?? 'moderately_active',
      household_size: 1,
      weight_goal: inlineFormData.weight_goal ?? 'maintain',
      medical_goals: inlineFormData.medical_goals ?? [],
      diet_type: inlineFormData.diet_type ?? 'none',
      allergies: inlineFormData.allergies ?? [],
      foods_to_avoid: inlineFormData.foods_to_avoid ?? '',
      foods_to_include: inlineFormData.foods_to_include ?? '',
      spice_tolerance: inlineFormData.spice_tolerance ?? 'medium',
      // Cooking defaults — will be overridden by household settings in Step 3
      cooking_skill: 'intermediate',
      max_cook_time: 45,
      cuisines: [],
      meals_per_day: ['breakfast', 'lunch', 'dinner'],
      snacks_per_day: 1,
      meals_to_repeat: 4,
    };

    const newProfile = await createProfile(profileData);

    // Refresh the profile list so the new profile appears in the grid
    await refreshProfiles();

    // Auto-select the newly created profile
    setSelectedMemberIds((prev) => [...prev, newProfile.id]);

    // Reset and collapse the form
    setInlineFormData(getDefaultProfileFormData());
    setShowInlineForm(false);

    toast.success(`${newProfile.name} added!`);
  } catch (error) {
    toast.error(getErrorMessage(error));
  } finally {
    setSavingMember(false);
  }
};
```

**Cancel handler:**

```typescript
const handleCancelInlineForm = () => {
  setInlineFormData(getDefaultProfileFormData());
  setShowInlineForm(false);
};
```

#### Step 1 Navigation

Proceed condition: `name.trim().length > 0 && selectedMemberIds.length >= 2`

```tsx
<div className="flex justify-end pt-2">
  <Button
    onClick={handleProceedToStep2}
    disabled={!name.trim() || selectedMemberIds.length < 2}
  >
    Next <ArrowRight className="h-4 w-4 ml-1" />
  </Button>
</div>
```

**`handleProceedToStep2`:** This handler must load full profile data for all selected members and pre-populate the Step 2 form state before advancing the step counter. This avoids a jarring loading spinner mid-step.

```typescript
const handleProceedToStep2 = async () => {
  if (selectedMemberIds.length < 2 || !name.trim()) return;

  setLoadingPreferences(true);
  try {
    // Load full profile data for all selected members in parallel
    const memberProfiles = await Promise.all(
      selectedMemberIds.map((id) => getProfile(id))
    );

    // Pre-populate Step 2: Household Dietary Preferences
    setHouseholdDiet({
      diet_type: computeStrictestDietType(memberProfiles.map((p) => p.diet_type)),
      allergies: computeAllergyUnion(memberProfiles.map((p) => p.allergies)),
      foods_to_avoid: computeConcatenatedUnique(memberProfiles.map((p) => p.foods_to_avoid)),
      foods_to_include: computeConcatenatedUnique(memberProfiles.map((p) => p.foods_to_include)),
    });

    // Pre-populate Step 3: Household Cooking Preferences
    setHouseholdCooking({
      cooking_skill: computeMostRestrictiveCookingSkill(memberProfiles.map((p) => p.cooking_skill)),
      max_cook_time: Math.min(...memberProfiles.map((p) => p.max_cook_time)),
      spice_tolerance: computeMostRestrictiveSpice(memberProfiles.map((p) => p.spice_tolerance)),
      cuisines: computeCuisineIntersection(memberProfiles.map((p) => p.cuisines)),
      meals_per_day: memberProfiles[0].meals_per_day,  // First member's meal structure
      snacks_per_day: memberProfiles[0].snacks_per_day,
      meals_to_repeat: memberProfiles[0].meals_to_repeat ?? 4,
    });

    setStep(2);
  } catch (error) {
    toast.error('Failed to load member preferences: ' + getErrorMessage(error));
  } finally {
    setLoadingPreferences(false);
  }
};
```

The button shows a loading state while profiles are being fetched:

```tsx
<Button
  onClick={handleProceedToStep2}
  disabled={!name.trim() || selectedMemberIds.length < 2}
  loading={loadingPreferences}
>
  {loadingPreferences ? 'Loading preferences...' : 'Next'}
  {!loadingPreferences && <ArrowRight className="h-4 w-4 ml-1" />}
</Button>
```

---

### Step 2: Household Dietary Preferences

#### Info Callout

At the top of Step 2, render an info box that explains why household preferences are being collected separately:

```tsx
<div
  className="flex items-start gap-3 p-3.5 rounded-xl mb-4"
  style={{
    background: 'var(--color-info-bg)',
    border: '1px solid rgba(83, 155, 245, 0.25)',
  }}
>
  <Info className="h-4 w-4 shrink-0 mt-0.5" style={{ color: 'var(--color-info)' }} />
  <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
    These preferences apply to <strong>ALL meals</strong> in this household plan. Individual health
    goals (weight management, medical conditions) are handled per-person automatically.
  </p>
</div>
```

#### Pre-population disclaimer

Below the info callout, show a small text note explaining that values were pre-computed:

```tsx
<p className="text-xs mb-4" style={{ color: 'var(--text-muted)' }}>
  Pre-populated from your selected members. You can adjust any value below.
</p>
```

#### Fields

All fields use the same UI components (`Select`, `Input`, `CheckboxItem`) as the profile page. The state object being mutated is `householdDiet`.

**Diet Type dropdown:**

```tsx
<Select
  label="Diet Type"
  options={dietTypeOptions}
  value={householdDiet.diet_type}
  onChange={(e) =>
    setHouseholdDiet((prev) => ({
      ...prev,
      diet_type: e.target.value as ProfileFormData['diet_type'],
    }))
  }
  fullWidth
/>
```

A helper note below the dropdown: `"Most restrictive from your members. Adjust if needed."`

**Allergies checkboxes (2-3 column grid):**

Pre-check any allergies in the union. Each checkbox toggles the allergy in `householdDiet.allergies`.

```tsx
<div>
  <label className="block text-sm font-semibold mb-3" style={{ color: 'var(--text-primary)' }}>
    Allergies
    <span className="ml-2 text-xs font-normal" style={{ color: 'var(--text-muted)' }}>
      (union of all members)
    </span>
  </label>
  <div className="grid grid-cols-2 md:grid-cols-3 gap-1">
    {allergiesOptions.map((allergy) => (
      <CheckboxItem
        key={allergy}
        label={allergy}
        checked={householdDiet.allergies.includes(allergy)}
        onChange={() => {
          setHouseholdDiet((prev) => ({
            ...prev,
            allergies: prev.allergies.includes(allergy)
              ? prev.allergies.filter((a) => a !== allergy)
              : [...prev.allergies, allergy],
          }));
        }}
      />
    ))}
  </div>
</div>
```

**Foods to Avoid (textarea):**

```tsx
<div>
  <label className="block text-sm font-semibold mb-1" style={{ color: 'var(--text-primary)' }}>
    Foods to Avoid
    <span className="ml-2 text-xs font-normal" style={{ color: 'var(--text-muted)' }}>
      (combined from all members)
    </span>
  </label>
  <textarea
    value={householdDiet.foods_to_avoid}
    onChange={(e) =>
      setHouseholdDiet((prev) => ({ ...prev, foods_to_avoid: e.target.value }))
    }
    placeholder="e.g., bitter gourd, raw onion, mushrooms"
    rows={3}
    className="w-full rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2"
    style={{
      background: 'var(--bg-input)',
      border: '1px solid var(--surface-border)',
      color: 'var(--text-secondary)',
    }}
    maxLength={1000}
  />
</div>
```

**Foods to Include (textarea):** Same structure as foods_to_avoid, bound to `householdDiet.foods_to_include`.

#### Step 2 Navigation

```tsx
<div className="flex justify-between pt-2">
  <Button variant="ghost" onClick={() => setStep(1)}>
    <ArrowLeft className="h-4 w-4 mr-1" /> Back
  </Button>
  <Button onClick={() => setStep(3)}>
    Next <ArrowRight className="h-4 w-4 ml-1" />
  </Button>
</div>
```

No disabled condition — all fields are optional (the user may accept pre-populated values as-is).

---

### Step 3: Cooking & Meal Structure

#### Pre-population note

Same small note as Step 2: `"Pre-populated from your selected members. You can adjust any value below."`

#### Fields

All state mutations go to `householdCooking`.

**Cooking Skill (select):**

```tsx
<Select
  label="Cooking Skill"
  options={cookingSkillOptions}
  value={householdCooking.cooking_skill}
  onChange={(e) =>
    setHouseholdCooking((prev) => ({
      ...prev,
      cooking_skill: e.target.value as ProfileFormData['cooking_skill'],
    }))
  }
  fullWidth
/>
```

Helper text: `"Using the lowest skill level from your members."`

**Max Cook Time (number input):**

```tsx
<Input
  label="Max Cook Time (minutes)"
  type="number"
  value={householdCooking.max_cook_time}
  onChange={(e) =>
    setHouseholdCooking((prev) => ({ ...prev, max_cook_time: Number(e.target.value) }))
  }
  min={10}
  max={120}
  helperText="Per meal. Using the shortest time from your members."
  fullWidth
/>
```

**Spice Tolerance (select):**

```tsx
<Select
  label="Spice Tolerance"
  options={spiceToleranceOptions}
  value={householdCooking.spice_tolerance}
  onChange={(e) =>
    setHouseholdCooking((prev) => ({
      ...prev,
      spice_tolerance: e.target.value as ProfileFormData['spice_tolerance'],
    }))
  }
  fullWidth
/>
```

Helper text: `"Using the mildest tolerance from your members."`

**Preferred Cuisines (checkbox grid):**

```tsx
<div>
  <label className="block text-sm font-semibold mb-3" style={{ color: 'var(--text-primary)' }}>
    Preferred Cuisines
    <span className="ml-2 text-xs font-normal" style={{ color: 'var(--text-muted)' }}>
      (intersection of member preferences)
    </span>
  </label>
  <div className="grid grid-cols-2 md:grid-cols-3 gap-1">
    {cuisinesOptions.map((cuisine) => (
      <CheckboxItem
        key={cuisine}
        label={cuisine}
        checked={householdCooking.cuisines.includes(cuisine)}
        onChange={() => {
          setHouseholdCooking((prev) => ({
            ...prev,
            cuisines: prev.cuisines.includes(cuisine)
              ? prev.cuisines.filter((c) => c !== cuisine)
              : [...prev.cuisines, cuisine],
          }));
        }}
      />
    ))}
  </div>
  {householdCooking.cuisines.length === 0 && (
    <p className="text-xs mt-2" style={{ color: 'var(--brand-amber)' }}>
      No cuisine overlap found between members. All cuisines are available — select your
      household preferences.
    </p>
  )}
</div>
```

**Meals Per Day (pill toggles):**

Reuse the exact pill-button pattern from the profile page. Each pill is a `button` with green gradient when selected.

```tsx
<div>
  <label className="block text-sm font-semibold mb-3" style={{ color: 'var(--text-primary)' }}>
    Meals Per Day
  </label>
  <div className="flex gap-3">
    {['breakfast', 'lunch', 'dinner'].map((meal) => {
      const isSelected = householdCooking.meals_per_day.includes(meal);
      return (
        <button
          key={meal}
          type="button"
          onClick={() => {
            setHouseholdCooking((prev) => ({
              ...prev,
              meals_per_day: isSelected
                ? prev.meals_per_day.filter((m) => m !== meal)
                : [...prev.meals_per_day, meal],
            }));
          }}
          className="px-5 py-2 rounded-xl text-sm font-medium capitalize transition-all"
          style={{
            background: isSelected
              ? 'linear-gradient(135deg, var(--brand-green), var(--brand-green-light))'
              : 'var(--bg-input)',
            color: isSelected ? 'white' : 'var(--text-secondary)',
            border: isSelected
              ? '1.5px solid var(--brand-green)'
              : '1.5px solid var(--surface-glass)',
            boxShadow: isSelected ? '0 2px 8px var(--brand-green-glow)' : 'none',
          }}
        >
          {meal}
        </button>
      );
    })}
  </div>
</div>
```

**Snacks Per Day (number input):**

```tsx
<Input
  label="Snacks Per Day"
  type="number"
  value={householdCooking.snacks_per_day}
  onChange={(e) =>
    setHouseholdCooking((prev) => ({ ...prev, snacks_per_day: Number(e.target.value) }))
  }
  min={0}
  max={3}
  fullWidth
/>
```

**Meals to Repeat Per Week (number input):**

```tsx
<Input
  label="Meals to Repeat Per Week"
  type="number"
  value={householdCooking.meals_to_repeat}
  onChange={(e) =>
    setHouseholdCooking((prev) => ({ ...prev, meals_to_repeat: Number(e.target.value) }))
  }
  min={0}
  max={7}
  helperText="Number of lunch/dinner meals to repeat across the week (0 = all unique)"
  fullWidth
/>
```

#### Submit Handler

The submit button on Step 3 constructs the full `JointProfileCreate` payload (see Phase 5 types — the `primary_profile_id` field is **removed** from this type; it is no longer part of the API contract).

```typescript
const handleSubmit = async () => {
  if (selectedMemberIds.length < 2 || !name.trim()) return;

  setSaving(true);
  try {
    const payload: JointProfileCreate = {
      name: name.trim(),
      member_profile_ids: selectedMemberIds,
      // Household dietary preferences from Step 2
      diet_type: householdDiet.diet_type,
      allergies: householdDiet.allergies,
      foods_to_avoid: householdDiet.foods_to_avoid,
      foods_to_include: householdDiet.foods_to_include,
      // Household cooking/meal structure from Step 3
      cooking_skill: householdCooking.cooking_skill,
      max_cook_time: householdCooking.max_cook_time,
      spice_tolerance: householdCooking.spice_tolerance,
      cuisines: householdCooking.cuisines,
      meals_per_day: householdCooking.meals_per_day,
      snacks_per_day: householdCooking.snacks_per_day,
      meals_to_repeat: householdCooking.meals_to_repeat,
    };

    const result = await createJointProfile(payload);
    await refreshProfiles();
    switchProfile(result.profile.id);
    toast.success('Joint profile created!');
    handleClose();
  } catch (error) {
    toast.error(getErrorMessage(error));
  } finally {
    setSaving(false);
  }
};
```

#### Step 3 Navigation

```tsx
<div className="flex justify-between pt-2">
  <Button variant="ghost" onClick={() => setStep(2)}>
    <ArrowLeft className="h-4 w-4 mr-1" /> Back
  </Button>
  <Button onClick={handleSubmit} loading={saving}>
    <Users className="h-4 w-4 mr-1" /> Create Joint Profile
  </Button>
</div>
```

#### Reset Function

The `reset()` function must clear all new state fields added in this redesign:

```typescript
const reset = () => {
  setStep(1);
  setName('');
  setSelectedMemberIds([]);
  setShowInlineForm(false);
  setInlineFormData(getDefaultProfileFormData());
  setSavingMember(false);
  setHouseholdDiet({
    diet_type: 'none',
    allergies: [],
    foods_to_avoid: '',
    foods_to_include: '',
  });
  setHouseholdCooking({
    cooking_skill: 'intermediate',
    max_cook_time: 45,
    spice_tolerance: 'medium',
    cuisines: [],
    meals_per_day: ['breakfast', 'lunch', 'dinner'],
    snacks_per_day: 1,
    meals_to_repeat: 4,
  });
  setLoadingPreferences(false);
  setSaving(false);
};
```

#### Required Import Changes

Remove from imports: `Crown` (no longer used)
Add to imports: `PlusCircle`, `Info`, `createProfile` from api

```typescript
// Remove:
import { Users, Crown, Check, ArrowRight, ArrowLeft } from 'lucide-react';
import { createJointProfile } from '@/lib/api';

// Replace with:
import { Users, Check, ArrowRight, ArrowLeft, PlusCircle, Info } from 'lucide-react';
import { createJointProfile, createProfile, getProfile } from '@/lib/api';

// Add type imports:
import type { ProfileListItem, ProfileFormData } from '@/types';
```

---

## Task 6.2 — Settings Page: Workflow Toggle

**File to modify:** `frontend/src/app/app/settings/page.tsx`

### Before vs After

**Before:** The "Preferences / Application Settings" card contains only placeholder text: *"Additional settings will appear here. Currently, you can manage data from the Danger Zone below."*

**After:** The card is replaced with a real "Family Meal Planning" settings section containing two radio-style selectable cards. The Danger Zone section remains unchanged below it.

### State

```typescript
// Add to existing state declarations at the top of SettingsPage()
const [workflow, setWorkflow] = useState<'hybrid' | 'llm_only'>('hybrid');
const [loadingWorkflow, setLoadingWorkflow] = useState(true);
const [savingWorkflow, setSavingWorkflow] = useState(false);
```

### Mount Effect

Load the current workflow setting on page mount:

```typescript
useEffect(() => {
  async function loadWorkflow() {
    try {
      const settings = await getUserSettings();
      setWorkflow(settings.family_meal_workflow);
    } catch {
      // Non-critical — default stays 'hybrid'
    } finally {
      setLoadingWorkflow(false);
    }
  }
  loadWorkflow();
}, []);
```

`getUserSettings()` is a new API function added in Phase 5 (`api.ts`). It calls `GET /settings/workflow` and returns `{ family_meal_workflow: 'hybrid' | 'llm_only' }`.

### Change Handler

```typescript
const handleWorkflowChange = async (value: 'hybrid' | 'llm_only') => {
  if (value === workflow || savingWorkflow) return;

  setSavingWorkflow(true);
  const previous = workflow;
  setWorkflow(value); // Optimistic update
  try {
    await updateUserSettings({ family_meal_workflow: value });
    toast.success('Settings updated');
  } catch (error) {
    setWorkflow(previous); // Revert on failure
    toast.error(getErrorMessage(error));
  } finally {
    setSavingWorkflow(false);
  }
};
```

`updateUserSettings()` is a new API function added in Phase 5. It calls `PATCH /settings/workflow` with `{ workflow: value }`.

### Layout — Settings Card Replacement

Replace the existing placeholder `<div>` (the one with class `"bg-[var(--bg-secondary)]..."` and "Application Settings" heading) with the following:

```tsx
<div
  className="bg-[var(--bg-secondary)] border border-[var(--surface-border)] rounded-[var(--radius-lg)] overflow-hidden mb-4"
  style={{ boxShadow: 'var(--shadow-md)' }}
>
  {/* Card Header */}
  <div className="px-6 py-4 border-b border-[var(--surface-border)]">
    <p className="type-overline text-[var(--brand-green)] mb-0.5">Preferences</p>
    <h2 className="type-h4 text-[var(--text-primary)]">Family Meal Planning</h2>
    <p className="text-sm mt-1 text-[var(--text-secondary)]">
      Choose how portion sizes are calculated for family meal plans
    </p>
  </div>

  {/* Card Body */}
  <div className="p-6">
    {loadingWorkflow ? (
      <div className="flex items-center gap-3 py-2">
        <Loader2 className="h-4 w-4 animate-spin" style={{ color: 'var(--brand-green)' }} />
        <span className="text-sm" style={{ color: 'var(--text-muted)' }}>
          Loading settings...
        </span>
      </div>
    ) : (
      <div className="space-y-3">
        {/* Option 1: Precision Mode (Hybrid) */}
        <WorkflowOptionCard
          value="hybrid"
          currentValue={workflow}
          title="Precision Mode (LP + AI)"
          description="Uses linear programming to compute mathematically optimal portions per person, with AI for dish selection. More precise nutrition targeting."
          badge="Recommended"
          onChange={handleWorkflowChange}
          saving={savingWorkflow}
        />

        {/* Option 2: Quick Mode (LLM Only) */}
        <WorkflowOptionCard
          value="llm_only"
          currentValue={workflow}
          title="Quick Mode (AI Only)"
          description="AI generates portion adjustments directly. Faster generation, but nutrition targets are approximate."
          onChange={handleWorkflowChange}
          saving={savingWorkflow}
        />
      </div>
    )}
  </div>
</div>
```

### WorkflowOptionCard Sub-Component

Define this as a local function within the file (not exported):

```typescript
interface WorkflowOptionCardProps {
  value: 'hybrid' | 'llm_only';
  currentValue: 'hybrid' | 'llm_only';
  title: string;
  description: string;
  badge?: string;
  onChange: (value: 'hybrid' | 'llm_only') => void;
  saving: boolean;
}

function WorkflowOptionCard({
  value,
  currentValue,
  title,
  description,
  badge,
  onChange,
  saving,
}: WorkflowOptionCardProps) {
  const isSelected = value === currentValue;

  return (
    <button
      type="button"
      onClick={() => onChange(value)}
      disabled={saving}
      className="w-full text-left p-4 rounded-[var(--radius-md)] transition-all"
      style={{
        background: isSelected
          ? 'linear-gradient(135deg, var(--brand-green-border), var(--brand-green-subtle))'
          : 'var(--surface-glass)',
        border: isSelected
          ? '2px solid var(--brand-green)'
          : '1px solid var(--surface-border)',
        boxShadow: isSelected ? '0 0 0 1px var(--brand-green)' : 'var(--shadow-sm)',
        opacity: saving && !isSelected ? 0.6 : 1,
        cursor: saving ? 'not-allowed' : 'pointer',
      }}
    >
      <div className="flex items-start gap-3">
        {/* Radio circle indicator */}
        <div
          className="mt-0.5 w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0"
          style={{
            borderColor: isSelected ? 'var(--brand-green)' : 'var(--surface-border)',
            background: isSelected ? 'var(--brand-green)' : 'transparent',
          }}
        >
          {isSelected && (
            <div className="w-1.5 h-1.5 rounded-full bg-white" />
          )}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span
              className="text-sm font-semibold"
              style={{
                color: isSelected ? 'var(--brand-green-dark)' : 'var(--text-primary)',
              }}
            >
              {title}
            </span>
            {badge && (
              <span
                className="text-[10px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wider"
                style={{
                  background: 'var(--brand-green-subtle)',
                  color: 'var(--brand-green)',
                  border: '1px solid var(--brand-green-border)',
                }}
              >
                {badge}
              </span>
            )}
          </div>
          <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
            {description}
          </p>
        </div>
      </div>
    </button>
  );
}
```

### Required Import Changes for Settings Page

```typescript
// Add to existing imports
import { Loader2 } from 'lucide-react';
import { getUserSettings, updateUserSettings } from '@/lib/api';
```

---

## Task 6.3 — MealCard Per-Member Serving Display

**File to modify:** `frontend/src/components/meal-plan/MealCard.tsx`

### New Type Required (from Phase 5)

The `Meal` interface in `frontend/src/types/index.ts` will be extended in Phase 5 with:

```typescript
// Add to Meal interface
member_servings?: MemberServing[] | null;
```

Where `MemberServing` is a new interface:

```typescript
export interface MemberServing {
  member_profile_id: number;
  member_name: string;
  adjustment: string;        // Human-readable text, e.g. "Half rice, extra salad"
  calories: number;
  protein: number;
  carbs: number;
  fats: number;
}
```

If Phase 5 is not yet complete, add a local `MemberServing` type stub at the top of `MealCard.tsx` as a placeholder.

### Before vs After

**Before:** The "Per Person Serving" section in `MealCard` renders each member's name and a scaled `portion_size` string computed using `scalePortionString(meal.portion_size, member.share_ratio)`. This is a rough estimate based on calorie ratios, not actual computed servings.

**After:**
- When `meal.member_servings` exists and `member_servings.length > 0`: render a new `<MemberServingsDisplay>` sub-component showing actual per-member data (adjustment text + individual macros).
- When `meal.member_servings` is null/undefined/empty AND `memberNutritionTargets` is present: fall back to the existing `share_ratio`-based display (backward compatibility for old joint plans).
- When neither is present: render nothing in this section.

### MealCardProps Change

Add the new field to the props interface:

```typescript
interface MealCardProps {
  // ... existing props unchanged ...
  memberNutritionTargets?: MemberNutritionTargets[] | null;
  // No new prop needed — member_servings comes from meal.member_servings directly
}
```

No new prop is needed because `member_servings` is part of the `Meal` object itself.

### Conditional Rendering Logic

Locate the existing "Per-person breakdown for joint profiles" section (lines 229–257 in the current file). Replace it entirely with:

```tsx
{/* Per-person breakdown — new format or legacy fallback */}
{meal.member_servings && meal.member_servings.length > 0 ? (
  <MemberServingsDisplay servings={meal.member_servings} />
) : memberNutritionTargets && memberNutritionTargets.length > 0 && meal.portion_size ? (
  /* Legacy: share_ratio based display — kept for backward compat with old joint plans */
  <div
    className="mt-2.5 pt-2.5 space-y-1.5"
    style={{ borderTop: '1px dashed var(--brand-green-border)' }}
  >
    <p className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--brand-green-light)' }}>
      Per Person Serving (estimated)
    </p>
    {memberNutritionTargets.map((member) => (
      <div
        key={member.profile_id}
        className="rounded-lg px-2.5 py-1.5"
        style={{ background: 'var(--brand-green-subtle)' }}
      >
        <div className="flex items-baseline gap-1.5 text-xs">
          <span className="font-semibold shrink-0" style={{ color: 'var(--brand-green-dark)' }}>
            {member.profile_name}:
          </span>
          <span className="font-medium" style={{ color: 'var(--text-secondary)' }}>
            {scalePortionString(meal.portion_size!, member.share_ratio)}
          </span>
        </div>
      </div>
    ))}
  </div>
) : null}
```

Note the label change from `"Per Person Serving"` to `"Per Person Serving (estimated)"` in the legacy block to make it clear to users that old plans use estimates.

### MemberServingsDisplay Sub-Component

Add this as a new function at the bottom of `MealCard.tsx` (alongside `getMealTypeGradient` and `getMealTypeBadge`):

```typescript
function MemberServingsDisplay({ servings }: { servings: MemberServing[] }) {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <div
      className="mt-2.5 pt-2.5"
      style={{ borderTop: '1px dashed var(--brand-green-border)' }}
    >
      {/* Header row — always visible */}
      <button
        type="button"
        onClick={() => setIsExpanded((prev) => !prev)}
        className="flex items-center justify-between w-full mb-1.5"
      >
        <p className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--brand-green-light)' }}>
          Per-Person Servings
        </p>
        {isExpanded
          ? <ChevronUp className="h-3 w-3" style={{ color: 'var(--text-muted)' }} />
          : <ChevronDown className="h-3 w-3" style={{ color: 'var(--text-muted)' }} />
        }
      </button>

      {/* Expanded member rows */}
      {isExpanded && (
        <div className="space-y-2 animate-slide-down">
          {servings.map((serving) => (
            <div
              key={serving.member_profile_id}
              className="rounded-lg px-2.5 py-2"
              style={{
                background: 'var(--brand-green-subtle)',
                border: '1px solid var(--brand-green-border)',
              }}
            >
              {/* Member name + adjustment text */}
              <div className="flex items-baseline gap-1.5 mb-1.5">
                <span
                  className="text-xs font-semibold shrink-0"
                  style={{ color: 'var(--brand-green-dark)' }}
                >
                  {serving.member_name}
                </span>
                {serving.adjustment && (
                  <span className="text-xs italic" style={{ color: 'var(--text-muted)' }}>
                    — {serving.adjustment}
                  </span>
                )}
              </div>

              {/* Per-member macro row */}
              <div className="flex items-center gap-3 text-[10px]" style={{ color: 'var(--text-muted)' }}>
                <span>
                  <span className="font-bold" style={{ color: 'var(--brand-amber)' }}>
                    {Math.round(serving.calories)}
                  </span>{' '}
                  kcal
                </span>
                <span>
                  <span className="font-bold" style={{ color: 'var(--color-error)' }}>
                    {Math.round(serving.protein)}g
                  </span>{' '}
                  protein
                </span>
                <span>
                  <span className="font-bold" style={{ color: 'var(--brand-amber-light)' }}>
                    {Math.round(serving.carbs)}g
                  </span>{' '}
                  carbs
                </span>
                <span>
                  <span className="font-bold" style={{ color: 'var(--color-info)' }}>
                    {Math.round(serving.fats)}g
                  </span>{' '}
                  fats
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Collapsed summary — total member count */}
      {!isExpanded && (
        <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
          {servings.length} {servings.length === 1 ? 'member' : 'members'} — click to expand
        </p>
      )}
    </div>
  );
}
```

### Share With Kids Button — Joint Profile Guard

Per the backward compatibility contract in the overview spec (`00-overview.md`), the "Share with Kids" button must be hidden for joint profiles. Add this guard to the `showShareButton` computed value:

```typescript
// Before:
const showShareButton = kidProfiles && kidProfiles.length > 0 && onShareWithKids;

// After:
// Joint profiles manage the full household — kid-sharing is disabled for them
const isJointProfileContext = memberNutritionTargets && memberNutritionTargets.length > 0;
const showShareButton = kidProfiles && kidProfiles.length > 0 && onShareWithKids && !isJointProfileContext;
```

### Import Changes for MealCard

```typescript
// Add MemberServing to type imports (once Phase 5 types are available)
import type { Meal, DailyPlan, MemberNutritionTargets, KidProfile, MemberServing } from '@/types';
```

---

## Task 6.4 — DayColumn Per-Member Daily Totals

**File to modify:** `frontend/src/components/meal-plan/DayColumn.tsx`

### Before vs After

**Before:** Per-member daily calorie display computes each member's share of the day's total using:
```typescript
Math.round(dailyPlan.total_calories * member.share_ratio)
```
This is an approximation — it proportionally scales the day's aggregate totals by the calorie ratio, without knowing which components each member actually ate.

**After:** When `meal.member_servings` data exists on the meals, sum actual per-member nutrition directly from those serving records. Fall back to the legacy ratio-based display if no `member_servings` data is present.

### New Color-Coding Logic

The existing `NutritionStat` sub-component already handles binary on-target/over-target coloring (green/red). This must be extended to a three-tier system:

| Deviation from target | Color | CSS variable |
|---|---|---|
| Within ±5% | Green | `var(--brand-green)` |
| 5–15% off (either direction) | Amber/yellow | `var(--brand-amber)` |
| >15% off | Red | `var(--color-error)` |

The `NutritionStat` component props do not need to change — pass the computed `value` and `target` and update the internal color logic:

```typescript
// Inside NutritionStat — replace the color logic:
const deviation = target ? Math.abs(value - target) / target : 0;
const isOnTarget = deviation <= 0.05;
const isSlightlyOff = deviation > 0.05 && deviation <= 0.15;
// isWayOff = deviation > 0.15 (handled by the else below)

// In the return JSX, for the target display:
color: isOnTarget
  ? 'var(--brand-green)'
  : isSlightlyOff
    ? 'var(--brand-amber)'
    : 'var(--color-error)',
```

### Member Daily Totals Computation

In the per-member breakdown section of `DayColumn` (inside the `hasMembers` branch), compute member totals from actual serving data:

```typescript
// Computed inside DayColumn — placed before the return statement
// Check if any meal in this day has member_servings data
const hasMemberServings = dailyPlan.meals.some(
  (meal) => meal.member_servings && meal.member_servings.length > 0
);

// Build per-member daily actuals from member_servings if available
const memberDailyActuals = hasMemberServings
  ? memberNutritionTargets!.map((member) => {
      const totals = { calories: 0, protein: 0, carbs: 0, fats: 0 };
      dailyPlan.meals.forEach((meal) => {
        const serving = meal.member_servings?.find(
          (s) => s.member_profile_id === member.profile_id
        );
        if (serving) {
          totals.calories += serving.calories;
          totals.protein += serving.protein;
          totals.carbs += serving.carbs;
          totals.fats += serving.fats;
        }
      });
      return { member, actual: totals };
    })
  : null; // null triggers legacy display path
```

### Per-Member Card Rendering

Replace the per-member nutrition stat rendering inside the `hasMembers` branch to use `memberDailyActuals` when available:

```tsx
{memberNutritionTargets!.map((member) => {
  // Use actual serving data if available, otherwise fall back to ratio-based estimate
  const actual = memberDailyActuals
    ?.find((d) => d.member.profile_id === member.profile_id)?.actual;

  const calories = actual
    ? Math.round(actual.calories)
    : Math.round(dailyPlan.total_calories * member.share_ratio);
  const protein = actual
    ? Math.round(actual.protein)
    : Math.round(dailyPlan.total_protein * member.share_ratio);
  const carbs = actual
    ? Math.round(actual.carbs)
    : Math.round(dailyPlan.total_carbs * member.share_ratio);
  const fats = actual
    ? Math.round(actual.fats)
    : Math.round(dailyPlan.total_fats * member.share_ratio);

  return (
    <div
      key={member.profile_id}
      className="rounded-xl p-3"
      style={{
        // No longer use amber for primary vs green for secondary — all members equal
        background: 'var(--brand-green-subtle)',
        border: '1px solid var(--brand-green-subtle)',
      }}
    >
      <div className="flex items-center gap-2 mb-2">
        {/* Remove Crown icon — no primary member concept */}
        <span className="text-sm font-semibold" style={{ color: 'var(--brand-green-dark)' }}>
          {member.profile_name}
        </span>
        {/* Show "estimated" label if no actual serving data */}
        {!actual && (
          <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
            (estimated)
          </span>
        )}
      </div>
      <div className="flex flex-wrap gap-x-5 gap-y-2">
        <NutritionStat
          icon={<Flame className="h-3.5 w-3.5" />}
          label="Calories"
          value={calories}
          target={member.target_calories}
          unit="kcal"
          color="var(--brand-amber)"
        />
        <NutritionStat
          icon={<Drumstick className="h-3.5 w-3.5" />}
          label="Protein"
          value={protein}
          target={member.target_protein}
          unit="g"
          color="var(--color-error)"
        />
        <NutritionStat
          icon={<Wheat className="h-3.5 w-3.5" />}
          label="Carbs"
          value={carbs}
          target={member.target_carbs}
          unit="g"
          color="var(--brand-amber-light)"
        />
        <NutritionStat
          icon={<Droplets className="h-3.5 w-3.5" />}
          label="Fats"
          value={fats}
          target={member.target_fats}
          unit="g"
          color="var(--color-info)"
        />
      </div>
    </div>
  );
})}
```

### `is_primary` Reference Removal

**Current code** (line 88–91 in `DayColumn.tsx`):
```tsx
style={{
  background: member.is_primary
    ? 'var(--brand-amber-subtle)'
    : 'var(--brand-green-subtle)',
  border: member.is_primary
    ? '1px solid var(--brand-amber-subtle)'
    : '1px solid var(--brand-green-subtle)',
}}
```

**After:** Remove the conditional — use `var(--brand-green-subtle)` and `var(--brand-green-subtle)` for all members. Also remove the `Crown` icon and `member.is_primary` check (lines 94–97). All members are displayed equally.

### Import Changes for DayColumn

```typescript
// Remove: Crown (no longer needed)
import React from 'react';
import { RefreshCw, Flame, Drumstick, Wheat, Droplets } from 'lucide-react';
```

The `Meal` type import must include `member_servings` via the updated `Meal` interface from Phase 5. No explicit import change needed if `Meal` already includes `member_servings`.

---

## Task 6.5 — Joint Profile Page Update

**File to modify:** `frontend/src/app/app/profile/page.tsx`

### Before vs After

**Before:** The joint profile view (the `isEditing && activeProfile?.is_joint` branch) shows:
- A "primary member" card with amber background, Crown icon, and text "Primary Member — preferences are inherited from this profile"
- Other members displayed as secondary cards with green background
- An info callout: "To change dietary preferences, cooking settings, or nutrition targets, edit the individual member profiles directly."
- No display of the joint profile's own dietary/cooking preferences

**After:**
- All member cards use equal styling (no primary, no crown, no amber)
- A new "Household Preferences" section shows the joint profile's diet_type, allergies, cuisines, etc.
- The info callout is updated to remove references to "primary member"
- The page loads and displays the joint profile's `UserProfile` data (not just member names)

### State Changes

Add a new state field to `ProfilePageContent` for the full joint profile data (it is already loaded into `formData` by the existing `loadProfile` effect — reuse this):

```typescript
// No new state needed — formData already contains all joint profile fields
// The existing loadProfile effect calls getProfile(activeProfileId) and populates formData
// Just remove the primaryMember/otherMembers split logic
```

### Remove from Joint Profile View

Remove these items entirely from the `isEditing && activeProfile?.is_joint` branch:

1. `const primaryMember = jointMembers.find((m) => m.is_primary);`
2. `const otherMembers = jointMembers.filter((m) => !m.is_primary);`
3. The entire `{primaryMember && (...)}` block (the amber Crown card)
4. `Crown` import from lucide-react

### Updated Member List Rendering

Replace the entire member list rendering with equal-treatment cards:

```tsx
{/* All Members — equal display, no primary distinction */}
<div className="space-y-3">
  {jointMembers.map((member) => (
    <div
      key={member.profile_id}
      className="flex items-center gap-4 p-4 rounded-[var(--radius-md)]"
      style={{
        background: 'var(--brand-green-subtle)',
        border: '1px solid var(--brand-green-border)',
      }}
    >
      <div
        className="flex items-center justify-center w-10 h-10 rounded-full shrink-0"
        style={{
          background: 'linear-gradient(135deg, var(--brand-green), var(--brand-green-light))',
          boxShadow: '0 2px 8px var(--brand-green-glow)',
        }}
      >
        <User className="h-5 w-5 text-white" />
      </div>
      <div className="flex-1">
        <p
          className="font-semibold text-base"
          style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-inter), sans-serif' }}
        >
          {member.profile_name}
        </p>
        <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
          Household member
        </p>
      </div>
    </div>
  ))}
</div>
```

### New "Household Preferences" Card

Add this card below the existing "Members" card. It reads from `formData` (already populated by the existing `loadProfile` effect):

```tsx
<Card className="animate-slide-up stagger-1 mt-6">
  <Card.Header>
    <div className="flex items-start gap-4">
      <div
        className="flex items-center justify-center w-10 h-10 rounded-[var(--radius-md)] shrink-0"
        style={{
          background: 'var(--brand-green-subtle)',
          border: '1px solid var(--brand-green-border)',
        }}
      >
        <Leaf className="h-5 w-5 text-[var(--brand-green-light)]" />
      </div>
      <div>
        <h2 className="type-h4 text-[var(--text-primary)]">Household Preferences</h2>
        <p className="text-sm mt-0.5 text-[var(--text-muted)]">
          Shared dietary and cooking settings for this household
        </p>
      </div>
    </div>
  </Card.Header>
  <Card.Body>
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">

      {/* Diet Type */}
      <div>
        <p className="text-[10px] font-semibold uppercase tracking-wider mb-1"
          style={{ color: 'var(--brand-green-light)' }}>
          Diet Type
        </p>
        <p className="text-sm font-medium capitalize" style={{ color: 'var(--text-secondary)' }}>
          {formData.diet_type === 'none' ? 'No restrictions' : formData.diet_type}
        </p>
      </div>

      {/* Cooking Skill */}
      <div>
        <p className="text-[10px] font-semibold uppercase tracking-wider mb-1"
          style={{ color: 'var(--brand-green-light)' }}>
          Cooking Skill
        </p>
        <p className="text-sm font-medium capitalize" style={{ color: 'var(--text-secondary)' }}>
          {formData.cooking_skill}
        </p>
      </div>

      {/* Max Cook Time */}
      <div>
        <p className="text-[10px] font-semibold uppercase tracking-wider mb-1"
          style={{ color: 'var(--brand-green-light)' }}>
          Max Cook Time
        </p>
        <p className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>
          {formData.max_cook_time} minutes
        </p>
      </div>

      {/* Spice Tolerance */}
      <div>
        <p className="text-[10px] font-semibold uppercase tracking-wider mb-1"
          style={{ color: 'var(--brand-green-light)' }}>
          Spice Tolerance
        </p>
        <p className="text-sm font-medium capitalize" style={{ color: 'var(--text-secondary)' }}>
          {formData.spice_tolerance}
        </p>
      </div>

      {/* Allergies */}
      {formData.allergies.length > 0 && (
        <div className="sm:col-span-2">
          <p className="text-[10px] font-semibold uppercase tracking-wider mb-2"
            style={{ color: 'var(--brand-green-light)' }}>
            Allergies
          </p>
          <div className="flex flex-wrap gap-1.5">
            {formData.allergies.map((allergy) => (
              <span
                key={allergy}
                className="px-2 py-0.5 rounded-md text-xs font-medium capitalize"
                style={{
                  background: 'var(--color-error-bg)',
                  color: 'var(--color-error)',
                  border: '1px solid rgba(229,83,75,0.20)',
                }}
              >
                {allergy.replace(/_/g, ' ')}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Cuisines */}
      {formData.cuisines.length > 0 && (
        <div className="sm:col-span-2">
          <p className="text-[10px] font-semibold uppercase tracking-wider mb-2"
            style={{ color: 'var(--brand-green-light)' }}>
            Preferred Cuisines
          </p>
          <div className="flex flex-wrap gap-1.5">
            {formData.cuisines.map((cuisine) => (
              <span
                key={cuisine}
                className="px-2 py-0.5 rounded-md text-xs font-medium capitalize"
                style={{
                  background: 'var(--brand-green-subtle)',
                  color: 'var(--brand-green)',
                  border: '1px solid var(--brand-green-border)',
                }}
              >
                {cuisine.replace(/_/g, ' ')}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Meals Per Day */}
      <div className="sm:col-span-2">
        <p className="text-[10px] font-semibold uppercase tracking-wider mb-2"
          style={{ color: 'var(--brand-green-light)' }}>
          Meals Per Day
        </p>
        <div className="flex gap-2 flex-wrap">
          {formData.meals_per_day.map((meal) => (
            <span
              key={meal}
              className="px-3 py-1 rounded-lg text-xs font-medium capitalize"
              style={{
                background: 'var(--brand-green-subtle)',
                color: 'var(--brand-green)',
                border: '1px solid var(--brand-green-border)',
              }}
            >
              {meal}
            </span>
          ))}
          {formData.snacks_per_day > 0 && (
            <span
              className="px-3 py-1 rounded-lg text-xs font-medium"
              style={{
                background: 'var(--surface-glass)',
                color: 'var(--text-muted)',
                border: '1px solid var(--surface-border)',
              }}
            >
              +{formData.snacks_per_day} snack{formData.snacks_per_day > 1 ? 's' : ''}
            </span>
          )}
        </div>
      </div>

    </div>
  </Card.Body>
</Card>
```

### Updated Info Callout

Replace the existing info callout text:

**Before:**
```
"To change dietary preferences, cooking settings, or nutrition targets, edit the individual member profiles directly."
```

**After:**
```tsx
<div
  className="flex items-start gap-3 p-4 rounded-[var(--radius-lg)] mt-7 animate-slide-up stagger-2"
  style={{
    background: 'var(--brand-green-subtle)',
    border: '1px solid var(--brand-green-border)',
  }}
>
  <Info className="h-5 w-5 shrink-0 mt-0.5" style={{ color: 'var(--brand-green)' }} />
  <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
    Household preferences apply to all meals in this plan. Individual health goals
    (weight management, medical conditions) are applied per-person during meal generation.
    To update preferences, delete this joint profile and create a new one.
  </p>
</div>
```

### Updated Page Subtitle

**Before:** `"All preferences are inherited from the primary member. Nutrition targets are combined across all members."`

**After:** `"Household meal planning for {jointMembers.length} members. Each member's individual health goals are honored automatically."`

```tsx
<p className="mt-2 text-base" style={{ color: 'var(--text-muted)' }}>
  Household meal planning for {jointMembers.length} member{jointMembers.length !== 1 ? 's' : ''}.
  Each member&apos;s individual health goals are honored automatically.
</p>
```

### Import Changes for Profile Page

```typescript
// Add Leaf to imports (for Household Preferences card header)
import { User, Heart, Leaf, ChefHat, Sparkles, Info, Baby, Users, ArrowLeft } from 'lucide-react';
// Remove: Crown
```

---

## New Type Definitions Required

These types are specified here for the Phase 5 developer's reference. They must exist in `frontend/src/types/index.ts` before Phase 6 work begins. If Phase 5 is still in progress, stub them locally.

### MemberServing

```typescript
/**
 * Per-member portion allocation for a single meal.
 * Populated by the hybrid (LP) or LLM-only workflow for joint profiles.
 * Absent for non-joint profiles and for old joint plans generated before this redesign.
 */
export interface MemberServing {
  member_profile_id: number;
  member_name: string;         // Denormalized for display without extra lookup
  adjustment: string;          // Human-readable portion description, e.g. "Half rice, extra salad"
  calories: number;
  protein: number;
  carbs: number;
  fats: number;
}
```

### Updated Meal Interface

```typescript
export interface Meal {
  // ... all existing fields unchanged ...

  // Per-member servings — present only for joint profile plans generated after redesign
  // null or absent for non-joint plans and old joint plans (backward compat)
  member_servings?: MemberServing[] | null;
}
```

### Updated JointProfileMember

```typescript
export interface JointProfileMember {
  profile_id: number;
  profile_name: string;
  // is_primary REMOVED — no longer part of the API response
}
```

### Updated MemberNutritionTargets

```typescript
export interface MemberNutritionTargets extends NutritionTargets {
  profile_id: number;
  profile_name: string;
  share_ratio: number;
  // is_primary REMOVED
}
```

### Updated JointProfileCreate

```typescript
export interface JointProfileCreate {
  name: string;
  // primary_profile_id REMOVED — no longer sent to API
  member_profile_ids: number[];
  // Household dietary preferences (from Step 2)
  diet_type: UserProfile['diet_type'];
  allergies: string[];
  foods_to_avoid: string;
  foods_to_include: string;
  // Household cooking preferences (from Step 3)
  cooking_skill: UserProfile['cooking_skill'];
  max_cook_time: number;
  spice_tolerance: UserProfile['spice_tolerance'];
  cuisines: string[];
  meals_per_day: string[];
  snacks_per_day: number;
  meals_to_repeat: number;
}
```

### New Types for Settings and SSE (Phase 5)

```typescript
export interface WorkflowSetting {
  family_meal_workflow: 'hybrid' | 'llm_only';
}

export interface SSEProgressStep {
  step: string;
  stepIndex: number;
  totalSteps: number;
  message: string;
}
```

---

## Shared Constants & Helpers

To avoid duplicating form field definitions between `JointProfileWizard` (inline member creation form) and `profile/page.tsx`, extract the following into a shared module.

**Recommended file:** `frontend/src/lib/profileFormConstants.ts` (new file)

### Contents of profileFormConstants.ts

```typescript
import type { SelectOption } from '@/components/ui/Select';
import type { ProfileFormData } from '@/types';

// ── Option arrays (currently defined inline in profile/page.tsx) ──────────

export const genderOptions: SelectOption[] = [
  { value: 'male', label: 'Male' },
  { value: 'female', label: 'Female' },
  { value: 'other', label: 'Other' },
];

export const activityLevelOptions: SelectOption[] = [
  { value: 'sedentary', label: 'Sedentary (little to no exercise)' },
  { value: 'lightly_active', label: 'Lightly Active (1-3 days/week)' },
  { value: 'moderately_active', label: 'Moderately Active (3-5 days/week)' },
  { value: 'very_active', label: 'Very Active (6-7 days/week)' },
  { value: 'extra_active', label: 'Extra Active (very hard exercise)' },
];

export const weightGoalOptions: SelectOption[] = [
  { value: 'lose', label: 'Lose Weight' },
  { value: 'maintain', label: 'Maintain Weight' },
  { value: 'gain', label: 'Gain Weight' },
];

export const dietTypeOptions: SelectOption[] = [
  { value: 'none', label: 'No Restrictions' },
  { value: 'vegetarian', label: 'Vegetarian' },
  { value: 'vegan', label: 'Vegan' },
  { value: 'pescatarian', label: 'Pescatarian' },
  { value: 'keto', label: 'Keto' },
  { value: 'paleo', label: 'Paleo' },
  { value: 'mediterranean', label: 'Mediterranean' },
];

export const spiceToleranceOptions: SelectOption[] = [
  { value: 'mild', label: 'Mild' },
  { value: 'medium', label: 'Medium' },
  { value: 'hot', label: 'Hot' },
];

export const cookingSkillOptions: SelectOption[] = [
  { value: 'beginner', label: 'Beginner' },
  { value: 'intermediate', label: 'Intermediate' },
  { value: 'advanced', label: 'Advanced' },
];

export const adultMedicalGoalsOptions = [
  'diabetes_management',
  'heart_health',
  'high_protein',
  'muscle_building',
  'general_wellness',
];

export const kidMedicalGoalsOptions = [
  'healthy_growth',
  'brain_development',
  'bone_health',
  'immune_support',
  'picky_eater_support',
  'general_wellness',
];

export const allergiesOptions = [
  'peanuts',
  'tree_nuts',
  'dairy',
  'eggs',
  'soy',
  'wheat',
  'fish',
  'shellfish',
];

export const cuisinesOptions = [
  'indian',
  'punjabi',
  'chinese',
  'italian',
  'mexican',
  'japanese',
  'thai',
  'mediterranean',
  'american',
  'middle_eastern',
  'korean',
];

// ── Default form data factory ─────────────────────────────────────────────

/**
 * Returns a fresh ProfileFormData object with safe defaults.
 * Used for the inline member creation form and for resetting forms.
 */
export function getDefaultProfileFormData(): Partial<ProfileFormData> {
  return {
    name: '',
    age: undefined,
    gender: 'male',
    height_cm: undefined,
    weight_kg: undefined,
    activity_level: 'moderately_active',
    household_size: 1,
    weight_goal: 'maintain',
    medical_goals: [],
    diet_type: 'none',
    allergies: [],
    foods_to_avoid: '',
    foods_to_include: '',
    spice_tolerance: 'medium',
    cooking_skill: 'intermediate',
    max_cook_time: 45,
    cuisines: [],
    meals_per_day: ['breakfast', 'lunch', 'dinner'],
    snacks_per_day: 1,
    meals_to_repeat: 4,
  };
}

// ── Pre-population merge helpers ──────────────────────────────────────────

/**
 * Strictness hierarchy for diet types.
 * Higher index = more restrictive. The most restrictive wins for household plans.
 */
const DIET_STRICTNESS: ProfileFormData['diet_type'][] = [
  'none',
  'mediterranean',
  'keto',
  'paleo',
  'pescatarian',
  'vegetarian',
  'vegan',
];

/**
 * Returns the strictest diet type from a list of member diet types.
 * e.g. ['none', 'vegetarian', 'none'] → 'vegetarian'
 */
export function computeStrictestDietType(
  dietTypes: ProfileFormData['diet_type'][]
): ProfileFormData['diet_type'] {
  let maxIndex = 0;
  for (const dt of dietTypes) {
    const idx = DIET_STRICTNESS.indexOf(dt);
    if (idx > maxIndex) maxIndex = idx;
  }
  return DIET_STRICTNESS[maxIndex];
}

/**
 * Returns the union (set union) of all members' allergy arrays.
 * e.g. [['peanuts'], ['dairy', 'peanuts']] → ['peanuts', 'dairy']
 */
export function computeAllergyUnion(allergyArrays: string[][]): string[] {
  const result = new Set<string>();
  for (const arr of allergyArrays) {
    for (const a of arr) {
      result.add(a);
    }
  }
  return Array.from(result);
}

/**
 * Concatenates comma-separated food strings from multiple members,
 * deduplicating items case-insensitively.
 */
export function computeConcatenatedUnique(foodStrings: string[]): string {
  const combined = foodStrings
    .flatMap((s) => s.split(',').map((item) => item.trim().toLowerCase()))
    .filter(Boolean);
  const unique = Array.from(new Set(combined));
  return unique.join(', ');
}

/**
 * Skill hierarchy: beginner < intermediate < advanced.
 * Returns the most restrictive (lowest) skill level.
 */
const SKILL_ORDER: ProfileFormData['cooking_skill'][] = [
  'beginner',
  'intermediate',
  'advanced',
];

export function computeMostRestrictiveCookingSkill(
  skills: ProfileFormData['cooking_skill'][]
): ProfileFormData['cooking_skill'] {
  let minIndex = SKILL_ORDER.length - 1;
  for (const skill of skills) {
    const idx = SKILL_ORDER.indexOf(skill);
    if (idx < minIndex) minIndex = idx;
  }
  return SKILL_ORDER[minIndex];
}

/**
 * Spice hierarchy: mild < medium < hot.
 * Returns the most restrictive (mildest) tolerance.
 */
const SPICE_ORDER: ProfileFormData['spice_tolerance'][] = ['mild', 'medium', 'hot'];

export function computeMostRestrictiveSpice(
  tolerances: ProfileFormData['spice_tolerance'][]
): ProfileFormData['spice_tolerance'] {
  let minIndex = SPICE_ORDER.length - 1;
  for (const t of tolerances) {
    const idx = SPICE_ORDER.indexOf(t);
    if (idx < minIndex) minIndex = idx;
  }
  return SPICE_ORDER[minIndex];
}

/**
 * Returns the intersection of cuisine arrays.
 * If the intersection is empty, returns the union (all cuisines from all members).
 * An empty result from union means no member has cuisines set — returns [].
 */
export function computeCuisineIntersection(cuisineArrays: string[][]): string[] {
  if (cuisineArrays.length === 0) return [];

  // Filter out empty arrays before intersecting
  const nonEmpty = cuisineArrays.filter((arr) => arr.length > 0);
  if (nonEmpty.length === 0) return [];

  // Start with the first non-empty array's set
  let intersection = new Set(nonEmpty[0]);

  for (let i = 1; i < nonEmpty.length; i++) {
    const current = new Set(nonEmpty[i]);
    intersection = new Set([...intersection].filter((c) => current.has(c)));
  }

  // If intersection is empty, fall back to union
  if (intersection.size === 0) {
    return computeAllergyUnion(nonEmpty); // reuse union logic
  }

  return Array.from(intersection);
}
```

**Usage in JointProfileWizard:** Import all helpers from `@/lib/profileFormConstants`.
**Usage in profile/page.tsx:** Replace inline constant definitions with imports from `@/lib/profileFormConstants`.
