'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { UtensilsCrossed, RefreshCw, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { useToast } from '@/components/ui/Toast';
import { Spinner } from '@/components/ui/LoadingSkeleton';
import { WeekView } from '@/components/meal-plan/WeekView';
import { GenerationProgress } from '@/components/meal-plan/GenerationProgress';
import { useSSEGeneration } from '@/hooks/useSSEGeneration';
import {
  getCurrentMealPlan,
  generateMealPlan,
  generateRecipe,
  getNutritionTargets,
  getMemberNutritionTargets,
  getKidProfiles,
  shareWithKids,
  swapMeal,
  replaceWithCustomMeal,
  copyMealTo,
  regenerateDay,
  regeneratePlan,
} from '@/lib/api';
import { useProfile } from '@/lib/ProfileContext';
import { getErrorMessage } from '@/lib/utils';
import { ROUTES } from '@/lib/routes';
import type { WeeklyPlan, Meal, NutritionTargets, MemberNutritionTargets, KidProfile, SSEProgressStep } from '@/types';

export default function MealPlanPage() {
  const router = useRouter();
  const toast = useToast();
  const { activeProfileId, activeProfile, loading: profileLoading } = useProfile();

  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [weeklyPlan, setWeeklyPlan] = useState<WeeklyPlan | null>(null);
  const [swappingMealId, setSwappingMealId] = useState<number | null>(null);
  const [customReplacingMealId, setCustomReplacingMealId] = useState<number | null>(null);
  const [regeneratingDayIndex, setRegeneratingDayIndex] = useState<number | null>(null);
  const [regeneratingWeek, setRegeneratingWeek] = useState(false);
  const [copyingMealId, setCopyingMealId] = useState<number | null>(null);
  const [sharingMealId, setSharingMealId] = useState<number | null>(null);
  const [targets, setTargets] = useState<NutritionTargets | null>(null);
  const [memberTargets, setMemberTargets] = useState<MemberNutritionTargets[] | null>(null);
  const [kidProfiles, setKidProfiles] = useState<KidProfile[]>([]);
  // SSE progress state — only populated during joint profile generation
  const [sseProgress, setSseProgress] = useState<SSEProgressStep | null>(null);

  // ── SSE hook for joint profile generation ──────────────────────────────────
  // The URL embeds activeProfileId. Since start() is only called after the user
  // actively clicks "Generate" (at which point activeProfileId is stable), a
  // stale closure from a previous profile is not a concern in practice.
  const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api/v1';

  const {
    start: startSSEGeneration,
    abort: abortSSEGeneration,
    isStreaming,
    progress: sseProgressFromHook,
  } = useSSEGeneration<WeeklyPlan>({
    url: `${API_BASE_URL}/meal-plans/generate-family?profile_id=${activeProfileId ?? 0}`,

    onComplete: (plan) => {
      setWeeklyPlan(plan);
      setGenerating(false);
      setSseProgress(null);
      toast.success('Meal plan generated successfully!');
    },

    onError: (errorMessage) => {
      toast.error(errorMessage);
      setGenerating(false);
      setSseProgress(null);

      // Error recovery: the server-side generation runs as a fire-and-forget
      // task (asyncio.ensure_future). Even if the SSE connection is lost, the
      // generation may have completed and saved the plan. Poll after 5 seconds
      // to retrieve a plan that was saved despite the stream failure.
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

  // Sync hook progress into local state so the GenerationProgress component
  // re-renders on every new SSE event. useEffect ensures this runs after render,
  // matching React's rule that state updates must not occur during render.
  useEffect(() => {
    if (sseProgressFromHook) {
      setSseProgress(sseProgressFromHook);
    }
  }, [sseProgressFromHook]);

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

  const handleGeneratePlan = async () => {
    if (!activeProfileId) return;

    // Joint profiles use the SSE generation path for live progress streaming.
    // The remainder of the generation lifecycle (completion, error, recovery)
    // is handled by the useSSEGeneration callbacks above.
    if (activeProfile?.is_joint) {
      setGenerating(true);
      setSseProgress(null);
      startSSEGeneration();
      return;
    }

    // Non-joint profiles use the existing blocking API call (no SSE)
    setGenerating(true);
    try {
      const plan = await generateMealPlan(activeProfileId);
      setWeeklyPlan(plan);
      toast.success('Meal plan generated successfully!');
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setGenerating(false);
    }
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

  const handleRegenerateDay = async (dayIndex: number) => {
    if (!weeklyPlan) return;

    setRegeneratingDayIndex(dayIndex);
    try {
      const updatedDay = await regenerateDay(weeklyPlan.id, dayIndex);
      setWeeklyPlan((prev) => ({
        ...prev!,
        days: prev!.days.map((d, i) => i === dayIndex ? updatedDay : d)
      }));
      toast.success('Day regenerated successfully!');
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setRegeneratingDayIndex(null);
    }
  };

  const handleRegeneratePlan = async () => {
    if (!weeklyPlan) return;

    setRegeneratingWeek(true);
    try {
      const updatedPlan = await regeneratePlan(weeklyPlan.id);
      setWeeklyPlan(updatedPlan);
      toast.success('Entire week regenerated successfully!');
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setRegeneratingWeek(false);
    }
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

        {weeklyPlan && (
          <Button
            variant="secondary"
            onClick={handleRegeneratePlan}
            loading={regeneratingWeek}
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Regenerate Week
          </Button>
        )}
      </div>

      {/* Loading State - Generating Plan */}
      {generating && (
        <div className="flex flex-col items-center justify-center py-16">

          {/*
            Joint profile SSE path: show step-circle progress once SSE events arrive.
            Before the first event (sseProgress is null), show a "Connecting..." spinner
            so there is immediate feedback after the user clicks "Generate".
          */}
          {sseProgress && activeProfile?.is_joint ? (
            <>
              <h3 className="type-h4 text-[var(--text-primary)] mb-2">
                Generating Your Family Meal Plan
              </h3>
              <GenerationProgress progress={sseProgress} />
              <p className="text-center max-w-md text-sm text-[var(--text-muted)] mt-4">
                Personalizing portions for each household member. This typically takes 1-3 minutes.
              </p>
            </>
          ) : (
            /* Connecting state (before first SSE event) OR non-joint profile spinner */
            <>
              <Loader2 className="h-16 w-16 animate-spin mb-4 text-[var(--brand-green-light)]" />
              <h3 className="type-h4 text-[var(--text-primary)] mb-2">
                {activeProfile?.is_joint ? 'Connecting...' : 'Generating Your Meal Plan'}
              </h3>
              <p className="text-center max-w-md text-sm text-[var(--text-muted)]">
                {activeProfile?.is_joint
                  ? 'Starting family meal plan generation...'
                  : 'Our AI is crafting a personalized 7-day meal plan tailored to your goals. This typically takes 1-2 minutes...'
                }
              </p>
            </>
          )}

          {/* Cancel button — only shown for joint profile SSE generation */}
          {activeProfile?.is_joint && (
            <button
              type="button"
              onClick={() => {
                abortSSEGeneration();
                setGenerating(false);
                setSseProgress(null);
              }}
              className="mt-6 text-xs underline"
              style={{ color: 'var(--text-muted)' }}
            >
              Cancel
            </button>
          )}

        </div>
      )}

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
          regeneratingDayIndex={regeneratingDayIndex ?? undefined}
        />
      )}

    </div>
  );
}
