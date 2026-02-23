'use client';

import React from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { Card } from '@/components/ui/Card';
import { getDayName } from '@/lib/utils';
import { darkChartTheme, tooltipStyle, tooltipLabelStyle } from '@/lib/chartTheme';
import type { DailyStats } from '@/types';

interface CalorieChartProps {
  data: DailyStats[];
}

/**
 * Line chart showing planned vs actual calories over the week.
 */
export function CalorieChart({ data }: CalorieChartProps) {
  const chartData = data.map((day) => ({
    name: getDayName(day.date, 'short'),
    planned: Math.round(day.planned_calories),
    actual: Math.round(day.actual_calories),
  }));

  return (
    <Card>
      <Card.Header>
        <h3 className="type-h4 text-[var(--text-primary)]">
          Calories: Planned vs Actual
        </h3>
        <p className="text-[var(--text-secondary)] text-sm mt-0.5">Daily calorie comparison</p>
      </Card.Header>
      <Card.Body>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={chartData}>
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
            <Legend
              wrapperStyle={tooltipLabelStyle}
            />
            <Line
              type="monotone"
              dataKey="planned"
              stroke={darkChartTheme.hexColors.tertiary}
              strokeWidth={2}
              name="Planned"
              dot={{ fill: darkChartTheme.hexColors.tertiary, r: 4, strokeWidth: 0 }}
              activeDot={{ r: 6, fill: darkChartTheme.hexColors.tertiary }}
            />
            <Line
              type="monotone"
              dataKey="actual"
              stroke={darkChartTheme.hexColors.primary}
              strokeWidth={2}
              name="Actual"
              dot={{ fill: darkChartTheme.hexColors.primary, r: 4, strokeWidth: 0 }}
              activeDot={{ r: 6, fill: darkChartTheme.hexColors.primaryLight }}
            />
          </LineChart>
        </ResponsiveContainer>
      </Card.Body>
    </Card>
  );
}
