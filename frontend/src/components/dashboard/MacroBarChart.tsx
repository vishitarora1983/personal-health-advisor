'use client';

import React from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { Card } from '@/components/ui/Card';
import { darkChartTheme, tooltipStyle, tooltipLabelStyle } from '@/lib/chartTheme';
import type { MacroBreakdown } from '@/types';

interface MacroBarChartProps {
  planned: MacroBreakdown;
  actual: MacroBreakdown;
}

/**
 * Bar chart comparing planned vs actual macro nutrients.
 * IMPORTANT: MacroBreakdown uses protein_pct, carbs_pct, fats_pct (percentages).
 */
export function MacroBarChart({ planned, actual }: MacroBarChartProps) {
  const chartData = [
    {
      name: 'Protein',
      planned: Math.round(planned.protein_pct),
      actual: Math.round(actual.protein_pct),
    },
    {
      name: 'Carbs',
      planned: Math.round(planned.carbs_pct),
      actual: Math.round(actual.carbs_pct),
    },
    {
      name: 'Fats',
      planned: Math.round(planned.fats_pct),
      actual: Math.round(actual.fats_pct),
    },
  ];

  return (
    <Card>
      <Card.Header>
        <h3 className="type-h4 text-[var(--text-primary)]">
          Macros: Planned vs Actual (%)
        </h3>
        <p className="text-[var(--text-secondary)] text-sm mt-0.5">Macro nutrient breakdown</p>
      </Card.Header>
      <Card.Body>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={chartData}>
            <CartesianGrid {...darkChartTheme.cartesianGrid} />
            <XAxis
              dataKey="name"
              tick={darkChartTheme.axis.tick}
              axisLine={darkChartTheme.axis.axisLine}
              tickLine={darkChartTheme.axis.tickLine}
            />
            <YAxis
              tick={darkChartTheme.axis.tick}
              axisLine={darkChartTheme.axis.axisLine}
              tickLine={darkChartTheme.axis.tickLine}
            />
            <Tooltip
              contentStyle={tooltipStyle}
              labelStyle={tooltipLabelStyle}
            />
            <Legend wrapperStyle={tooltipLabelStyle} />
            <Bar
              dataKey="planned"
              fill={darkChartTheme.hexColors.tertiary}
              name="Planned"
              radius={[4, 4, 0, 0]}
            />
            <Bar
              dataKey="actual"
              fill={darkChartTheme.hexColors.primary}
              name="Actual"
              radius={[4, 4, 0, 0]}
            />
          </BarChart>
        </ResponsiveContainer>
      </Card.Body>
    </Card>
  );
}
