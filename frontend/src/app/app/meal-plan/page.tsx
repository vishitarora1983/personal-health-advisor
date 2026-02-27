'use client';

import React, { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { UtensilsCrossed, RefreshCw, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { useToast } from '@/components/ui/Toast';
import { Spinner } from '@/components/ui/LoadingSkeleton';
import { WeekView } from '@/components/meal-plan/WeekView';
import { GenerationProgress } from '@/components/meal-plan/GenerationProgress';
import { useSSEGeneration } from '@/hooks/useSSEGeneration';
import { useProgressBuffer } from '@/hooks/useProgressBuffer';
import {
  getCurrentMealPlan,
  generateRecipe,
  getNutritionTargets,
  getMemberNutritionTargets,
  getKidProfiles,
  shareWithKids,
  swapMeal,
  replaceWithCustomMeal,
  copyMealTo,
} from '@/lib/api';
import { useProfile } from '@/lib/ProfileContext';
import { getErrorMessage } from '@/lib/utils';
import { ROUTES } from '@/lib/routes';
import type { WeeklyPlan, DailyPlan, Meal, NutritionTargets, MemberNutritionTargets, KidProfile } from '@/types';

export default function MealPlanPage() {
  const router = useRouter();
  const toast = useToast();
  const { activeProfileId, activeProfile, loading: profileLoading } = useProfile();

  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [weeklyPlan, setWeeklyPlan] = useState<WeeklyPlan | null>(null);
  const [swappingMealId, setSwappingMealId] = useState<number | null>(null);
  const [customReplacingMealId, setCustomReplacingMealId] = useState<number | null>(null);
  const [copyingMealId, setCopyingMealId] = useState<number | null>(null);
  const [sharingMealId, setSharingMealId] = useState<number | null>(null);
  const [targets, setTargets] = useState<NutritionTargets | null>(null);
  const [memberTargets, setMemberTargets] = useState<MemberNutritionTargets[] | null>(null);
  const [kidProfiles, setKidProfiles] = useState<KidProfile[]>([]);

  // ── SSE operation tracking ────────────────────────────────────────────────
  type SSEOperation =
    | { type: 'generate' }
    | { type: 'regenerate-week' }
    | { type: 'regenerate-day'; dayIndex: number };
  const operationRef = useRef<SSEOperation | null>(null);

  // ── Progress buffer for smooth SSE step transitions ────────────────────────
  const {
    displayProgress: sseProgress,
    messageCounter,
    pushEvent,
    startDrain,
    reset: resetBuffer,
  } = useProgressBuffer();

  // ── SSE hook for all generation operations ──────────────────────────────────
  // The URL is a default; start() is called with urlOverride for each operation.
  const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api/v1';

  const {
    start: startSSEGeneration,
    abort: abortSSEGeneration,
    isStreaming,
  } = useSSEGeneration<unknown>({
    url: `${API_BASE_URL}/meal-plans/generate-family?profile_id=${activeProfileId ?? 0}`,

    onProgress: pushEvent,

    onComplete: (data) => {
      const op = operationRef.current;
      startDrain();
      setTimeout(() => {
        if (op?.type === 'regenerate-day') {
          // Merge single day into existing plan
          setWeeklyPlan(prev => ({
            ...prev!,
            days: prev!.days.map((d, i) => i === op.dayIndex ? (data as DailyPlan) : d),
          }));
        } else {
          setWeeklyPlan(data as WeeklyPlan);
        }
        setGenerating(false);
        resetBuffer();
        operationRef.current = null;
        toast.success(
          op?.type === 'regenerate-day' ? 'Day regenerated!' :
          op?.type === 'regenerate-week' ? 'Week regenerated!' :
          'Meal plan generated!'
        );
      }, 2000);
    },

    onError: (errorMessage) => {
      toast.error(errorMessage);
      setGenerating(false);
      resetBuffer();
      operationRef.current = null;

      // Error recovery: poll for a saved plan after 5 seconds
      setTimeout(async () => {
        if (!activeProfileId) return;
        try {
          const plan = await getCurrentMealPlan(activeProfileId);
          if (plan) {
            setWeeklyPlan(plan);
            toast.info('Meal plan recovered from server.');
          }
        } catch {
          // Plan was not saved — do nothing; user can retry manually.
        }
      }, 5000);
    },
  });

  // Clean up the SSE stream on unmount or when isStreaming changes to false.
  // Prevents the hook from calling onComplete/onError after the component unmounts,
  // which would cause a "setState on unmounted component" warning.
  useEffect(() => {
    return () => {
      if (isStreaming) {
        abortSSEGeneration();
      }
    };
  }, [isStreaming, abortSSEGeneration]);

  // ── Meal plan initialization ─────────────────────────────────────────────

  useEffect(() => {
    if (profileLoading) return;

    if (!activeProfileId) {
      toast.info('Please create or select a profile first');
      router.push(ROUTES.APP.PROFILE);
      return;
    }

    async function initialize() {
      try {
        const plan = await getCurrentMealPlan(activeProfileId!);
        setWeeklyPlan(plan);
      } catch (error: unknown) {
        if (error && typeof error === 'object' && 'response' in error) {
          const axiosError = error as { response?: { status?: number } };
          if (axiosError.response?.status !== 404) {
            toast.error('Failed to load meal plan');
          }
        }
      } finally {
        setLoading(false);
      }

      // Fetch targets separately — don't block page load
      try {
        const nutritionTargets = await getNutritionTargets(activeProfileId!);
        setTargets(nutritionTargets);
      } catch {
        // Non-critical — page works without targets
      }

      // For joint profiles, also fetch per-member nutrition targets
      if (activeProfile?.is_joint) {
        try {
          const mt = await getMemberNutritionTargets(activeProfileId!);
          setMemberTargets(mt);
        } catch {
          // Non-critical
        }
      } else {
        setMemberTargets(null);
      }

      // Fetch kid profiles for share feature (only useful for adult/joint profiles)
      if (activeProfile && (activeProfile.profile_type === 'adult' || activeProfile.profile_type === 'family' || activeProfile.is_joint)) {
        try {
          const kids = await getKidProfiles();
          setKidProfiles(kids);
        } catch {
          setKidProfiles([]);
        }
      } else {
        setKidProfiles([]);
      }
    }

    setLoading(true);
    setWeeklyPlan(null);
    initialize();
  }, [activeProfileId, activeProfile, profileLoading, router, toast]);

  const handleGeneratePlan = () => {
    if (!activeProfileId) return;
    setGenerating(true);
    resetBuffer();
    operationRef.current = { type: 'generate' };
    startSSEGeneration(
      `${API_BASE_URL}/meal-plans/generate-family?profile_id=${activeProfileId}`
    );
  };

  const handleSwapMeal = async (mealId: number) => {
    setSwappingMealId(mealId);
    try {
      const newMeal = await swapMeal(mealId);

      setWeeklyPlan((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          days: prev.days.map((day) => {
            const updatedMeals = day.meals.map((meal) =>
              meal.id === mealId ? newMeal : meal
            );
            // Recalculate daily totals from individual meals
            const hasSwap = day.meals.some((m) => m.id === mealId);
            if (!hasSwap) return { ...day, meals: updatedMeals };
            return {
              ...day,
              meals: updatedMeals,
              total_calories: updatedMeals.reduce((sum, m) => sum + m.calories, 0),
              total_protein: updatedMeals.reduce((sum, m) => sum + m.protein, 0),
              total_carbs: updatedMeals.reduce((sum, m) => sum + m.carbs, 0),
              total_fats: updatedMeals.reduce((sum, m) => sum + m.fats, 0),
            };
          }),
        };
      });

      toast.success('Meal swapped successfully!');
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setSwappingMealId(null);
    }
  };

  const handleCustomReplace = async (mealId: number, description: string): Promise<string[] | null> => {
    setCustomReplacingMealId(mealId);
    try {
      const { meal: newMeal, warnings } = await replaceWithCustomMeal(mealId, description);

      setWeeklyPlan((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          days: prev.days.map((day) => {
            const updatedMeals = day.meals.map((meal) =>
              meal.id === mealId ? newMeal : meal
            );
            const hasMatch = day.meals.some((m) => m.id === mealId);
            if (!hasMatch) return { ...day, meals: updatedMeals };
            return {
              ...day,
              meals: updatedMeals,
              total_calories: updatedMeals.reduce((sum, m) => sum + m.calories, 0),
              total_protein: updatedMeals.reduce((sum, m) => sum + m.protein, 0),
              total_carbs: updatedMeals.reduce((sum, m) => sum + m.carbs, 0),
              total_fats: updatedMeals.reduce((sum, m) => sum + m.fats, 0),
            };
          }),
        };
      });

      toast.success('Meal updated with your custom dish!');
      if (warnings && warnings.length > 0) {
        warnings.forEach((w) => toast.info(w));
      }
      return warnings;
    } catch (error) {
      toast.error(getErrorMessage(error));
      return null;
    } finally {
      setCustomReplacingMealId(null);
    }
  };

  const handleRegenerateDay = (dayIndex: number) => {
    if (!weeklyPlan) return;
    setGenerating(true);
    resetBuffer();
    operationRef.current = { type: 'regenerate-day', dayIndex };
    startSSEGeneration(
      `${API_BASE_URL}/meal-plans/${weeklyPlan.id}/regenerate-day-stream/${dayIndex}`
    );
  };

  const handleRegeneratePlan = () => {
    if (!weeklyPlan) return;
    setGenerating(true);
    resetBuffer();
    operationRef.current = { type: 'regenerate-week' };
    startSSEGeneration(
      `${API_BASE_URL}/meal-plans/${weeklyPlan.id}/regenerate-stream`
    );
  };

  const handleRecipeLoad = async (mealId: number): Promise<Meal> => {
    const updatedMeal = await generateRecipe(mealId);

    // Update the meal in local state so it's cached for future renders
    setWeeklyPlan((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        days: prev.days.map((day) => ({
          ...day,
          meals: day.meals.map((meal) =>
            meal.id === mealId ? updatedMeal : meal
          ),
        })),
      };
    });

    return updatedMeal;
  };

  const handleCopyMeal = async (sourceMealId: number, targetMealId: number) => {
    setCopyingMealId(sourceMealId);
    try {
      const updatedTarget = await copyMealTo(sourceMealId, targetMealId);

      setWeeklyPlan((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          days: prev.days.map((day) => {
            const updatedMeals = day.meals.map((meal) =>
              meal.id === targetMealId ? updatedTarget : meal
            );
            const hasTarget = day.meals.some((m) => m.id === targetMealId);
            if (!hasTarget) return day;
            return {
              ...day,
              meals: updatedMeals,
              total_calories: updatedMeals.reduce((sum, m) => sum + m.calories, 0),
              total_protein: updatedMeals.reduce((sum, m) => sum + m.protein, 0),
              total_carbs: updatedMeals.reduce((sum, m) => sum + m.carbs, 0),
              total_fats: updatedMeals.reduce((sum, m) => sum + m.fats, 0),
            };
          }),
        };
      });

      toast.success('Meal copied successfully!');
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setCopyingMealId(null);
    }
  };

  const handleShareWithKids = async (mealId: number, kidIds: number[]) => {
    setSharingMealId(mealId);
    try {
      const updatedMeal = await shareWithKids(mealId, kidIds);

      setWeeklyPlan((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          days: prev.days.map((day) => ({
            ...day,
            meals: day.meals.map((meal) =>
              meal.id === mealId ? updatedMeal : meal
            ),
          })),
        };
      });

      if (kidIds.length === 0) {
        toast.success('Sharing removed');
      } else {
        toast.success('Meal shared with kids!');
      }
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setSharingMealId(null);
    }
  };

  if (profileLoading || loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Spinner size="lg" />
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="type-h3 text-[var(--text-primary)]">Weekly Meal Plan</h1>
          <p className="text-[var(--text-secondary)] text-sm mt-2">
            Your personalized meal plan for the week
          </p>
        </div>

        {weeklyPlan && !generating && (
          <Button
            variant="secondary"
            onClick={handleRegeneratePlan}
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Regenerate Week
          </Button>
        )}
      </div>

      {/* Loading State — SSE progress for all generation operations */}
      {generating && (() => {
        const op = operationRef.current;
        const heading =
          op?.type === 'regenerate-day' ? `Regenerating Day ${op.dayIndex + 1}` :
          op?.type === 'regenerate-week' ? 'Regenerating Your Week' :
          activeProfile?.is_joint ? 'Generating Your Family Meal Plan' :
          'Generating Your Meal Plan';
        const subtitle =
          activeProfile?.is_joint
            ? 'Personalizing portions for each household member. This typically takes 1-3 minutes.'
            : 'Our AI is crafting a personalized meal plan tailored to your goals. This typically takes 1-2 minutes.';

        return (
          <div className="flex flex-col items-center justify-center py-16">
            {sseProgress ? (
              <>
                <h3 className="type-h4 text-[var(--text-primary)] mb-2">{heading}</h3>
                <GenerationProgress progress={sseProgress} messageKey={messageCounter} />
                <p className="text-center max-w-md text-sm text-[var(--text-muted)] mt-4">
                  {subtitle}
                </p>
              </>
            ) : (
              <>
                <Loader2 className="h-16 w-16 animate-spin mb-4 text-[var(--brand-green-light)]" />
                <h3 className="type-h4 text-[var(--text-primary)] mb-2">Connecting...</h3>
                <p className="text-center max-w-md text-sm text-[var(--text-muted)]">
                  Starting generation...
                </p>
              </>
            )}

            <button
              type="button"
              onClick={() => {
                abortSSEGeneration();
                setGenerating(false);
                resetBuffer();
                operationRef.current = null;
              }}
              className="mt-6 text-xs underline"
              style={{ color: 'var(--text-muted)' }}
            >
              Cancel
            </button>
          </div>
        );
      })()}

      {/* Empty State - No Plan */}
      {!weeklyPlan && !generating && (
        <EmptyState
          icon={UtensilsCrossed}
          title="No Meal Plan Yet"
          description="Generate your first AI-powered meal plan based on your profile and preferences"
          actionLabel="Generate Meal Plan"
          onAction={handleGeneratePlan}
        />
      )}

      {/* Week View */}
      {weeklyPlan && !generating && (
        <WeekView
          weeklyPlan={weeklyPlan}
          nutritionTargets={targets}
          memberNutritionTargets={memberTargets}
          onSwapMeal={handleSwapMeal}
          onCustomReplace={handleCustomReplace}
          onRegenerateDay={handleRegenerateDay}
          onRecipeLoad={handleRecipeLoad}
          onCopyMeal={handleCopyMeal}
          onShareWithKids={kidProfiles.length > 0 ? handleShareWithKids : undefined}
          kidProfiles={kidProfiles.length > 0 ? kidProfiles : undefined}
          swappingMealId={swappingMealId ?? undefined}
          customReplacingMealId={customReplacingMealId ?? undefined}
          copyingMealId={copyingMealId ?? undefined}
          sharingMealId={sharingMealId ?? undefined}
        />
      )}

    </div>
  );
}
