'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ShoppingCart, RefreshCw, Download } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { useToast } from '@/components/ui/Toast';
import { Spinner } from '@/components/ui/LoadingSkeleton';
import { GroceryCategory } from '@/components/grocery/GroceryCategory';
import {
  getCurrentMealPlan,
  getGroceryList,
  generateGroceryList,
  toggleGroceryItem,
  exportGroceryExcel,
  downloadBlob,
} from '@/lib/api';
import { useProfile } from '@/lib/ProfileContext';
import { calculatePercentage, getErrorMessage } from '@/lib/utils';
import { ROUTES } from '@/lib/routes';
import type { GroceryList, GroceryItem } from '@/types';

export default function GroceryPage() {
  const router = useRouter();
  const toast = useToast();
  const { activeProfileId, loading: profileLoading } = useProfile();

  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [groceryList, setGroceryList] = useState<GroceryList | null>(null);
  const [planId, setPlanId] = useState<number | null>(null);

  useEffect(() => {
    if (profileLoading) return;

    if (!activeProfileId) {
      setLoading(false);
      return;
    }

    async function initialize() {
      try {
        const plan = await getCurrentMealPlan(activeProfileId!);
        setPlanId(plan.id);

        try {
          const list = await getGroceryList(plan.id);
          setGroceryList(list);
        } catch (error: unknown) {
          if (error && typeof error === 'object' && 'response' in error) {
            const axiosError = error as { response?: { status?: number } };
            if (axiosError.response?.status !== 404) {
              toast.error('Failed to load grocery list');
            }
          }
        }
      } catch (error: unknown) {
        if (error && typeof error === 'object' && 'response' in error) {
          const axiosError = error as { response?: { status?: number } };
          if (axiosError.response?.status === 404) {
            toast.info('Please generate a meal plan first');
          } else {
            toast.error('Failed to initialize');
          }
        } else {
          toast.error('Failed to initialize');
        }
      } finally {
        setLoading(false);
      }
    }

    setLoading(true);
    setGroceryList(null);
    setPlanId(null);
    initialize();
  }, [activeProfileId, profileLoading, toast]);

  const handleGenerateList = async () => {
    if (!planId) return;

    setGenerating(true);
    try {
      const list = await generateGroceryList(planId);
      setGroceryList(list);
      toast.success('Grocery list generated successfully!');
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setGenerating(false);
    }
  };

  const handleDownloadExcel = async () => {
    if (!planId) return;

    setDownloading(true);
    try {
      const blob = await exportGroceryExcel(planId);
      downloadBlob(blob, `grocery_list.xlsx`);
      toast.success('Grocery list downloaded!');
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setDownloading(false);
    }
  };

  const handleToggleItem = async (itemId: number, checked: boolean) => {
    try {
      await toggleGroceryItem(itemId, checked);

      setGroceryList((prev) => {
        if (!prev) return prev;

        const updatedItems: Record<string, GroceryItem[]> = {};
        for (const [category, items] of Object.entries(prev.items)) {
          updatedItems[category] = items.map((item) =>
            item.id === itemId ? { ...item, checked } : item
          );
        }

        const totalChecked = Object.values(updatedItems).reduce(
          (sum, items) => sum + items.filter((item) => item.checked).length,
          0
        );

        return {
          ...prev,
          items: updatedItems,
          checked_count: totalChecked,
        };
      });
    } catch (error) {
      toast.error(getErrorMessage(error));
    }
  };

  if (profileLoading || loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Spinner size="lg" />
      </div>
    );
  }

  if (!planId) {
    return (
      <div>
        <EmptyState
          icon={ShoppingCart}
          title="No Meal Plan Found"
          description="You need to generate a meal plan before creating a grocery list"
          actionLabel="Go to Meal Plan"
          onAction={() => router.push(ROUTES.APP.MEAL_PLAN)}
        />
      </div>
    );
  }

  const progress = groceryList
    ? calculatePercentage(groceryList.checked_count, groceryList.total_items)
    : 0;

  return (
    <div className="max-w-4xl mx-auto">
      {/* Header */}
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="type-h3 text-[var(--text-primary)]">Grocery List</h1>
          <p className="text-[var(--text-secondary)] text-sm mt-2">
            All ingredients you need for the week
          </p>
        </div>

        <div className="flex gap-2">
          {groceryList && (
            <Button
              variant="secondary"
              onClick={handleDownloadExcel}
              loading={downloading}
            >
              <Download className="h-4 w-4 mr-2" />
              Excel
            </Button>
          )}
          <Button
            variant="secondary"
            onClick={handleGenerateList}
            loading={generating}
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            {groceryList ? 'Regenerate' : 'Generate'} List
          </Button>
        </div>
      </div>

      {/* Empty State */}
      {!groceryList && !generating && (
        <EmptyState
          icon={ShoppingCart}
          title="No Grocery List Yet"
          description="Generate a grocery list from your meal plan to see all ingredients"
          actionLabel="Generate Grocery List"
          onAction={handleGenerateList}
        />
      )}

      {/* Generating State */}
      {generating && (
        <div className="flex flex-col items-center justify-center py-16">
          <Spinner size="lg" />
          <p className="text-[var(--text-secondary)] mt-4 text-sm">Generating your grocery list...</p>
        </div>
      )}

      {/* Grocery List */}
      {groceryList && !generating && (
        <>
          {/* Progress */}
          <div
            className="bg-[var(--bg-secondary)] border border-[var(--surface-border)] rounded-[var(--radius-lg)] p-5 mb-6"
            style={{ boxShadow: 'var(--shadow-md)' }}
          >
            <div className="flex items-center justify-between mb-3">
              <p className="type-overline text-[var(--brand-green)]">Shopping Progress</p>
              <span className="text-xs text-[var(--text-muted)]">
                {groceryList.checked_count} of {groceryList.total_items} items
              </span>
            </div>
            <div className="w-full bg-[var(--bg-tertiary)] rounded-full h-2">
              <div
                className="h-2 rounded-full transition-all duration-300"
                style={{ width: `${progress}%`, background: 'var(--brand-green)' }}
              />
            </div>
            <p className="text-xs text-[var(--text-muted)] mt-2">{progress}% complete</p>
          </div>

          {/* Categories */}
          <div className="space-y-4">
            {Object.entries(groceryList.items).map(([category, items]) => (
              <GroceryCategory
                key={category}
                category={category}
                items={items}
                onToggleItem={handleToggleItem}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
