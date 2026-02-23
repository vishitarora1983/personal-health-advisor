'use client';

import React from 'react';
import { cn } from '@/lib/utils';

type BadgeVariant = 'success' | 'warning' | 'error' | 'info' | 'neutral';

interface BadgeProps {
  children: React.ReactNode;
  variant?: BadgeVariant;
  className?: string;
}

/**
 * Badge component with FedRight dark design system semantic palette.
 * Uses CSS custom property tokens — never hardcoded hex values.
 * All variants use pill shape (--radius-full) per the design spec.
 */
export function Badge({ children, variant = 'neutral', className }: BadgeProps) {
  const variantStyles: Record<BadgeVariant, React.CSSProperties> = {
    success: {
      backgroundColor: 'var(--color-success-bg)',
      color: 'var(--color-success)',
      borderColor: 'rgba(42, 175, 101, 0.20)',
    },
    warning: {
      backgroundColor: 'var(--color-warning-bg)',
      color: 'var(--color-warning)',
      borderColor: 'rgba(240, 168, 48, 0.20)',
    },
    error: {
      backgroundColor: 'var(--color-error-bg)',
      color: 'var(--color-error)',
      borderColor: 'rgba(229, 83, 75, 0.20)',
    },
    info: {
      backgroundColor: 'var(--color-info-bg)',
      color: 'var(--color-info)',
      borderColor: 'rgba(83, 155, 245, 0.20)',
    },
    neutral: {
      backgroundColor: 'var(--surface-glass)',
      color: 'var(--text-secondary)',
      borderColor: 'var(--surface-border)',
    },
  };

  return (
    <span
      className={cn(
        'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border',
        className
      )}
      style={variantStyles[variant]}
    >
      {children}
    </span>
  );
}
