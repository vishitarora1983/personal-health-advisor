'use client';

import Image from 'next/image';
import { motion, useReducedMotion } from 'framer-motion';
import { cn } from '@/lib/utils';

// ─── Types ────────────────────────────────────────────────────────────────────

interface CuisineCard {
  name: string;
  cuisine: string;
  image: string;
  imageAlt: string;
}

// ─── Data ─────────────────────────────────────────────────────────────────────

// SOURCE data (6 cards). Duplicated to create seamless loop.
const SOURCE_CARDS: CuisineCard[] = [
  {
    name: 'Butter Chicken',
    cuisine: 'Punjabi',
    image: '/images/landing/cuisine-punjabi.png',
    imageAlt: 'Rich creamy butter chicken served with naan — classic Punjabi cuisine',
  },
  {
    name: 'Masala Dosa',
    cuisine: 'South Indian',
    image: '/images/landing/cuisine-south-indian.png',
    imageAlt: 'Crispy masala dosa with sambar and chutneys — South Indian breakfast',
  },
  {
    name: 'Gujarati Thali',
    cuisine: 'Gujarati',
    image: '/images/landing/cuisine-gujarati.png',
    imageAlt: 'A colourful Gujarati thali with dal, sabzi, rotli, and khichdi',
  },
  {
    name: 'Macher Jhol',
    cuisine: 'Bengali',
    image: '/images/landing/cuisine-bengali.png',
    imageAlt: 'Macher jhol — Bengali fish curry with mustard and turmeric',
  },
  {
    name: 'Hyderabadi Biryani',
    cuisine: 'Hyderabadi',
    image: '/images/landing/cuisine-hyderabadi.png',
    imageAlt: 'Aromatic Hyderabadi dum biryani layered with saffron rice and meat',
  },
  {
    name: 'Appam & Stew',
    cuisine: 'Kerala',
    image: '/images/landing/cuisine-kerala.png',
    imageAlt: 'Soft appam with creamy coconut vegetable stew — Kerala breakfast',
  },
];

// Duplicated for seamless loop (-50% animation)
const MARQUEE_CARDS: CuisineCard[] = [...SOURCE_CARDS, ...SOURCE_CARDS];

const BADGE_NAMES = [
  'Punjabi', 'South Indian', 'Gujarati', 'Bengali', 'Marathi',
  'Rajasthani', 'Hyderabadi', 'Kerala', 'Chettinad', 'Mughlai',
  'Street Food', 'Healthy Fusion',
];

const MARQUEE_BADGES = [...BADGE_NAMES, ...BADGE_NAMES]; // 24 badges total

// ─── CuisineCardItem sub-component ───────────────────────────────────────────

function CuisineCardItem({ card }: { card: CuisineCard }) {
  return (
    <div
      className="relative flex-shrink-0 w-64 h-40 rounded-xl overflow-hidden border border-[var(--surface-border)]"
      aria-label={`${card.name} — ${card.cuisine} cuisine`}
    >
      {/* Cuisine photo */}
      <Image
        src={card.image}
        alt={card.imageAlt}
        fill
        sizes="256px"
        className="object-cover"
      />

      {/* Gradient overlay + text */}
      <div
        className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent"
        aria-hidden="true"
      />
      <div className="absolute bottom-0 left-0 right-0 p-4">
        <p className="text-white font-semibold text-sm leading-tight">{card.name}</p>
        <p className="text-[var(--brand-amber)] text-xs mt-0.5">{card.cuisine}</p>
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export interface CuisineMarqueeProps {
  id?: string;
}

export function CuisineMarquee({ id }: CuisineMarqueeProps) {
  const shouldReduceMotion = useReducedMotion();

  return (
    <section
      id={id}
      className="py-24 lg:py-32 overflow-hidden bg-[var(--bg-primary)]"
      aria-labelledby="cuisines-heading"
    >
      {/* Section header */}
      <motion.div
        className="max-w-7xl mx-auto px-6 text-center mb-16"
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: '-100px' }}
        transition={{ duration: 0.5 }}
      >
        <p className="text-xs font-semibold uppercase tracking-widest text-[var(--brand-green)] mb-3">
          CUISINES
        </p>
        <h2
          id="cuisines-heading"
          className="text-3xl lg:text-4xl font-bold text-[var(--text-primary)]"
        >
          From Chole Bhature to Masala Dosa
        </h2>
        <p className="text-[var(--text-secondary)] mt-3 text-lg">
          Every Cuisine, Every Kitchen
        </p>
      </motion.div>

      {/* ── TOP MARQUEE: Cuisine image cards (scrolls LEFT) ── */}
      <div
        className="relative group"
        aria-label="Cuisine images carousel"
        aria-live="off"
      >
        {/* Left fade edge */}
        <div
          className="absolute left-0 top-0 bottom-0 w-32 z-10 pointer-events-none bg-gradient-to-r from-[var(--bg-primary)] to-transparent"
          aria-hidden="true"
        />
        {/* Right fade edge */}
        <div
          className="absolute right-0 top-0 bottom-0 w-32 z-10 pointer-events-none bg-gradient-to-l from-[var(--bg-primary)] to-transparent"
          aria-hidden="true"
        />

        {/* Scrolling track — will-change: transform is appropriate here because
            the element is always in motion (continuous animation). */}
        <div
          className={cn(
            'flex gap-4',
            // When reduced motion is preferred, skip the scrolling animation
            shouldReduceMotion ? 'flex-wrap justify-center gap-6' : 'animate-marquee-left group-hover:[animation-play-state:paused] group-focus-within:[animation-play-state:paused]'
          )}
          style={{ width: shouldReduceMotion ? 'auto' : 'max-content', willChange: 'transform' }}
        >
          {/* Show all duplicated cards for seamless loop, or just the original set if reduced motion */}
          {(shouldReduceMotion ? SOURCE_CARDS : MARQUEE_CARDS).map((card, i) => (
            <CuisineCardItem
              key={`${card.name}-${i}`}
              card={card}
            />
          ))}
        </div>
      </div>

      {/* Gap between strips */}
      <div className="my-6" aria-hidden="true" />

      {/* ── BOTTOM MARQUEE: Text badges (scrolls RIGHT) ── */}
      <div
        className="relative group"
        aria-label="Cuisine types"
        aria-live="off"
      >
        {/* Edge fades */}
        <div
          className="absolute left-0 top-0 bottom-0 w-32 z-10 pointer-events-none bg-gradient-to-r from-[var(--bg-primary)] to-transparent"
          aria-hidden="true"
        />
        <div
          className="absolute right-0 top-0 bottom-0 w-32 z-10 pointer-events-none bg-gradient-to-l from-[var(--bg-primary)] to-transparent"
          aria-hidden="true"
        />

        {/* Scrolling track — will-change: transform is appropriate here because
            the element is always in motion (continuous animation). */}
        <div
          className={cn(
            'flex items-center gap-4',
            shouldReduceMotion ? 'flex-wrap justify-center' : 'animate-marquee-right group-hover:[animation-play-state:paused] group-focus-within:[animation-play-state:paused]'
          )}
          style={{ width: shouldReduceMotion ? 'auto' : 'max-content', willChange: 'transform' }}
        >
          {/* Show all duplicated badges for seamless loop, or just the original set if reduced motion */}
          {(shouldReduceMotion ? BADGE_NAMES : MARQUEE_BADGES).map((badge, i) => (
            <span
              key={`${badge}-${i}`}
              className={cn(
                'flex-shrink-0 px-4 py-2 rounded-full',
                'border border-white/10 bg-white/5',
                'text-[var(--text-secondary)] text-sm font-medium whitespace-nowrap'
              )}
              aria-hidden={i >= BADGE_NAMES.length ? true : undefined}
            >
              {badge}
            </span>
          ))}
        </div>
      </div>

    </section>
  );
}
