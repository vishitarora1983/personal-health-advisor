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
    active: 'var(--brand-amber)',
    bg: 'var(--brand-amber-subtle)',
    border: 'var(--brand-amber-glow)',
  },
  lunch: {
    active: 'var(--brand-green)',
    bg: 'var(--brand-green-border)',
    border: 'var(--brand-green-glow)',
  },
  dinner: {
    active: 'var(--color-info)',
    bg: 'rgba(42, 138, 122, 0.10)',
    border: 'rgba(42, 138, 122, 0.25)',
  },
  snack: {
    active: 'var(--text-secondary)',
    bg: 'var(--surface-glass-hover)',
    border: 'var(--surface-border-hover)',
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
          style={{ color: 'var(--text-muted)' }}
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
                background: selected ? colors.bg : 'var(--surface-glass)',
                border: `1px solid ${selected ? colors.border : 'var(--surface-border)'}`,
                color: selected ? colors.active : 'var(--text-secondary)',
              }}
            >
              <div
                className="flex items-center justify-center w-4 h-4 rounded transition-all shrink-0"
                style={{
                  background: selected ? colors.active : 'var(--surface-glass-hover)',
                  border: selected ? 'none' : '1px solid var(--surface-border)',
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
