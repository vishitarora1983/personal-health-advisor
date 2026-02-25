'use client';

import React from 'react';
import { RefreshCw, Flame, Drumstick, Wheat, Droplets } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { MealCard } from './MealCard';
import type { DailyPlan, Meal, NutritionTargets, MemberNutritionTargets, KidProfile } from '@/types';

interface DayColumnProps {
  dailyPlan: DailyPlan;
  dayIndex: number;
  nutritionTargets?: NutritionTargets | null;
  memberNutritionTargets?: MemberNutritionTargets[] | null;
  onSwapMeal: (mealId: number) => void;
  onCustomReplace: (mealId: number, description: string) => Promise<string[] | null>;
  onRegenerateDay: (dayIndex: number) => void;
  onRecipeLoad?: (mealId: number) => Promise<Meal>;
  onCopyMeal?: (sourceMealId: number, targetMealId: number) => Promise<void>;
  onShareWithKids?: (mealId: number, kidIds: number[]) => Promise<void>;
  kidProfiles?: KidProfile[];
  swappingMealId?: number;
  customReplacingMealId?: number;
  copyingMealId?: number;
  sharingMealId?: number;
  regeneratingDay?: boolean;
  allDays?: DailyPlan[];
  repeatedDishNames?: Set<string>;
}

/**
 * Day content showing nutrition summary and meals in a responsive grid.
 */
export function DayColumn({
  dailyPlan,
  dayIndex,
  nutritionTargets,
  memberNutritionTargets,
  onSwapMeal,
  onCustomReplace,
  onRegenerateDay,
  onRecipeLoad,
  onCopyMeal,
  onShareWithKids,
  kidProfiles,
  swappingMealId,
  customReplacingMealId,
  copyingMealId,
  sharingMealId,
  regeneratingDay = false,
  allDays,
  repeatedDishNames,
}: DayColumnProps) {
  const hasMembers = memberNutritionTargets && memberNutritionTargets.length > 0;

  // Check if any meal in this day has member_servings data (Phase 7+ plans)
  const hasMemberServings = dailyPlan.meals.some(
    (meal) => meal.member_servings && meal.member_servings.length > 0,
  );

  // Build per-member daily actuals from member_servings when available.
  // Falls back to null (legacy ratio-based path) when no serving data is present.
  const memberDailyActuals = hasMembers && hasMemberServings
    ? memberNutritionTargets!.map((member) => {
        const totals = { calories: 0, protein: 0, carbs: 0, fats: 0 };
        dailyPlan.meals.forEach((meal) => {
          const serving = meal.member_servings?.find(
            (s) => s.member_profile_id === member.profile_id,
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
    : null;

  /**
   * Compute per-member calorie share ratio from target_calories.
   * Used only in the legacy (no member_servings) path.
   */
  const totalHouseholdCalories = hasMembers
    ? memberNutritionTargets!.reduce((sum, m) => sum + m.target_calories, 0)
    : 0;

  return (
    <div className="space-y-6">
      {/* Daily Nutrition Summary Bar */}
      {hasMembers ? (
        /* Per-member daily breakdown for joint profiles */
        <Card padding="md">
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <p
                className="text-xs font-semibold uppercase tracking-wider"
                style={{ color: 'var(--brand-green-light)' }}
              >
                Per-Person Daily Breakdown
              </p>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => onRegenerateDay(dayIndex)}
                loading={regeneratingDay}
              >
                <RefreshCw className="h-4 w-4 mr-1.5" />
                Regenerate Day
              </Button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {memberNutritionTargets!.map((member) => {
                // Use actual serving data if available, otherwise ratio-based estimate
                const actual = memberDailyActuals?.find(
                  (d) => d.member.profile_id === member.profile_id,
                )?.actual;

                const shareRatio =
                  !actual && totalHouseholdCalories > 0
                    ? member.target_calories / totalHouseholdCalories
                    : 1 / memberNutritionTargets!.length;

                const calories = actual
                  ? Math.round(actual.calories)
                  : Math.round(dailyPlan.total_calories * shareRatio);
                const protein = actual
                  ? Math.round(actual.protein)
                  : Math.round(dailyPlan.total_protein * shareRatio);
                const carbs = actual
                  ? Math.round(actual.carbs)
                  : Math.round(dailyPlan.total_carbs * shareRatio);
                const fats = actual
                  ? Math.round(actual.fats)
                  : Math.round(dailyPlan.total_fats * shareRatio);

                return (
                  <div
                    key={member.profile_id}
                    className="rounded-xl p-3"
                    style={{
                      // All members equal — no amber/primary distinction
                      background: 'var(--brand-green-subtle)',
                      border: '1px solid var(--brand-green-subtle)',
                    }}
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <span
                        className="text-sm font-semibold"
                        style={{ color: 'var(--brand-green-light)' }}
                      >
                        {member.profile_name}
                      </span>
                      {/* Show "estimated" label if using ratio-based calculation */}
                      {!actual && (
                        <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
                          (estimated)
                        </span>
                      )}
                    </div>
                    <div className="flex flex-col gap-2.5">
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
            </div>
          </div>
        </Card>
      ) : (
        /* Standard single-person nutrition bar */
        <Card padding="md">
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <p
                className="text-xs font-semibold uppercase tracking-wider"
                style={{ color: 'var(--brand-green-light)' }}
              >
                Daily Nutrition
              </p>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => onRegenerateDay(dayIndex)}
                loading={regeneratingDay}
              >
                <RefreshCw className="h-4 w-4 mr-1.5" />
                Regenerate Day
              </Button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2.5">
              <NutritionStat
                icon={<Flame className="h-4 w-4" />}
                label="Calories"
                value={Math.round(dailyPlan.total_calories)}
                target={nutritionTargets?.target_calories}
                unit="kcal"
                color="var(--brand-amber)"
              />
              <NutritionStat
                icon={<Drumstick className="h-4 w-4" />}
                label="Protein"
                value={Math.round(dailyPlan.total_protein)}
                target={nutritionTargets?.target_protein}
                unit="g"
                color="var(--color-error)"
              />
              <NutritionStat
                icon={<Wheat className="h-4 w-4" />}
                label="Carbs"
                value={Math.round(dailyPlan.total_carbs)}
                target={nutritionTargets?.target_carbs}
                unit="g"
                color="var(--brand-amber-light)"
              />
              <NutritionStat
                icon={<Droplets className="h-4 w-4" />}
                label="Fats"
                value={Math.round(dailyPlan.total_fats)}
                target={nutritionTargets?.target_fats}
                unit="g"
                color="var(--color-info)"
              />
            </div>
          </div>
        </Card>
      )}

      {/* Meals Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {dailyPlan.meals.map((meal) => (
          <MealCard
            key={meal.id}
            meal={meal}
            onSwap={onSwapMeal}
            onCustomReplace={onCustomReplace}
            onRecipeLoad={onRecipeLoad}
            onCopyMeal={onCopyMeal}
            onShareWithKids={onShareWithKids}
            kidProfiles={kidProfiles}
            swapping={swappingMealId === meal.id}
            customReplacing={customReplacingMealId === meal.id}
            copyingMeal={copyingMealId === meal.id}
            sharingMeal={sharingMealId === meal.id}
            memberNutritionTargets={memberNutritionTargets}
            allDays={allDays}
            isRepeat={repeatedDishNames?.has(meal.dish_name.toLowerCase().trim()) ?? false}
          />
        ))}
      </div>
    </div>
  );
}

// ── NutritionStat sub-component ───────────────────────────────────────────────

function NutritionStat({
  icon,
  label,
  value,
  target,
  unit,
  color,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  target?: number;
  unit: string;
  color: string;
}) {
  // Three-tier deviation coloring: ≤5% green, 5-15% amber, >15% red
  const deviation = target ? Math.abs(value - target) / target : 0;
  const isOnTarget = deviation <= 0.05;
  const isSlightlyOff = deviation > 0.05 && deviation <= 0.15;

  const fillColor = !target
    ? color
    : isOnTarget
      ? 'var(--brand-green)'
      : isSlightlyOff
        ? 'var(--brand-amber)'
        : 'var(--color-error)';

  // Bar width: clamp at 130% so over-target bars don't explode layout
  const fillPct = target ? Math.min((value / target) * 100, 130) : 100;

  return (
    <div className="flex flex-col gap-1">
      {/* Label row: icon + label left, value / target right */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <span style={{ color }}>{icon}</span>
          <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
            {label}
          </span>
        </div>
        <span className="text-xs font-semibold" style={{ color: 'var(--text-secondary)' }}>
          {value}
          {target != null && (
            <span className="font-normal" style={{ color: 'var(--text-muted)' }}>
              {' '}/ {Math.round(target)}
            </span>
          )}
          <span className="font-normal ml-0.5" style={{ color: 'var(--text-muted)' }}>
            {unit}
          </span>
        </span>
      </div>
      {/* Horizontal bar */}
      {target != null && (
        <div
          className="h-1.5 w-full rounded-full overflow-hidden"
          style={{ background: `${color}15` }}
        >
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{ width: `${fillPct}%`, background: fillColor }}
          />
        </div>
      )}
    </div>
  );
}
