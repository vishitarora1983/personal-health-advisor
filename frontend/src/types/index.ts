// ============================================================================
// PROFILE TYPES
// ============================================================================

/**
 * User profile containing all health, dietary, and cooking preferences.
 * Matches the backend API schema for user profiles.
 */
export interface UserProfile {
  id: number;
  name: string;

  // Basic demographic information
  age: number;
  gender: 'male' | 'female' | 'other';
  height_cm: number;
  weight_kg: number;
  activity_level: 'sedentary' | 'lightly_active' | 'moderately_active' | 'very_active' | 'extra_active';
  household_size: number;

  // Health and weight goals
  weight_goal: 'lose' | 'maintain' | 'gain';
  medical_goals: string[];

  // Dietary preferences and restrictions
  diet_type: 'none' | 'vegetarian' | 'vegan' | 'keto' | 'paleo' | 'mediterranean' | 'pescatarian';
  allergies: string[];
  foods_to_avoid: string;
  spice_tolerance: 'mild' | 'medium' | 'hot';

  // Cooking preferences
  cooking_skill: 'beginner' | 'intermediate' | 'advanced';
  max_cook_time: number;
  cuisines: string[];
  meals_per_day: string[];
  snacks_per_day: number;

  // Nutrition targets (can be manually overridden or auto-calculated)
  target_calories: number | null;
  target_protein: number | null;
  target_carbs: number | null;
  target_fats: number | null;
  target_fiber: number | null;
  target_sodium: number | null;
  target_sugar: number | null;

  // Timestamps
  created_at: string;
  updated_at: string;
}

/**
 * Form data for creating or updating a profile.
 * Excludes system-generated fields like id and timestamps.
 */
export interface ProfileFormData {
  name: string;
  age: number;
  gender: 'male' | 'female' | 'other';
  height_cm: number;
  weight_kg: number;
  activity_level: 'sedentary' | 'lightly_active' | 'moderately_active' | 'very_active' | 'extra_active';
  household_size: number;
  weight_goal: 'lose' | 'maintain' | 'gain';
  medical_goals: string[];
  diet_type: 'none' | 'vegetarian' | 'vegan' | 'keto' | 'paleo' | 'mediterranean' | 'pescatarian';
  allergies: string[];
  foods_to_avoid: string;
  spice_tolerance: 'mild' | 'medium' | 'hot';
  cooking_skill: 'beginner' | 'intermediate' | 'advanced';
  max_cook_time: number;
  cuisines: string[];
  meals_per_day: string[];
  snacks_per_day: number;
  target_calories?: number | null;
  target_protein?: number | null;
  target_carbs?: number | null;
  target_fats?: number | null;
  target_fiber?: number | null;
  target_sodium?: number | null;
  target_sugar?: number | null;
}

/**
 * Calculated daily nutrition targets based on user profile.
 * Returned by the GET /profile/nutrition-targets endpoint.
 * IMPORTANT: Field names match backend exactly (bmr, tdee, target_*)
 */
export interface NutritionTargets {
  bmr: number;
  tdee: number;
  target_calories: number;
  target_protein: number;
  target_carbs: number;
  target_fats: number;
  target_fiber: number;
  target_sodium: number;
  target_sugar: number;
  macro_split: Record<string, number>;
}

/**
 * Lightweight profile summary for the profile switcher.
 */
export interface ProfileListItem {
  id: number;
  name: string;
  created_at: string;
}

// ============================================================================
// MEAL PLAN TYPES
// ============================================================================

/**
 * Individual ingredient with quantity and measurement unit.
 */
export interface Ingredient {
  name: string;
  quantity: string;
  unit: string;
}

/**
 * Single meal with complete nutritional information and recipe.
 */
export interface Meal {
  id: number;
  day_index: number;  // 0-6 (Monday to Sunday)
  meal_type: 'breakfast' | 'lunch' | 'dinner' | 'snack';
  dish_name: string;
  description: string;
  cuisine: string;
  portion_size: string;

  // Nutritional values per serving
  calories: number;
  protein: number;
  carbs: number;
  fats: number;
  fiber: number;
  sodium: number;
  sugar: number;

  // Recipe details (null until generated on demand)
  prep_time: number;  // minutes
  ingredients?: Ingredient[] | null;
  recipe_brief?: string | null;
}

/**
 * Daily meal plan containing all meals for a single day.
 */
export interface DailyPlan {
  id: number;
  day_of_week: number;  // 0-6 (Monday to Sunday)
  day_date: string;  // ISO date format YYYY-MM-DD
  meals: Meal[];

  // Daily nutrition totals
  total_calories: number;
  total_protein: number;
  total_carbs: number;
  total_fats: number;
  total_fiber: number;
  total_sodium: number;
  total_sugar: number;
}

/**
 * Complete weekly meal plan with all daily plans.
 */
export interface WeeklyPlan {
  id: number;
  profile_id: number;
  week_start_date: string;  // ISO date format YYYY-MM-DD
  status: 'active' | 'archived';
  days: DailyPlan[];
  created_at: string;
}

// ============================================================================
// MEAL TRACKING TYPES
// ============================================================================

/**
 * Tracking status for a meal.
 */
export type TrackingStatus = 'ate_as_planned' | 'skipped' | 'ate_something_else';

/**
 * Meal tracking record with actual consumption data.
 */
export interface MealTracking {
  meal_id: number;
  status: TrackingStatus;

  // Alternative meal details (if ate_something_else)
  alt_description: string | null;
  alt_calories: number | null;
  alt_protein: number | null;
  alt_carbs: number | null;
  alt_fats: number | null;

  tracked_at: string;
}

/**
 * Nutrition totals for tracking data.
 */
export interface NutritionTotals {
  calories: number;
  protein: number;
  carbs: number;
  fats: number;
}

/**
 * Tracked meal with lighter structure optimized for tracking views.
 * IMPORTANT: Backend returns tracking fields flat (not nested under 'tracking').
 * Fields like status, alt_description, etc. are at the same level as meal fields.
 */
export interface TrackedMeal {
  meal_id: number;
  meal_type: string;
  dish_name: string;
  planned_calories: number;
  planned_protein: number;
  planned_carbs: number;
  planned_fats: number;
  status: TrackingStatus | null;
  alt_description: string | null;
  alt_calories: number | null;
  alt_protein: number | null;
  alt_carbs: number | null;
  alt_fats: number | null;
  tracked_at: string | null;
}

/**
 * Daily tracking summary with all meals for a specific date.
 * IMPORTANT: Backend returns planned_totals/actual_totals and adherence_percentage.
 */
export interface DailyTracking {
  date: string;
  meals: TrackedMeal[];
  planned_totals: NutritionTotals;
  actual_totals: NutritionTotals;
  adherence_percentage: number;
}

/**
 * Weekly tracking summary for an entire meal plan.
 * IMPORTANT: Backend returns flat fields, not adherence_stats sub-object.
 */
export interface WeeklyTracking {
  plan_id: number;
  week_start_date: string;
  daily_tracking: DailyTracking[];
  weekly_planned_totals: NutritionTotals;
  weekly_actual_totals: NutritionTotals;
  weekly_adherence_percentage: number;
  total_meals: number;
  tracked_meals: number;
}

// ============================================================================
// GROCERY LIST TYPES
// ============================================================================

/**
 * Single grocery item with category and checked status.
 * IMPORTANT: quantity is a number|null from backend, not string
 */
export interface GroceryItem {
  id: number;
  ingredient_name: string;
  quantity: number | null;
  unit: string;
  category: string;
  checked: boolean;
}

/**
 * Grocery category grouping items together.
 * NOTE: This is a frontend-only type for display purposes.
 */
export interface GroceryCategory {
  category: string;
  items: GroceryItem[];
}

/**
 * Complete grocery list for a meal plan.
 * IMPORTANT: Backend returns items as Record<string, GroceryItem[]> keyed by category,
 * not as categories array. Also returns checked_count, not checked_items.
 */
export interface GroceryList {
  plan_id: number;
  items: Record<string, GroceryItem[]>;
  total_items: number;
  checked_count: number;
  generated_at?: string;
}

// ============================================================================
// DASHBOARD TYPES
// ============================================================================

/**
 * Daily statistics for a single day in the dashboard.
 * IMPORTANT: Backend may not return adherence_rate per day (only in overall adherence).
 */
export interface DailyStats {
  date: string;
  planned_calories: number;
  actual_calories: number;
  planned_protein: number;
  actual_protein: number;
  planned_carbs: number;
  actual_carbs: number;
  planned_fats: number;
  actual_fats: number;
}

/**
 * Macro breakdown for pie chart visualization.
 * IMPORTANT: Backend returns protein_pct, carbs_pct, fats_pct (not protein/carbs/fats).
 */
export interface MacroBreakdown {
  protein_pct: number;
  carbs_pct: number;
  fats_pct: number;
}

/**
 * Complete dashboard data for analytics and visualizations.
 * IMPORTANT: Backend returns calorie_trend as number[] (list of daily trends),
 * not as 'on_track'|'under'|'over'. Also includes total_planned_calories_week,
 * total_actual_calories_week, and calorie_deficit_surplus.
 */
export interface DashboardData {
  plan_id: number;
  week_start_date: string;

  // Daily stats for 7-day chart
  daily_stats: DailyStats[];

  // Overall adherence summary
  adherence: {
    total_meals: number;
    ate_as_planned: number;
    skipped: number;
    ate_something_else: number;
    adherence_percentage: number;
  };

  // Macro breakdown (average for the week)
  planned_macro_breakdown: MacroBreakdown;
  actual_macro_breakdown: MacroBreakdown;

  // Overall metrics
  consistency_score: number;  // 0-100 percentage
  calorie_trend: number[];  // List of daily calorie trends
  total_planned_calories_week: number;
  total_actual_calories_week: number;
  calorie_deficit_surplus: number;
}

// ============================================================================
// API RESPONSE TYPES
// ============================================================================

/**
 * Standard error response from the API.
 */
export interface ApiError {
  detail: string | { loc: string[]; msg: string; type: string }[];
}

/**
 * Meal swap request data.
 */
export interface SwapMealRequest {
  reason?: string;
}

/**
 * Tracking update request data.
 */
export interface TrackingUpdateRequest {
  status: TrackingStatus;
  alt_description?: string;
  alt_calories?: number;
  alt_protein?: number;
  alt_carbs?: number;
  alt_fats?: number;
}
