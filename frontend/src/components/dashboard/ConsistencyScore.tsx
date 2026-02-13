'use client';

import React from 'react';
import { Card } from '@/components/ui/Card';
import { getScoreColor } from '@/lib/utils';

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

  const trendColors = {
    on_track: 'text-green-600',
    under: 'text-yellow-600',
    over: 'text-red-600',
  };

  return (
    <Card>
      <Card.Header>
        <h3 className="text-lg font-semibold text-gray-900">Consistency Score</h3>
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
                stroke="#e5e7eb"
                strokeWidth="12"
              />
              {/* Progress circle */}
              <circle
                cx="80"
                cy="80"
                r={radius}
                fill="none"
                stroke="#3b82f6"
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
                <div className={`text-3xl font-bold ${getScoreColor(score)}`}>
                  {Math.round(score)}%
                </div>
                <div className="text-sm text-gray-600">Consistent</div>
              </div>
            </div>
          </div>

          {/* Calorie Trend */}
          <div className="mt-6 text-center">
            <p className="text-sm text-gray-600 mb-1">Calorie Trend</p>
            <p className={`text-lg font-semibold ${trendColors[trendStatus]}`}>
              {trendLabels[trendStatus]}
            </p>
          </div>
        </div>
      </Card.Body>
    </Card>
  );
}
