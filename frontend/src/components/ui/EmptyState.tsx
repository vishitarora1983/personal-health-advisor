'use client';

import React from 'react';
import { LucideIcon } from 'lucide-react';
import { Button } from './Button';

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
}

/**
 * Empty state with botanical luxe design.
 * Emerald-tinted icon container with warm amber CTA.
 */
export function EmptyState({
  icon: Icon,
  title,
  description,
  actionLabel,
  onAction,
}: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4 text-center animate-fade-in">
      <div
        className="p-6 mb-5 rounded-2xl"
        style={{
          background: 'linear-gradient(135deg, rgba(45, 90, 63, 0.06), rgba(127, 168, 138, 0.04))',
          border: '1px solid rgba(45, 90, 63, 0.08)',
        }}
      >
        <Icon className="h-12 w-12" style={{ color: 'var(--color-sage)' }} />
      </div>
      <h3
        className="text-xl font-semibold mb-2"
        style={{
          fontFamily: 'var(--font-display), serif',
          color: 'var(--color-emerald-deep)',
        }}
      >
        {title}
      </h3>
      <p className="mb-8 max-w-sm text-sm" style={{ color: 'var(--color-clay-muted)' }}>
        {description}
      </p>
      {actionLabel && onAction && (
        <Button onClick={onAction} variant="primary" size="lg">
          {actionLabel}
        </Button>
      )}
    </div>
  );
}
