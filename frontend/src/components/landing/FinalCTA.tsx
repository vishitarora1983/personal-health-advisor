'use client';

import Image from 'next/image';
import { motion, useReducedMotion } from 'framer-motion';
import { CheckCircle2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ROUTES } from '@/lib/routes';

export interface FinalCTAProps {
  id?: string;
}

export function FinalCTA({ id }: FinalCTAProps) {
  const shouldReduceMotion = useReducedMotion();

  return (
    <section
      id={id}
      className="py-24 lg:py-32 relative overflow-hidden bg-[var(--bg-primary)]"
      aria-labelledby="final-cta-heading"
    >
      {/* Animated gradient mesh background — the gradient color stops create a
          living colour-mesh effect. animation-play-state: paused disables the
          animation for users who prefer reduced motion. */}
      <div
        className={cn(
          'absolute inset-0 pointer-events-none',
          !shouldReduceMotion && 'animate-gradient-mesh-cta'
        )}
        style={{
          backgroundImage:
            'linear-gradient(135deg, rgba(27,139,77,0.15) 0%, rgba(230,146,10,0.10) 50%, rgba(27,139,77,0.15) 100%)',
          backgroundSize: '400% 400%',
        }}
        aria-hidden="true"
      />

      {/* Subtle grid pattern on top of gradient */}
      <div
        className="absolute inset-0 pointer-events-none opacity-[0.03]"
        style={{
          backgroundImage:
            'linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), ' +
            'linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)',
          backgroundSize: '40px 40px',
        }}
        aria-hidden="true"
      />

      {/* Decorative thali image — left side */}
      <div
        className="absolute -left-24 top-1/2 -translate-y-1/2 w-80 h-80 rounded-full overflow-hidden opacity-15 pointer-events-none blur-[1px]"
        aria-hidden="true"
      >
        <Image
          src="/images/landing/thali-phone-cta.png"
          alt=""
          fill
          sizes="320px"
          className="object-cover"
        />
      </div>

      {/* Decorative thali image — right side (mirrored) */}
      <div
        className="absolute -right-24 top-1/2 -translate-y-1/2 w-80 h-80 rounded-full overflow-hidden opacity-10 pointer-events-none blur-[1px] scale-x-[-1]"
        aria-hidden="true"
      >
        <Image
          src="/images/landing/thali-phone-cta.png"
          alt=""
          fill
          sizes="320px"
          className="object-cover"
        />
      </div>

      {/* Green glow orbs */}
      <div
        className="absolute top-0 left-1/4 w-96 h-96 rounded-full blur-3xl pointer-events-none opacity-20"
        style={{ background: 'radial-gradient(circle, var(--brand-green-glow), transparent)' }}
        aria-hidden="true"
      />
      <div
        className="absolute bottom-0 right-1/4 w-96 h-96 rounded-full blur-3xl pointer-events-none opacity-15"
        style={{ background: 'radial-gradient(circle, var(--brand-amber-glow), transparent)' }}
        aria-hidden="true"
      />

      {/* Content */}
      <div className="relative z-10 max-w-3xl mx-auto px-6 text-center">

        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: '-80px' }}
          variants={{ hidden: {}, visible: { transition: { staggerChildren: 0.1 } } }}
        >
          {/* Eyebrow */}
          <motion.div
            variants={{
              hidden: { opacity: 0, y: 16 },
              visible: { opacity: 1, y: 0, transition: { duration: 0.4 } },
            }}
            className="mb-6"
          >
            <span className={cn(
              'inline-flex items-center gap-2',
              'border border-[var(--brand-green-border)] bg-[var(--brand-green-subtle)]',
              'rounded-full px-4 py-1.5',
              'text-xs font-semibold uppercase tracking-widest text-[var(--brand-green-light)]'
            )}>
              Free to Start
            </span>
          </motion.div>

          {/* H2 */}
          <motion.h2
            id="final-cta-heading"
            className="text-3xl lg:text-5xl font-bold text-[var(--text-primary)] leading-tight"
            variants={{
              hidden: { opacity: 0, y: 20 },
              visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: 'easeOut' } },
            }}
          >
            Stop Agonizing Over Dinner.{' '}
            <span className="bg-gradient-to-r from-[var(--brand-green)] to-[var(--brand-green-light)] bg-clip-text text-transparent">
              Start Nourishing Your Family.
            </span>
          </motion.h2>

          {/* Subtitle */}
          <motion.p
            className="text-lg text-[var(--text-secondary)] mt-6 max-w-xl mx-auto leading-relaxed"
            variants={{
              hidden: { opacity: 0, y: 16 },
              visible: { opacity: 1, y: 0, transition: { duration: 0.4, ease: 'easeOut' } },
            }}
          >
            Set up your household in 2 minutes. Get your first AI-crafted meal plan instantly.
          </motion.p>

          {/* Primary CTA */}
          <motion.div
            className="mt-10"
            variants={{
              hidden: { opacity: 0, y: 16 },
              visible: { opacity: 1, y: 0, transition: { duration: 0.4, ease: 'easeOut' } },
            }}
          >
            <motion.a
              href={ROUTES.PUBLIC.SIGNUP}
              className={cn(
                'inline-flex items-center justify-center',
                'bg-[var(--brand-green)] px-10 py-5 rounded-2xl',
                'text-white font-semibold text-xl',
                'hover:bg-[var(--brand-green-light)]',
                'transition-colors duration-300',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-green)] focus-visible:ring-offset-4 focus-visible:ring-offset-[var(--bg-primary)]'
              )}
              // Glow pulse on hover — disabled for reduced motion users
              whileHover={
                shouldReduceMotion
                  ? {}
                  : { scale: 1.02, boxShadow: '0 0 30px rgba(27,139,77,0.4)' }
              }
              whileTap={shouldReduceMotion ? {} : { scale: 0.98 }}
              transition={{ type: 'spring', stiffness: 400, damping: 20 }}
            >
              Get Started Free
            </motion.a>
          </motion.div>

          {/* Reassurance text */}
          <motion.p
            className="text-sm text-[var(--text-muted)] mt-4"
            variants={{
              hidden: { opacity: 0 },
              visible: { opacity: 1, transition: { duration: 0.4, delay: 0.1 } },
            }}
            aria-label="No credit card required to sign up"
          >
            No credit card required
          </motion.p>

        </motion.div>

        {/* Trust badges */}
        <motion.div
          className="flex items-center justify-center gap-6 mt-14 flex-wrap"
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ delay: 0.4, duration: 0.5 }}
          aria-hidden="true"
        >
          {[
            'No credit card',
            'Cancel anytime',
            'Free 7-day trial',
            '500+ families',
          ].map((item) => (
            <span
              key={item}
              className="flex items-center gap-1.5 text-xs text-[var(--text-muted)]"
            >
              <CheckCircle2 className="w-3.5 h-3.5 text-[var(--brand-green)]" aria-hidden="true" />
              {item}
            </span>
          ))}
        </motion.div>

      </div>
    </section>
  );
}
