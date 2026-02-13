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
 * Badge component with botanical luxe color palette.
 * Uses emerald for success, amber for warning/info, coral for error.
 */
export function Badge({ children, variant = 'neutral', className }: BadgeProps) {
  const variantStyles: Record<BadgeVariant, React.CSSProperties> = {
    success: {
      backgroundColor: 'rgba(45, 90, 63, 0.08)',
      color: 'var(--color-emerald)',
      borderColor: 'rgba(45, 90, 63, 0.15)',
    },
    warning: {
      backgroundColor: 'rgba(212, 148, 10, 0.08)',
      color: 'var(--color-amber)',
      borderColor: 'rgba(212, 148, 10, 0.15)',
    },
    error: {
      backgroundColor: 'rgba(212, 90, 58, 0.08)',
      color: 'var(--color-coral)',
      borderColor: 'rgba(212, 90, 58, 0.15)',
    },
    info: {
      backgroundColor: 'rgba(42, 138, 122, 0.08)',
      color: 'var(--color-teal-soft)',
      borderColor: 'rgba(42, 138, 122, 0.15)',
    },
    neutral: {
      backgroundColor: 'rgba(74, 63, 53, 0.06)',
      color: 'var(--color-clay-light)',
      borderColor: 'rgba(74, 63, 53, 0.10)',
    },
  };

  return (
    <span
      className={cn(
        'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border',
        className
      )}
      style={variantStyles[variant]}
    >
      {children}
    </span>
  );
}
