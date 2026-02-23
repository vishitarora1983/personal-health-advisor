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
import { ROUTES } from '@/lib/routes';
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
          onAction={() => router.push(ROUTES.APP.TRACKING)}
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
          <h1 className="type-h3 text-[var(--text-primary)]">Dashboard</h1>
          <p className="text-[var(--text-secondary)] text-sm mt-2">
            Track your progress and analyze your nutrition
          </p>
        </div>

        <div className="flex gap-3 items-center">
          <Badge variant={adherenceBadge.variant} className="px-4 py-2 text-sm">
            {adherenceBadge.label}
          </Badge>
          <Button
            variant="secondary"
            onClick={handleExport}
            loading={exporting}
          >
            <Download className="h-4 w-4 mr-2" />
            Export to Excel
          </Button>
        </div>
      </div>

      {/* Weekly Summary Stats */}
      <div className="mb-6 grid grid-cols-1 md:grid-cols-3 gap-4">
        <div
          className="bg-[var(--bg-secondary)] border border-[var(--surface-border)] rounded-[var(--radius-lg)] p-5 border-t-2"
          style={{ borderTopColor: 'var(--color-info)', boxShadow: 'var(--shadow-md)' }}
        >
          <p className="type-overline text-[var(--text-muted)] mb-2">Total Meals</p>
          <p className="text-3xl font-bold text-[var(--text-primary)]">
            {dashboardData.adherence.total_meals}
          </p>
        </div>

        <div
          className="bg-[var(--bg-secondary)] border border-[var(--surface-border)] rounded-[var(--radius-lg)] p-5 border-t-2"
          style={{ borderTopColor: 'var(--brand-green)', boxShadow: 'var(--shadow-md)' }}
        >
          <p className="type-overline text-[var(--text-muted)] mb-2">Adherence Rate</p>
          <p className="text-3xl font-bold text-[var(--brand-green-light)]">
            {Math.round(dashboardData.adherence.adherence_percentage)}%
          </p>
        </div>

        <div
          className="bg-[var(--bg-secondary)] border border-[var(--surface-border)] rounded-[var(--radius-lg)] p-5 border-t-2"
          style={{ borderTopColor: 'var(--brand-amber)', boxShadow: 'var(--shadow-md)' }}
        >
          <p className="type-overline text-[var(--text-muted)] mb-2">Consistency</p>
          <p className="text-3xl font-bold text-[var(--brand-amber)]">
            {Math.round(dashboardData.consistency_score)}%
          </p>
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
    </div>
  );
}
