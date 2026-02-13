'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Leaf,
  Sparkles,
  UtensilsCrossed,
  ClipboardCheck,
  ShoppingCart,
  BarChart3,
  ArrowRight,
  ChevronRight,
  User,
  Heart,
  TrendingUp,
  Zap,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Spinner } from '@/components/ui/LoadingSkeleton';
import { useProfile } from '@/lib/ProfileContext';

/* ────────────────────────────────────────────
   Feature data
   ──────────────────────────────────────────── */

const features = [
  {
    icon: UtensilsCrossed,
    title: 'AI Meal Plans',
    description:
      'Receive a full 7-day meal plan crafted around your dietary preferences, allergies, and nutritional goals.',
    accent: 'var(--color-amber)',
    accentBg: 'rgba(212, 148, 10, 0.08)',
    accentBorder: 'rgba(212, 148, 10, 0.15)',
    glowColor: 'rgba(212, 148, 10, 0.12)',
  },
  {
    icon: ClipboardCheck,
    title: 'Nutrition Tracking',
    description:
      'Log meals effortlessly and watch your macro and calorie targets come into focus day by day.',
    accent: 'var(--color-emerald)',
    accentBg: 'rgba(45, 90, 63, 0.08)',
    accentBorder: 'rgba(45, 90, 63, 0.15)',
    glowColor: 'rgba(45, 90, 63, 0.12)',
  },
  {
    icon: ShoppingCart,
    title: 'Smart Grocery Lists',
    description:
      'Auto-generated shopping lists from your meal plan, organized by aisle so nothing gets missed.',
    accent: 'var(--color-teal-soft)',
    accentBg: 'rgba(42, 138, 122, 0.08)',
    accentBorder: 'rgba(42, 138, 122, 0.15)',
    glowColor: 'rgba(42, 138, 122, 0.12)',
  },
  {
    icon: BarChart3,
    title: 'Analytics Dashboard',
    description:
      'Visualize trends in your nutrition, adherence rates, and consistency scores over time.',
    accent: 'var(--color-coral)',
    accentBg: 'rgba(212, 90, 58, 0.08)',
    accentBorder: 'rgba(212, 90, 58, 0.15)',
    glowColor: 'rgba(212, 90, 58, 0.12)',
  },
];

const quickNav = [
  {
    href: '/meal-plan',
    icon: UtensilsCrossed,
    label: 'Meal Plan',
    desc: 'View weekly meals',
  },
  {
    href: '/tracking',
    icon: ClipboardCheck,
    label: 'Tracking',
    desc: 'Log today\'s meals',
  },
  {
    href: '/grocery',
    icon: ShoppingCart,
    label: 'Grocery List',
    desc: 'Shopping items',
  },
  {
    href: '/dashboard',
    icon: BarChart3,
    label: 'Dashboard',
    desc: 'View analytics',
  },
];

/* ────────────────────────────────────────────
   Decorative botanical leaf SVG
   ──────────────────────────────────────────── */

function BotanicalLeaf({ className, style }: { className?: string; style?: React.CSSProperties }) {
  return (
    <svg
      viewBox="0 0 120 180"
      className={className}
      style={style}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M60 10 C20 50 10 100 30 150 C40 170 55 175 60 175 C65 175 80 170 90 150 C110 100 100 50 60 10Z"
        fill="currentColor"
        opacity="0.06"
      />
      <path
        d="M60 30 C60 80 60 130 60 170"
        stroke="currentColor"
        strokeWidth="1"
        opacity="0.08"
      />
      <path
        d="M60 60 C45 50 35 55 30 65"
        stroke="currentColor"
        strokeWidth="0.8"
        opacity="0.06"
      />
      <path
        d="M60 85 C75 75 85 80 90 90"
        stroke="currentColor"
        strokeWidth="0.8"
        opacity="0.06"
      />
      <path
        d="M60 110 C45 100 35 105 30 115"
        stroke="currentColor"
        strokeWidth="0.8"
        opacity="0.06"
      />
    </svg>
  );
}

/* ────────────────────────────────────────────
   Home Page Component
   ──────────────────────────────────────────── */

export default function HomePage() {
  const router = useRouter();
  const { activeProfile, profiles, loading } = useProfile();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <Spinner size="lg" />
          <p className="mt-4" style={{ color: 'var(--color-clay-muted)' }}>
            Loading your health advisor...
          </p>
        </div>
      </div>
    );
  }

  const hasProfile = profiles.length > 0 && activeProfile;
  const ctaHref = hasProfile ? '/meal-plan' : '/profile';
  const ctaLabel = hasProfile ? 'Go to Meal Plan' : 'Create Your Profile';

  return (
    <div className="relative min-h-[calc(100vh-6rem)] pb-12">
      {/* ── Decorative background elements ── */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none" aria-hidden="true">
        <BotanicalLeaf
          className="absolute -top-8 -right-6 w-48 h-72"
          style={{ color: 'var(--color-emerald)', transform: 'rotate(15deg)' }}
        />
        <BotanicalLeaf
          className="absolute bottom-20 -left-10 w-36 h-52"
          style={{ color: 'var(--color-sage)', transform: 'rotate(-25deg) scaleX(-1)' }}
        />
        {/* Warm amber glow */}
        <div
          className="absolute top-16 left-1/2 -translate-x-1/2 w-[600px] h-[300px] rounded-full"
          style={{
            background: 'radial-gradient(ellipse, rgba(212, 148, 10, 0.06) 0%, transparent 70%)',
          }}
        />
      </div>

      {/* ══════════════════════════════════════
           HERO SECTION
         ══════════════════════════════════════ */}
      <section
        className={`relative text-center pt-8 pb-14 lg:pt-14 lg:pb-20 ${
          mounted ? 'animate-fade-in' : 'opacity-0'
        }`}
      >
        {/* Icon badge */}
        <div className="flex justify-center mb-6">
          <div
            className="inline-flex items-center gap-2.5 px-5 py-2.5 rounded-full animate-slide-down stagger-1"
            style={{
              background: 'rgba(45, 90, 63, 0.06)',
              border: '1px solid rgba(45, 90, 63, 0.10)',
            }}
          >
            <div
              className="flex items-center justify-center w-7 h-7 rounded-lg"
              style={{
                background: 'linear-gradient(135deg, var(--color-amber), var(--color-amber-warm))',
                boxShadow: '0 0 12px rgba(212, 148, 10, 0.25)',
              }}
            >
              <Leaf className="w-3.5 h-3.5 text-white" />
            </div>
            <span
              className="text-xs font-semibold tracking-widest uppercase"
              style={{ color: 'var(--color-emerald)' }}
            >
              AI-Powered Wellness
            </span>
          </div>
        </div>

        {/* Main heading */}
        <h1
          className="text-4xl sm:text-5xl lg:text-6xl leading-tight mb-5 animate-slide-up stagger-2"
          style={{
            fontFamily: 'var(--font-display), serif',
            color: 'var(--color-emerald-deep)',
            letterSpacing: '-0.025em',
          }}
        >
          Personal Health
          <br />
          <span className="relative inline-block">
            Advisor
            {/* Decorative underline */}
            <span
              className="absolute -bottom-1 left-0 right-0 h-[3px] rounded-full"
              style={{
                background: 'linear-gradient(90deg, var(--color-amber), var(--color-amber-glow), transparent)',
              }}
            />
          </span>
        </h1>

        {/* Tagline */}
        <p
          className="text-base sm:text-lg max-w-xl mx-auto mb-10 animate-slide-up stagger-3"
          style={{
            color: 'var(--color-clay-muted)',
            lineHeight: 1.7,
          }}
        >
          Intelligent meal planning tailored to your body, your goals, and your taste.
          Let AI handle the nutrition so you can focus on living well.
        </p>

        {/* CTA buttons */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 animate-slide-up stagger-4">
          <Button
            size="lg"
            onClick={() => router.push(ctaHref)}
          >
            {ctaLabel}
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>

          {!hasProfile && (
            <button
              onClick={() => router.push('/profile')}
              className="inline-flex items-center gap-2 text-sm font-medium px-5 py-3.5 rounded-xl transition-all"
              style={{
                color: 'var(--color-emerald)',
                transitionDuration: 'var(--duration-normal)',
                transitionTimingFunction: 'var(--ease-out-expo)',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'rgba(45, 90, 63, 0.06)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'transparent';
              }}
            >
              <Sparkles className="h-4 w-4" />
              See how it works
            </button>
          )}
        </div>

        {/* Trust indicators */}
        <div
          className="flex items-center justify-center gap-6 mt-10 animate-fade-in stagger-5"
        >
          {[
            { icon: Heart, text: 'Diet-Aware' },
            { icon: Zap, text: 'Instant Plans' },
            { icon: TrendingUp, text: 'Track Progress' },
          ].map((item) => (
            <div
              key={item.text}
              className="flex items-center gap-1.5"
            >
              <item.icon
                className="h-3.5 w-3.5"
                style={{ color: 'var(--color-sage)' }}
              />
              <span
                className="text-xs font-medium"
                style={{ color: 'var(--color-clay-subtle)' }}
              >
                {item.text}
              </span>
            </div>
          ))}
        </div>
      </section>

      {/* ══════════════════════════════════════
           QUICK STATS — for logged in users
         ══════════════════════════════════════ */}
      {hasProfile && (
        <section className="mb-14 animate-slide-up stagger-3">
          <Card padding="lg" hover={false}>
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
              <div className="flex items-center gap-4">
                {/* Avatar */}
                <div
                  className="flex items-center justify-center w-12 h-12 rounded-xl text-lg font-bold shrink-0"
                  style={{
                    background: 'linear-gradient(135deg, var(--color-amber), var(--color-amber-warm))',
                    color: 'white',
                    boxShadow: '0 0 16px rgba(212, 148, 10, 0.2)',
                  }}
                >
                  {activeProfile.name.charAt(0).toUpperCase()}
                </div>
                <div>
                  <p
                    className="text-sm font-medium"
                    style={{ color: 'var(--color-clay-muted)' }}
                  >
                    Welcome back,
                  </p>
                  <h2
                    className="text-xl"
                    style={{
                      fontFamily: 'var(--font-display), serif',
                      color: 'var(--color-emerald-deep)',
                    }}
                  >
                    {activeProfile.name}
                  </h2>
                </div>
              </div>
              <Badge variant="success">
                <User className="h-3 w-3 mr-1" />
                Active Profile
              </Badge>
            </div>

            {/* Quick nav grid */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              {quickNav.map((item) => (
                <button
                  key={item.href}
                  onClick={() => router.push(item.href)}
                  className="group flex flex-col items-start p-4 rounded-xl transition-all text-left"
                  style={{
                    background: 'rgba(45, 90, 63, 0.03)',
                    border: '1px solid rgba(45, 90, 63, 0.06)',
                    transitionDuration: 'var(--duration-normal)',
                    transitionTimingFunction: 'var(--ease-out-expo)',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = 'rgba(45, 90, 63, 0.06)';
                    e.currentTarget.style.borderColor = 'rgba(45, 90, 63, 0.12)';
                    e.currentTarget.style.boxShadow = 'var(--shadow-md)';
                    e.currentTarget.style.transform = 'translateY(-2px)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'rgba(45, 90, 63, 0.03)';
                    e.currentTarget.style.borderColor = 'rgba(45, 90, 63, 0.06)';
                    e.currentTarget.style.boxShadow = 'none';
                    e.currentTarget.style.transform = 'translateY(0)';
                  }}
                >
                  <div
                    className="flex items-center justify-center w-10 h-10 rounded-lg mb-3 transition-all"
                    style={{
                      background: 'rgba(45, 90, 63, 0.08)',
                      transitionDuration: 'var(--duration-normal)',
                    }}
                  >
                    <item.icon
                      className="h-5 w-5"
                      style={{ color: 'var(--color-emerald)' }}
                    />
                  </div>
                  <span
                    className="text-sm font-semibold mb-0.5"
                    style={{ color: 'var(--color-emerald-deep)' }}
                  >
                    {item.label}
                  </span>
                  <span
                    className="text-xs"
                    style={{ color: 'var(--color-clay-muted)' }}
                  >
                    {item.desc}
                  </span>
                  <ChevronRight
                    className="h-4 w-4 mt-2 transition-transform group-hover:translate-x-1"
                    style={{
                      color: 'var(--color-sage)',
                      transitionDuration: 'var(--duration-fast)',
                    }}
                  />
                </button>
              ))}
            </div>
          </Card>
        </section>
      )}

      {/* ══════════════════════════════════════
           FEATURES SECTION
         ══════════════════════════════════════ */}
      <section className="relative">
        {/* Section header */}
        <div className="text-center mb-10">
          <p
            className="text-xs font-semibold tracking-widest uppercase mb-3 animate-fade-in stagger-4"
            style={{ color: 'var(--color-amber)' }}
          >
            Everything You Need
          </p>
          <h2
            className="text-2xl sm:text-3xl mb-3 animate-slide-up stagger-5"
            style={{
              fontFamily: 'var(--font-display), serif',
              color: 'var(--color-emerald-deep)',
            }}
          >
            Designed for Your Wellbeing
          </h2>
          <div className="flex justify-center">
            <div
              className="w-16 h-[3px] rounded-full"
              style={{
                background: 'linear-gradient(90deg, var(--color-amber), var(--color-amber-warm))',
              }}
            />
          </div>
        </div>

        {/* Feature cards grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          {features.map((feature, index) => {
            const Icon = feature.icon;
            return (
              <Card
                key={feature.title}
                padding="lg"
                hover
                className={`animate-slide-up stagger-${index + 3}`}
              >
                {/* Icon container */}
                <div
                  className="flex items-center justify-center w-12 h-12 rounded-xl mb-5"
                  style={{
                    background: feature.accentBg,
                    border: `1px solid ${feature.accentBorder}`,
                    boxShadow: `0 0 20px ${feature.glowColor}`,
                  }}
                >
                  <Icon
                    className="h-5 w-5"
                    style={{ color: feature.accent }}
                  />
                </div>

                {/* Title */}
                <h3
                  className="text-lg font-semibold mb-2"
                  style={{
                    fontFamily: 'var(--font-display), serif',
                    color: 'var(--color-emerald-deep)',
                  }}
                >
                  {feature.title}
                </h3>

                {/* Description */}
                <p
                  className="text-sm leading-relaxed"
                  style={{ color: 'var(--color-clay-muted)' }}
                >
                  {feature.description}
                </p>

                {/* Decorative bottom accent */}
                <div
                  className="mt-5 h-[2px] w-12 rounded-full"
                  style={{
                    background: `linear-gradient(90deg, ${feature.accent}, transparent)`,
                    opacity: 0.4,
                  }}
                />
              </Card>
            );
          })}
        </div>
      </section>

      {/* ══════════════════════════════════════
           BOTTOM CTA SECTION
         ══════════════════════════════════════ */}
      <section className="mt-16 animate-fade-in stagger-6">
        <div
          className="relative overflow-hidden rounded-2xl px-8 py-12 sm:px-12 text-center"
          style={{
            background: 'linear-gradient(145deg, var(--color-emerald-deep) 0%, var(--color-emerald) 50%, var(--color-emerald-light) 100%)',
            boxShadow: 'var(--shadow-xl)',
          }}
        >
          {/* Noise texture */}
          <div className="texture-overlay absolute inset-0 pointer-events-none" />

          {/* Glow accents */}
          <div
            className="absolute top-0 right-0 w-64 h-64 pointer-events-none"
            style={{
              background: 'radial-gradient(circle, rgba(212, 148, 10, 0.15) 0%, transparent 65%)',
            }}
          />
          <div
            className="absolute bottom-0 left-0 w-48 h-48 pointer-events-none"
            style={{
              background: 'radial-gradient(circle, rgba(168, 197, 176, 0.10) 0%, transparent 65%)',
            }}
          />

          <div className="relative z-10">
            <h3
              className="text-2xl sm:text-3xl text-white mb-3"
              style={{
                fontFamily: 'var(--font-display), serif',
                letterSpacing: '-0.02em',
              }}
            >
              {hasProfile
                ? 'Your plan is waiting'
                : 'Begin your wellness journey'
              }
            </h3>
            <p
              className="text-sm sm:text-base max-w-md mx-auto mb-8"
              style={{
                color: 'rgba(168, 197, 176, 0.8)',
                lineHeight: 1.7,
              }}
            >
              {hasProfile
                ? 'Explore your personalized meal plan, track your nutrition, and build healthier habits one meal at a time.'
                : 'Set up your profile in under two minutes and receive an AI-crafted meal plan customized to your needs.'
              }
            </p>
            <Button
              size="lg"
              onClick={() => router.push(ctaHref)}
            >
              {ctaLabel}
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
}
