'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import {
  motion,
  useScroll,
  useTransform,
  useReducedMotion,
} from 'framer-motion';
import { Sparkles, Play, Star } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ROUTES } from '@/lib/routes';

// ─── Floating Particles ───────────────────────────────────────────────────────

interface Particle {
  id: number;
  x: number;
  y: number;
  size: number;
  color: 'green' | 'amber';
  duration: number;
  delay: number;
}

function generateParticles(count: number): Particle[] {
  // Use deterministic values to avoid hydration mismatch
  return Array.from({ length: count }, (_, i) => ({
    id: i,
    x: (i * 37 + 13) % 100,
    y: (i * 53 + 7) % 100,
    size: 2 + (i % 3),
    color: i % 2 === 0 ? 'green' : 'amber',
    duration: 20 + (i % 20),
    delay: (i % 10),
  }));
}

// Trust strip avatars — colored initials used as placeholder
const TRUST_AVATARS = [
  { initials: 'PS', bg: 'bg-emerald-800' },
  { initials: 'RP', bg: 'bg-amber-800' },
  { initials: 'AI', bg: 'bg-blue-800' },
  { initials: 'VS', bg: 'bg-purple-800' },
];

export interface HeroProps {}

export function Hero({}: HeroProps) {
  const particles = useMemo(() => generateParticles(25), []);
  const shouldReduceMotion = useReducedMotion();
  const { scrollY } = useScroll();
  // Parallax: image container moves up 50px as user scrolls down 500px.
  // Disabled when user prefers reduced motion.
  const imageY = useTransform(scrollY, [0, 500], shouldReduceMotion ? [0, 0] : [0, -50]);

  return (
    <section
      className="relative min-h-screen flex items-center overflow-hidden bg-[var(--bg-primary)]"
      aria-label="Hero section"
    >
      {/* ── BACKGROUND LAYER ── */}
      <div className="absolute inset-0 z-0 pointer-events-none" aria-hidden="true">
        {/* Radial glow from top-left */}
        <div
          className="absolute inset-0"
          style={{
            background:
              'radial-gradient(ellipse 80% 50% at 30% 20%, rgba(27,139,77,0.08), transparent)',
          }}
        />
        {/* Secondary glow from bottom-right */}
        <div
          className="absolute inset-0"
          style={{
            background:
              'radial-gradient(ellipse 60% 50% at 80% 80%, rgba(230,146,10,0.05), transparent)',
          }}
        />

        {/* SVG noise filter */}
        <svg className="absolute w-0 h-0" aria-hidden="true">
          <defs>
            <filter id="noise-filter">
              <feTurbulence
                type="fractalNoise"
                baseFrequency="0.65"
                numOctaves="3"
                stitchTiles="stitch"
              />
              <feColorMatrix type="saturate" values="0" />
            </filter>
          </defs>
        </svg>
        <div
          className="absolute inset-0 opacity-[0.03]"
          style={{ filter: 'url(#noise-filter)' }}
        />

        {/* Floating particles — suppressed when reduced motion is preferred.
            willChange: 'transform' is intentionally omitted here: applying it
            on 25 simultaneous elements forces the browser to promote each into
            its own compositor layer, consuming significant GPU memory.
            The CSS `animation` property already triggers the browser's own
            heuristics to layer-promote elements when beneficial.              */}
        {!shouldReduceMotion && particles.map((p) => (
          <span
            key={p.id}
            className="absolute rounded-full"
            style={{
              left: `${p.x}%`,
              top: `${p.y}%`,
              width: `${p.size}px`,
              height: `${p.size}px`,
              backgroundColor: p.color === 'green' ? '#1B8B4D' : '#E6920A',
              animation: `particleFloat ${p.duration}s ${p.delay}s ease-in-out infinite`,
              opacity: 0.4,
            }}
          />
        ))}
      </div>

      {/* ── CONTENT GRID ── */}
      <div className="relative z-10 max-w-7xl mx-auto px-6 w-full py-24 lg:py-0">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center min-h-screen lg:min-h-0 lg:py-32">

          {/* ── LEFT: Text Content ── */}
          <motion.div
            className="lg:col-span-7 flex flex-col gap-8"
            initial="hidden"
            animate="visible"
            variants={{
              hidden: {},
              visible: { transition: { staggerChildren: 0.12 } },
            }}
          >
            {/* Eyebrow badge */}
            <motion.div
              variants={{
                hidden: { opacity: 0, y: 16 },
                visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: 'easeOut' } },
              }}
            >
              <span
                className={cn(
                  'inline-flex items-center gap-2',
                  'border border-[var(--brand-green-border)] bg-[var(--brand-green-subtle)]',
                  'rounded-full px-4 py-1.5',
                  'text-xs font-semibold uppercase tracking-widest text-[var(--brand-green-light)]'
                )}
              >
                <Sparkles className="w-3.5 h-3.5" aria-hidden="true" />
                AI-Powered Nutrition for Indian Families
              </span>
            </motion.div>

            {/* H1 — 3 animated lines */}
            <h1 className="flex flex-col gap-1">
              {['One Kitchen.', 'Every Body.', 'Perfectly Fed.'].map((line, i) => (
                <motion.span
                  key={line}
                  className={cn(
                    'block text-4xl lg:text-7xl font-extrabold leading-[1.1] tracking-tight',
                    i === 2
                      ? 'bg-gradient-to-r from-[var(--brand-amber)] to-[var(--brand-amber-light)] bg-clip-text text-transparent'
                      : 'text-[var(--text-primary)]'
                  )}
                  variants={{
                    hidden: { opacity: 0, y: 24 },
                    visible: {
                      opacity: 1,
                      y: 0,
                      transition: { duration: 0.6, ease: [0.16, 1, 0.3, 1] },
                    },
                  }}
                >
                  {line}
                </motion.span>
              ))}
            </h1>

            {/* Subtitle */}
            <motion.p
              className="text-lg lg:text-xl text-[var(--text-secondary)] max-w-xl leading-[1.7]"
              variants={{
                hidden: { opacity: 0, y: 16 },
                visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: 'easeOut' } },
              }}
            >
              The AI nutritionist that knows everyone in your household — from Nani&apos;s
              diabetes diet to your toddler&apos;s first foods. Personalized 7-day meal plans
              from one kitchen.
            </motion.p>

            {/* CTA Row */}
            <motion.div
              className="flex flex-col sm:flex-row gap-4"
              variants={{
                hidden: { opacity: 0, y: 16 },
                visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: 'easeOut' } },
              }}
            >
              {/* Primary CTA */}
              <Link
                href={ROUTES.PUBLIC.SIGNUP}
                className={cn(
                  'inline-flex justify-center items-center',
                  'bg-[var(--brand-green)] px-8 py-4 rounded-xl',
                  'text-white font-semibold text-lg',
                  'hover:bg-[var(--brand-green-light)]',
                  'transition-all duration-300',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-green)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--bg-primary)]',
                  'shadow-[0_0_0_0_rgba(27,139,77,0)] hover:shadow-[0_0_30px_rgba(27,139,77,0.35)]'
                )}
              >
                Start Your Free Plan
              </Link>

              {/* Secondary CTA */}
              <button
                className={cn(
                  'inline-flex justify-center items-center gap-2',
                  'border border-white/10 px-6 py-4 rounded-xl',
                  'text-[var(--text-secondary)] font-medium',
                  'hover:bg-white/5 hover:text-[var(--text-primary)]',
                  'transition-all duration-200',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-green)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--bg-primary)]'
                )}
                aria-label="Watch product demo video"
              >
                <Play className="w-4 h-4" aria-hidden="true" />
                Watch Demo
              </button>
            </motion.div>

            {/* Trust strip */}
            <motion.div
              className="flex items-center gap-3 mt-2 flex-wrap"
              variants={{
                hidden: { opacity: 0 },
                visible: { opacity: 1, transition: { duration: 0.4, delay: 0.1 } },
              }}
              aria-label="Social proof"
            >
              {/* Overlapping avatar circles (placeholder initials) */}
              <div className="flex items-center" aria-hidden="true">
                {TRUST_AVATARS.map((avatar, idx) => (
                  <div
                    key={avatar.initials}
                    className={cn(
                      'w-8 h-8 rounded-full border-2 border-[var(--bg-primary)] overflow-hidden flex items-center justify-center',
                      avatar.bg,
                      idx > 0 && '-ml-2'
                    )}
                    style={{ zIndex: TRUST_AVATARS.length - idx }}
                  >
                    <span className="text-[9px] font-bold text-white">{avatar.initials}</span>
                  </div>
                ))}
              </div>

              {/* Trust text */}
              <p className="text-sm text-[var(--text-muted)]">
                Trusted by{' '}
                <span className="text-[var(--text-secondary)] font-medium">500+ Indian families</span>
              </p>

              {/* Divider */}
              <span className="text-[var(--text-muted)]/30" aria-hidden="true">|</span>

              {/* Star rating */}
              <div
                className="flex items-center gap-1"
                role="img"
                aria-label="Rated 4.9 out of 5 stars"
              >
                {Array.from({ length: 5 }).map((_, i) => (
                  <Star
                    key={i}
                    className="w-3.5 h-3.5 fill-[var(--brand-amber)] text-[var(--brand-amber)]"
                    aria-hidden="true"
                  />
                ))}
                <span className="text-sm font-semibold text-[var(--text-secondary)] ml-1">4.9</span>
              </div>
            </motion.div>
          </motion.div>

          {/* ── RIGHT: Hero Image ── */}
          <div className="lg:col-span-5 relative order-first lg:order-last">
            {/* Glow ring behind image */}
            <div
              className="absolute -inset-4 rounded-3xl blur-3xl opacity-40 pointer-events-none"
              style={{
                background:
                  'linear-gradient(135deg, rgba(27,139,77,0.25), rgba(230,146,10,0.15))',
              }}
              aria-hidden="true"
            />

            {/* Parallax wrapper */}
            <motion.div style={{ y: imageY }} className="relative">
              <motion.div
                className="relative aspect-[4/5] rounded-2xl overflow-hidden shadow-2xl"
                initial={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.9 }}
                animate={shouldReduceMotion ? { opacity: 1 } : { opacity: 1, scale: 1 }}
                transition={{ duration: 0.8, ease: 'easeOut', delay: 0.3 }}
              >
                {/* Hero family image */}
                <Image
                  src="/images/landing/hero-family.png"
                  alt="Indian family enjoying a meal together at home"
                  fill
                  sizes="(max-width: 1024px) 100vw, 42vw"
                  className="object-cover"
                  priority
                />

                {/* Gradient overlay */}
                <div
                  className="absolute inset-0 bg-gradient-to-t from-[var(--bg-primary)]/60 via-transparent to-transparent"
                  aria-hidden="true"
                />

                {/* Floating feature card */}
                <div
                  className="absolute bottom-6 left-4 right-4 rounded-xl bg-[var(--bg-secondary)]/90 backdrop-blur-sm border border-[var(--surface-border)] p-3"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-[var(--brand-green-subtle)] border border-[var(--brand-green-border)] flex items-center justify-center flex-shrink-0">
                      <Sparkles className="w-4 h-4 text-[var(--brand-green)]" />
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-[var(--text-primary)]">7-day plan ready</p>
                      <p className="text-[10px] text-[var(--text-muted)]">Personalized for 4 members</p>
                    </div>
                    <div className="ml-auto">
                      <span className="text-xs font-semibold text-[var(--brand-green)]">✓ Done</span>
                    </div>
                  </div>
                </div>
              </motion.div>
            </motion.div>
          </div>
        </div>
      </div>

      {/* Scroll hint */}
      <motion.div
        className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.5, duration: 0.5 }}
        aria-hidden="true"
      >
        <span className="text-[var(--text-muted)] text-xs tracking-widest uppercase">Scroll</span>
        <div className="w-[1px] h-8 bg-gradient-to-b from-[var(--text-muted)] to-transparent animate-float" />
      </motion.div>
    </section>
  );
}
