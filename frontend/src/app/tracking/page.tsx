'use client';

import React, { useEffect, useState } from 'react';
import { Calendar, ChevronLeft, ChevronRight } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { useToast } from '@/components/ui/Toast';
import { Spinner } from '@/components/ui/LoadingSkeleton';
import { MealTrackingRow } from '@/components/tracking/MealTrackingRow';
import { getDailyTracking, trackMeal, updateTracking, getCurrentMealPlan } from '@/lib/api';
import { useProfile } from '@/lib/ProfileContext';
import { getTodayDate, addDays, formatDate, getErrorMessage } from '@/lib/utils';
import type { DailyTracking, TrackingUpdateRequest } from '@/types';

export default function TrackingPage() {
  const toast = useToast();
  const { activeProfileId, loading: profileLoading } = useProfile();

  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState(getTodayDate());
  const [dateInitialized, setDateInitialized] = useState(false);
  const [dailyTracking, setDailyTracking] = useState<DailyTracking | null>(null);
  const [savingMealId, setSavingMealId] = useState<number | null>(null);

  // On profile change, default to plan's start date if today is before it
  useEffect(() => {
    if (profileLoading || !activeProfileId) return;

    async function initDate() {
      try {
        const plan = await getCurrentMealPlan(activeProfileId!);
        const today = getTodayDate();
        if (plan.week_start_date > today) {
          setSelectedDate(plan.week_start_date);
        } else {
          setSelectedDate(today);
        }
      } catch {
        setSelectedDate(getTodayDate());
      } finally {
        setDateInitialized(true);
      }
    }

    setDateInitialized(false);
    initDate();
  }, [activeProfileId, profileLoading]);

  useEffect(() => {
    if (profileLoading || !dateInitialized) return;

    async function loadTracking() {
      setLoading(true);
      try {
        const data = await getDailyTracking(selectedDate, activeProfileId ?? undefined);
        setDailyTracking(data);
      } catch (error: unknown) {
        if (error && typeof error === 'object' && 'response' in error) {
          const axiosError = error as { response?: { status?: number } };
          if (axiosError.response?.status === 404) {
            setDailyTracking(null);
          } else {
            toast.error(getErrorMessage(error));
          }
        } else {
          toast.error(getErrorMessage(error));
        }
      } finally {
        setLoading(false);
      }
    }

    loadTracking();
  }, [selectedDate, activeProfileId, profileLoading, dateInitialized, toast]);

  const handleSaveTracking = async (mealId: number, data: TrackingUpdateRequest) => {
    setSavingMealId(mealId);
    try {
      const existingMeal = dailyTracking?.meals.find((m) => m.meal_id === mealId);
      const hasTracking = existingMeal?.status !== null;

      if (hasTracking) {
        await updateTracking(mealId, data);
      } else {
        await trackMeal(mealId, data);
      }

      toast.success('Tracking saved successfully!');

      const updatedData = await getDailyTracking(selectedDate, activeProfileId ?? undefined);
      setDailyTracking(updatedData);
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setSavingMealId(null);
    }
  };

  const handlePreviousDay = () => {
    setSelectedDate(addDays(selectedDate, -1));
  };

  const handleNextDay = () => {
    setSelectedDate(addDays(selectedDate, 1));
  };

  const handleToday = () => {
    setSelectedDate(getTodayDate());
  };

  return (
    <div className="max-w-4xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Meal Tracking</h1>
        <p className="text-gray-600 mt-2">
          Track what you actually ate to monitor your progress
        </p>
      </div>

      {/* Date Selector */}
      <Card padding="md" className="mb-6">
        <div className="flex items-center justify-between">
          <Button variant="outline" size="sm" onClick={handlePreviousDay}>
            <ChevronLeft className="h-4 w-4" />
          </Button>

          <div className="flex items-center gap-3">
            <Calendar className="h-5 w-5 text-gray-400" />
            <span className="text-lg font-semibold text-gray-900">
              {formatDate(selectedDate, 'full')}
            </span>
          </div>

          <Button variant="outline" size="sm" onClick={handleNextDay}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>

        {selectedDate !== getTodayDate() && (
          <div className="mt-3 text-center">
            <Button variant="ghost" size="sm" onClick={handleToday}>
              Go to Today
            </Button>
          </div>
        )}
      </Card>

      {/* Loading State */}
      {loading && (
        <div className="flex justify-center py-12">
          <Spinner size="lg" />
        </div>
      )}

      {/* No Meals */}
      {!loading && !dailyTracking && (
        <Card padding="lg">
          <div className="text-center py-8">
            <Calendar className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              No Meals Planned
            </h3>
            <p className="text-gray-600">
              There are no meals planned for this date
            </p>
          </div>
        </Card>
      )}

      {/* Meals List */}
      {!loading && dailyTracking && (
        <>
          <div className="space-y-4 mb-6">
            {dailyTracking.meals.map((mealData) => (
              <MealTrackingRow
                key={mealData.meal_id}
                meal={mealData}
                onSave={(data) => handleSaveTracking(mealData.meal_id, data)}
                saving={savingMealId === mealData.meal_id}
              />
            ))}
          </div>

          {/* Daily Summary */}
          <Card padding="md" className="bg-blue-50 border-blue-200">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Daily Summary</h3>
            <div className="grid grid-cols-2 gap-6">
              <div>
                <h4 className="text-sm font-medium text-gray-700 mb-2">Planned</h4>
                <div className="space-y-1 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Calories:</span>
                    <span className="font-semibold">
                      {Math.round(dailyTracking.planned_totals.calories)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Protein:</span>
                    <span className="font-semibold">
                      {Math.round(dailyTracking.planned_totals.protein)}g
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Carbs:</span>
                    <span className="font-semibold">
                      {Math.round(dailyTracking.planned_totals.carbs)}g
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Fats:</span>
                    <span className="font-semibold">
                      {Math.round(dailyTracking.planned_totals.fats)}g
                    </span>
                  </div>
                </div>
              </div>

              <div>
                <h4 className="text-sm font-medium text-gray-700 mb-2">Actual</h4>
                <div className="space-y-1 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Calories:</span>
                    <span className="font-semibold">
                      {Math.round(dailyTracking.actual_totals.calories)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Protein:</span>
                    <span className="font-semibold">
                      {Math.round(dailyTracking.actual_totals.protein)}g
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Carbs:</span>
                    <span className="font-semibold">
                      {Math.round(dailyTracking.actual_totals.carbs)}g
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Fats:</span>
                    <span className="font-semibold">
                      {Math.round(dailyTracking.actual_totals.fats)}g
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </Card>
        </>
      )}
    </div>
  );
}
