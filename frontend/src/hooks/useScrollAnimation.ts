'use client';

/**
 * useScrollAnimation.ts
 *
 * A reusable hook that combines a ref + useInView for scroll-triggered animations.
 * Returns { ref, isInView } — attach ref to the element you want to observe,
 * then use isInView to toggle the animation variant ("hidden" ↔ "visible").
 *
 * This abstracts away the direct use of useInView in components,
 * making scroll animations consistent and easier to maintain.
 *
 * Usage:
 *   const { ref, isInView } = useScrollAnimation({ threshold: 0.2, once: true });
 *
 *   <motion.div
 *     ref={ref}
 *     initial="hidden"
 *     animate={isInView ? "visible" : "hidden"}
 *     variants={fadeUpVariants}
 *   />
 */

import { useInView } from 'framer-motion';
import { useRef } from 'react';

interface UseScrollAnimationOptions {
  // Fraction of the element that must be visible before triggering (0–1)
  threshold?: number;
  // If true, the animation only fires once per page load.
  // If false, it replays every time the element re-enters the viewport.
  once?: boolean;
  // Additional margin around the viewport for early/late triggering.
  // Negative values trigger the animation before the element is fully in view.
  // e.g. '-100px' means "100px before the element enters the viewport"
  margin?: string;
}

interface UseScrollAnimationReturn {
  ref: React.RefObject<HTMLElement | null>;
  isInView: boolean;
}

export function useScrollAnimation(
  options: UseScrollAnimationOptions = {}
): UseScrollAnimationReturn {
  const { threshold = 0.1, once = true, margin = '-100px' } = options;

  const ref = useRef<HTMLElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const isInView = useInView(ref, { amount: threshold, once, margin: margin as any });

  return { ref, isInView };
}
