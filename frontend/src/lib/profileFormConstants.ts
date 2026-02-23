/**
 * Shared form constants and merge helpers for profile creation and joint wizard.
 *
 * Extracted from profile/page.tsx so the JointProfileWizard inline member
 * creation form can reuse the same option arrays, default values, and merge
 * algorithms without duplication.
 */

import type { SelectOption } from '@/components/ui/Select';
import type { ProfileFormData } from '@/types';

// ── Option arrays ─────────────────────────────────────────────────────────────

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

export const adultMedicalGoalsOptions: string[] = [
  'diabetes_management',
  'heart_health',
  'high_protein',
  'muscle_building',
  'general_wellness',
];

export const kidMedicalGoalsOptions: string[] = [
  'healthy_growth',
  'brain_development',
  'bone_health',
  'immune_support',
  'picky_eater_support',
  'general_wellness',
];

export const allergiesOptions: string[] = [
  'peanuts',
  'tree_nuts',
  'dairy',
  'eggs',
  'soy',
  'wheat',
  'fish',
  'shellfish',
];

export const cuisinesOptions: string[] = [
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

// ── Default form data factory ──────────────────────────────────────────────────

/**
 * Returns a fresh partial ProfileFormData object with safe defaults.
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

// ── Pre-population merge helpers ───────────────────────────────────────────────

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
  dietTypes: ProfileFormData['diet_type'][],
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
  skills: ProfileFormData['cooking_skill'][],
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
  tolerances: ProfileFormData['spice_tolerance'][],
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
 * If the intersection is empty, falls back to the union (all cuisines from all members).
 * An empty union means no member has cuisines set — returns [].
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
    return computeAllergyUnion(nonEmpty); // reuse union logic for string arrays
  }

  return Array.from(intersection);
}
