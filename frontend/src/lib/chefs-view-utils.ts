import type { Meal, WeeklyPlan } from '@/types';

// ============================================================================
// Types
// ============================================================================

export interface PortionByProfile {
  profileName: string;
  portion: string;
  calories: number;
}

export interface AggregatedDish {
  dishName: string;
  profileNames: string[];
  aggregatedPortion: string;
  portionsByProfile: PortionByProfile[];
  totalCalories: number;
  sourceMeals: Meal[];
}

export interface GridCell {
  dishes: AggregatedDish[];
}

export type MealType = 'breakfast' | 'lunch' | 'dinner' | 'snack';

export const MEAL_TYPES: MealType[] = ['breakfast', 'lunch', 'dinner', 'snack'];
export const DAY_COUNT = 7;

// ============================================================================
// Helpers
// ============================================================================

/**
 * Extract gram weight from a portion_size string like "1 serving (350g)" or "350g".
 * Returns null if no gram value found.
 */
export function parseGrams(portionSize: string): number | null {
  const match = portionSize.match(/\((\d+\.?\d*)\s*g/);
  if (match) return parseFloat(match[1]);

  // Also try standalone gram values like "350g"
  const standalone = portionSize.match(/^(\d+\.?\d*)\s*g$/i);
  if (standalone) return parseFloat(standalone[1]);

  return null;
}

/**
 * Count servings from a portion_size string. Defaults to 1 if unparseable.
 */
function parseServings(portionSize: string): number {
  const match = portionSize.match(/^(\d+\.?\d*)\s*serving/i);
  if (match) return parseFloat(match[1]);
  return 1;
}

// ============================================================================
// Aggregation
// ============================================================================

export interface PlansByProfile {
  profileId: number;
  profileName: string;
  plan: WeeklyPlan;
}

/**
 * Aggregate multiple profiles' meal plans into a single grid.
 * Groups meals by (mealType, dayIndex), then aggregates same dishes.
 */
export function aggregateMealPlans(
  plansByProfile: PlansByProfile[]
): Record<MealType, GridCell[]> {
  // Initialize empty grid: 4 meal types x 7 days
  const grid: Record<MealType, GridCell[]> = {
    breakfast: Array.from({ length: DAY_COUNT }, () => ({ dishes: [] })),
    lunch: Array.from({ length: DAY_COUNT }, () => ({ dishes: [] })),
    dinner: Array.from({ length: DAY_COUNT }, () => ({ dishes: [] })),
    snack: Array.from({ length: DAY_COUNT }, () => ({ dishes: [] })),
  };

  // Temporary structure for grouping: key = "mealType|dayIndex|dishNameLower"
  const groupMap = new Map<
    string,
    {
      dishName: string;
      profileNames: string[];
      portionsByProfile: PortionByProfile[];
      calories: number[];
      meals: Meal[];
    }
  >();

  for (const { profileName, plan } of plansByProfile) {
    for (const day of plan.days) {
      const dayIndex = day.day_of_week;
      for (const meal of day.meals) {
        const key = `${meal.meal_type}|${dayIndex}|${meal.dish_name.toLowerCase().trim()}`;

        if (!groupMap.has(key)) {
          groupMap.set(key, {
            dishName: meal.dish_name,
            profileNames: [],
            portionsByProfile: [],
            calories: [],
            meals: [],
          });
        }

        const group = groupMap.get(key)!;
        group.profileNames.push(profileName);
        group.calories.push(meal.calories);
        group.meals.push(meal);
        group.portionsByProfile.push({
          profileName,
          portion: meal.portion_size,
          calories: meal.calories,
        });
      }
    }
  }

  // Convert groups into AggregatedDish entries in the grid
  for (const [key, group] of groupMap) {
    const [mealType, dayIndexStr] = key.split('|');
    const dayIndex = parseInt(dayIndexStr, 10);

    const totalCalories = group.calories.reduce((sum, c) => sum + c, 0);

    // Build aggregatedPortion: use original portion_size text directly
    let aggregatedPortion: string;
    if (group.portionsByProfile.length === 1) {
      // Single source — show original portion as-is
      aggregatedPortion = group.portionsByProfile[0].portion;
    } else {
      // Multiple sources — show each profile's portion
      aggregatedPortion = group.portionsByProfile
        .map((p) => `${p.profileName}: ${p.portion}`)
        .join(' + ');
    }

    const dish: AggregatedDish = {
      dishName: group.dishName,
      profileNames: group.profileNames,
      aggregatedPortion,
      portionsByProfile: group.portionsByProfile,
      totalCalories,
      sourceMeals: group.meals,
    };

    if (MEAL_TYPES.includes(mealType as MealType) && dayIndex >= 0 && dayIndex < DAY_COUNT) {
      grid[mealType as MealType][dayIndex].dishes.push(dish);
    }
  }

  return grid;
}

/**
 * Get day headers from the most recent plan.
 * Uses day_date from each DailyPlan sorted by day_of_week.
 */
export function getDayHeaders(plansByProfile: PlansByProfile[]): string[] {
  if (plansByProfile.length === 0) {
    return ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  }

  // Use the most recently created plan for date headers
  const sortedPlans = [...plansByProfile].sort(
    (a, b) => new Date(b.plan.created_at).getTime() - new Date(a.plan.created_at).getTime()
  );

  const plan = sortedPlans[0].plan;
  const days = [...plan.days].sort((a, b) => a.day_of_week - b.day_of_week);

  return days.map((d) => {
    const date = new Date(d.day_date + 'T12:00:00'); // noon to avoid timezone shifts
    return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  });
}
