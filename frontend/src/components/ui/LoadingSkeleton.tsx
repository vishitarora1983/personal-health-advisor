'use client';

import React from 'react';
import { cn } from '@/lib/utils';

interface LoadingSkeletonProps {
  rows?: number;
  height?: 'sm' | 'md' | 'lg';
  className?: string;
}

/**
 * Loading skeleton with FedRight dark shimmer effect.
 * Uses the .skeleton CSS class from globals.css which applies
 * the shimmer gradient between --bg-secondary and --bg-hover.
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
            // .skeleton class from globals.css handles shimmer gradient + animation
            'skeleton',
            heightStyles[height],
            index === rows - 1 && rows > 1 ? 'w-3/4' : 'w-full'
          )}
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
      className="rounded-[var(--radius-lg)] p-6"
      style={{
        background: 'var(--bg-secondary)',
        border: '1px solid var(--surface-border)',
        boxShadow: 'var(--shadow-md)',
      }}
    >
      {/* Title skeleton */}
      <div className="skeleton h-6 rounded-lg w-1/3 mb-4" />
      {/* Body line skeletons at 100%, 83%, 67% widths */}
      <div className="space-y-3">
        {[1, 0.83, 0.67].map((width, i) => (
          <div
            key={i}
            className="skeleton h-4 rounded-lg"
            style={{
              width: `${width * 100}%`,
              animationDelay: `${i * 0.1}s`,
            }}
          />
        ))}
      </div>
    </div>
  );
}

/**
 * Spinner with brand green ring.
 * Uses --brand-green for the active arc and --surface-border for the track.
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
          border: '2.5px solid var(--surface-border)',
          borderTopColor: 'var(--brand-green)',
        }}
      />
    </div>
  );
}
