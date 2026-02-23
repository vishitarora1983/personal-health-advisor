'use client';

import React from 'react';
import { Card } from '@/components/ui/Card';
import { darkChartTheme } from '@/lib/chartTheme';

interface ConsistencyScoreProps {
  score: number;
  calorieTrend: number[];
}

/**
 * Circular progress indicator for consistency score.
 * IMPORTANT: calorieTrend is now a number[] from backend, not a string enum.
 * We calculate average trend to determine status.
 */
export function ConsistencyScore({ score, calorieTrend }: ConsistencyScoreProps) {
  const radius = 70;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (score / 100) * circumference;

  // Calculate average calorie trend from the array
  const avgTrend = calorieTrend.length > 0
    ? calorieTrend.reduce((sum, val) => sum + val, 0) / calorieTrend.length
    : 0;

  // Determine trend status based on average (-10% to +10% is "on track")
  const getTrendStatus = (): 'on_track' | 'under' | 'over' => {
    if (avgTrend < -10) return 'under';
    if (avgTrend > 10) return 'over';
    return 'on_track';
  };

  const trendStatus = getTrendStatus();

  const trendLabels = {
    on_track: 'On Track',
    under: 'Under Target',
    over: 'Over Target',
  };

  // Use design token colors for trend status
  const trendHexColors = {
    on_track: darkChartTheme.hexColors.primary,
    under: darkChartTheme.hexColors.secondary,
    over: darkChartTheme.hexColors.danger,
  };

  const trendTextColors = {
    on_track: 'text-[var(--color-success)]',
    under: 'text-[var(--color-warning)]',
    over: 'text-[var(--color-error)]',
  };

  // Score ring color: green if >=70, amber if >=40, red if below
  const scoreColor = score >= 70
    ? darkChartTheme.hexColors.primary
    : score >= 40
      ? darkChartTheme.hexColors.secondary
      : darkChartTheme.hexColors.danger;

  return (
    <Card>
      <Card.Header>
        <h3 className="type-h4 text-[var(--text-primary)]">Consistency Score</h3>
        <p className="text-[var(--text-secondary)] text-sm mt-0.5">Overall plan adherence metric</p>
      </Card.Header>
      <Card.Body>
        <div className="flex flex-col items-center">
          {/* Circular Progress */}
          <div className="relative">
            <svg width="160" height="160">
              {/* Background circle */}
              <circle
                cx="80"
                cy="80"
                r={radius}
                fill="none"
                stroke="rgba(255, 255, 255, 0.06)"
                strokeWidth="12"
              />
              {/* Progress circle */}
              <circle
                cx="80"
                cy="80"
                r={radius}
                fill="none"
                stroke={scoreColor}
                strokeWidth="12"
                strokeLinecap="round"
                strokeDasharray={circumference}
                strokeDashoffset={strokeDashoffset}
                transform="rotate(-90 80 80)"
                style={{ transition: 'stroke-dashoffset 0.5s ease' }}
              />
            </svg>
            {/* Score Text */}
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="text-center">
                <div className="text-3xl font-bold text-[var(--text-primary)]">
                  {Math.round(score)}%
                </div>
                <div className="type-overline text-[var(--text-muted)] mt-0.5">Consistent</div>
              </div>
            </div>
          </div>

          {/* Calorie Trend */}
          <div className="mt-6 text-center">
            <p className="text-sm text-[var(--text-muted)] mb-1">Calorie Trend</p>
            <p className={`text-lg font-semibold ${trendTextColors[trendStatus]}`}>
              {trendLabels[trendStatus]}
            </p>
            {/* Trend color indicator dot */}
            <div className="flex items-center justify-center gap-2 mt-2">
              <div
                className="w-2 h-2 rounded-full"
                style={{ backgroundColor: trendHexColors[trendStatus] }}
              />
              <span className="text-xs text-[var(--text-muted)]">
                {avgTrend > 0 ? '+' : ''}{Math.round(avgTrend)}% avg deviation
              </span>
            </div>
          </div>
        </div>
      </Card.Body>
    </Card>
  );
}
