'use client';

import { useEffect, useRef, useState } from 'react';
import { useReducedMotion } from 'framer-motion';
import { cn } from '@/lib/utils';

function easeOutExpo(t: number): number {
  return t === 1 ? 1 : 1 - Math.pow(2, -10 * t);
}

export interface AnimatedCounterProps {
  value: number;
  suffix: string;
  label: string;
  duration?: number;
  className?: string;
}

export function AnimatedCounter({
  value,
  suffix,
  label,
  duration = 2000,
  className,
}: AnimatedCounterProps) {
  const shouldReduceMotion = useReducedMotion();
  // When reduced motion is preferred, start at the final value immediately
  const [displayValue, setDisplayValue] = useState(shouldReduceMotion ? value : 0);
  const [hasTriggered, setHasTriggered] = useState(!!shouldReduceMotion);
  const containerRef = useRef<HTMLDivElement>(null);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    // If reduced motion is preferred, show final value without animation
    if (shouldReduceMotion) {
      setDisplayValue(value);
      return;
    }

    const el = containerRef.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !hasTriggered) {
          setHasTriggered(true);
          observer.disconnect();

          const startTime = performance.now();

          function tick(now: number) {
            const elapsed = now - startTime;
            const progress = Math.min(elapsed / duration, 1);
            const eased = easeOutExpo(progress);
            const current = Math.round(eased * value);
            setDisplayValue(current);

            if (progress < 1) {
              rafRef.current = requestAnimationFrame(tick);
            }
          }

          rafRef.current = requestAnimationFrame(tick);
        }
      },
      { threshold: 0.3 }
    );

    observer.observe(el);

    return () => {
      observer.disconnect();
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, [value, duration, hasTriggered, shouldReduceMotion]);

  return (
    <div ref={containerRef} className={cn('text-center', className)}>
      <p
        className="text-4xl font-bold text-[var(--text-primary)] tabular-nums"
        aria-label={`${value}${suffix}`}
        aria-live="polite"
      >
        {displayValue.toLocaleString('en-IN')}{suffix}
      </p>
      <p className="text-sm text-[var(--text-muted)] mt-1">{label}</p>
    </div>
  );
}
