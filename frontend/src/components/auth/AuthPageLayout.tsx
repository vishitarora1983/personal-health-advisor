'use client';

// frontend/src/components/auth/AuthPageLayout.tsx
//
// Shared split-panel layout for /login and /signup pages.
//
// Desktop (≥ lg): Two columns — left branded hero panel (50%), right form (50%).
// Mobile (< lg):  Single column — form only, hero panel is hidden.
//
// The form content is passed as children rendered inside the right panel.
// Hero content (tagline, quote) is passed as heroContent prop to allow
// login and signup to customize the left panel independently.

import React from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { Leaf } from 'lucide-react';

interface HeroContent {
  heading: React.ReactNode;
  subtitle: string;
  quoteText: string;
  quoteCite: string;
}

interface AuthPageLayoutProps {
  children: React.ReactNode;
  heroContent: HeroContent;
}

// framer-motion variants for the hero panel (slides in from left)
const heroPanelVariants = {
  hidden: { opacity: 0, x: -24 },
  visible: {
    opacity: 1,
    x: 0,
    transition: { duration: 0.6, ease: [0.16, 1, 0.3, 1] as const },
  },
};

export function AuthPageLayout({ children, heroContent }: AuthPageLayoutProps) {
  // Respect the OS-level "Reduce Motion" accessibility setting. When enabled,
  // skip all entrance animations so users sensitive to motion are not affected.
  const shouldReduceMotion = useReducedMotion();

  return (
    <div
      className="min-h-screen grid grid-cols-1 lg:grid-cols-2"
      style={{ backgroundColor: 'var(--bg-primary)' }}
    >
      {/* ── Left: Hero Panel (desktop only) ─────────────────────────── */}
      <motion.div
        className="hidden lg:block relative overflow-hidden"
        variants={heroPanelVariants}
        initial={shouldReduceMotion ? false : 'hidden'}
        animate="visible"
      >
        {/* Background gradient — represents food/nature theme without an image */}
        <div
          className="absolute inset-0"
          style={{
            background: `
              linear-gradient(135deg,
                rgba(11, 13, 15, 0.95) 0%,
                rgba(18, 21, 26, 0.80) 40%,
                rgba(27, 139, 77, 0.18) 100%
              ),
              radial-gradient(ellipse 80% 60% at 30% 70%, rgba(27, 139, 77, 0.12), transparent),
              radial-gradient(ellipse 50% 80% at 80% 20%, rgba(230, 146, 10, 0.06), transparent)
            `,
            backgroundColor: 'var(--bg-secondary)',
          }}
        />

        {/* Decorative mesh overlay */}
        <div
          className="absolute inset-0 opacity-30"
          style={{
            backgroundImage: `
              repeating-linear-gradient(
                45deg,
                transparent,
                transparent 40px,
                rgba(27, 139, 77, 0.04) 40px,
                rgba(27, 139, 77, 0.04) 41px
              )
            `,
          }}
        />

        {/* Decorative glow orbs */}
        <div
          className="absolute top-1/3 right-8 w-48 h-48 rounded-full blur-3xl pointer-events-none"
          style={{ background: 'radial-gradient(circle, rgba(27, 139, 77, 0.15), transparent 70%)' }}
        />
        <div
          className="absolute bottom-1/4 left-8 w-32 h-32 rounded-full blur-2xl pointer-events-none"
          style={{ background: 'radial-gradient(circle, rgba(230, 146, 10, 0.10), transparent 70%)' }}
        />

        {/* Hero content (z-20 ensures it sits above all overlays) */}
        <div className="relative z-20 flex flex-col justify-between h-full p-10">

          {/* Top: FedRight logo lockup */}
          <div className="flex items-center gap-3">
            <div
              className="flex items-center justify-center w-9 h-9 rounded-xl flex-shrink-0"
              style={{
                background: 'linear-gradient(135deg, var(--brand-green-dark), var(--brand-green))',
                boxShadow: '0 4px 16px var(--brand-green-glow)',
              }}
            >
              <Leaf className="w-5 h-5" style={{ color: 'var(--text-primary)' }} />
            </div>
            <span
              className="font-bold text-lg tracking-tight"
              style={{ color: 'var(--text-primary)' }}
            >
              FedRight
            </span>
          </div>

          {/* Middle: Tagline + subtitle */}
          <div className="flex-1 flex flex-col justify-center py-10">
            <h1
              className="type-h2 mb-4 max-w-xs"
              style={{ color: 'var(--text-primary)', lineHeight: '1.15' }}
            >
              {heroContent.heading}
            </h1>
            <p
              className="text-sm leading-relaxed max-w-xs"
              style={{ color: 'var(--text-secondary)' }}
            >
              {heroContent.subtitle}
            </p>

            {/* Decorative green pill tags */}
            <div className="flex flex-wrap gap-2 mt-8">
              {['AI-Powered', 'Family-Aware', 'Indian Cuisine', 'Nutrition-First'].map((tag) => (
                <span
                  key={tag}
                  className="text-xs font-medium px-3 py-1.5 rounded-full"
                  style={{
                    background: 'var(--brand-green-subtle)',
                    color: 'var(--brand-green-light)',
                    border: '1px solid var(--brand-green-border)',
                  }}
                >
                  {tag}
                </span>
              ))}
            </div>
          </div>

          {/* Bottom: Testimonial quote */}
          <blockquote
            className="border-l-2 pl-4"
            style={{ borderColor: 'var(--brand-green)' }}
          >
            <p
              className="text-sm italic leading-relaxed"
              style={{ color: 'var(--text-secondary)' }}
            >
              &ldquo;{heroContent.quoteText}&rdquo;
            </p>
            <cite
              className="text-xs mt-2 block not-italic"
              style={{ color: 'var(--text-muted)' }}
            >
              {heroContent.quoteCite}
            </cite>
          </blockquote>
        </div>
      </motion.div>

      {/* ── Right: Form Panel ────────────────────────────────────────── */}
      <div
        className="flex flex-col items-center justify-center px-6 py-12 lg:py-0 min-h-screen lg:min-h-0"
        style={{ backgroundColor: 'var(--bg-primary)' }}
      >
        <div className="w-full max-w-md">
          {/* Mobile-only logo (hidden on desktop where hero panel shows it) */}
          <div
            className="flex items-center gap-2.5 mb-8 lg:hidden"
          >
            <div
              className="flex items-center justify-center w-8 h-8 rounded-lg flex-shrink-0"
              style={{
                background: 'linear-gradient(135deg, var(--brand-green-dark), var(--brand-green))',
                boxShadow: '0 4px 12px var(--brand-green-glow)',
              }}
            >
              <Leaf className="w-4 h-4" style={{ color: 'var(--text-primary)' }} />
            </div>
            <span
              className="font-bold text-base tracking-tight"
              style={{ color: 'var(--text-primary)' }}
            >
              FedRight
            </span>
          </div>

          {/* Form content from children */}
          {children}
        </div>
      </div>
    </div>
  );
}
