'use client';

import React, { useState } from 'react';
import { Users } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { AggregatedDish, GridCell, MealType } from '@/lib/chefs-view-utils';
import { MEAL_TYPES, DAY_COUNT } from '@/lib/chefs-view-utils';

interface ChefsGridProps {
  grid: Record<MealType, GridCell[]>;
  dayHeaders: string[];
  onDishClick: (dish: AggregatedDish) => void;
  visibleMealTypes: Set<MealType>;
}

const MEAL_TYPE_LABELS: Record<MealType, string> = {
  breakfast: 'Breakfast',
  lunch: 'Lunch',
  dinner: 'Dinner',
  snack: 'Snack',
};

const MEAL_TYPE_COLORS: Record<MealType, string> = {
  breakfast: 'var(--color-amber)',
  lunch: 'var(--color-emerald)',
  dinner: 'var(--color-teal-soft)',
  snack: 'var(--color-clay-light)',
};

function DishBlock({
  dish,
  onClick,
}: {
  dish: AggregatedDish;
  onClick: () => void;
}) {
  const multiProfile = dish.portionsByProfile.length > 1;

  return (
    <button
      onClick={onClick}
      className="w-full text-left p-2.5 rounded-xl transition-all group"
      style={{
        background: 'rgba(168, 197, 176, 0.04)',
        border: '1px solid rgba(168, 197, 176, 0.08)',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = 'rgba(212, 148, 10, 0.06)';
        e.currentTarget.style.borderColor = 'rgba(212, 148, 10, 0.15)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = 'rgba(168, 197, 176, 0.04)';
        e.currentTarget.style.borderColor = 'rgba(168, 197, 176, 0.08)';
      }}
    >
      <p
        className="text-sm font-medium leading-tight mb-1"
        style={{ color: 'var(--color-emerald-deep)' }}
      >
        {dish.dishName}
      </p>

      {/* Portion details */}
      {multiProfile ? (
        <div className="space-y-0.5 mb-1">
          {dish.portionsByProfile.map((p, i) => (
            <div key={i} className="flex items-baseline gap-1 text-xs">
              <span
                className="font-medium shrink-0"
                style={{ color: 'var(--color-teal-soft)' }}
              >
                {p.profileName}:
              </span>
              <span style={{ color: 'var(--color-clay-light)' }}>
                {p.portion}
              </span>
            </div>
          ))}
        </div>
      ) : (
        <p
          className="text-xs mb-1"
          style={{ color: 'var(--color-clay-light)' }}
        >
          {dish.aggregatedPortion}
        </p>
      )}

      <div className="flex items-center gap-1.5 flex-wrap">
        <span
          className="text-xs font-medium"
          style={{ color: 'var(--color-amber-warm)' }}
        >
          {dish.totalCalories} kcal
        </span>
        {multiProfile && (
          <span
            className="inline-flex items-center gap-0.5 text-xs"
            style={{ color: 'var(--color-teal-soft)' }}
          >
            <Users className="h-3 w-3" />
            {dish.profileNames.length}
          </span>
        )}
      </div>
    </button>
  );
}

function EmptyCell() {
  return (
    <p className="text-xs px-2 py-3" style={{ color: 'var(--color-clay-subtle)' }}>
      No meal
    </p>
  );
}

// ============================================================================
// Desktop Grid (lg+)
// ============================================================================

function DesktopGrid({ grid, dayHeaders, onDishClick, visibleMealTypes }: ChefsGridProps) {
  const mealTypes = MEAL_TYPES.filter((mt) => visibleMealTypes.has(mt));
  return (
    <div
      className="hidden lg:grid overflow-hidden rounded-2xl"
      style={{
        gridTemplateColumns: '100px repeat(7, 1fr)',
        border: '1px solid var(--surface-glass-border)',
        background: 'var(--surface-primary)',
      }}
    >
      {/* Header row */}
      <div
        className="p-3"
        style={{
          background: 'rgba(26, 58, 42, 0.04)',
          borderBottom: '1px solid var(--surface-glass-border)',
          borderRight: '1px solid var(--surface-glass-border)',
        }}
      />
      {dayHeaders.map((header, i) => (
        <div
          key={i}
          className="p-3 text-center text-xs font-semibold uppercase tracking-wider"
          style={{
            color: 'var(--color-emerald)',
            background: 'rgba(26, 58, 42, 0.04)',
            borderBottom: '1px solid var(--surface-glass-border)',
            borderRight: i < DAY_COUNT - 1 ? '1px solid var(--surface-glass-border)' : 'none',
          }}
        >
          {header}
        </div>
      ))}

      {/* Meal rows */}
      {mealTypes.map((mealType, rowIdx) => (
        <React.Fragment key={mealType}>
          {/* Row label */}
          <div
            className="p-3 flex items-start"
            style={{
              borderBottom: rowIdx < mealTypes.length - 1 ? '1px solid var(--surface-glass-border)' : 'none',
              borderRight: '1px solid var(--surface-glass-border)',
            }}
          >
            <span
              className="text-xs font-bold uppercase tracking-wider"
              style={{ color: MEAL_TYPE_COLORS[mealType] }}
            >
              {MEAL_TYPE_LABELS[mealType]}
            </span>
          </div>

          {/* Day cells */}
          {grid[mealType].map((cell, dayIdx) => (
            <div
              key={dayIdx}
              className="p-2 min-h-[80px]"
              style={{
                borderBottom: rowIdx < mealTypes.length - 1 ? '1px solid var(--surface-glass-border)' : 'none',
                borderRight: dayIdx < DAY_COUNT - 1 ? '1px solid var(--surface-glass-border)' : 'none',
              }}
            >
              {cell.dishes.length === 0 ? (
                <EmptyCell />
              ) : (
                <div className="space-y-1.5">
                  {cell.dishes.map((dish, i) => (
                    <DishBlock
                      key={i}
                      dish={dish}
                      onClick={() => onDishClick(dish)}
                    />
                  ))}
                </div>
              )}
            </div>
          ))}
        </React.Fragment>
      ))}
    </div>
  );
}

// ============================================================================
// Tablet Grid (md only) — horizontal scroll with sticky meal column
// ============================================================================

function TabletGrid({ grid, dayHeaders, onDishClick, visibleMealTypes }: ChefsGridProps) {
  const mealTypes = MEAL_TYPES.filter((mt) => visibleMealTypes.has(mt));
  return (
    <div
      className="hidden md:block lg:hidden overflow-x-auto rounded-2xl"
      style={{
        border: '1px solid var(--surface-glass-border)',
        background: 'var(--surface-primary)',
      }}
    >
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '90px repeat(7, minmax(140px, 1fr))',
          minWidth: '1070px',
        }}
      >
        {/* Header row */}
        <div
          className="p-2 sticky left-0 z-10"
          style={{
            background: 'rgba(26, 58, 42, 0.06)',
            borderBottom: '1px solid var(--surface-glass-border)',
            borderRight: '1px solid var(--surface-glass-border)',
          }}
        />
        {dayHeaders.map((header, i) => (
          <div
            key={i}
            className="p-2 text-center text-xs font-semibold uppercase tracking-wider"
            style={{
              color: 'var(--color-emerald)',
              background: 'rgba(26, 58, 42, 0.06)',
              borderBottom: '1px solid var(--surface-glass-border)',
              borderRight: i < DAY_COUNT - 1 ? '1px solid var(--surface-glass-border)' : 'none',
            }}
          >
            {header}
          </div>
        ))}

        {/* Rows */}
        {mealTypes.map((mealType, rowIdx) => (
          <React.Fragment key={mealType}>
            <div
              className="p-2 flex items-start sticky left-0 z-10"
              style={{
                background: 'var(--surface-primary)',
                borderBottom: rowIdx < mealTypes.length - 1 ? '1px solid var(--surface-glass-border)' : 'none',
                borderRight: '1px solid var(--surface-glass-border)',
              }}
            >
              <span
                className="text-xs font-bold uppercase tracking-wider"
                style={{ color: MEAL_TYPE_COLORS[mealType] }}
              >
                {MEAL_TYPE_LABELS[mealType]}
              </span>
            </div>
            {grid[mealType].map((cell, dayIdx) => (
              <div
                key={dayIdx}
                className="p-2 min-h-[70px]"
                style={{
                  borderBottom: rowIdx < mealTypes.length - 1 ? '1px solid var(--surface-glass-border)' : 'none',
                  borderRight: dayIdx < DAY_COUNT - 1 ? '1px solid var(--surface-glass-border)' : 'none',
                }}
              >
                {cell.dishes.length === 0 ? (
                  <EmptyCell />
                ) : (
                  <div className="space-y-1.5">
                    {cell.dishes.map((dish, i) => (
                      <DishBlock
                        key={i}
                        dish={dish}
                        onClick={() => onDishClick(dish)}
                      />
                    ))}
                  </div>
                )}
              </div>
            ))}
          </React.Fragment>
        ))}
      </div>
    </div>
  );
}

// ============================================================================
// Mobile View (<md) — day tabs + stacked meal cards
// ============================================================================

function MobileView({ grid, dayHeaders, onDishClick, visibleMealTypes }: ChefsGridProps) {
  const mealTypes = MEAL_TYPES.filter((mt) => visibleMealTypes.has(mt));
  const [selectedDay, setSelectedDay] = useState(0);

  return (
    <div className="md:hidden">
      {/* Day tabs */}
      <div className="flex gap-1 mb-4 overflow-x-auto pb-1 -mx-1 px-1">
        {dayHeaders.map((header, i) => (
          <button
            key={i}
            onClick={() => setSelectedDay(i)}
            className={cn(
              'shrink-0 px-3 py-2 rounded-xl text-xs font-semibold transition-all'
            )}
            style={{
              background: selectedDay === i
                ? 'linear-gradient(135deg, var(--color-emerald), var(--color-emerald-deep))'
                : 'rgba(168, 197, 176, 0.08)',
              color: selectedDay === i ? 'white' : 'var(--color-clay-light)',
              border: selectedDay === i
                ? 'none'
                : '1px solid var(--surface-glass-border)',
            }}
          >
            {header}
          </button>
        ))}
      </div>

      {/* Stacked meal cards */}
      <div className="space-y-4">
        {mealTypes.map((mealType) => {
          const cell = grid[mealType][selectedDay];
          return (
            <div
              key={mealType}
              className="rounded-xl p-4"
              style={{
                background: 'var(--surface-primary)',
                border: '1px solid var(--surface-glass-border)',
                boxShadow: 'var(--shadow-sm)',
              }}
            >
              <div className="flex items-center gap-2 mb-3">
                <div
                  className="w-2 h-2 rounded-full"
                  style={{ background: MEAL_TYPE_COLORS[mealType] }}
                />
                <h3
                  className="text-sm font-bold uppercase tracking-wider"
                  style={{ color: MEAL_TYPE_COLORS[mealType] }}
                >
                  {MEAL_TYPE_LABELS[mealType]}
                </h3>
              </div>
              {cell.dishes.length === 0 ? (
                <EmptyCell />
              ) : (
                <div className="space-y-2">
                  {cell.dishes.map((dish, i) => (
                    <DishBlock
                      key={i}
                      dish={dish}
                      onClick={() => onDishClick(dish)}
                    />
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ============================================================================
// Exported composite
// ============================================================================

export function ChefsGrid(props: ChefsGridProps) {
  return (
    <>
      <DesktopGrid {...props} />
      <TabletGrid {...props} />
      <MobileView {...props} />
    </>
  );
}
