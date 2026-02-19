'use client';

import React, { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import { ChefHat } from 'lucide-react';
import { useProfile } from '@/lib/ProfileContext';
import { useToast } from '@/components/ui/Toast';
import { Spinner } from '@/components/ui/LoadingSkeleton';
import { EmptyState } from '@/components/ui/EmptyState';
import { getCurrentMealPlan } from '@/lib/api';
import { getErrorMessage } from '@/lib/utils';
import { ProfileSelector } from '@/components/chefs-view/ProfileSelector';
import { MealTypeFilter } from '@/components/chefs-view/MealTypeFilter';
import { ChefsGrid } from '@/components/chefs-view/ChefsGrid';
import { RecipeModal } from '@/components/chefs-view/RecipeModal';
import {
  aggregateMealPlans,
  getDayHeaders,
  type PlansByProfile,
  type AggregatedDish,
  type MealType,
} from '@/lib/chefs-view-utils';

const STORAGE_KEY_PROFILES = 'chefsView_selectedProfiles';
const STORAGE_KEY_MEALS = 'chefsView_selectedMealTypes';
const DEFAULT_MEAL_TYPES: MealType[] = ['breakfast', 'lunch', 'dinner'];

function loadStoredIds(): Set<number> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_PROFILES);
    if (raw) {
      const arr = JSON.parse(raw);
      if (Array.isArray(arr)) return new Set(arr.filter((n: unknown) => typeof n === 'number'));
    }
  } catch { /* ignore */ }
  return new Set();
}

function loadStoredMealTypes(): Set<MealType> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_MEALS);
    if (raw) {
      const arr = JSON.parse(raw);
      if (Array.isArray(arr) && arr.length > 0) return new Set(arr as MealType[]);
    }
  } catch { /* ignore */ }
  return new Set(DEFAULT_MEAL_TYPES);
}

export default function ChefsViewPage() {
  const toast = useToast();
  const { profiles, loading: profileLoading } = useProfile();

  const [selectedIds, setSelectedIds] = useState<Set<number>>(loadStoredIds);
  const [plansByProfile, setPlansByProfile] = useState<PlansByProfile[]>([]);
  const [profilesWithNoPlan, setProfilesWithNoPlan] = useState<Set<number>>(new Set());
  const [loading, setLoading] = useState(false);
  const [recipeDish, setRecipeDish] = useState<AggregatedDish | null>(null);
  const [selectedMealTypes, setSelectedMealTypes] = useState<Set<MealType>>(loadStoredMealTypes);

  // Persist selections to localStorage
  const handleProfileSelectionChange = useCallback((ids: Set<number>) => {
    setSelectedIds(ids);
    localStorage.setItem(STORAGE_KEY_PROFILES, JSON.stringify([...ids]));
  }, []);

  const handleMealTypeSelectionChange = useCallback((types: Set<MealType>) => {
    setSelectedMealTypes(types);
    localStorage.setItem(STORAGE_KEY_MEALS, JSON.stringify([...types]));
  }, []);

  // On mount, prune stored profile IDs that no longer exist
  useEffect(() => {
    if (profileLoading || profiles.length === 0) return;
    const validIds = new Set(profiles.map((p) => p.id));
    setSelectedIds((prev) => {
      const pruned = new Set([...prev].filter((id) => validIds.has(id)));
      if (pruned.size !== prev.size) {
        localStorage.setItem(STORAGE_KEY_PROFILES, JSON.stringify([...pruned]));
      }
      return pruned;
    });
  }, [profileLoading, profiles]);

  // Track which profiles we've already fetched to avoid re-fetching on selection change
  const fetchedPlans = useRef<Map<number, PlansByProfile | null>>(new Map());

  // Fetch plans for selected profiles (only newly added ones)
  const fetchPlans = useCallback(
    async (ids: Set<number>) => {
      const idsToFetch = Array.from(ids).filter((id) => !fetchedPlans.current.has(id));

      if (idsToFetch.length === 0) {
        // All already fetched — just update plansByProfile from cache
        const cached: PlansByProfile[] = [];
        for (const id of ids) {
          const entry = fetchedPlans.current.get(id);
          if (entry) cached.push(entry);
        }
        setPlansByProfile(cached);
        return;
      }

      setLoading(true);
      const newNoPlan = new Set(profilesWithNoPlan);

      try {
        const results = await Promise.allSettled(
          idsToFetch.map(async (profileId) => {
            const profile = profiles.find((p) => p.id === profileId);
            if (!profile) return null;

            try {
              const plan = await getCurrentMealPlan(profileId);
              const entry: PlansByProfile = {
                profileId,
                profileName: profile.name,
                plan,
              };
              fetchedPlans.current.set(profileId, entry);
              newNoPlan.delete(profileId);
              return entry;
            } catch (error: unknown) {
              // 404 = no plan for this profile
              if (
                error &&
                typeof error === 'object' &&
                'response' in error &&
                (error as { response?: { status?: number } }).response?.status === 404
              ) {
                fetchedPlans.current.set(profileId, null);
                newNoPlan.add(profileId);
                toast.info(`${profile.name} has no active meal plan`);
                return null;
              }
              throw error;
            }
          })
        );

        // Collect successful results
        const freshEntries: PlansByProfile[] = [];
        for (const r of results) {
          if (r.status === 'fulfilled' && r.value) {
            freshEntries.push(r.value);
          } else if (r.status === 'rejected') {
            toast.error(getErrorMessage(r.reason));
          }
        }

        // Combine with previously cached entries for current selection
        const allEntries: PlansByProfile[] = [];
        for (const id of ids) {
          const entry = fetchedPlans.current.get(id);
          if (entry) allEntries.push(entry);
        }

        setPlansByProfile(allEntries);
        setProfilesWithNoPlan(newNoPlan);
      } finally {
        setLoading(false);
      }
    },
    [profiles, profilesWithNoPlan, toast]
  );

  // Trigger fetch when selection changes
  useEffect(() => {
    if (selectedIds.size > 0) {
      fetchPlans(selectedIds);
    } else {
      setPlansByProfile([]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedIds]);

  // Aggregate grid data
  const grid = useMemo(
    () => aggregateMealPlans(plansByProfile),
    [plansByProfile]
  );

  const dayHeaders = useMemo(
    () => getDayHeaders(plansByProfile),
    [plansByProfile]
  );

  const hasAnyDishes = useMemo(
    () =>
      Object.values(grid).some((cells) =>
        cells.some((cell) => cell.dishes.length > 0)
      ),
    [grid]
  );

  if (profileLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Spinner size="lg" />
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-2">
          <div
            className="flex items-center justify-center w-10 h-10 rounded-xl"
            style={{
              background: 'linear-gradient(135deg, var(--color-amber), var(--color-amber-warm))',
              boxShadow: '0 0 16px rgba(212, 148, 10, 0.2)',
            }}
          >
            <ChefHat className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="text-3xl font-bold" style={{ color: 'var(--color-emerald-deep)' }}>
              Chef&apos;s View
            </h1>
            <p className="text-sm mt-0.5" style={{ color: 'var(--color-clay-light)' }}>
              All meals across profiles in one cooking overview
            </p>
          </div>
        </div>
      </div>

      {/* Profile Selector + Meal Type Filter */}
      <div className="mb-6 space-y-3">
        <ProfileSelector
          profiles={profiles}
          selectedIds={selectedIds}
          onSelectionChange={handleProfileSelectionChange}
          loading={loading}
          profilesWithNoPlan={profilesWithNoPlan}
        />
        <MealTypeFilter
          selectedTypes={selectedMealTypes}
          onSelectionChange={handleMealTypeSelectionChange}
        />
      </div>

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center py-16">
          <Spinner size="lg" />
        </div>
      )}

      {/* Empty state */}
      {!loading && selectedIds.size > 0 && !hasAnyDishes && (
        <EmptyState
          icon={ChefHat}
          title="No Meals to Show"
          description="The selected profiles don't have active meal plans. Generate meal plans from the Meal Plan page first."
        />
      )}

      {/* No profiles selected */}
      {!loading && selectedIds.size === 0 && profiles.length > 0 && (
        <EmptyState
          icon={ChefHat}
          title="Select Profiles"
          description="Choose one or more profiles above to see their meals combined in the cooking grid."
        />
      )}

      {/* No profiles at all */}
      {!loading && profiles.length === 0 && (
        <EmptyState
          icon={ChefHat}
          title="No Profiles Found"
          description="Create profiles to use the Chef's View."
        />
      )}

      {/* Grid */}
      {!loading && hasAnyDishes && (
        <ChefsGrid
          grid={grid}
          dayHeaders={dayHeaders}
          onDishClick={setRecipeDish}
          visibleMealTypes={selectedMealTypes}
        />
      )}

      {/* Recipe Modal */}
      <RecipeModal
        isOpen={!!recipeDish}
        onClose={() => setRecipeDish(null)}
        dish={recipeDish}
      />
    </div>
  );
}
