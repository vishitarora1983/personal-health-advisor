'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { UtensilsCrossed, RefreshCw, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { useToast } from '@/components/ui/Toast';
import { Spinner } from '@/components/ui/LoadingSkeleton';
import { WeekView } from '@/components/meal-plan/WeekView';
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
import type { WeeklyPlan, Meal, NutritionTargets, MemberNutritionTargets, KidProfile } from '@/types';

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

  useEffect(() => {
    if (profileLoading) return;

    if (!activeProfileId) {
      toast.info('Please create or select a profile first');
      router.push('/profile');
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
          <h1 className="text-3xl font-bold text-gray-900">Weekly Meal Plan</h1>
          <p className="text-gray-600 mt-2">
            Your personalized meal plan for the week
          </p>
        </div>

        {weeklyPlan && (
          <Button
            variant="outline"
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
          <Loader2 className="h-16 w-16 animate-spin mb-4" style={{ color: 'var(--color-emerald)' }} />
          <h3 className="text-xl font-semibold mb-2">
            Generating Your Meal Plan
          </h3>
          <p className="text-center max-w-md" style={{ color: 'var(--color-clay-muted)' }}>
            Our AI is crafting a personalized 7-day meal plan tailored to your goals. This typically takes 1-2 minutes...
          </p>
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
