'use client';

import React from 'react';
import { cn } from '@/lib/utils';

interface LoadingSkeletonProps {
  rows?: number;
  height?: 'sm' | 'md' | 'lg';
  className?: string;
}

/**
 * Loading skeleton with botanical shimmer effect.
 * Uses sage-tinted gradients that sweep across the surface.
 */
export function LoadingSkeleton({ rows = 1, height = 'md', className }: LoadingSkeletonProps) {
  const heightStyles = {
    sm: 'h-4',
    md: 'h-6',
    lg: 'h-8',
  };

  return (
    <div className={cn('space-y-3', className)}>
      {Array.from({ length: rows }).map((_, index) => (
        <div
          key={index}
          className={cn(
            'rounded-lg animate-shimmer',
            heightStyles[height],
            index === rows - 1 && rows > 1 ? 'w-3/4' : 'w-full'
          )}
          style={{
            background: 'linear-gradient(90deg, var(--color-sage-mist) 25%, var(--color-cream-warm) 50%, var(--color-sage-mist) 75%)',
            backgroundSize: '200% 100%',
          }}
        />
      ))}
    </div>
  );
}

/**
 * Card skeleton for loading card-based layouts.
 */
export function CardSkeleton() {
  return (
    <div
      className="rounded-2xl p-6"
      style={{
        background: 'var(--surface-primary)',
        border: '1px solid var(--surface-glass-border)',
        boxShadow: 'var(--shadow-sm)',
      }}
    >
      <div
        className="h-6 rounded-lg w-1/3 mb-4 animate-shimmer"
        style={{
          background: 'linear-gradient(90deg, var(--color-sage-mist) 25%, var(--color-cream-warm) 50%, var(--color-sage-mist) 75%)',
          backgroundSize: '200% 100%',
        }}
      />
      <div className="space-y-3">
        {[1, 0.83, 0.67].map((width, i) => (
          <div
            key={i}
            className="h-4 rounded-lg animate-shimmer"
            style={{
              width: `${width * 100}%`,
              background: 'linear-gradient(90deg, var(--color-sage-mist) 25%, var(--color-cream-warm) 50%, var(--color-sage-mist) 75%)',
              backgroundSize: '200% 100%',
              animationDelay: `${i * 0.1}s`,
            }}
          />
        ))}
      </div>
    </div>
  );
}

/**
 * Spinner with emerald/amber gradient ring.
 */
export function Spinner({ size = 'md', className }: { size?: 'sm' | 'md' | 'lg'; className?: string }) {
  const sizeStyles = {
    sm: 'h-4 w-4',
    md: 'h-8 w-8',
    lg: 'h-12 w-12',
  };

  return (
    <div className={cn('flex items-center justify-center', className)}>
      <div
        className={cn('animate-spin rounded-full', sizeStyles[size])}
        style={{
          border: '2.5px solid var(--color-sage-mist)',
          borderTopColor: 'var(--color-emerald)',
        }}
      />
    </div>
  );
}
