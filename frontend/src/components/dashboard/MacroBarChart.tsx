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
        <h3 className="text-lg font-semibold text-gray-900">
          Macros: Planned vs Actual (%)
        </h3>
      </Card.Header>
      <Card.Body>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={chartData}>
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
            <Bar dataKey="planned" fill="#3b82f6" name="Planned" />
            <Bar dataKey="actual" fill="#10b981" name="Actual" />
          </BarChart>
        </ResponsiveContainer>
      </Card.Body>
    </Card>
  );
}
