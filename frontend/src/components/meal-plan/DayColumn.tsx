'use client';

import React from 'react';
import { RefreshCw, Flame, Drumstick, Wheat, Droplets, Crown } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { MealCard } from './MealCard';
import type { DailyPlan, Meal, NutritionTargets, MemberNutritionTargets } from '@/types';

interface DayColumnProps {
  dailyPlan: DailyPlan;
  dayIndex: number;
  nutritionTargets?: NutritionTargets | null;
  memberNutritionTargets?: MemberNutritionTargets[] | null;
  onSwapMeal: (mealId: number) => void;
  onRegenerateDay: (dayIndex: number) => void;
  onRecipeLoad?: (mealId: number) => Promise<Meal>;
  swappingMealId?: number;
  regeneratingDay?: boolean;
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
  onRegenerateDay,
  onRecipeLoad,
  swappingMealId,
  regeneratingDay = false,
}: DayColumnProps) {
  const hasMembers = memberNutritionTargets && memberNutritionTargets.length > 0;

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
                style={{ color: 'var(--color-sage)' }}
              >
                Per-Person Daily Breakdown
              </p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => onRegenerateDay(dayIndex)}
                loading={regeneratingDay}
              >
                <RefreshCw className="h-4 w-4 mr-1.5" />
                Regenerate Day
              </Button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {memberNutritionTargets!.map((member) => (
                <div
                  key={member.profile_id}
                  className="rounded-xl p-3"
                  style={{
                    background: member.is_primary
                      ? 'rgba(212, 148, 10, 0.04)'
                      : 'rgba(45, 90, 63, 0.03)',
                    border: member.is_primary
                      ? '1px solid rgba(212, 148, 10, 0.12)'
                      : '1px solid rgba(45, 90, 63, 0.06)',
                  }}
                >
                  <div className="flex items-center gap-2 mb-2">
                    {member.is_primary && (
                      <Crown className="h-3.5 w-3.5" style={{ color: 'var(--color-amber)' }} />
                    )}
                    <span
                      className="text-sm font-semibold"
                      style={{ color: 'var(--color-emerald-deep)' }}
                    >
                      {member.profile_name}
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-x-5 gap-y-2">
                    <NutritionStat
                      icon={<Flame className="h-3.5 w-3.5" />}
                      label="Calories"
                      value={Math.round(dailyPlan.total_calories * member.share_ratio)}
                      target={member.target_calories}
                      unit="kcal"
                      color="var(--color-amber)"
                    />
                    <NutritionStat
                      icon={<Drumstick className="h-3.5 w-3.5" />}
                      label="Protein"
                      value={Math.round(dailyPlan.total_protein * member.share_ratio)}
                      target={member.target_protein}
                      unit="g"
                      color="var(--color-coral)"
                    />
                    <NutritionStat
                      icon={<Wheat className="h-3.5 w-3.5" />}
                      label="Carbs"
                      value={Math.round(dailyPlan.total_carbs * member.share_ratio)}
                      target={member.target_carbs}
                      unit="g"
                      color="var(--color-amber-warm)"
                    />
                    <NutritionStat
                      icon={<Droplets className="h-3.5 w-3.5" />}
                      label="Fats"
                      value={Math.round(dailyPlan.total_fats * member.share_ratio)}
                      target={member.target_fats}
                      unit="g"
                      color="var(--color-teal-soft)"
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </Card>
      ) : (
        /* Standard single-person nutrition bar */
        <Card padding="md">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex flex-wrap gap-x-6 gap-y-3">
              <NutritionStat
                icon={<Flame className="h-4 w-4" />}
                label="Calories"
                value={Math.round(dailyPlan.total_calories)}
                target={nutritionTargets?.target_calories}
                unit="kcal"
                color="var(--color-amber)"
              />
              <NutritionStat
                icon={<Drumstick className="h-4 w-4" />}
                label="Protein"
                value={Math.round(dailyPlan.total_protein)}
                target={nutritionTargets?.target_protein}
                unit="g"
                color="var(--color-coral)"
              />
              <NutritionStat
                icon={<Wheat className="h-4 w-4" />}
                label="Carbs"
                value={Math.round(dailyPlan.total_carbs)}
                target={nutritionTargets?.target_carbs}
                unit="g"
                color="var(--color-amber-warm)"
              />
              <NutritionStat
                icon={<Droplets className="h-4 w-4" />}
                label="Fats"
                value={Math.round(dailyPlan.total_fats)}
                target={nutritionTargets?.target_fats}
                unit="g"
                color="var(--color-teal-soft)"
              />
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={() => onRegenerateDay(dayIndex)}
              loading={regeneratingDay}
            >
              <RefreshCw className="h-4 w-4 mr-1.5" />
              Regenerate Day
            </Button>
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
            onRecipeLoad={onRecipeLoad}
            swapping={swappingMealId === meal.id}
            memberNutritionTargets={memberNutritionTargets}
          />
        ))}
      </div>
    </div>
  );
}

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
  // Determine if value is within ±5% of target
  const isOnTarget = target ? Math.abs(value - target) / target <= 0.05 : true;
  const isOver = target ? value > target * 1.05 : false;

  return (
    <div className="flex items-center gap-2">
      <div
        className="flex items-center justify-center w-8 h-8 rounded-lg"
        style={{ background: `${color}15`, color }}
      >
        {icon}
      </div>
      <div>
        <p className="text-xs" style={{ color: 'var(--color-clay-muted)' }}>
          {label}
        </p>
        <p className="text-sm font-bold" style={{ color: 'var(--color-clay)' }}>
          {value}
          <span className="font-normal text-xs ml-0.5" style={{ color: 'var(--color-clay-muted)' }}>
            {unit}
          </span>
        </p>
        {target != null && (
          <p
            className="text-[10px] font-medium"
            style={{
              color: isOnTarget
                ? 'var(--color-emerald)'
                : isOver
                  ? 'var(--color-coral)'
                  : 'var(--color-clay-muted)',
            }}
          >
            Target: {Math.round(target)}{unit}
          </p>
        )}
      </div>
    </div>
  );
}
