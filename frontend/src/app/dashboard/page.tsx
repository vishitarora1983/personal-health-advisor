'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Download, BarChart3 } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/EmptyState';
import { useToast } from '@/components/ui/Toast';
import { Spinner } from '@/components/ui/LoadingSkeleton';
import { CalorieChart } from '@/components/dashboard/CalorieChart';
import { MacroBarChart } from '@/components/dashboard/MacroBarChart';
import { AdherenceChart } from '@/components/dashboard/AdherenceChart';
import { ConsistencyScore } from '@/components/dashboard/ConsistencyScore';
import { getCurrentMealPlan, getDashboard, exportExcel, downloadBlob } from '@/lib/api';
import { useProfile } from '@/lib/ProfileContext';
import { getErrorMessage, formatDate } from '@/lib/utils';
import type { DashboardData } from '@/types';

export default function DashboardPage() {
  const router = useRouter();
  const toast = useToast();
  const { activeProfileId, loading: profileLoading } = useProfile();

  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
  const [planId, setPlanId] = useState<number | null>(null);

  useEffect(() => {
    if (profileLoading) return;

    if (!activeProfileId) {
      setLoading(false);
      return;
    }

    async function loadDashboard() {
      try {
        const plan = await getCurrentMealPlan(activeProfileId!);
        setPlanId(plan.id);

        try {
          const data = await getDashboard(plan.id);
          setDashboardData(data);
        } catch (error: unknown) {
          if (error && typeof error === 'object' && 'response' in error) {
            const axiosError = error as { response?: { status?: number } };
            if (axiosError.response?.status === 404) {
              setDashboardData(null);
            } else {
              toast.error('Failed to load dashboard data');
            }
          } else {
            toast.error('Failed to load dashboard data');
          }
        }
      } catch (error: unknown) {
        if (error && typeof error === 'object' && 'response' in error) {
          const axiosError = error as { response?: { status?: number } };
          if (axiosError.response?.status === 404) {
            toast.info('Please generate a meal plan first');
          } else {
            toast.error('Failed to initialize dashboard');
          }
        } else {
          toast.error('Failed to initialize dashboard');
        }
      } finally {
        setLoading(false);
      }
    }

    setLoading(true);
    setDashboardData(null);
    setPlanId(null);
    loadDashboard();
  }, [activeProfileId, profileLoading, toast]);

  const handleExport = async () => {
    if (!planId) return;

    setExporting(true);
    try {
      const blob = await exportExcel(planId);
      const filename = `meal-plan-${formatDate(new Date().toISOString().split('T')[0], 'short')}.xlsx`;
      downloadBlob(blob, filename);
      toast.success('Meal plan exported successfully!');
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setExporting(false);
    }
  };

  if (profileLoading || loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Spinner size="lg" />
      </div>
    );
  }

  if (!planId || !dashboardData) {
    return (
      <div>
        <EmptyState
          icon={BarChart3}
          title="No Data Available"
          description="Start tracking your meals to see your progress and analytics"
          actionLabel="Go to Tracking"
          onAction={() => router.push('/tracking')}
        />
      </div>
    );
  }

  const getAdherenceBadge = () => {
    const { adherence_percentage } = dashboardData.adherence;
    if (adherence_percentage >= 80) return { variant: 'success' as const, label: 'Excellent' };
    if (adherence_percentage >= 60) return { variant: 'warning' as const, label: 'Good' };
    return { variant: 'error' as const, label: 'Needs Improvement' };
  };

  const adherenceBadge = getAdherenceBadge();

  return (
    <div>
      {/* Header */}
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-gray-600 mt-2">
            Track your progress and analyze your nutrition
          </p>
        </div>

        <div className="flex gap-3">
          <Badge variant={adherenceBadge.variant} className="px-4 py-2 text-sm">
            {adherenceBadge.label}
          </Badge>
          <Button
            variant="outline"
            onClick={handleExport}
            loading={exporting}
          >
            <Download className="h-4 w-4 mr-2" />
            Export to Excel
          </Button>
        </div>
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Calorie Chart */}
        <CalorieChart data={dashboardData.daily_stats} />

        {/* Macro Bar Chart */}
        <MacroBarChart
          planned={dashboardData.planned_macro_breakdown}
          actual={dashboardData.actual_macro_breakdown}
        />

        {/* Adherence Pie Chart */}
        <AdherenceChart adherence={dashboardData.adherence} />

        {/* Consistency Score */}
        <ConsistencyScore
          score={dashboardData.consistency_score}
          calorieTrend={dashboardData.calorie_trend}
        />
      </div>

      {/* Weekly Summary */}
      <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
          <h4 className="text-sm font-medium text-gray-700 mb-2">Total Meals</h4>
          <p className="text-3xl font-bold text-blue-600">
            {dashboardData.adherence.total_meals}
          </p>
        </div>

        <div className="bg-green-50 border border-green-200 rounded-lg p-6">
          <h4 className="text-sm font-medium text-gray-700 mb-2">Adherence Rate</h4>
          <p className="text-3xl font-bold text-green-600">
            {Math.round(dashboardData.adherence.adherence_percentage)}%
          </p>
        </div>

        <div className="bg-purple-50 border border-purple-200 rounded-lg p-6">
          <h4 className="text-sm font-medium text-gray-700 mb-2">Consistency</h4>
          <p className="text-3xl font-bold text-purple-600">
            {Math.round(dashboardData.consistency_score)}%
          </p>
        </div>
      </div>
    </div>
  );
}
