'use client';

import React, { useId } from 'react';
import { cn } from '@/lib/utils';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helperText?: string;
  fullWidth?: boolean;
}

/**
 * Input component with FedRight dark design system.
 * Dark inset background (--bg-input), brand green focus ring,
 * subtle border that brightens on focus.
 */
export function Input({
  label,
  error,
  helperText,
  fullWidth = false,
  className,
  id,
  ...props
}: InputProps) {
  const generatedId = useId();
  const inputId = id || generatedId;
  const hasError = !!error;

  return (
    <div className={fullWidth ? 'w-full' : ''}>
      {label && (
        <label
          htmlFor={inputId}
          className="block text-sm font-medium mb-1.5"
          style={{ color: 'var(--text-secondary)' }}
        >
          {label}
        </label>
      )}
      <input
        id={inputId}
        className={cn(
          'px-3.5 py-2.5 rounded-xl text-sm transition-all',
          'placeholder:text-[var(--text-muted)]',
          'disabled:opacity-50 disabled:cursor-not-allowed',
          fullWidth ? 'w-full' : '',
          className
        )}
        style={{
          color: 'var(--text-primary)',
          backgroundColor: 'var(--bg-input)',
          border: hasError
            ? '1.5px solid var(--color-error)'
            : '1.5px solid var(--surface-border)',
          outline: 'none',
          transitionDuration: 'var(--duration-fast)',
          transitionTimingFunction: 'var(--ease-out-expo)',
        }}
        onFocus={(e) => {
          if (!hasError) {
            e.currentTarget.style.borderColor = 'var(--brand-green)';
            e.currentTarget.style.boxShadow = '0 0 0 3px var(--brand-green-subtle)';
          } else {
            e.currentTarget.style.boxShadow = '0 0 0 3px var(--color-error-bg)';
          }
        }}
        onBlur={(e) => {
          e.currentTarget.style.borderColor = hasError
            ? 'var(--color-error)'
            : 'var(--surface-border)';
          e.currentTarget.style.boxShadow = 'none';
        }}
        {...props}
      />
      {error && (
        <p className="mt-1.5 text-xs font-medium" style={{ color: 'var(--color-error)' }}>
          {error}
        </p>
      )}
      {helperText && !error && (
        <p className="mt-1.5 text-xs" style={{ color: 'var(--text-muted)' }}>
          {helperText}
        </p>
      )}
    </div>
  );
}
