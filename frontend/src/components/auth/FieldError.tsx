'use client';

// frontend/src/components/auth/FieldError.tsx
//
// Shared inline field-level error message component used by both the login
// and signup auth form pages.
//
// Animates in/out using a height-collapse transition (via errorVariants) so
// that surrounding form content reflows smoothly rather than jumping.
//
// Accessibility: the inner <p> carries role="alert" so that screen readers
// announce the error immediately when it appears, without requiring focus
// to move to the error element.

import { motion, AnimatePresence } from 'framer-motion';
import { AlertCircle } from 'lucide-react';
import { errorVariants } from './authFormConstants';

interface FieldErrorProps {
  /** The error message string. Pass an empty string (or omit) to hide. */
  message: string;
  /**
   * The HTML id to assign to the inner <p>. Auth inputs reference this via
   * aria-describedby to associate themselves with their error message for AT.
   */
  id: string;
}

/**
 * Animated inline field error message for auth forms.
 *
 * Usage:
 *   <FieldError message={errors.email || ''} id="email-error" />
 *
 * The parent input should carry:
 *   aria-describedby={errors.email ? 'email-error' : undefined}
 *   aria-invalid={!!errors.email}
 */
export function FieldError({ message, id }: FieldErrorProps) {
  return (
    <AnimatePresence>
      {message && (
        <motion.div
          variants={errorVariants}
          initial="hidden"
          animate="visible"
          exit="exit"
          // overflow:hidden is required for the height-collapse animation to
          // clip the content cleanly during the exit transition.
          style={{ overflow: 'hidden' }}
        >
          <p
            id={id}
            role="alert"
            className="flex items-center gap-1.5 text-xs mt-1.5"
            style={{ color: 'var(--color-error)' }}
          >
            <AlertCircle className="w-3 h-3 flex-shrink-0" aria-hidden="true" />
            {message}
          </p>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
