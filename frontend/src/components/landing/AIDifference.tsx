'use client';

import { motion, useReducedMotion } from 'framer-motion';
import { CheckCircle2, XCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ROUTES } from '@/lib/routes';

// ─── Types ────────────────────────────────────────────────────────────────────

interface ComparisonRow {
  others: string;
  fedright: string;
}

// ─── Data ─────────────────────────────────────────────────────────────────────

const COMPARISONS: ComparisonRow[] = [
  {
    others: 'Individual-only tracking',
    fedright: 'Household-first meal intelligence',
  },
  {
    others: 'Generic meal suggestions',
    fedright: 'AI plans personalized to each member',
  },
  {
    others: 'Manual recipe search',
    fedright: 'One kitchen, every diet handled',
  },
  {
    others: 'No family coordination',
    fedright: "Chef's View for the family cook",
  },
  {
    others: 'One-size-fits-all portions',
    fedright: 'Kid-safe portions auto-calculated',
  },
];

// ─── Main Component ───────────────────────────────────────────────────────────

export interface AIDifferenceProps {
  id?: string;
}

export function AIDifference({ id }: AIDifferenceProps) {
  const shouldReduceMotion = useReducedMotion();

  return (
    <section
      id={id}
      className="py-24 lg:py-32 bg-[var(--bg-secondary)]"
      aria-labelledby="ai-difference-heading"
    >
      <div className="max-w-5xl mx-auto px-6">

        {/* Section header */}
        <motion.div
          className="text-center mb-16"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-100px' }}
          transition={{ duration: 0.5 }}
        >
          <p className="text-xs font-semibold uppercase tracking-widest text-[var(--brand-green)] mb-3">
            THE AI DIFFERENCE
          </p>
          <h2
            id="ai-difference-heading"
            className="text-3xl lg:text-4xl font-bold text-[var(--text-primary)]"
          >
            Not Another Calorie Counter
          </h2>
          <p className="text-[var(--text-secondary)] mt-3 max-w-lg mx-auto">
            FedRight is built specifically for Indian households where cooking for everyone at once is the norm.
          </p>
        </motion.div>

        {/* Comparison grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 lg:gap-12">

          {/* ── LEFT: Other Apps ── */}
          <div>
            {/* Column header */}
            <div className="flex items-center gap-3 mb-6">
              <div className="w-8 h-8 rounded-lg bg-red-500/10 border border-red-500/20 flex items-center justify-center flex-shrink-0">
                <XCircle className="w-4 h-4 text-red-400/70" aria-hidden="true" />
              </div>
              <h3 className="text-sm font-semibold uppercase tracking-wider text-[var(--text-muted)] text-left">
                Other Apps
              </h3>
            </div>

            <div className="flex flex-col" role="list" aria-label="What other apps offer">
              {COMPARISONS.map((row, i) => (
                <motion.div
                  key={row.others}
                  role="listitem"
                  className="flex items-start gap-3 py-4 border-b border-white/5"
                  initial={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, x: -20 }}
                  whileInView={shouldReduceMotion ? { opacity: 1 } : { opacity: 1, x: 0 }}
                  viewport={{ once: true, margin: '-50px' }}
                  transition={
                    shouldReduceMotion
                      ? { duration: 0.3 }
                      : { duration: 0.4, ease: 'easeOut', delay: i * 0.1 }
                  }
                >
                  <XCircle
                    className="w-5 h-5 text-red-400/50 flex-shrink-0 mt-0.5"
                    aria-hidden="true"
                  />
                  <span className="text-[var(--text-muted)] text-sm leading-relaxed">
                    {row.others}
                  </span>
                </motion.div>
              ))}
            </div>
          </div>

          {/* ── RIGHT: FedRight ── */}
          <div className="border-l-0 md:border-l-2 md:border-[var(--brand-green-border)] md:pl-6">
            {/* Column header */}
            <div className="flex items-center gap-3 mb-6">
              <div className="w-8 h-8 rounded-lg bg-[var(--brand-green-subtle)] border border-[var(--brand-green-border)] flex items-center justify-center flex-shrink-0">
                <CheckCircle2 className="w-4 h-4 text-[var(--brand-green)]" aria-hidden="true" />
              </div>
              <h3 className="text-sm font-semibold uppercase tracking-wider text-[var(--brand-green)] text-left">
                FedRight
              </h3>
            </div>

            <div className="flex flex-col" role="list" aria-label="What FedRight offers">
              {COMPARISONS.map((row, i) => (
                <motion.div
                  key={row.fedright}
                  role="listitem"
                  className="flex items-start gap-3 py-4 border-b border-white/5"
                  initial={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, x: 20 }}
                  whileInView={shouldReduceMotion ? { opacity: 1 } : { opacity: 1, x: 0 }}
                  viewport={{ once: true, margin: '-50px' }}
                  transition={
                    shouldReduceMotion
                      ? { duration: 0.3 }
                      : { duration: 0.4, ease: 'easeOut', delay: i * 0.1 }
                  }
                >
                  <CheckCircle2
                    className="w-5 h-5 text-[var(--brand-green)] flex-shrink-0 mt-0.5"
                    aria-hidden="true"
                  />
                  <span className="text-[var(--text-primary)] font-medium text-sm leading-relaxed">
                    {row.fedright}
                  </span>
                </motion.div>
              ))}
            </div>
          </div>

        </div>

        {/* Bottom CTA nudge */}
        <motion.div
          className="text-center mt-16"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
        >
          <a
            href={ROUTES.PUBLIC.SIGNUP}
            className={cn(
              'inline-flex items-center gap-2 px-6 py-3 rounded-xl',
              'bg-[var(--brand-green-subtle)] border border-[var(--brand-green-border)]',
              'text-[var(--brand-green-light)] font-medium text-sm',
              'hover:bg-[var(--brand-green)] hover:text-white hover:border-[var(--brand-green)]',
              'transition-all duration-200'
            )}
          >
            Experience the FedRight difference
          </a>
        </motion.div>

      </div>
    </section>
  );
}
