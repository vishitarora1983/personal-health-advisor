'use client';

import React from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';
import { Card } from '@/components/ui/Card';
import { darkChartTheme, tooltipStyle, tooltipLabelStyle } from '@/lib/chartTheme';
import type { DashboardData } from '@/types';

interface AdherenceChartProps {
  adherence: DashboardData['adherence'];
}

/**
 * Pie chart showing meal adherence breakdown.
 */
export function AdherenceChart({ adherence }: AdherenceChartProps) {
  const data = [
    { name: 'Ate as Planned', value: adherence.ate_as_planned, color: darkChartTheme.hexColors.primary },
    { name: 'Ate Something Else', value: adherence.ate_something_else, color: darkChartTheme.hexColors.secondary },
    { name: 'Skipped', value: adherence.skipped, color: darkChartTheme.hexColors.danger },
  ];

  return (
    <Card>
      <Card.Header>
        <h3 className="type-h4 text-[var(--text-primary)]">Meal Adherence</h3>
        <p className="text-[var(--text-secondary)] text-sm mt-0.5">How closely you followed the plan</p>
      </Card.Header>
      <Card.Body>
        <ResponsiveContainer width="100%" height={300}>
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              labelLine={false}
              label={({ name, percent, x, y, midAngle }) => {
                // Explicit fill is required for dark backgrounds — SVG text inherits nothing
                // from CSS; without it the label renders as black and is invisible.
                void midAngle; // referenced by Recharts internally
                return (
                  <text x={x} y={y} fill="#9BA3B0" textAnchor="middle" dominantBaseline="central" fontSize={11}>
                    {`${name}: ${((percent || 0) * 100).toFixed(0)}%`}
                  </text>
                );
              }}
              outerRadius={80}
              dataKey="value"
            >
              {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} />
              ))}
            </Pie>
            <Tooltip contentStyle={tooltipStyle} labelStyle={tooltipLabelStyle} />
            <Legend wrapperStyle={tooltipLabelStyle} />
          </PieChart>
        </ResponsiveContainer>
        <div className="mt-4 text-center">
          <p className="text-sm text-[var(--text-secondary)]">
            <span className="text-[var(--brand-green-light)] font-semibold">{adherence.ate_as_planned}</span>
            {' '}of{' '}
            <span className="text-[var(--text-primary)] font-semibold">{adherence.total_meals}</span>
            {' '}meals (
            <span className="text-[var(--brand-green-light)] font-semibold">{Math.round(adherence.adherence_percentage)}%</span>
            )
          </p>
        </div>
      </Card.Body>
    </Card>
  );
}
