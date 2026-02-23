'use client';

import { useState } from 'react';
import Image from 'next/image';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, Users, ChefHat, ShoppingCart, BarChart3, CheckCircle2 } from 'lucide-react';
import { Swiper, SwiperSlide } from 'swiper/react';
import { Pagination } from 'swiper/modules';
import 'swiper/css';
import 'swiper/css/pagination';
import { cn } from '@/lib/utils';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Feature {
  id: string;
  title: string;
  shortDescription: string;
  fullDescription: string;
  bullets: string[];
  icon: React.ComponentType<{ className?: string }>;
  screenshot: string;
  screenshotAlt: string;
}

// ─── Data ─────────────────────────────────────────────────────────────────────

const FEATURES: Feature[] = [
  {
    id: 'meal-plans',
    title: 'AI Meal Plans',
    shortDescription: '7-day plans in 30 seconds. Swap any meal. Regenerate any day.',
    fullDescription:
      'Our AI generates a complete 7-day meal plan for every person in your household in under 30 seconds. Every meal respects individual dietary needs, allergy restrictions, and cuisine preferences — all from one shared kitchen.',
    bullets: [
      'Personalized to each family member',
      'One-click meal swaps',
      'Regenerate individual days',
      'Cuisine preferences respected',
    ],
    icon: Sparkles,
    screenshot: '/images/landing/screenshot-meal-plan.png',
    screenshotAlt: 'FedRight AI meal plan showing a 7-day weekly view with breakfast, lunch, dinner, and snack for each day',
  },
  {
    id: 'household-profiles',
    title: 'Household Profiles',
    shortDescription: 'Individual + joint profiles. Kids, adults, elderly — each gets what they need.',
    fullDescription:
      'Create rich profiles for every family member. Set age, weight, health goals, medical conditions (diabetes, hypertension, PCOD), allergies, and regional cuisine preferences. Joint profiles handle shared meals automatically.',
    bullets: [
      'Age-appropriate nutrition targets',
      'Medical condition awareness',
      'Allergy & restriction handling',
      'Joint household profiles',
    ],
    icon: Users,
    screenshot: '/images/landing/screenshot-profile.png',
    screenshotAlt: 'Household profile page showing a joint Vish+Meds profile with two family members',
  },
  {
    id: 'chefs-view',
    title: "Chef's View",
    shortDescription: 'One cooking grid for the whole family. See what to cook, for whom, and how much.',
    fullDescription:
      "The Chef's View is built for the family cook. See all meals for all family members in one grid. Scale portions per person, view kids' safe portions, and access any recipe with a single tap.",
    bullets: [
      'Multi-profile meal grid',
      'Portion scaling per person',
      'One-click recipe access',
      'Filter by meal type',
    ],
    icon: ChefHat,
    screenshot: '/images/landing/screenshot-chefs-view.png',
    screenshotAlt: "Chef's View grid showing all meals for the week organized by breakfast, lunch, and dinner with portions and calories",
  },
  {
    id: 'smart-grocery',
    title: 'Smart Grocery',
    shortDescription: 'Category-sorted, exportable to Excel. Check off items as you shop.',
    fullDescription:
      'FedRight generates your weekly grocery list automatically from the meal plan. Items are organized by category (vegetables, dairy, spices, proteins) so shopping is fast and logical. Export to Excel or check off on your phone.',
    bullets: [
      'Auto-generated from meal plan',
      'Organized by aisle/category',
      'Export to Excel (.xlsx)',
      'Check off while shopping',
    ],
    icon: ShoppingCart,
    screenshot: '/images/landing/screenshot-grocery.png',
    screenshotAlt: 'Smart grocery list page with auto-generated shopping items organized by category',
  },
  {
    id: 'nutrition-dashboard',
    title: 'Nutrition Dashboard',
    shortDescription: 'Calories, macros, adherence tracking, consistency scores.',
    fullDescription:
      "Track every family member's nutrition over time. Daily calorie and macro charts, meal adherence rates, and weekly consistency scores give you and your family a clear picture of your health journey.",
    bullets: [
      'Daily calorie trends',
      'Macro breakdown charts',
      'Meal adherence tracking',
      'Weekly consistency scores',
    ],
    icon: BarChart3,
    screenshot: '/images/landing/screenshot-dashboard.png',
    screenshotAlt: 'Nutrition dashboard showing calorie trends, macro breakdowns, and health analytics',
  },
];

// ─── Main Component ───────────────────────────────────────────────────────────

export interface FeatureShowcaseProps {
  id?: string;
}

export function FeatureShowcase({ id }: FeatureShowcaseProps) {
  const [activeFeatureId, setActiveFeatureId] = useState<string>(FEATURES[0].id);
  const activeFeature = FEATURES.find((f) => f.id === activeFeatureId)!;

  // Keyboard navigation for tab list (arrow keys)
  function handleTabKeyDown(e: React.KeyboardEvent, currentIndex: number) {
    if (e.key === 'ArrowDown' || e.key === 'ArrowRight') {
      e.preventDefault();
      const next = FEATURES[(currentIndex + 1) % FEATURES.length];
      setActiveFeatureId(next.id);
    } else if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') {
      e.preventDefault();
      const prev = FEATURES[(currentIndex - 1 + FEATURES.length) % FEATURES.length];
      setActiveFeatureId(prev.id);
    }
  }

  return (
    <section
      id={id}
      className="py-24 lg:py-32 bg-[var(--bg-secondary)]"
      aria-labelledby="features-heading"
    >
      <div className="max-w-7xl mx-auto px-6">

        {/* Section header */}
        <motion.div
          className="text-center mb-4"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-100px' }}
          transition={{ duration: 0.5 }}
        >
          <p className="text-xs font-semibold uppercase tracking-widest text-[var(--brand-green)] mb-3">
            FEATURES
          </p>
          <h2
            id="features-heading"
            className="text-3xl lg:text-4xl font-bold text-[var(--text-primary)]"
          >
            Everything Your Family Needs
          </h2>
          <p className="text-[var(--text-secondary)] mt-3 text-lg max-w-xl mx-auto">
            One platform. Every dietary need. Every family member.
          </p>
        </motion.div>

        {/* Desktop: Tab + Showcase layout */}
        <div className="hidden md:grid grid-cols-12 gap-8 mt-16">

          {/* ── LEFT: Feature Tabs ── */}
          <div
            className="col-span-4 flex flex-col relative"
            role="tablist"
            aria-label="Feature list"
            aria-orientation="vertical"
          >
            {FEATURES.map((feature, i) => {
              const isActive = feature.id === activeFeatureId;
              const Icon = feature.icon;
              return (
                <button
                  key={feature.id}
                  role="tab"
                  id={`tab-${feature.id}`}
                  aria-selected={isActive}
                  aria-controls={`panel-${feature.id}`}
                  tabIndex={isActive ? 0 : -1}
                  onClick={() => setActiveFeatureId(feature.id)}
                  onKeyDown={(e) => handleTabKeyDown(e, i)}
                  className={cn(
                    'relative flex items-start gap-4 px-6 py-5 rounded-xl text-left transition-all duration-200',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-green)]',
                    isActive
                      ? 'bg-[var(--bg-tertiary)] text-[var(--text-primary)]'
                      : 'bg-transparent text-[var(--text-muted)] hover:text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]'
                  )}
                >
                  {/* Active indicator line */}
                  {isActive && (
                    <motion.div
                      layoutId="activeTabIndicator"
                      className="absolute left-0 top-3 bottom-3 w-0.5 rounded-full bg-[var(--brand-green)]"
                      transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                    />
                  )}

                  {/* Icon */}
                  <div
                    className={cn(
                      'flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center mt-0.5',
                      isActive
                        ? 'bg-[var(--brand-green-subtle)] text-[var(--brand-green)]'
                        : 'bg-[var(--bg-tertiary)] text-[var(--text-muted)]'
                    )}
                    aria-hidden="true"
                  >
                    <Icon className="w-5 h-5" />
                  </div>

                  {/* Text */}
                  <div>
                    <p className="font-semibold text-sm">{feature.title}</p>
                    <p className="text-xs text-[var(--text-muted)] mt-1 leading-relaxed line-clamp-2">
                      {feature.shortDescription}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>

          {/* ── RIGHT: Feature Showcase Panel ── */}
          <div className="col-span-8">
            <AnimatePresence mode="wait">
              <motion.div
                key={activeFeatureId}
                role="tabpanel"
                id={`panel-${activeFeatureId}`}
                aria-labelledby={`tab-${activeFeatureId}`}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.25, ease: 'easeInOut' }}
                className="h-full flex flex-col gap-8"
              >
                {/* App screenshot */}
                <div
                  className={cn(
                    'relative rounded-2xl overflow-hidden bg-[var(--bg-primary)]',
                    'border border-[var(--surface-border)]',
                    'aspect-video'
                  )}
                >
                  <Image
                    src={activeFeature.screenshot}
                    alt={activeFeature.screenshotAlt}
                    fill
                    sizes="(max-width: 1280px) 66vw, 800px"
                    className="object-cover object-left-top"
                  />

                  {/* Subtle glow overlay */}
                  <div
                    className="absolute inset-0 pointer-events-none"
                    style={{
                      background:
                        'radial-gradient(ellipse 60% 60% at 50% 50%, rgba(27,139,77,0.04), transparent)',
                    }}
                    aria-hidden="true"
                  />
                </div>

                {/* Feature text content */}
                <div>
                  <h3 className="text-2xl font-bold text-[var(--text-primary)] mb-3">
                    {activeFeature.title}
                  </h3>
                  <p className="text-[var(--text-secondary)] leading-relaxed mb-6">
                    {activeFeature.fullDescription}
                  </p>

                  {/* Bullet list */}
                  <ul className="grid grid-cols-2 gap-3" role="list">
                    {activeFeature.bullets.map((bullet) => (
                      <li
                        key={bullet}
                        className="flex items-start gap-2 text-sm text-[var(--text-secondary)]"
                      >
                        <CheckCircle2
                          className="w-4 h-4 text-[var(--brand-green)] flex-shrink-0 mt-0.5"
                          aria-hidden="true"
                        />
                        {bullet}
                      </li>
                    ))}
                  </ul>
                </div>

              </motion.div>
            </AnimatePresence>
          </div>

        </div>

        {/* Mobile: Swiper carousel */}
        <div className="md:hidden mt-12">
          <Swiper
            slidesPerView={1.1}
            spaceBetween={16}
            centeredSlides={false}
            pagination={{ clickable: true }}
            modules={[Pagination]}
            className="!overflow-visible pb-10"
            aria-label="Features carousel"
          >
            {FEATURES.map((feature) => {
              const Icon = feature.icon;
              return (
                <SwiperSlide key={feature.id}>
                  <div
                    className={cn(
                      'rounded-2xl bg-[var(--bg-primary)] border border-[var(--surface-border)] p-6',
                      'flex flex-col gap-5'
                    )}
                  >
                    {/* Icon */}
                    <div className="w-12 h-12 rounded-xl bg-[var(--brand-green-subtle)] flex items-center justify-center">
                      <Icon className="w-6 h-6 text-[var(--brand-green)]" aria-hidden="true" />
                    </div>

                    {/* App screenshot */}
                    <div className="relative aspect-video rounded-xl overflow-hidden border border-[var(--surface-border)]">
                      <Image
                        src={feature.screenshot}
                        alt={feature.screenshotAlt}
                        fill
                        sizes="(max-width: 768px) 90vw, 50vw"
                        className="object-cover object-left-top"
                      />
                    </div>

                    {/* Text */}
                    <div>
                      <h3 className="font-bold text-[var(--text-primary)] mb-2">{feature.title}</h3>
                      <p className="text-sm text-[var(--text-secondary)]">{feature.shortDescription}</p>
                    </div>

                    {/* Bullets */}
                    <ul className="flex flex-col gap-2" role="list">
                      {feature.bullets.map((b) => (
                        <li key={b} className="flex items-center gap-2 text-xs text-[var(--text-secondary)]">
                          <CheckCircle2
                            className="w-3.5 h-3.5 text-[var(--brand-green)] flex-shrink-0"
                            aria-hidden="true"
                          />
                          {b}
                        </li>
                      ))}
                    </ul>
                  </div>
                </SwiperSlide>
              );
            })}
          </Swiper>
        </div>

      </div>
    </section>
  );
}
