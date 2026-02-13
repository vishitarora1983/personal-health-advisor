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
        <h3 className="text-lg font-semibold text-gray-900">
          Calories: Planned vs Actual
        </h3>
      </Card.Header>
      <Card.Body>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis dataKey="name" stroke="#6b7280" />
            <YAxis stroke="#6b7280" />
            <Tooltip
              contentStyle={{
                backgroundColor: '#fff',
                border: '1px solid #e5e7eb',
                borderRadius: '0.5rem',
              }}
            />
            <Legend />
            <Line
              type="monotone"
              dataKey="planned"
              stroke="#3b82f6"
              strokeWidth={2}
              name="Planned"
            />
            <Line
              type="monotone"
              dataKey="actual"
              stroke="#10b981"
              strokeWidth={2}
              name="Actual"
            />
          </LineChart>
        </ResponsiveContainer>
      </Card.Body>
    </Card>
  );
}
