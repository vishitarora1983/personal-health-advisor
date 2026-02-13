'use client';

import React from 'react';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'danger' | 'ghost';
type ButtonSize = 'sm' | 'md' | 'lg';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  fullWidth?: boolean;
  children: React.ReactNode;
}

/**
 * Button component with botanical luxe styling.
 * Primary uses a warm amber gradient with glow effects.
 * Secondary uses sage-tinted surfaces.
 */
export function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  fullWidth = false,
  className,
  disabled,
  children,
  ...props
}: ButtonProps) {
  const baseStyles =
    'relative inline-flex items-center justify-center font-semibold rounded-xl transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed disabled:pointer-events-none overflow-hidden';

  const variantStyles: Record<ButtonVariant, string> = {
    primary: 'text-white focus-visible:ring-[var(--color-amber)]',
    secondary:
      'text-[var(--color-emerald-deep)] bg-[var(--color-sage-mist)] hover:bg-[var(--color-sage-light)] focus-visible:ring-[var(--color-sage)]',
    outline:
      'border-2 border-[var(--color-sage-light)] text-[var(--color-emerald-deep)] hover:bg-[var(--color-sage-mist)] hover:border-[var(--color-sage)] focus-visible:ring-[var(--color-sage)]',
    danger:
      'text-white focus-visible:ring-[var(--color-coral)]',
    ghost:
      'text-[var(--color-clay)] hover:bg-[var(--color-sage-mist)] hover:text-[var(--color-emerald-deep)] focus-visible:ring-[var(--color-sage)]',
  };

  const sizeStyles: Record<ButtonSize, string> = {
    sm: 'px-3.5 py-1.5 text-sm',
    md: 'px-5 py-2.5 text-sm',
    lg: 'px-7 py-3.5 text-base tracking-wide',
  };

  const getInlineStyles = (): React.CSSProperties => {
    const base: React.CSSProperties = {
      transitionDuration: 'var(--duration-normal)',
      transitionTimingFunction: 'var(--ease-out-expo)',
    };

    if (variant === 'primary') {
      return {
        ...base,
        background: 'linear-gradient(135deg, var(--color-amber) 0%, var(--color-amber-warm) 100%)',
        boxShadow: '0 2px 8px rgba(212, 148, 10, 0.25), inset 0 1px 0 rgba(255, 255, 255, 0.15)',
      };
    }

    if (variant === 'danger') {
      return {
        ...base,
        background: 'linear-gradient(135deg, var(--color-coral) 0%, var(--color-coral-light) 100%)',
        boxShadow: '0 2px 8px rgba(212, 90, 58, 0.25), inset 0 1px 0 rgba(255, 255, 255, 0.15)',
      };
    }

    return base;
  };

  return (
    <button
      className={cn(
        baseStyles,
        variantStyles[variant],
        sizeStyles[size],
        fullWidth && 'w-full',
        className
      )}
      style={getInlineStyles()}
      disabled={disabled || loading}
      onMouseEnter={(e) => {
        if (variant === 'primary' && !disabled && !loading) {
          e.currentTarget.style.boxShadow = 'var(--shadow-glow-amber)';
          e.currentTarget.style.transform = 'translateY(-1px)';
        }
        if (variant === 'danger' && !disabled && !loading) {
          e.currentTarget.style.transform = 'translateY(-1px)';
          e.currentTarget.style.boxShadow = '0 4px 16px rgba(212, 90, 58, 0.35)';
        }
      }}
      onMouseLeave={(e) => {
        if (variant === 'primary' && !disabled && !loading) {
          e.currentTarget.style.boxShadow = '0 2px 8px rgba(212, 148, 10, 0.25), inset 0 1px 0 rgba(255, 255, 255, 0.15)';
          e.currentTarget.style.transform = 'translateY(0)';
        }
        if (variant === 'danger' && !disabled && !loading) {
          e.currentTarget.style.transform = 'translateY(0)';
          e.currentTarget.style.boxShadow = '0 2px 8px rgba(212, 90, 58, 0.25), inset 0 1px 0 rgba(255, 255, 255, 0.15)';
        }
      }}
      {...props}
    >
      {loading && (
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
      )}
      {children}
    </button>
  );
}
