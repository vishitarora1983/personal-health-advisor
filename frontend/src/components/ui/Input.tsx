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
 * Input component with botanical luxe styling.
 * Warm cream background, sage-tinted borders, emerald focus ring,
 * and refined label typography.
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
          className="block text-sm font-semibold mb-1.5"
          style={{ color: 'var(--color-emerald-deep)' }}
        >
          {label}
        </label>
      )}
      <input
        id={inputId}
        className={cn(
          'px-3.5 py-2.5 rounded-xl text-sm transition-all',
          'placeholder:text-[var(--color-clay-subtle)]',
          'disabled:opacity-50 disabled:cursor-not-allowed',
          fullWidth ? 'w-full' : '',
          className
        )}
        style={{
          color: 'var(--color-clay)',
          backgroundColor: 'var(--color-ivory)',
          border: hasError
            ? '1.5px solid var(--color-coral)'
            : '1.5px solid var(--color-sage-mist)',
          outline: 'none',
          transitionDuration: 'var(--duration-normal)',
          transitionTimingFunction: 'var(--ease-out-expo)',
        }}
        onFocus={(e) => {
          if (!hasError) {
            e.currentTarget.style.borderColor = 'var(--color-emerald)';
            e.currentTarget.style.boxShadow = '0 0 0 3px rgba(45, 90, 63, 0.10)';
          } else {
            e.currentTarget.style.boxShadow = '0 0 0 3px rgba(212, 90, 58, 0.10)';
          }
        }}
        onBlur={(e) => {
          e.currentTarget.style.borderColor = hasError
            ? 'var(--color-coral)'
            : 'var(--color-sage-mist)';
          e.currentTarget.style.boxShadow = 'none';
        }}
        {...props}
      />
      {error && (
        <p className="mt-1.5 text-xs font-medium" style={{ color: 'var(--color-coral)' }}>
          {error}
        </p>
      )}
      {helperText && !error && (
        <p className="mt-1.5 text-xs" style={{ color: 'var(--color-clay-muted)' }}>
          {helperText}
        </p>
      )}
    </div>
  );
}
