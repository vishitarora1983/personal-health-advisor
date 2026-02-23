'use client';

/**
 * useSmoothScroll.ts
 *
 * Re-exports the useSmoothScroll hook from SmoothScroll.tsx for convenient access.
 * This lets child components access the Lenis instance for programmatic scrolling
 * without importing from the implementation file directly.
 *
 * The SmoothScroll context provides the Lenis instance, which can be used to:
 *   - Scroll to a specific element or position
 *   - Scroll to a section by ID
 *   - Temporarily disable smooth scrolling
 *
 * Usage:
 *   const { lenis } = useSmoothScroll();
 *
 *   function handleCTAClick() {
 *     lenis?.scrollTo('#cta-section', {
 *       offset: -80,
 *       duration: 1.5,
 *     });
 *   }
 *
 * IMPORTANT: This hook only works inside components that are children
 * of the <SmoothScroll> provider (i.e., inside the landing page).
 * In /app/* pages, this will return { lenis: null } harmlessly.
 */

export { useSmoothScroll } from '@/components/landing/SmoothScroll';
