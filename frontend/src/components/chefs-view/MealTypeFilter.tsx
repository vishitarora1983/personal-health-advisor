'use client';

import React from 'react';
import { Check } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { MEAL_TYPES, type MealType } from '@/lib/chefs-view-utils';

const MEAL_TYPE_LABELS: Record<MealType, string> = {
  breakfast: 'Breakfast',
  lunch: 'Lunch',
  dinner: 'Dinner',
  snack: 'Snack',
};

const MEAL_TYPE_COLORS: Record<MealType, { active: string; bg: string; border: string }> = {
  breakfast: {
    active: 'var(--color-amber)',
    bg: 'rgba(212, 148, 10, 0.10)',
    border: 'rgba(212, 148, 10, 0.25)',
  },
  lunch: {
    active: 'var(--color-emerald)',
    bg: 'rgba(45, 90, 63, 0.10)',
    border: 'rgba(45, 90, 63, 0.25)',
  },
  dinner: {
    active: 'var(--color-teal-soft)',
    bg: 'rgba(42, 138, 122, 0.10)',
    border: 'rgba(42, 138, 122, 0.25)',
  },
  snack: {
    active: 'var(--color-clay-light)',
    bg: 'rgba(74, 63, 53, 0.08)',
    border: 'rgba(74, 63, 53, 0.20)',
  },
};

interface MealTypeFilterProps {
  selectedTypes: Set<MealType>;
  onSelectionChange: (types: Set<MealType>) => void;
}

export function MealTypeFilter({ selectedTypes, onSelectionChange }: MealTypeFilterProps) {
  const toggle = (type: MealType) => {
    const next = new Set(selectedTypes);
    if (next.has(type)) {
      // Don't allow deselecting all
      if (next.size <= 1) return;
      next.delete(type);
    } else {
      next.add(type);
    }
    onSelectionChange(next);
  };

  return (
    <Card padding="sm">
      <div className="flex items-center gap-2 flex-wrap">
        <span
          className="text-xs font-semibold uppercase tracking-wider mr-1"
          style={{ color: 'var(--color-clay-subtle)' }}
        >
          Meals
        </span>

        {MEAL_TYPES.map((type) => {
          const selected = selectedTypes.has(type);
          const colors = MEAL_TYPE_COLORS[type];

          return (
            <button
              key={type}
              onClick={() => toggle(type)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all"
              style={{
                background: selected ? colors.bg : 'rgba(74, 63, 53, 0.04)',
                border: `1px solid ${selected ? colors.border : 'rgba(74, 63, 53, 0.10)'}`,
                color: selected ? colors.active : 'var(--color-clay-light)',
              }}
            >
              <div
                className="flex items-center justify-center w-4 h-4 rounded transition-all shrink-0"
                style={{
                  background: selected ? colors.active : 'rgba(74, 63, 53, 0.08)',
                  border: selected ? 'none' : '1px solid rgba(74, 63, 53, 0.15)',
                }}
              >
                {selected && <Check className="h-2.5 w-2.5 text-white" />}
              </div>
              {MEAL_TYPE_LABELS[type]}
            </button>
          );
        })}
      </div>
    </Card>
  );
}
