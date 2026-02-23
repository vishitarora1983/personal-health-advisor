// frontend/src/components/auth/authFormConstants.ts
//
// Shared animation variants, CSS class strings, and inline style objects used
// by both the login and signup auth form pages. Centralizing them here prevents
// duplication drift and ensures visual consistency across all auth surfaces.

// ── framer-motion animation variants ─────────────────────────────────────────

/**
 * Container variant: staggers child items in on initial render.
 * Used as the root motion.div wrapper in each auth form.
 */
export const containerVariants = {
  hidden: {},
  visible: {
    transition: { staggerChildren: 0.06, delayChildren: 0.1 },
  },
} as const;

/**
 * Item variant: each form field/section fades+slides up individually.
 * Driven by containerVariants stagger timing.
 */
export const itemVariants = {
  hidden: { opacity: 0, y: 16 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.4, ease: [0.16, 1, 0.3, 1] as const },
  },
} as const;

/**
 * Error variant: inline field error messages animate in/out with a
 * height-collapse so surrounding content reflows smoothly instead of jumping.
 */
export const errorVariants = {
  hidden: { opacity: 0, height: 0 },
  visible: {
    opacity: 1,
    height: 'auto',
    transition: { duration: 0.15, ease: [0.16, 1, 0.3, 1] as const },
  },
  exit: {
    opacity: 0,
    height: 0,
    transition: { duration: 0.15, ease: [0.16, 1, 0.3, 1] as const },
  },
} as const;

// ── Input styling ─────────────────────────────────────────────────────────────

/**
 * Tailwind class string applied to every text input.
 * outline:none removes the browser default ring; we apply our own custom ring
 * via inline style on focus (see inputFocusStyle).
 */
export const inputClasses =
  'w-full px-4 py-3 rounded-xl text-sm outline-none transition-all duration-150';

/**
 * Base inline style object for text inputs.
 * Uses CSS custom properties so the values automatically update when the
 * theme changes (e.g. dark/light mode toggle).
 */
export const inputStyle: React.CSSProperties = {
  background: 'var(--bg-input)',
  border: '1px solid var(--surface-border)',
  color: 'var(--text-primary)',
};
