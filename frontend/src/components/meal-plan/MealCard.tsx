'use client';

import { useState } from 'react';
import { ChevronDown, ChevronUp, RefreshCw, Clock, Loader2 } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { formatMacros, capitalize } from '@/lib/utils';
import type { Meal } from '@/types';

interface MealCardProps {
  meal: Meal;
  onSwap: (mealId: number) => void;
  onRecipeLoad?: (mealId: number) => Promise<Meal>;
  swapping?: boolean;
}

/**
 * Card displaying a single meal with expandable recipe details.
 * Shows nutrition info, cooking time, and swap functionality.
 * Loads recipe on demand when user clicks "Recipe".
 */
export function MealCard({ meal, onSwap, onRecipeLoad, swapping = false }: MealCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [loadingRecipe, setLoadingRecipe] = useState(false);

  const hasRecipe = meal.ingredients && meal.ingredients.length > 0;

  const handleToggleRecipe = async () => {
    if (isExpanded) {
      setIsExpanded(false);
      return;
    }

    // If recipe already loaded, just expand
    if (hasRecipe) {
      setIsExpanded(true);
      return;
    }

    // Load recipe on demand
    if (onRecipeLoad) {
      setLoadingRecipe(true);
      try {
        await onRecipeLoad(meal.id);
        setIsExpanded(true);
      } catch {
        // Error handled by parent via toast
      } finally {
        setLoadingRecipe(false);
      }
    }
  };

  return (
    <Card padding="none" hover className="flex flex-col">
      {/* Meal Type Accent Strip */}
      <div
        className="h-1 rounded-t-2xl"
        style={{
          background: getMealTypeGradient(meal.meal_type),
        }}
      />

      <div className="p-4 flex flex-col flex-1 space-y-3">
        {/* Header */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1.5">
              <Badge variant={getMealTypeBadge(meal.meal_type)}>
                {capitalize(meal.meal_type)}
              </Badge>
              <Badge variant="neutral">{capitalize(meal.cuisine)}</Badge>
            </div>
            <h3
              className="font-semibold text-base leading-snug"
              style={{ color: 'var(--color-emerald-deep)', fontFamily: 'var(--font-display), serif' }}
            >
              {meal.dish_name}
            </h3>
          </div>
        </div>

        {/* Nutrition Row */}
        <div
          className="rounded-xl p-3"
          style={{
            background: 'rgba(45, 90, 63, 0.04)',
            border: '1px solid rgba(45, 90, 63, 0.06)',
          }}
        >
          <div className="flex items-center justify-between text-sm">
            <div>
              <span style={{ color: 'var(--color-clay-muted)' }}>Calories: </span>
              <span className="font-bold" style={{ color: 'var(--color-clay)' }}>
                {Math.round(meal.calories)}
              </span>
            </div>
            <div className="flex items-center gap-1" style={{ color: 'var(--color-clay-muted)' }}>
              <Clock className="h-3.5 w-3.5" />
              <span className="text-sm">{meal.prep_time} min</span>
            </div>
          </div>
          <div className="mt-1.5 flex items-center justify-between text-xs" style={{ color: 'var(--color-clay-muted)' }}>
            <span>{formatMacros(meal.protein, meal.carbs, meal.fats)}</span>
            {meal.portion_size && (
              <span>Serving: <span className="font-medium" style={{ color: 'var(--color-clay-light)' }}>{meal.portion_size}</span></span>
            )}
          </div>
        </div>

        {/* Expandable Details */}
        {isExpanded && (
          <div className="space-y-3 pt-3 animate-slide-down" style={{ borderTop: '1px solid var(--surface-glass-border)' }}>
            {meal.description && (
              <div>
                <h4 className="text-xs font-semibold uppercase tracking-wider mb-1" style={{ color: 'var(--color-sage)' }}>
                  Description
                </h4>
                <p className="text-sm" style={{ color: 'var(--color-clay-light)' }}>{meal.description}</p>
              </div>
            )}

            {meal.ingredients && meal.ingredients.length > 0 && (
              <div>
                <h4 className="text-xs font-semibold uppercase tracking-wider mb-1.5" style={{ color: 'var(--color-sage)' }}>
                  Ingredients ({meal.ingredients.length})
                </h4>
                <ul className="text-sm space-y-1" style={{ color: 'var(--color-clay-light)' }}>
                  {meal.ingredients.map((ing, idx) => (
                    <li key={idx} className="flex gap-1">
                      <span style={{ color: 'var(--color-clay-muted)' }}>&bull;</span>
                      <span>
                        <span className="font-medium">{ing.quantity} {ing.unit}</span>{' '}
                        {ing.name}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {meal.recipe_brief && (
              <div>
                <h4 className="text-xs font-semibold uppercase tracking-wider mb-1" style={{ color: 'var(--color-sage)' }}>
                  Recipe
                </h4>
                <p className="text-sm whitespace-pre-line" style={{ color: 'var(--color-clay-light)' }}>
                  {meal.recipe_brief}
                </p>
              </div>
            )}

          </div>
        )}

        {/* Actions — pushed to bottom */}
        <div className="flex gap-2 pt-1 mt-auto">
          <Button
            variant="ghost"
            size="sm"
            fullWidth
            onClick={handleToggleRecipe}
            loading={loadingRecipe}
          >
            {loadingRecipe ? (
              <>
                <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                Loading...
              </>
            ) : isExpanded ? (
              <>
                <ChevronUp className="h-4 w-4 mr-1" />
                Less
              </>
            ) : (
              <>
                <ChevronDown className="h-4 w-4 mr-1" />
                Recipe
              </>
            )}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => onSwap(meal.id)}
            loading={swapping}
          >
            <RefreshCw className="h-4 w-4 mr-1" />
            Swap
          </Button>
        </div>
      </div>
    </Card>
  );
}

function getMealTypeGradient(type: string): string {
  const gradients: Record<string, string> = {
    breakfast: 'linear-gradient(90deg, var(--color-amber), var(--color-amber-warm))',
    lunch: 'linear-gradient(90deg, var(--color-emerald), var(--color-emerald-light))',
    dinner: 'linear-gradient(90deg, var(--color-emerald-deep), var(--color-emerald))',
    snack: 'linear-gradient(90deg, var(--color-sage-light), var(--color-sage))',
  };
  return gradients[type] || gradients.snack;
}

function getMealTypeBadge(type: string): 'success' | 'warning' | 'info' | 'neutral' {
  const variants: Record<string, 'success' | 'warning' | 'info' | 'neutral'> = {
    breakfast: 'warning',
    lunch: 'success',
    dinner: 'info',
    snack: 'neutral',
  };
  return variants[type] || 'neutral';
}
