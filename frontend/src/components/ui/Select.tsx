'use client';

import React, { useId } from 'react';
import { cn } from '@/lib/utils';

export interface SelectOption {
  value: string;
  label: string;
}

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  options: SelectOption[];
  error?: string;
  helperText?: string;
  fullWidth?: boolean;
  placeholder?: string;
}

/**
 * Select dropdown with FedRight dark design system.
 * Matches Input styling for visual consistency across forms.
 * Dark inset background, brand green focus ring.
 */
export function Select({
  label,
  options,
  error,
  helperText,
  fullWidth = false,
  placeholder,
  className,
  id,
  ...props
}: SelectProps) {
  const generatedId = useId();
  const selectId = id || generatedId;
  const hasError = !!error;

  return (
    <div className={fullWidth ? 'w-full' : ''}>
      {label && (
        <label
          htmlFor={selectId}
          className="block text-sm font-medium mb-1.5"
          style={{ color: 'var(--text-secondary)' }}
        >
          {label}
        </label>
      )}
      <select
        id={selectId}
        className={cn(
          'px-3.5 py-2.5 rounded-xl text-sm transition-all appearance-none',
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
          // Chevron icon in text-muted color for dark backgrounds
          backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%235C6370' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E")`,
          backgroundRepeat: 'no-repeat',
          backgroundPosition: 'right 12px center',
          paddingRight: '40px',
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
      >
        {placeholder && (
          <option value="" disabled>
            {placeholder}
          </option>
        )}
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
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
