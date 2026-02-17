'use client';

import { useState, useMemo } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { DayColumn } from './DayColumn';
import { getDayName, formatDate, isToday, parseLocalDate } from '@/lib/utils';
import { cn } from '@/lib/utils';
import type { WeeklyPlan, DailyPlan, Meal, NutritionTargets, MemberNutritionTargets, KidProfile } from '@/types';

interface WeekViewProps {
  weeklyPlan: WeeklyPlan;
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
  regeneratingDayIndex?: number;
}

/**
 * Tab-based weekly meal plan view with day selector.
 * Shows one day at a time with a horizontal tab strip for navigation.
 */
export function WeekView({
  weeklyPlan,
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
  regeneratingDayIndex,
}: WeekViewProps) {
  // Default to today's tab if it exists in the plan, otherwise first day
  const todayIndex = weeklyPlan.days.findIndex((d) => isToday(d.day_date));
  const [selectedDay, setSelectedDay] = useState(todayIndex >= 0 ? todayIndex : 0);

  // Detect repeated dish names across the entire week
  const repeatedDishNames = useMemo(() => {
    const nameCounts = new Map<string, number>();
    for (const day of weeklyPlan.days) {
      for (const meal of day.meals) {
        const key = meal.dish_name.toLowerCase().trim();
        nameCounts.set(key, (nameCounts.get(key) || 0) + 1);
      }
    }
    const repeated = new Set<string>();
    for (const [name, count] of nameCounts) {
      if (count > 1) repeated.add(name);
    }
    return repeated;
  }, [weeklyPlan.days]);

  const currentDay = weeklyPlan.days[selectedDay];

  return (
    <div className="space-y-6">
      {/* Day Tab Strip */}
      <div className="relative">
        {/* Navigation arrows for mobile */}
        <button
          onClick={() => setSelectedDay(Math.max(0, selectedDay - 1))}
          className={cn(
            'absolute left-0 top-1/2 -translate-y-1/2 z-10 p-1.5 rounded-full lg:hidden',
            selectedDay === 0 ? 'opacity-0 pointer-events-none' : 'opacity-100'
          )}
          style={{
            background: 'var(--surface-primary-solid)',
            boxShadow: 'var(--shadow-md)',
          }}
          disabled={selectedDay === 0}
          aria-label="Previous day"
        >
          <ChevronLeft className="h-4 w-4" style={{ color: 'var(--color-emerald)' }} />
        </button>

        <button
          onClick={() => setSelectedDay(Math.min(weeklyPlan.days.length - 1, selectedDay + 1))}
          className={cn(
            'absolute right-0 top-1/2 -translate-y-1/2 z-10 p-1.5 rounded-full lg:hidden',
            selectedDay === weeklyPlan.days.length - 1 ? 'opacity-0 pointer-events-none' : 'opacity-100'
          )}
          style={{
            background: 'var(--surface-primary-solid)',
            boxShadow: 'var(--shadow-md)',
          }}
          disabled={selectedDay === weeklyPlan.days.length - 1}
          aria-label="Next day"
        >
          <ChevronRight className="h-4 w-4" style={{ color: 'var(--color-emerald)' }} />
        </button>

        {/* Tab strip */}
        <div
          className="flex gap-1 overflow-x-auto px-8 lg:px-0 pb-1 scrollbar-hide"
          role="tablist"
          aria-label="Days of the week"
        >
          {weeklyPlan.days.map((day, index) => {
            const isActive = index === selectedDay;
            const today = isToday(day.day_date);

            return (
              <button
                key={day.id}
                role="tab"
                aria-selected={isActive}
                onClick={() => setSelectedDay(index)}
                className={cn(
                  'flex-1 min-w-[4.5rem] flex flex-col items-center gap-0.5 px-3 py-2.5 rounded-xl transition-all text-center',
                  'focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2',
                )}
                style={{
                  background: isActive
                    ? 'linear-gradient(135deg, var(--color-emerald-deep), var(--color-emerald))'
                    : 'var(--surface-primary)',
                  color: isActive ? '#fff' : 'var(--color-clay)',
                  border: isActive ? 'none' : '1px solid var(--surface-glass-border)',
                  boxShadow: isActive ? 'var(--shadow-md)' : 'var(--shadow-sm)',
                  transitionDuration: 'var(--duration-normal)',
                  transitionTimingFunction: 'var(--ease-out-expo)',
                }}
              >
                <span className="text-xs font-medium" style={{ opacity: isActive ? 0.85 : 0.6 }}>
                  {getDayName(day.day_date, 'short')}
                </span>
                <span className="text-sm font-bold">
                  {parseLocalDate(day.day_date).getDate()}
                </span>
                {today && (
                  <span
                    className="w-1.5 h-1.5 rounded-full"
                    style={{
                      background: isActive ? 'var(--color-amber-glow)' : 'var(--color-amber)',
                    }}
                  />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Selected Day Header */}
      <div className="flex items-center gap-3">
        <h2
          className="text-2xl font-bold"
          style={{ color: 'var(--color-emerald-deep)', fontFamily: 'var(--font-display), serif' }}
        >
          {getDayName(currentDay.day_date, 'long')}
        </h2>
        <span className="text-sm" style={{ color: 'var(--color-clay-muted)' }}>
          {formatDate(currentDay.day_date, 'long')}
        </span>
        {isToday(currentDay.day_date) && (
          <span
            className="px-2 py-0.5 rounded-full text-xs font-semibold"
            style={{
              background: 'rgba(212, 148, 10, 0.12)',
              color: 'var(--color-amber)',
            }}
          >
            Today
          </span>
        )}
      </div>

      {/* Day Content */}
      <DayColumn
        dailyPlan={currentDay}
        dayIndex={selectedDay}
        nutritionTargets={nutritionTargets}
        memberNutritionTargets={memberNutritionTargets}
        onSwapMeal={onSwapMeal}
        onCustomReplace={onCustomReplace}
        onRegenerateDay={onRegenerateDay}
        onRecipeLoad={onRecipeLoad}
        onCopyMeal={onCopyMeal}
        onShareWithKids={onShareWithKids}
        kidProfiles={kidProfiles}
        swappingMealId={swappingMealId}
        customReplacingMealId={customReplacingMealId}
        copyingMealId={copyingMealId}
        sharingMealId={sharingMealId}
        regeneratingDay={regeneratingDayIndex === selectedDay}
        allDays={weeklyPlan.days}
        repeatedDishNames={repeatedDishNames}
      />
    </div>
  );
}
