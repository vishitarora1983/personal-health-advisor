'use client';

import React from 'react';
import { RefreshCw, Flame, Drumstick, Wheat, Droplets } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { MealCard } from './MealCard';
import type { DailyPlan, Meal, NutritionTargets } from '@/types';

interface DayColumnProps {
  dailyPlan: DailyPlan;
  dayIndex: number;
  nutritionTargets?: NutritionTargets | null;
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
  onSwapMeal,
  onRegenerateDay,
  onRecipeLoad,
  swappingMealId,
  regeneratingDay = false,
}: DayColumnProps) {
  return (
    <div className="space-y-6">
      {/* Daily Nutrition Summary Bar */}
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

      {/* Meals Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {dailyPlan.meals.map((meal) => (
          <MealCard
            key={meal.id}
            meal={meal}
            onSwap={onSwapMeal}
            onRecipeLoad={onRecipeLoad}
            swapping={swappingMealId === meal.id}
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
