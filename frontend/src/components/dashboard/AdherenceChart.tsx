'use client';

import React from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { Card } from '@/components/ui/Card';
import type { DashboardData } from '@/types';

interface AdherenceChartProps {
  adherence: DashboardData['adherence'];
}

/**
 * Pie chart showing meal adherence breakdown.
 */
export function AdherenceChart({ adherence }: AdherenceChartProps) {
  const data = [
    { name: 'Ate as Planned', value: adherence.ate_as_planned, color: '#10b981' },
    { name: 'Ate Something Else', value: adherence.ate_something_else, color: '#f59e0b' },
    { name: 'Skipped', value: adherence.skipped, color: '#ef4444' },
  ];

  return (
    <Card>
      <Card.Header>
        <h3 className="text-lg font-semibold text-gray-900">Meal Adherence</h3>
      </Card.Header>
      <Card.Body>
        <ResponsiveContainer width="100%" height={300}>
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              labelLine={false}
              label={({ name, percent }) =>
                `${name}: ${((percent || 0) * 100).toFixed(0)}%`
              }
              outerRadius={80}
              fill="#8884d8"
              dataKey="value"
            >
              {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} />
              ))}
            </Pie>
            <Tooltip />
          </PieChart>
        </ResponsiveContainer>
        <div className="mt-4 text-center">
          <p className="text-sm text-gray-600">
            {adherence.ate_as_planned} of {adherence.total_meals} meals (
            {Math.round(adherence.adherence_percentage)}%)
          </p>
        </div>
      </Card.Body>
    </Card>
  );
}
