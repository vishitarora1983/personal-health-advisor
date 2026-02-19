'use client';

import { useState } from 'react';
import { ChevronDown, ChevronUp, RefreshCw, Clock, Loader2, Pencil, AlertTriangle, X, Copy, Repeat2, Users } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { formatMacros, capitalize, getDayName } from '@/lib/utils';
import type { Meal, DailyPlan, MemberNutritionTargets, KidProfile } from '@/types';

interface MealCardProps {
  meal: Meal;
  onSwap: (mealId: number) => void;
  onCustomReplace: (mealId: number, description: string) => Promise<string[] | null>;
  onRecipeLoad?: (mealId: number) => Promise<Meal>;
  onCopyMeal?: (sourceMealId: number, targetMealId: number) => Promise<void>;
  onShareWithKids?: (mealId: number, kidIds: number[]) => Promise<void>;
  swapping?: boolean;
  customReplacing?: boolean;
  copyingMeal?: boolean;
  sharingMeal?: boolean;
  kidProfiles?: KidProfile[];
  memberNutritionTargets?: MemberNutritionTargets[] | null;
  allDays?: DailyPlan[];
  isRepeat?: boolean;
}

/**
 * Card displaying a single meal with expandable recipe details.
 * Shows nutrition info, cooking time, and swap functionality.
 * Loads recipe on demand when user clicks "Recipe".
 */
/**
 * Scale a portion_size string by a ratio, adjusting all numeric quantities and gram weights.
 * e.g. "2 cups chickpeas (500g) + 4 bhature (400g total)" with ratio 0.56
 *    → "~1 cups chickpeas (~280g) + ~2 bhature (~224g total)"
 */
function scalePortionString(portionSize: string, ratio: number): string {
  const parts = portionSize.split(/\s*\+\s*/);

  return parts.map((part) => {
    // Scale the leading quantity number (e.g., "2 cups" → "~1 cups")
    let scaled = part.replace(/^(\d+\.?\d*)/, (_, num) => {
      const val = parseFloat(num) * ratio;
      return '~' + (val < 1 ? val.toFixed(1) : String(Math.round(val * 10) / 10).replace(/\.0$/, ''));
    });

    // Scale gram values in parentheses (e.g., "(500g)" → "(~280g)")
    scaled = scaled.replace(/\((\d+\.?\d*)\s*g([^)]*)\)/, (_, num, rest) => {
      const val = Math.round(parseFloat(num) * ratio);
      return `(~${val}g${rest})`;
    });

    return scaled;
  }).join(' + ');
}

export function MealCard({ meal, onSwap, onCustomReplace, onRecipeLoad, onCopyMeal, onShareWithKids, swapping = false, customReplacing = false, copyingMeal = false, sharingMeal = false, kidProfiles, memberNutritionTargets, allDays, isRepeat = false }: MealCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [loadingRecipe, setLoadingRecipe] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [copyMode, setCopyMode] = useState(false);
  const [shareMode, setShareMode] = useState(false);
  const [selectedKidIds, setSelectedKidIds] = useState<Set<number>>(new Set());
  const [selectedDayId, setSelectedDayId] = useState<number | null>(null);
  const [customDescription, setCustomDescription] = useState('');
  const [dietaryWarnings, setDietaryWarnings] = useState<string[] | null>(null);

  const isBusy = swapping || customReplacing || copyingMeal || sharingMeal;

  const hasKidShares = meal.shared_with_kids && meal.shared_with_kids.length > 0;
  const showShareButton = kidProfiles && kidProfiles.length > 0 && onShareWithKids;

  const handleCustomSubmit = async () => {
    if (customDescription.trim().length < 3) return;
    setDietaryWarnings(null);
    const warnings = await onCustomReplace(meal.id, customDescription.trim());
    if (warnings && warnings.length > 0) {
      setDietaryWarnings(warnings);
    }
    setEditMode(false);
    setCustomDescription('');
  };

  const handleEditCancel = () => {
    setEditMode(false);
    setCustomDescription('');
    setDietaryWarnings(null);
  };

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
              {isRepeat && (
                <span
                  className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-semibold uppercase tracking-wider"
                  style={{
                    background: 'rgba(139, 92, 246, 0.10)',
                    color: 'rgb(139, 92, 246)',
                    border: '1px solid rgba(139, 92, 246, 0.20)',
                  }}
                >
                  <Repeat2 className="h-3 w-3" />
                  Repeat
                </span>
              )}
            </div>
            <h3
              className="font-semibold text-base leading-snug"
              style={{ color: 'var(--color-emerald-deep)', fontFamily: 'var(--font-display), serif' }}
            >
              {meal.dish_name}
            </h3>
            {/* Shared-with-kids badges + cooking multiplier */}
            {hasKidShares && (
              <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                {meal.shared_with_kids!.map((kid) => (
                  <span
                    key={kid.profile_id}
                    className="inline-flex items-center px-1.5 py-0.5 rounded-md text-[10px] font-semibold"
                    style={{
                      background: 'rgba(99, 102, 241, 0.10)',
                      color: 'rgb(99, 102, 241)',
                      border: '1px solid rgba(99, 102, 241, 0.20)',
                    }}
                  >
                    {kid.profile_name}
                  </span>
                ))}
                <span
                  className="inline-flex items-center px-1.5 py-0.5 rounded-md text-[10px] font-bold"
                  style={{
                    background: 'rgba(16, 185, 129, 0.10)',
                    color: 'rgb(16, 185, 129)',
                    border: '1px solid rgba(16, 185, 129, 0.20)',
                  }}
                >
                  Cook &times;{(1 + meal.shared_with_kids!.reduce((sum, k) => sum + k.scale_ratio, 0)).toFixed(2)}
                </span>
              </div>
            )}
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
          {/* Total line — labeled as "Total" for joint profiles */}
          <div className="flex items-center justify-between text-sm">
            <div>
              {memberNutritionTargets && memberNutritionTargets.length > 0 && (
                <span className="text-[10px] font-semibold uppercase tracking-wider mr-1.5" style={{ color: 'var(--color-sage)' }}>
                  Total
                </span>
              )}
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
              <span>
                {memberNutritionTargets && memberNutritionTargets.length > 0 ? 'Total portion' : 'Serving'}:{' '}
                <span className="font-medium" style={{ color: 'var(--color-clay-light)' }}>
                  {hasKidShares
                    ? scalePortionString(meal.portion_size!, 1 + meal.shared_with_kids!.reduce((sum, k) => sum + k.scale_ratio, 0))
                    : meal.portion_size}
                </span>
              </span>
            )}
          </div>

          {/* Per-person breakdown for joint profiles */}
          {memberNutritionTargets && memberNutritionTargets.length > 0 && meal.portion_size && (
            <div
              className="mt-2.5 pt-2.5 space-y-1.5"
              style={{ borderTop: '1px dashed rgba(45, 90, 63, 0.10)' }}
            >
              <p className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--color-sage)' }}>
                Per Person Serving
              </p>
              {memberNutritionTargets.map((member) => (
                <div
                  key={member.profile_id}
                  className="rounded-lg px-2.5 py-1.5"
                  style={{
                    background: member.is_primary ? 'rgba(212, 148, 10, 0.04)' : 'rgba(45, 90, 63, 0.02)',
                  }}
                >
                  <div className="flex items-baseline gap-1.5 text-xs">
                    <span className="font-semibold shrink-0" style={{ color: 'var(--color-emerald-deep)' }}>
                      {member.profile_name}:
                    </span>
                    <span className="font-medium" style={{ color: 'var(--color-clay-light)' }}>
                      {scalePortionString(meal.portion_size!, member.share_ratio)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
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

        {/* Inline Edit Form */}
        {editMode && (
          <div
            className="rounded-xl p-3 space-y-2"
            style={{
              background: 'rgba(45, 90, 63, 0.03)',
              border: '1px solid rgba(45, 90, 63, 0.10)',
            }}
          >
            <label className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--color-sage)' }}>
              Describe your meal
            </label>
            <textarea
              value={customDescription}
              onChange={(e) => setCustomDescription(e.target.value)}
              placeholder="e.g., chicken biryani with raita"
              rows={2}
              className="w-full rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2"
              style={{
                background: 'var(--surface-primary-solid)',
                border: '1px solid var(--surface-glass-border)',
                color: 'var(--color-clay)',
              }}
              disabled={customReplacing}
              maxLength={500}
            />
            <div className="flex gap-2">
              <Button
                variant="primary"
                size="sm"
                fullWidth
                onClick={handleCustomSubmit}
                loading={customReplacing}
                disabled={customDescription.trim().length < 3 || customReplacing}
              >
                {customReplacing ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                    Analyzing...
                  </>
                ) : (
                  'Update Meal'
                )}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleEditCancel}
                disabled={customReplacing}
              >
                Cancel
              </Button>
            </div>
          </div>
        )}

        {/* Dietary Warnings */}
        {dietaryWarnings && dietaryWarnings.length > 0 && (
          <div
            className="rounded-xl p-3 flex gap-2"
            style={{
              background: 'rgba(212, 148, 10, 0.08)',
              border: '1px solid rgba(212, 148, 10, 0.20)',
            }}
          >
            <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" style={{ color: 'var(--color-amber)' }} />
            <div className="flex-1">
              {dietaryWarnings.map((w, i) => (
                <p key={i} className="text-xs" style={{ color: 'var(--color-amber)' }}>{w}</p>
              ))}
            </div>
            <button onClick={() => setDietaryWarnings(null)} className="shrink-0 self-start">
              <X className="h-3.5 w-3.5" style={{ color: 'var(--color-amber)' }} />
            </button>
          </div>
        )}

        {/* Inline Copy Panel */}
        {copyMode && allDays && (
          <div
            className="rounded-xl p-3 space-y-2"
            style={{
              background: 'rgba(45, 90, 63, 0.03)',
              border: '1px solid rgba(45, 90, 63, 0.10)',
            }}
          >
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--color-sage)' }}>
                Copy to
              </label>
              <button
                onClick={() => { setCopyMode(false); setSelectedDayId(null); }}
                className="p-0.5 rounded hover:bg-black/5"
              >
                <X className="h-3.5 w-3.5" style={{ color: 'var(--color-clay-muted)' }} />
              </button>
            </div>

            {/* Day selector row */}
            <div className="flex gap-1 flex-wrap">
              {allDays.map((day) => (
                <button
                  key={day.id}
                  onClick={() => setSelectedDayId(day.id === selectedDayId ? null : day.id)}
                  className="px-2.5 py-1 rounded-lg text-xs font-medium transition-colors"
                  style={{
                    background: selectedDayId === day.id
                      ? 'var(--color-emerald)'
                      : 'var(--surface-primary-solid)',
                    color: selectedDayId === day.id
                      ? '#fff'
                      : 'var(--color-clay)',
                    border: selectedDayId === day.id
                      ? '1px solid var(--color-emerald)'
                      : '1px solid var(--surface-glass-border)',
                  }}
                >
                  {getDayName(day.day_date, 'short')}
                </button>
              ))}
            </div>

            {/* Meal slot list for selected day */}
            {selectedDayId && (() => {
              const targetDay = allDays.find((d) => d.id === selectedDayId);
              if (!targetDay) return null;
              const targetMeals = targetDay.meals.filter((m) => m.id !== meal.id);
              if (targetMeals.length === 0) {
                return (
                  <p className="text-xs py-1" style={{ color: 'var(--color-clay-muted)' }}>
                    No other meal slots on this day.
                  </p>
                );
              }
              return (
                <div className="space-y-1">
                  {targetMeals.map((target) => (
                    <button
                      key={target.id}
                      onClick={async () => {
                        if (onCopyMeal) {
                          await onCopyMeal(meal.id, target.id);
                          setCopyMode(false);
                          setSelectedDayId(null);
                        }
                      }}
                      disabled={copyingMeal}
                      className="w-full text-left rounded-lg px-3 py-2 text-sm transition-colors hover:brightness-95 disabled:opacity-50"
                      style={{
                        background: 'var(--surface-primary-solid)',
                        border: '1px solid var(--surface-glass-border)',
                        color: 'var(--color-clay)',
                      }}
                    >
                      <span className="font-medium" style={{ color: 'var(--color-emerald-deep)' }}>
                        {capitalize(target.meal_type)}
                      </span>
                      <span style={{ color: 'var(--color-clay-muted)' }}> — </span>
                      <span>{target.dish_name}</span>
                    </button>
                  ))}
                </div>
              );
            })()}
          </div>
        )}

        {/* Inline Share Panel */}
        {shareMode && kidProfiles && kidProfiles.length > 0 && (
          <div
            className="rounded-xl p-3 space-y-2"
            style={{
              background: 'rgba(99, 102, 241, 0.03)',
              border: '1px solid rgba(99, 102, 241, 0.12)',
            }}
          >
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--color-sage)' }}>
                Share with kids
              </label>
              <button
                onClick={() => setShareMode(false)}
                className="p-0.5 rounded hover:bg-black/5"
              >
                <X className="h-3.5 w-3.5" style={{ color: 'var(--color-clay-muted)' }} />
              </button>
            </div>

            {/* All Kids toggle */}
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={kidProfiles.every((k) => selectedKidIds.has(k.id))}
                onChange={(e) => {
                  if (e.target.checked) {
                    setSelectedKidIds(new Set(kidProfiles.map((k) => k.id)));
                  } else {
                    setSelectedKidIds(new Set());
                  }
                }}
                className="rounded"
                disabled={sharingMeal}
              />
              <span className="text-sm font-medium" style={{ color: 'var(--color-clay)' }}>All Kids</span>
            </label>

            {/* Individual kid checkboxes */}
            {kidProfiles.map((kid) => (
              <label key={kid.id} className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={selectedKidIds.has(kid.id)}
                  onChange={(e) => {
                    const next = new Set(selectedKidIds);
                    if (e.target.checked) {
                      next.add(kid.id);
                    } else {
                      next.delete(kid.id);
                    }
                    setSelectedKidIds(next);
                  }}
                  className="rounded"
                  disabled={sharingMeal}
                />
                <span className="text-sm" style={{ color: 'var(--color-clay)' }}>{kid.name}</span>
              </label>
            ))}

            <Button
              variant="primary"
              size="sm"
              fullWidth
              onClick={async () => {
                if (onShareWithKids) {
                  await onShareWithKids(meal.id, Array.from(selectedKidIds));
                  setShareMode(false);
                }
              }}
              loading={sharingMeal}
              disabled={sharingMeal}
            >
              {sharingMeal ? 'Sharing...' : 'Apply'}
            </Button>
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
            disabled={isBusy}
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
            variant="ghost"
            size="sm"
            onClick={() => { setEditMode(!editMode); setDietaryWarnings(null); }}
            disabled={isBusy}
          >
            <Pencil className="h-4 w-4 mr-1" />
            Edit
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => { setCopyMode(!copyMode); setSelectedDayId(null); }}
            disabled={isBusy || !onCopyMeal}
            loading={copyingMeal}
          >
            <Copy className="h-4 w-4 mr-1" />
            Copy
          </Button>
          {showShareButton && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                // Pre-select currently shared kids when opening panel
                const current = new Set((meal.shared_with_kids || []).map((k) => k.profile_id));
                setSelectedKidIds(current);
                setShareMode(!shareMode);
              }}
              disabled={isBusy}
              loading={sharingMeal}
            >
              <Users className="h-4 w-4 mr-1" />
              Share
            </Button>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={() => onSwap(meal.id)}
            loading={swapping}
            disabled={isBusy}
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
