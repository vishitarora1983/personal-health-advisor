'use client';

import React, { useState, useEffect } from 'react';
import { Loader2, ChefHat } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { Badge } from '@/components/ui/Badge';
import { generateRecipe } from '@/lib/api';
import { getErrorMessage } from '@/lib/utils';
import { useToast } from '@/components/ui/Toast';
import type { AggregatedDish } from '@/lib/chefs-view-utils';
import type { Meal } from '@/types';

interface RecipeModalProps {
  isOpen: boolean;
  onClose: () => void;
  dish: AggregatedDish | null;
}

export function RecipeModal({ isOpen, onClose, dish }: RecipeModalProps) {
  const toast = useToast();
  const [loading, setLoading] = useState(false);
  const [recipeMeal, setRecipeMeal] = useState<Meal | null>(null);

  useEffect(() => {
    if (!isOpen || !dish) {
      setRecipeMeal(null);
      return;
    }

    const source = dish.sourceMeals[0];
    if (!source) return;

    // Check if recipe is already cached
    if (source.ingredients && source.ingredients.length > 0) {
      setRecipeMeal(source);
      return;
    }

    // Generate recipe
    let cancelled = false;
    setLoading(true);

    generateRecipe(source.id)
      .then((meal) => {
        if (!cancelled) {
          setRecipeMeal(meal);
          // Update the source meal in place so it's cached
          source.ingredients = meal.ingredients;
          source.recipe_brief = meal.recipe_brief;
        }
      })
      .catch((error) => {
        if (!cancelled) {
          toast.error(getErrorMessage(error));
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, [isOpen, dish, toast]);

  if (!dish) return null;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={dish.dishName} size="lg">
      {/* Header info */}
      <div className="flex flex-wrap items-center gap-2 mb-5">
        <Badge variant="info">{dish.aggregatedPortion}</Badge>
        <Badge variant="warning">{dish.totalCalories} kcal</Badge>
        {dish.profileNames.length > 1 && (
          <Badge variant="neutral">
            {dish.profileNames.length} profiles
          </Badge>
        )}
      </div>

      {/* Profile list */}
      <div className="flex flex-wrap gap-1.5 mb-5">
        {dish.profileNames.map((name, i) => (
          <span
            key={i}
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium"
            style={{
              background: 'var(--brand-amber-subtle)',
              color: 'var(--brand-amber-light)',
              border: '1px solid var(--brand-amber-glow)',
            }}
          >
            <span
              className="flex items-center justify-center w-4 h-4 rounded text-[10px] font-bold"
              style={{
                background: 'linear-gradient(135deg, var(--brand-amber), var(--brand-amber-light))',
                color: 'white',
              }}
            >
              {name.charAt(0).toUpperCase()}
            </span>
            {name}
          </span>
        ))}
      </div>

      {/* Loading state */}
      {loading && (
        <div className="flex flex-col items-center py-10">
          <Loader2
            className="h-10 w-10 animate-spin mb-3"
            style={{ color: 'var(--brand-green)' }}
          />
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
            Generating recipe...
          </p>
        </div>
      )}

      {/* Recipe content */}
      {!loading && recipeMeal && (
        <div className="space-y-5">
          {/* Ingredients */}
          {recipeMeal.ingredients && recipeMeal.ingredients.length > 0 && (
            <div>
              <h3
                className="text-sm font-semibold uppercase tracking-wider mb-3"
                style={{ color: 'var(--brand-green)' }}
              >
                Ingredients
              </h3>
              <div
                className="rounded-xl p-4"
                style={{
                  background: 'rgba(168, 197, 176, 0.06)',
                  border: '1px solid var(--surface-border)',
                }}
              >
                <ul className="space-y-1.5">
                  {recipeMeal.ingredients.map((ing, i) => (
                    <li
                      key={i}
                      className="flex items-baseline gap-2 text-sm"
                      style={{ color: 'var(--text-secondary)' }}
                    >
                      <span
                        className="w-1.5 h-1.5 rounded-full shrink-0 mt-1.5"
                        style={{ background: 'var(--brand-amber)' }}
                      />
                      <span>
                        <span className="font-medium">{ing.quantity} {ing.unit}</span>{' '}
                        {ing.name}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}

          {/* Instructions */}
          {recipeMeal.recipe_brief && (
            <div>
              <h3
                className="text-sm font-semibold uppercase tracking-wider mb-3"
                style={{ color: 'var(--brand-green)' }}
              >
                Instructions
              </h3>
              <div
                className="rounded-xl p-4 text-sm leading-relaxed whitespace-pre-line"
                style={{
                  background: 'rgba(168, 197, 176, 0.06)',
                  border: '1px solid var(--surface-border)',
                  color: 'var(--text-secondary)',
                }}
              >
                {recipeMeal.recipe_brief}
              </div>
            </div>
          )}

          {/* Prep time */}
          {recipeMeal.prep_time > 0 && (
            <div className="flex items-center gap-2 text-sm" style={{ color: 'var(--text-secondary)' }}>
              <ChefHat className="h-4 w-4" style={{ color: 'var(--brand-amber)' }} />
              <span>Prep time: {recipeMeal.prep_time} min</span>
            </div>
          )}
        </div>
      )}

      {/* No recipe yet and not loading */}
      {!loading && !recipeMeal && (
        <p className="text-sm text-center py-8" style={{ color: 'var(--text-muted)' }}>
          No recipe available for this dish.
        </p>
      )}
    </Modal>
  );
}
