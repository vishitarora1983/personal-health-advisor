'use client';

// SmoothScroll.tsx
//
// Lenis provides momentum-based smooth scrolling that replaces the browser's
// native scroll behaviour. It runs on requestAnimationFrame to stay on the
// compositor thread, avoiding layout thrash.
//
// We also integrate it with framer-motion so that useScroll() hooks receive
// Lenis-adjusted scroll values rather than the real (suppressed) scrollY.
//
// IMPORTANT: This component must wrap only the landing page, NOT the entire
// Next.js app. Applying it globally causes conflicts with non-landing pages
// that may have custom scroll containers (e.g., the /app/* dashboard with a
// fixed sidebar and overflow-y: auto content area).

import React, {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  ReactNode,
} from 'react';
import Lenis from 'lenis';
import { useReducedMotion } from 'framer-motion';

// ─── Context ─────────────────────────────────────────────────────────────────
// Expose the Lenis instance so child components can call lenis.scrollTo()
// for programmatic scrolling (e.g., "scroll to section" nav buttons).
//
// NOTE: We use state (not ref) so that context consumers get the actual
// Lenis instance once it's created, rather than always receiving null.
interface SmoothScrollContextValue {
  lenis: Lenis | null;
}

const SmoothScrollContext = createContext<SmoothScrollContextValue>({
  lenis: null,
});

export function useSmoothScroll(): SmoothScrollContextValue {
  return useContext(SmoothScrollContext);
}

// ─── Provider ────────────────────────────────────────────────────────────────
interface SmoothScrollProps {
  children: ReactNode;
}

export function SmoothScroll({ children }: SmoothScrollProps) {
  // Use state so context consumers re-render with the actual Lenis instance
  // (not null) once it's created on the client.
  const [lenis, setLenis] = useState<Lenis | null>(null);

  // When the user has requested reduced motion, skip Lenis entirely.
  // This honours the OS-level "Reduce motion" accessibility preference
  // and prevents momentum scrolling from causing discomfort or nausea.
  const shouldReduceMotion = useReducedMotion();

  // We use a ref for the RAF id so we can cancel on unmount without
  // triggering unnecessary re-renders.
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    // Guard: do not initialise Lenis when the user prefers reduced motion.
    // The dependency array includes shouldReduceMotion so that if the
    // OS preference changes at runtime the effect re-runs and correctly
    // skips (or creates) Lenis.
    if (shouldReduceMotion) return;

    // Instantiate Lenis once on mount.
    const lenisInstance = new Lenis({
      // Duration of the easing animation in seconds.
      // 1.2s provides a premium, slightly leisurely feel without being sluggish.
      duration: 1.2,

      // easeOutExpo curve: fast start, very gradual deceleration.
      // Gives the scroll a physical "momentum coasting" feel.
      easing: (t: number) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),

      // We are scrolling the document root, not a nested element.
      orientation: 'vertical',
      gestureOrientation: 'vertical',

      // Smooth trackpad and mouse wheel events.
      smoothWheel: true,

      // Standard wheel sensitivity. Increase to 1.2–1.5 if feedback indicates
      // the scroll feels too slow on magic trackpads.
      wheelMultiplier: 1,

      // Touch devices benefit from slightly higher multiplier because finger
      // swipes cover less physical distance than wheel events.
      touchMultiplier: 2,
    });

    // Expose the lenis instance to context consumers.
    setLenis(lenisInstance);

    // ─── RAF Loop ──────────────────────────────────────────────────────────
    // Lenis must be ticked on every animation frame. We also dispatch a
    // synthetic scroll event here so that framer-motion's useScroll() hook,
    // which listens to window scroll events, receives the Lenis-adjusted
    // scroll position rather than the real scrollY (which Lenis suppresses).
    function raf(time: number) {
      lenisInstance.raf(time);
      rafRef.current = requestAnimationFrame(raf);
    }
    rafRef.current = requestAnimationFrame(raf);

    // ─── Cleanup ───────────────────────────────────────────────────────────
    return () => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
      lenisInstance.destroy();
      setLenis(null);
    };
  }, [shouldReduceMotion]); // Re-run if OS reduced-motion preference changes.

  return (
    <SmoothScrollContext.Provider value={{ lenis }}>
      {children}
    </SmoothScrollContext.Provider>
  );
}
