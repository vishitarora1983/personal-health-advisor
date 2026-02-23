'use client';

import Image from 'next/image';
import { motion, useReducedMotion } from 'framer-motion';
import { cn } from '@/lib/utils';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Step {
  number: number;
  title: string;
  description: string;
  image: string;
  imageAlt: string;
}

// ─── Data ─────────────────────────────────────────────────────────────────────

const STEPS: Step[] = [
  {
    number: 1,
    title: 'Tell Us About Your Household',
    description:
      'Set up profiles for each family member — their age, health goals, ' +
      'allergies, and food preferences.',
    image: '/images/landing/mom-profiles.png',
    imageAlt: 'Mother setting up family member profiles on FedRight',
  },
  {
    number: 2,
    title: 'AI Crafts Your Weekly Plan',
    description:
      'Our AI builds a personalized 7-day meal plan for your entire household ' +
      'from one kitchen.',
    image: '/images/landing/dishes-overhead.png',
    imageAlt: 'Overhead view of beautifully arranged Indian dishes',
  },
  {
    number: 3,
    title: 'Smart Grocery List, Ready to Shop',
    description:
      'Auto-generated grocery list organized by category. Nothing missed, nothing wasted.',
    image: '/images/landing/fresh-vegetables.png',
    imageAlt: 'Fresh vegetables and ingredients for Indian cooking',
  },
  {
    number: 4,
    title: 'Track, Adapt, Thrive',
    description:
      "Log meals, track nutrition, and watch your family's health transform week by week.",
    image: '/images/landing/family-eating.png',
    imageAlt: 'Happy family eating a healthy meal together',
  },
];

// ─── Step Connector SVG ───────────────────────────────────────────────────────

function StepConnector({ index }: { index: number }) {
  const shouldReduceMotion = useReducedMotion();

  return (
    <div
      className="hidden lg:flex items-center justify-center self-start mt-14"
      aria-hidden="true"
    >
      <svg
        width="80"
        height="24"
        viewBox="0 0 80 24"
        fill="none"
        className="overflow-visible"
      >
        <motion.path
          d="M0 12 C20 12, 60 12, 80 12"
          stroke="rgba(27,139,77,0.3)"
          strokeWidth="1.5"
          strokeDasharray="4 4"
          // When reduced motion is preferred, show full path immediately
          initial={{ pathLength: shouldReduceMotion ? 1 : 0 }}
          whileInView={{ pathLength: 1 }}
          viewport={{ once: true, margin: '-100px' }}
          transition={
            shouldReduceMotion
              ? { duration: 0 }
              : { duration: 0.8, ease: 'easeInOut', delay: index * 0.15 + 0.3 }
          }
        />
        <motion.polygon
          points="76,8 80,12 76,16"
          fill="rgba(27,139,77,0.5)"
          initial={{ opacity: shouldReduceMotion ? 1 : 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={
            shouldReduceMotion
              ? { duration: 0 }
              : { delay: index * 0.15 + 1.1, duration: 0.2 }
          }
        />
      </svg>
    </div>
  );
}

// ─── Step Card ────────────────────────────────────────────────────────────────

function StepCard({ step, index }: { step: Step; index: number }) {
  const shouldReduceMotion = useReducedMotion();

  return (
    <motion.article
      className="flex flex-col"
      initial={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, y: 40 }}
      whileInView={shouldReduceMotion ? { opacity: 1 } : { opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-100px' }}
      transition={
        shouldReduceMotion
          ? { duration: 0.3 }
          : { duration: 0.5, ease: 'easeOut', delay: index * 0.15 }
      }
      aria-label={`Step ${step.number}: ${step.title}`}
    >
      {/* Step number circle */}
      <div
        className={cn(
          'w-12 h-12 rounded-full flex items-center justify-center mb-5',
          'bg-[var(--brand-green-subtle)] border border-[var(--brand-green-border)]',
          'text-[var(--brand-green)] font-bold text-lg'
        )}
        aria-hidden="true"
      >
        {step.number}
      </div>

      {/* Step image */}
      <div className="relative h-48 rounded-xl overflow-hidden mb-5 border border-[var(--surface-border)]">
        <Image
          src={step.image}
          alt={step.imageAlt}
          fill
          sizes="(max-width: 768px) 100vw, (max-width: 1024px) 50vw, 25vw"
          className="object-cover"
        />
        {/* Subtle green glow overlay */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              'radial-gradient(ellipse 60% 60% at 50% 50%, rgba(27,139,77,0.06), transparent)',
          }}
          aria-hidden="true"
        />
      </div>

      {/* Text */}
      <h3 className="text-xl font-semibold text-[var(--text-primary)]">
        {step.title}
      </h3>
      <p className="text-sm text-[var(--text-secondary)] mt-2 leading-[1.6]">
        {step.description}
      </p>
    </motion.article>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export interface HowItWorksProps {
  id?: string;
}

export function HowItWorks({ id }: HowItWorksProps) {
  return (
    <section
      id={id}
      className="py-24 lg:py-32 bg-[var(--bg-primary)]"
      aria-labelledby="how-it-works-heading"
    >
      <div className="max-w-7xl mx-auto px-6">

        {/* Section header */}
        <motion.div
          className="text-center mb-16"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-100px' }}
          transition={{ duration: 0.5 }}
        >
          <p className="text-xs font-semibold uppercase tracking-widest text-[var(--brand-green)] mb-3">
            HOW IT WORKS
          </p>
          <h2
            id="how-it-works-heading"
            className="text-3xl lg:text-4xl font-bold text-[var(--text-primary)]"
          >
            Your Family&apos;s Nutrition, Handled in 4 Steps
          </h2>
        </motion.div>

        {/* Desktop: 7-column custom grid (4 cards + 3 connectors) */}
        <div
          className="hidden lg:grid gap-0 items-start"
          style={{
            gridTemplateColumns: '1fr auto 1fr auto 1fr auto 1fr',
          }}
        >
          {STEPS.map((step, i) => (
            <div key={step.number} className="contents">
              <StepCard step={step} index={i} />
              {i < STEPS.length - 1 && (
                <StepConnector index={i} />
              )}
            </div>
          ))}
        </div>

        {/* Mobile / Tablet: Simple grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 lg:hidden">
          {STEPS.map((step, i) => (
            <StepCard key={step.number} step={step} index={i} />
          ))}
        </div>

      </div>
    </section>
  );
}
