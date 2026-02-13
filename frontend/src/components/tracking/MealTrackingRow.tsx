'use client';

import React, { useState } from 'react';
import { Sparkles } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import { formatMacros } from '@/lib/utils';
import { estimateNutrition } from '@/lib/api';
import type { TrackedMeal, TrackingStatus } from '@/types';

interface MealTrackingRowProps {
  meal: TrackedMeal;
  onSave: (data: {
    status: TrackingStatus;
    alt_description?: string;
    alt_calories?: number;
    alt_protein?: number;
    alt_carbs?: number;
    alt_fats?: number;
  }) => void;
  saving?: boolean;
}

/**
 * Row component for tracking a single meal.
 * Allows selection of ate/skipped/alternative with conditional inputs.
 * When "ate something else" is selected, AI estimates nutrition from description.
 */
export function MealTrackingRow({ meal, onSave, saving = false }: MealTrackingRowProps) {
  const [status, setStatus] = useState<TrackingStatus>(meal.status || 'ate_as_planned');
  const [altDescription, setAltDescription] = useState(meal.alt_description || '');
  const [altCalories, setAltCalories] = useState(meal.alt_calories?.toString() || '');
  const [altProtein, setAltProtein] = useState(meal.alt_protein?.toString() || '');
  const [altCarbs, setAltCarbs] = useState(meal.alt_carbs?.toString() || '');
  const [altFats, setAltFats] = useState(meal.alt_fats?.toString() || '');
  const [estimating, setEstimating] = useState(false);
  const [estimated, setEstimated] = useState(false);

  const handleEstimate = async () => {
    if (!altDescription.trim()) return;

    setEstimating(true);
    try {
      const result = await estimateNutrition(altDescription);
      setAltCalories(Math.round(result.calories).toString());
      setAltProtein(Math.round(result.protein).toString());
      setAltCarbs(Math.round(result.carbs).toString());
      setAltFats(Math.round(result.fats).toString());
      setEstimated(true);
    } catch {
      // Silently fail — user can still enter manually
    } finally {
      setEstimating(false);
    }
  };

  const handleSave = () => {
    const data: {
      status: TrackingStatus;
      alt_description?: string;
      alt_calories?: number;
      alt_protein?: number;
      alt_carbs?: number;
      alt_fats?: number;
    } = { status };

    if (status === 'ate_something_else') {
      data.alt_description = altDescription;
      data.alt_calories = Number(altCalories) || 0;
      data.alt_protein = Number(altProtein) || 0;
      data.alt_carbs = Number(altCarbs) || 0;
      data.alt_fats = Number(altFats) || 0;
    }

    onSave(data);
  };

  const hasChanges = meal.status !== null
    ? meal.status !== status ||
      (status === 'ate_something_else' &&
        (meal.alt_description !== altDescription ||
          meal.alt_calories?.toString() !== altCalories))
    : true;

  return (
    <Card padding="md">
      <div className="space-y-4">
        {/* Meal Info */}
        <div className="flex items-start justify-between">
          <div>
            <h3 className="font-semibold text-gray-900">{meal.dish_name}</h3>
            <div className="flex gap-2 mt-1">
              <Badge variant="info">{meal.meal_type}</Badge>
            </div>
            <p className="text-sm text-gray-600 mt-2">
              {Math.round(meal.planned_calories)} cal • {formatMacros(meal.planned_protein, meal.planned_carbs, meal.planned_fats)}
            </p>
          </div>
        </div>

        {/* Status Selection */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            What did you do?
          </label>
          <div className="space-y-2">
            <label className="flex items-center space-x-3 cursor-pointer">
              <input
                type="radio"
                name={`meal-${meal.meal_id}`}
                value="ate_as_planned"
                checked={status === 'ate_as_planned'}
                onChange={(e) => setStatus(e.target.value as TrackingStatus)}
                className="text-blue-600 focus:ring-blue-500"
              />
              <span className="text-sm text-gray-700">Ate as planned</span>
            </label>
            <label className="flex items-center space-x-3 cursor-pointer">
              <input
                type="radio"
                name={`meal-${meal.meal_id}`}
                value="skipped"
                checked={status === 'skipped'}
                onChange={(e) => setStatus(e.target.value as TrackingStatus)}
                className="text-blue-600 focus:ring-blue-500"
              />
              <span className="text-sm text-gray-700">Skipped this meal</span>
            </label>
            <label className="flex items-center space-x-3 cursor-pointer">
              <input
                type="radio"
                name={`meal-${meal.meal_id}`}
                value="ate_something_else"
                checked={status === 'ate_something_else'}
                onChange={(e) => setStatus(e.target.value as TrackingStatus)}
                className="text-blue-600 focus:ring-blue-500"
              />
              <span className="text-sm text-gray-700">Ate something else</span>
            </label>
          </div>
        </div>

        {/* Alternative Meal Inputs */}
        {status === 'ate_something_else' && (
          <div className="bg-gray-50 rounded-lg p-4 space-y-3">
            <h4 className="text-sm font-medium text-gray-900">What did you eat instead?</h4>
            <div className="flex gap-2">
              <div className="flex-1">
                <Input
                  placeholder="e.g., 2 slices of pizza and a coke"
                  value={altDescription}
                  onChange={(e) => {
                    setAltDescription(e.target.value);
                    setEstimated(false);
                  }}
                  fullWidth
                />
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={handleEstimate}
                loading={estimating}
                disabled={!altDescription.trim() || estimating}
                className="shrink-0"
              >
                <Sparkles className="h-4 w-4 mr-1" />
                Estimate
              </Button>
            </div>

            {/* Nutrition display — shown after estimation or if previously saved */}
            {(estimated || Number(altCalories) > 0) && (
              <div
                className="rounded-lg p-3 space-y-2"
                style={{
                  background: estimated ? 'rgba(45, 90, 63, 0.06)' : undefined,
                  border: estimated ? '1px solid rgba(45, 90, 63, 0.12)' : undefined,
                }}
              >
                {estimated && (
                  <p className="text-xs font-medium" style={{ color: 'var(--color-emerald)' }}>
                    AI Estimated — adjust if needed
                  </p>
                )}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <Input
                    label="Calories"
                    type="number"
                    placeholder="0"
                    value={altCalories}
                    onChange={(e) => setAltCalories(e.target.value)}
                    fullWidth
                  />
                  <Input
                    label="Protein (g)"
                    type="number"
                    placeholder="0"
                    value={altProtein}
                    onChange={(e) => setAltProtein(e.target.value)}
                    fullWidth
                  />
                  <Input
                    label="Carbs (g)"
                    type="number"
                    placeholder="0"
                    value={altCarbs}
                    onChange={(e) => setAltCarbs(e.target.value)}
                    fullWidth
                  />
                  <Input
                    label="Fats (g)"
                    type="number"
                    placeholder="0"
                    value={altFats}
                    onChange={(e) => setAltFats(e.target.value)}
                    fullWidth
                  />
                </div>
              </div>
            )}
          </div>
        )}

        {/* Save Button */}
        {hasChanges && (
          <div className="flex justify-end">
            <Button onClick={handleSave} loading={saving} variant="primary" size="sm">
              Save Tracking
            </Button>
          </div>
        )}
      </div>
    </Card>
  );
}
