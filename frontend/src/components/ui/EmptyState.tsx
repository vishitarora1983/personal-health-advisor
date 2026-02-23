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
 * Empty state with FedRight dark design system.
 * Green-tinted icon container on dark background.
 * Primary CTA uses brand green button.
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
      {/* Icon container — green-subtle tint per the brand green palette */}
      <div
        className="p-6 mb-5 rounded-[var(--radius-2xl)]"
        style={{
          background: 'var(--brand-green-subtle)',
          border: '1px solid var(--brand-green-border)',
        }}
      >
        <Icon className="h-12 w-12" style={{ color: 'var(--brand-green-light)' }} />
      </div>
      <h3
        className="text-xl font-semibold mb-2"
        style={{ color: 'var(--text-primary)' }}
      >
        {title}
      </h3>
      <p className="mb-8 max-w-sm text-sm" style={{ color: 'var(--text-muted)' }}>
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
