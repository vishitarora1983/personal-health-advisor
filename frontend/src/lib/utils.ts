import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * Merge Tailwind CSS classes with proper precedence.
 * Uses clsx for conditional classes and tailwind-merge to handle conflicts.
 *
 * @param inputs Class names (strings, objects, arrays)
 * @returns Merged class string
 *
 * @example
 * cn('px-2 py-1', isActive && 'bg-blue-500', className)
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

/**
 * Parse a YYYY-MM-DD string as a local date (not UTC).
 * `new Date('2026-02-13')` is parsed as UTC midnight, which shifts the day
 * in negative-offset timezones. This helper avoids that.
 */
export function parseLocalDate(dateString: string): Date {
  const [y, m, d] = dateString.split('-').map(Number);
  return new Date(y, m - 1, d);
}

/**
 * Format a date string to a human-readable format.
 *
 * @param dateString ISO date string (YYYY-MM-DD)
 * @param format 'short' | 'long' | 'full'
 * @returns Formatted date string
 *
 * @example
 * formatDate('2025-01-20') // 'Jan 20, 2025'
 * formatDate('2025-01-20', 'long') // 'January 20, 2025'
 */
export function formatDate(dateString: string, format: 'short' | 'long' | 'full' = 'short'): string {
  const date = parseLocalDate(dateString);

  const optionsMap: Record<string, Intl.DateTimeFormatOptions> = {
    short: { month: 'short', day: 'numeric', year: 'numeric' },
    long: { month: 'long', day: 'numeric', year: 'numeric' },
    full: { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' },
  };

  return date.toLocaleDateString('en-US', optionsMap[format]);
}

/**
 * Get the day name from a date string.
 *
 * @param dateString ISO date string (YYYY-MM-DD)
 * @param format 'short' | 'long'
 * @returns Day name
 *
 * @example
 * getDayName('2025-01-20') // 'Mon'
 * getDayName('2025-01-20', 'long') // 'Monday'
 */
export function getDayName(dateString: string, format: 'short' | 'long' = 'short'): string {
  const date = parseLocalDate(dateString);
  return date.toLocaleDateString('en-US', {
    weekday: format === 'short' ? 'short' : 'long'
  });
}

/**
 * Format number with proper decimal places and rounding.
 *
 * @param value Number to format
 * @param decimals Number of decimal places (default: 1)
 * @returns Formatted number string
 *
 * @example
 * formatNumber(1234.567) // '1234.6'
 * formatNumber(1234.567, 2) // '1234.57'
 */
export function formatNumber(value: number, decimals: number = 1): string {
  return value.toFixed(decimals);
}

/**
 * Calculate percentage with proper rounding.
 *
 * @param value Current value
 * @param total Total value
 * @param decimals Decimal places (default: 0)
 * @returns Percentage number
 *
 * @example
 * calculatePercentage(75, 100) // 75
 * calculatePercentage(1, 3, 1) // 33.3
 */
export function calculatePercentage(value: number, total: number, decimals: number = 0): number {
  if (total === 0) return 0;
  return Number(((value / total) * 100).toFixed(decimals));
}

/**
 * Get today's date in ISO format (YYYY-MM-DD).
 *
 * @returns Today's date string
 */
export function getTodayDate(): string {
  const today = new Date();
  return today.toISOString().split('T')[0];
}

/**
 * Get the start of the current week (Monday).
 *
 * @returns Monday's date in ISO format
 */
export function getWeekStartDate(): string {
  const today = new Date();
  const day = today.getDay();
  const diff = today.getDate() - day + (day === 0 ? -6 : 1); // Adjust when day is Sunday
  const monday = new Date(today.setDate(diff));
  return monday.toISOString().split('T')[0];
}

/**
 * Add days to a date.
 *
 * @param dateString ISO date string
 * @param days Number of days to add (can be negative)
 * @returns New date string
 */
export function addDays(dateString: string, days: number): string {
  const date = parseLocalDate(dateString);
  date.setDate(date.getDate() + days);
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * Format macro values as a readable string.
 *
 * @param protein Protein in grams
 * @param carbs Carbs in grams
 * @param fats Fats in grams
 * @returns Formatted string like "P: 30g | C: 40g | F: 20g"
 */
export function formatMacros(protein: number, carbs: number, fats: number): string {
  return `P: ${Math.round(protein)}g | C: ${Math.round(carbs)}g | F: ${Math.round(fats)}g`;
}

/**
 * Capitalize first letter of a string.
 *
 * @param str String to capitalize
 * @returns Capitalized string
 */
export function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

/**
 * Convert snake_case to Title Case.
 *
 * @param str Snake case string
 * @returns Title case string
 *
 * @example
 * snakeToTitle('lightly_active') // 'Lightly Active'
 */
export function snakeToTitle(str: string): string {
  return str
    .split('_')
    .map(word => capitalize(word))
    .join(' ');
}

/**
 * Debounce function to limit function call frequency.
 * Useful for search inputs and API calls.
 *
 * @param func Function to debounce
 * @param wait Wait time in milliseconds
 * @returns Debounced function
 */
export function debounce<T extends (...args: never[]) => unknown>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout | null = null;

  return function executedFunction(...args: Parameters<T>) {
    const later = () => {
      timeout = null;
      func(...args);
    };

    if (timeout) {
      clearTimeout(timeout);
    }
    timeout = setTimeout(later, wait);
  };
}

/**
 * Handle API errors and extract user-friendly error messages.
 *
 * @param error Error object from API
 * @returns User-friendly error message
 */
export function getErrorMessage(error: unknown): string {
  // Type guard for objects
  if (!error || typeof error !== 'object') {
    return 'An unexpected error occurred. Please try again.';
  }

  // Axios error with response
  if ('response' in error) {
    const axiosError = error as { response?: { data?: { detail?: unknown } } };
    const detail = axiosError.response?.data?.detail;

    if (detail) {
      // Validation error array
      if (Array.isArray(detail)) {
        return detail.map((err: { msg?: string }) => err.msg || 'Validation error').join(', ');
      }

      // Simple string error
      if (typeof detail === 'string') {
        return detail;
      }
    }
  }

  // Network error
  if ('message' in error && error.message === 'Network Error') {
    return 'Unable to connect to the server. Please check your connection.';
  }

  // Timeout error
  if ('code' in error && error.code === 'ECONNABORTED') {
    return 'Request timed out. Please try again.';
  }

  // Generic error with message
  if ('message' in error && typeof error.message === 'string') {
    return error.message;
  }

  // Generic error
  return 'An unexpected error occurred. Please try again.';
}

/**
 * Sleep/delay function for testing or animations.
 *
 * @param ms Milliseconds to sleep
 * @returns Promise that resolves after delay
 */
export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Check if a date is today.
 *
 * @param dateString ISO date string
 * @returns True if date is today
 */
export function isToday(dateString: string): boolean {
  return dateString === getTodayDate();
}

/**
 * Get color for tracking status badge.
 *
 * @param status Tracking status
 * @returns Tailwind color class
 */
export function getStatusColor(status: string): string {
  const colors: Record<string, string> = {
    ate_as_planned: 'bg-green-100 text-green-800 border-green-200',
    skipped: 'bg-red-100 text-red-800 border-red-200',
    ate_something_else: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  };
  return colors[status] || 'bg-gray-100 text-gray-800 border-gray-200';
}

/**
 * Get color for adherence/consistency score.
 *
 * @param percentage Percentage (0-100)
 * @returns Tailwind color class
 */
export function getScoreColor(percentage: number): string {
  if (percentage >= 80) return 'text-green-600';
  if (percentage >= 60) return 'text-yellow-600';
  return 'text-red-600';
}
