'use client';

import React from 'react';
import { cn } from '@/lib/utils';

interface CardProps {
  children: React.ReactNode;
  className?: string;
  padding?: 'none' | 'sm' | 'md' | 'lg';
  hover?: boolean;
  glass?: boolean;
}

interface CardHeaderProps {
  children: React.ReactNode;
  className?: string;
}

/**
 * Card component with botanical luxe glassmorphic surface.
 * Provides a refined container with subtle transparency, warm borders,
 * and organic shadow treatment.
 */
export function Card({ children, className, padding = 'md', hover = false, glass = false }: CardProps) {
  const paddingStyles = {
    none: '',
    sm: 'p-4',
    md: 'p-6',
    lg: 'p-8',
  };

  return (
    <div
      className={cn(
        'relative overflow-hidden rounded-2xl transition-all',
        glass ? 'glass-surface' : '',
        hover && 'hover:-translate-y-0.5',
        paddingStyles[padding],
        className
      )}
      style={{
        ...(!glass
          ? {
              background: 'var(--surface-primary)',
              backdropFilter: 'blur(var(--glass-blur)) saturate(var(--glass-saturate))',
              WebkitBackdropFilter: 'blur(var(--glass-blur)) saturate(var(--glass-saturate))',
              border: '1px solid var(--surface-glass-border)',
              boxShadow: hover ? undefined : 'var(--shadow-sm)',
            }
          : {}),
        transitionDuration: 'var(--duration-normal)',
        transitionTimingFunction: 'var(--ease-out-expo)',
      }}
      onMouseEnter={(e) => {
        if (hover) {
          e.currentTarget.style.boxShadow = 'var(--shadow-lg)';
        }
      }}
      onMouseLeave={(e) => {
        if (hover) {
          e.currentTarget.style.boxShadow = 'var(--shadow-sm)';
        }
      }}
    >
      {children}
    </div>
  );
}

/**
 * Card header with warm amber accent line.
 */
Card.Header = function CardHeader({ children, className }: CardHeaderProps) {
  return (
    <div className={cn('mb-4 pb-4', className)} style={{ borderBottom: '1px solid var(--surface-glass-border)' }}>
      {children}
    </div>
  );
};

/**
 * Card body for main content area.
 */
Card.Body = function CardBody({ children, className }: CardHeaderProps) {
  return <div className={cn('', className)}>{children}</div>;
};

/**
 * Card footer for actions or supplementary information.
 */
Card.Footer = function CardFooter({ children, className }: CardHeaderProps) {
  return (
    <div className={cn('mt-4 pt-4', className)} style={{ borderTop: '1px solid var(--surface-glass-border)' }}>
      {children}
    </div>
  );
};
