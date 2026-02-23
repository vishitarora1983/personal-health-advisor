'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
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
  ChefHat,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Spinner } from '@/components/ui/LoadingSkeleton';
import { useProfile } from '@/lib/ProfileContext';
import { ROUTES } from '@/lib/routes';

/* ────────────────────────────────────────────
   Feature data — using dark design tokens
   ──────────────────────────────────────────── */

const features = [
  {
    icon: UtensilsCrossed,
    title: 'AI Meal Plans',
    description:
      'Receive a full 7-day meal plan crafted around your dietary preferences, allergies, and nutritional goals.',
    iconBg: 'var(--brand-amber-subtle)',
    iconColor: 'var(--brand-amber)',
    iconBorder: 'var(--brand-amber-subtle)',
  },
  {
    icon: ClipboardCheck,
    title: 'Nutrition Tracking',
    description:
      'Log meals effortlessly and watch your macro and calorie targets come into focus day by day.',
    iconBg: 'var(--brand-green-subtle)',
    iconColor: 'var(--brand-green-light)',
    iconBorder: 'var(--brand-green-border)',
  },
  {
    icon: ShoppingCart,
    title: 'Smart Grocery Lists',
    description:
      'Auto-generated shopping lists from your meal plan, organized by aisle so nothing gets missed.',
    iconBg: 'var(--color-info-bg)',
    iconColor: 'var(--color-info)',
    iconBorder: 'rgba(83, 155, 245, 0.20)',
  },
  {
    icon: BarChart3,
    title: 'Analytics Dashboard',
    description:
      'Visualize trends in your nutrition, adherence rates, and consistency scores over time.',
    iconBg: 'var(--color-error-bg)',
    iconColor: 'var(--color-error)',
    iconBorder: 'rgba(229, 83, 75, 0.20)',
  },
];

const quickNav = [
  {
    href: ROUTES.APP.MEAL_PLAN,
    icon: UtensilsCrossed,
    label: 'Meal Plan',
    desc: 'View weekly meals',
  },
  {
    href: ROUTES.APP.TRACKING,
    icon: ClipboardCheck,
    label: 'Tracking',
    desc: "Log today's meals",
  },
  {
    href: ROUTES.APP.GROCERY,
    icon: ShoppingCart,
    label: 'Grocery List',
    desc: 'Shopping items',
  },
  {
    href: ROUTES.APP.DASHBOARD,
    icon: BarChart3,
    label: 'Dashboard',
    desc: 'View analytics',
  },
];

/* ────────────────────────────────────────────
   App Home Page Component (authenticated)
   ──────────────────────────────────────────── */

export default function AppHomePage() {
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
          <p className="mt-4 text-sm text-[var(--text-muted)]">
            Loading your health advisor...
          </p>
        </div>
      </div>
    );
  }

  const hasProfile = profiles.length > 0 && activeProfile;
  const ctaHref = hasProfile ? ROUTES.APP.MEAL_PLAN : ROUTES.APP.PROFILE;
  const ctaLabel = hasProfile ? 'Go to Meal Plan' : 'Create Your Profile';

  return (
    <div className="relative min-h-[calc(100vh-6rem)] pb-12">
      {/* ══════════════════════════════════════
           HERO SECTION
         ══════════════════════════════════════ */}
      <section
        className={`relative text-center pt-8 pb-14 lg:pt-14 lg:pb-20 ${
          mounted ? 'animate-fade-in' : 'opacity-0'
        }`}
      >
        {/* Brand badge */}
        <div className="flex justify-center mb-6">
          <div
            className="inline-flex items-center gap-2.5 px-5 py-2.5 rounded-full animate-slide-down stagger-1 border border-[var(--brand-green-border)]"
            style={{ background: 'var(--brand-green-subtle)' }}
          >
            <div
              className="flex items-center justify-center w-7 h-7 rounded-[var(--radius-sm)]"
              style={{
                background: 'linear-gradient(135deg, var(--brand-green-dark), var(--brand-green))',
                boxShadow: '0 0 12px var(--brand-green-glow)',
              }}
            >
              <ChefHat className="w-3.5 h-3.5 text-white" />
            </div>
            <span className="type-overline text-[var(--brand-green-light)]">
              AI-Powered Wellness
            </span>
          </div>
        </div>

        {/* Main heading */}
        <h1
          className="text-4xl sm:text-5xl lg:text-6xl font-bold leading-tight mb-5 animate-slide-up stagger-2 text-[var(--text-primary)]"
          style={{ letterSpacing: '-0.025em' }}
        >
          Personal Health
          <br />
          <span className="text-gradient-green">Advisor</span>
        </h1>

        {/* Tagline */}
        <p
          className="text-base sm:text-lg max-w-xl mx-auto mb-10 animate-slide-up stagger-3 text-[var(--text-secondary)]"
          style={{ lineHeight: 1.7 }}
        >
          Intelligent meal planning tailored to your body, your goals, and your taste.
          Let AI handle the nutrition so you can focus on living well.
        </p>

        {/* CTA buttons */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 animate-slide-up stagger-4">
          <Button
            variant="primary"
            size="lg"
            onClick={() => router.push(ctaHref)}
          >
            {ctaLabel}
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>

          {!hasProfile && (
            <Button
              variant="ghost"
              size="lg"
              onClick={() => router.push(ROUTES.APP.PROFILE)}
            >
              <Sparkles className="h-4 w-4 mr-2" />
              See how it works
            </Button>
          )}
        </div>

        {/* Trust indicators */}
        <div className="flex items-center justify-center gap-6 mt-10 animate-fade-in stagger-5">
          {[
            { icon: Heart, text: 'Diet-Aware' },
            { icon: Zap, text: 'Instant Plans' },
            { icon: TrendingUp, text: 'Track Progress' },
          ].map((item) => (
            <div key={item.text} className="flex items-center gap-1.5">
              <item.icon className="h-3.5 w-3.5 text-[var(--brand-green-light)]" />
              <span className="text-xs font-medium text-[var(--text-muted)]">
                {item.text}
              </span>
            </div>
          ))}
        </div>
      </section>

      {/* ══════════════════════════════════════
           QUICK NAV — for logged in users
         ══════════════════════════════════════ */}
      {hasProfile && (
        <section className="mb-14 animate-slide-up stagger-3">
          <Card padding="lg" hover={false}>
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
              <div className="flex items-center gap-4">
                {/* Avatar */}
                <div
                  className="flex items-center justify-center w-12 h-12 rounded-[var(--radius-md)] text-lg font-bold shrink-0 text-white"
                  style={{
                    background: 'linear-gradient(135deg, var(--brand-green-dark), var(--brand-green))',
                    boxShadow: '0 0 16px var(--brand-green-glow)',
                  }}
                >
                  {activeProfile.name.charAt(0).toUpperCase()}
                </div>
                <div>
                  <p className="text-sm font-medium text-[var(--text-muted)]">
                    Welcome back,
                  </p>
                  <h2 className="type-h4 text-[var(--text-primary)]">
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
                  className="group flex flex-col items-start p-4 rounded-[var(--radius-md)] transition-all text-left border border-[var(--surface-border)] bg-[var(--surface-glass)] hover:bg-[var(--bg-hover)] hover:border-[var(--surface-border-hover)] hover:-translate-y-px"
                  style={{ transitionDuration: 'var(--duration-normal)' }}
                >
                  <div className="flex items-center justify-center w-10 h-10 rounded-[var(--radius-sm)] mb-3 bg-[var(--brand-green-subtle)]">
                    <item.icon className="h-5 w-5 text-[var(--brand-green-light)]" />
                  </div>
                  <span className="text-sm font-semibold text-[var(--text-primary)] mb-0.5">
                    {item.label}
                  </span>
                  <span className="text-xs text-[var(--text-muted)]">
                    {item.desc}
                  </span>
                  <ChevronRight
                    className="h-4 w-4 mt-2 text-[var(--brand-green-light)] transition-transform group-hover:translate-x-1"
                    style={{ transitionDuration: 'var(--duration-fast)' }}
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
          <p className="type-overline text-[var(--brand-amber)] mb-3 animate-fade-in stagger-4">
            Everything You Need
          </p>
          <h2
            className="text-2xl sm:text-3xl font-bold mb-3 animate-slide-up stagger-5 text-[var(--text-primary)]"
            style={{ letterSpacing: '-0.01em' }}
          >
            Designed for Your Wellbeing
          </h2>
          <div className="flex justify-center">
            <div className="accent-line-green w-16" />
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
                  className="flex items-center justify-center w-12 h-12 rounded-[var(--radius-md)] mb-5"
                  style={{
                    background: feature.iconBg,
                    border: `1px solid ${feature.iconBorder}`,
                  }}
                >
                  <Icon
                    className="h-5 w-5"
                    style={{ color: feature.iconColor }}
                  />
                </div>

                {/* Title */}
                <h3 className="type-h4 text-[var(--text-primary)] mb-2">
                  {feature.title}
                </h3>

                {/* Description */}
                <p className="text-sm leading-relaxed text-[var(--text-secondary)]">
                  {feature.description}
                </p>

                {/* Decorative bottom accent */}
                <div
                  className="mt-5 h-[2px] w-12 rounded-full"
                  style={{
                    background: `linear-gradient(90deg, ${feature.iconColor}, transparent)`,
                    opacity: 0.5,
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
          className="relative overflow-hidden rounded-[var(--radius-xl)] px-8 py-12 sm:px-12 text-center"
          style={{
            background: 'linear-gradient(145deg, var(--brand-green-dark) 0%, var(--brand-green) 50%, var(--brand-green-light) 100%)',
            boxShadow: 'var(--shadow-xl)',
          }}
        >
          {/* Noise texture */}
          <div className="texture-overlay absolute inset-0 pointer-events-none" />

          {/* Glow accents */}
          <div
            className="absolute top-0 right-0 w-64 h-64 pointer-events-none"
            style={{
              background: 'radial-gradient(circle, rgba(230, 146, 10, 0.15) 0%, transparent 65%)',
            }}
          />
          <div
            className="absolute bottom-0 left-0 w-48 h-48 pointer-events-none"
            style={{
              background: 'radial-gradient(circle, rgba(255, 255, 255, 0.05) 0%, transparent 65%)',
            }}
          />

          <div className="relative z-10">
            <h3
              className="text-2xl sm:text-3xl text-white font-bold mb-3"
              style={{ letterSpacing: '-0.02em' }}
            >
              {hasProfile
                ? 'Your plan is waiting'
                : 'Begin your wellness journey'
              }
            </h3>
            <p
              className="text-sm sm:text-base max-w-md mx-auto mb-8"
              style={{ color: 'rgba(255,255,255,0.75)', lineHeight: 1.7 }}
            >
              {hasProfile
                ? 'Explore your personalized meal plan, track your nutrition, and build healthier habits one meal at a time.'
                : 'Set up your profile in under two minutes and receive an AI-crafted meal plan customized to your needs.'
              }
            </p>
            <Button
              variant="secondary"
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
