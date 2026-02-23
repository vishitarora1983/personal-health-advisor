'use client';

import React from 'react';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

// 'outline' was removed — it duplicated 'secondary' and was not in the design spec.
// 'icon' is added for transparent icon-button use cases (toolbar actions, close buttons, etc.).
type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'ghost' | 'icon';
type ButtonSize = 'sm' | 'md' | 'lg';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  fullWidth?: boolean;
  children: React.ReactNode;
}

/**
 * Button component with FedRight dark design system.
 * Primary uses brand green with glow on hover.
 * Secondary/ghost use glass surfaces on dark backgrounds.
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
    primary: 'text-[var(--text-inverse)] focus-visible:ring-[var(--brand-green)]',
    secondary:
      'text-[var(--text-primary)] bg-[var(--surface-glass)] hover:bg-[var(--surface-glass-hover)] border border-[var(--surface-border)] focus-visible:ring-[var(--brand-green)]',
    danger:
      'text-white focus-visible:ring-[var(--color-error)]',
    ghost:
      'text-[var(--text-secondary)] hover:bg-[var(--surface-glass-hover)] hover:text-[var(--text-primary)] focus-visible:ring-[var(--brand-green)]',
    // icon: transparent background, muted text, subtle hover fill — for toolbar/close buttons
    icon:
      'bg-transparent text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)] hover:text-[var(--text-primary)] focus-visible:ring-[var(--brand-green)]',
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
        background: 'var(--brand-green)',
        boxShadow: 'var(--shadow-md)',
      };
    }

    if (variant === 'danger') {
      return {
        ...base,
        background: 'var(--color-error)',
        boxShadow: 'var(--shadow-md)',
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
          e.currentTarget.style.background = 'var(--brand-green-light)';
          e.currentTarget.style.boxShadow = 'var(--shadow-glow-green)';
          e.currentTarget.style.transform = 'translateY(-1px)';
        }
        if (variant === 'danger' && !disabled && !loading) {
          e.currentTarget.style.opacity = '0.9';
          e.currentTarget.style.transform = 'translateY(-1px)';
        }
      }}
      onMouseLeave={(e) => {
        if (variant === 'primary' && !disabled && !loading) {
          e.currentTarget.style.background = 'var(--brand-green)';
          e.currentTarget.style.boxShadow = 'var(--shadow-md)';
          e.currentTarget.style.transform = 'translateY(0)';
        }
        if (variant === 'danger' && !disabled && !loading) {
          e.currentTarget.style.opacity = '1';
          e.currentTarget.style.transform = 'translateY(0)';
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
