# FedRight — Landing Page Implementation Spec
## File: `02-landing-page-sections.md`

**Document Status:** Ready for Development
**Last Updated:** 2026-02-20
**Target:** `/` (public landing page, no auth required)
**Tagline:** "One Kitchen. Every Body. Perfectly Fed."

---

## Table of Contents

1. [Design System & Tokens](#design-system--tokens)
2. [Global Setup — `app/page.tsx`](#global-setup--appapagetsx)
3. [SmoothScroll Provider](#smoothscroll-provider)
4. [Section 1 — Navbar](#section-1--navbar)
5. [Section 2 — Hero](#section-2--hero)
6. [Section 3 — Problem Statement](#section-3--problem-statement)
7. [Section 4 — How It Works](#section-4--how-it-works)
8. [Section 5 — Feature Showcase](#section-5--feature-showcase)
9. [Section 6 — Cuisine Marquee](#section-6--cuisine-marquee)
10. [Section 7 — AI Difference](#section-7--ai-difference)
11. [Section 8 — Testimonials](#section-8--testimonials)
12. [Section 9 — Final CTA](#section-9--final-cta)
13. [Section 10 — Footer](#section-10--footer)
14. [Shared Sub-Components](#shared-sub-components)
15. [CSS Additions Required in `globals.css`](#css-additions-required-in-globalscss)
16. [Dependencies Checklist](#dependencies-checklist)

---

## Design System & Tokens

All color tokens, typography, and spacing values used throughout this document. These must be registered in `tailwind.config.ts` (or the CSS custom properties layer in Tailwind v4) before development begins.

### Color Tokens

```typescript
// tailwind.config.ts — extend.colors
{
  "brand-green": "#1B8B4D",
  "brand-green-light": "#22A85E",
  "brand-green-subtle": "rgba(27,139,77,0.08)",
  "brand-green-glow": "rgba(27,139,77,0.25)",
  "brand-amber": "#E6920A",
  "brand-amber-light": "#F0A420",
  "bg-primary": "#0A0A0B",
  "bg-secondary": "#111113",
  "bg-tertiary": "#1A1A1C",
  "bg-hover": "rgba(255,255,255,0.04)",
  "surface-border": "rgba(255,255,255,0.07)",
  "text-primary": "#F0F0F2",
  "text-secondary": "#9A9AA8",
  "text-muted": "#5C5C6B",
}
```

### Box Shadow Tokens

```typescript
// tailwind.config.ts — extend.boxShadow
{
  "glow-green": "0 0 30px rgba(27,139,77,0.35), 0 0 60px rgba(27,139,77,0.15)",
  "glow-amber": "0 0 30px rgba(230,146,10,0.35)",
  "card": "0 4px 24px rgba(0,0,0,0.4)",
}
```

### Typography

- **Font Family:** Inter (Google Fonts, loaded via `next/font/google`)
- **Weights used:** 400 (regular), 500 (medium), 600 (semibold), 700 (bold), 800 (extrabold)
- **Base font size:** 16px
- **Line heights:** 1.5 (body), 1.2 (headings), 1.7 (descriptive text)

### Breakpoints (Tailwind defaults, confirmed)

| Token | Width     | Usage                        |
|-------|-----------|------------------------------|
| `sm`  | 640px     | Minor layout adjustments     |
| `md`  | 768px     | Tablet pivot point           |
| `lg`  | 1024px    | Desktop layout trigger       |
| `xl`  | 1280px    | Max content width            |
| `2xl` | 1536px    | Wide screen compensation     |

### Z-Index Scale

```
z-0   — Background decorative elements
z-10  — Edge fade overlays (marquee, etc.)
z-20  — Section content
z-50  — Navbar (fixed)
z-100 — Mobile drawer overlay
```

---

## Global Setup — `app/page.tsx`

**File path:** `frontend/src/app/page.tsx`

This is the root public landing page. It must NOT render the app's main Sidebar or any authenticated layout wrapper.

### Metadata Export

```typescript
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'FedRight — One Kitchen. Every Body. Perfectly Fed.',
  description:
    'FedRight is the AI-powered household meal planner for Indian families. '
    + 'Personalized 7-day meal plans, smart grocery lists, and nutrition tracking '
    + 'for every family member — from Nani\'s diabetes diet to your toddler\'s first foods.',
  keywords: [
    'Indian meal planning',
    'AI nutrition',
    'family meal planner',
    'Indian diet plan',
    'household nutrition',
    'personalized meal plan India',
    'healthy Indian recipes',
  ],
  openGraph: {
    title: 'FedRight — One Kitchen. Every Body. Perfectly Fed.',
    description: 'AI-powered meal planning for Indian families.',
    images: [{ url: '/images/landing/og-image.png', width: 1200, height: 630 }],
  },
};
```

### JSX Structure

```tsx
// frontend/src/app/page.tsx
import { SmoothScroll } from '@/components/landing/SmoothScroll';
import { Navbar } from '@/components/landing/Navbar';
import { Hero } from '@/components/landing/Hero';
import { ProblemStatement } from '@/components/landing/ProblemStatement';
import { HowItWorks } from '@/components/landing/HowItWorks';
import { FeatureShowcase } from '@/components/landing/FeatureShowcase';
import { CuisineMarquee } from '@/components/landing/CuisineMarquee';
import { AIDifference } from '@/components/landing/AIDifference';
import { Testimonials } from '@/components/landing/Testimonials';
import { FinalCTA } from '@/components/landing/FinalCTA';
import { Footer } from '@/components/landing/Footer';

export default function LandingPage() {
  return (
    <>
      {/*
        Navbar is rendered OUTSIDE SmoothScroll because:
        1. It is fixed-position (does not scroll with page).
        2. Lenis scroll events would interfere with its scroll detection if nested.
      */}
      <Navbar />

      {/*
        SmoothScroll wraps all scrollable content.
        It initialises Lenis and forwards scroll events to framer-motion's
        global scroll value so useScroll() hooks work correctly.
      */}
      <SmoothScroll>
        <main className="bg-bg-primary text-text-primary overflow-x-hidden">
          {/* Each section receives its scroll-target id directly */}
          <Hero />
          <ProblemStatement id="problem" />
          <HowItWorks id="how-it-works" />
          <FeatureShowcase id="features" />
          <CuisineMarquee id="cuisines" />
          <AIDifference id="difference" />
          <Testimonials id="testimonials" />
          <FinalCTA id="cta" />
          <Footer />
        </main>
      </SmoothScroll>
    </>
  );
}
```

**Critical notes:**
- Do NOT wrap this page in any layout that renders `<Sidebar />` or `<AuthGuard />`.
- The root `layout.tsx` must conditionally omit the sidebar for the `/` route, OR this page must use a separate layout segment (e.g., `app/(landing)/page.tsx` with its own `layout.tsx` that has no sidebar).
- Preferred approach: create `app/(landing)/layout.tsx` with just font and metadata. Move `page.tsx` there. Existing app routes stay in `app/(app)/` segment.

---

## SmoothScroll Provider

**File path:** `frontend/src/components/landing/SmoothScroll.tsx`

This component bootstraps Lenis smooth scrolling and bridges it to framer-motion so that `useScroll()` hooks throughout the landing page receive smooth scroll values rather than native scroll jumps.

### Props Interface

```typescript
interface SmoothScrollProps {
  children: React.ReactNode;
}
```

### Implementation

```tsx
'use client';

import { useEffect, useRef } from 'react';
import Lenis from 'lenis';
import { useMotionValue } from 'framer-motion';

export function SmoothScroll({ children }: SmoothScrollProps) {
  const lenisRef = useRef<Lenis | null>(null);

  useEffect(() => {
    const lenis = new Lenis({
      duration: 1.2,          // Scroll animation duration multiplier
      easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)), // Expo ease-out
      orientation: 'vertical',
      smoothWheel: true,
      touchMultiplier: 2,     // Increase touch scroll speed on mobile
    });

    lenisRef.current = lenis;

    /*
      Bridge Lenis scroll events to framer-motion's global scroll.
      This ensures useScroll({ target }) returns smooth (interpolated)
      scroll progress values that match the visual scroll position.
    */
    lenis.on('scroll', () => {
      // framer-motion reads window.scrollY; Lenis updates it.
      // No explicit bridge needed for framer-motion >=10.18 — Lenis
      // dispatches synthetic scroll events that framer-motion picks up.
    });

    // RAF loop — must be cancelled on cleanup to prevent memory leaks.
    let rafId: number;
    function raf(time: number) {
      lenis.raf(time);
      rafId = requestAnimationFrame(raf);
    }
    rafId = requestAnimationFrame(raf);

    return () => {
      cancelAnimationFrame(rafId);
      lenis.destroy();
    };
  }, []);

  return <>{children}</>;
}
```

**Dependency:** `npm install lenis` (package name is `lenis`, not `@studio-freight/lenis` — confirm current package name before installing).

---

## Section 1 — Navbar

**File path:** `frontend/src/components/landing/Navbar.tsx`

### Props Interface

```typescript
// Navbar takes no external props — all state is internal.
// Exported as a named export.
export interface NavbarProps {}
```

### Internal State & Hooks

```typescript
const [isScrolled, setIsScrolled] = useState(false);
const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
const { scrollY } = useScroll(); // framer-motion

// Toggle glassmorphic style at 80px scroll threshold.
useMotionValueEvent(scrollY, 'change', (latest) => {
  setIsScrolled(latest > 80);
});
```

### Nav Links Data

```typescript
const NAV_LINKS: { label: string; sectionId: string }[] = [
  { label: 'Features',      sectionId: 'features'     },
  { label: 'How It Works',  sectionId: 'how-it-works' },
  { label: 'Cuisines',      sectionId: 'cuisines'     },
  { label: 'Testimonials',  sectionId: 'testimonials' },
];
```

### Smooth Scroll Helper

```typescript
// Utility to be defined in the component or a shared scroll utils file.
function scrollToSection(sectionId: string): void {
  const el = document.getElementById(sectionId);
  if (!el) return;
  // Uses native smooth scroll; Lenis intercepts and applies its easing.
  el.scrollIntoView({ behavior: 'smooth' });
}
```

### JSX Structure

```tsx
<motion.header
  className={cn(
    // Base styles — always present
    'fixed top-0 left-0 right-0 z-50 transition-all duration-300',
    // Scrolled state — glassmorphic
    isScrolled
      ? 'backdrop-blur-xl bg-black/60 border-b border-white/[0.06]'
      : 'bg-transparent'
  )}
>
  <nav
    className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between"
    aria-label="Primary navigation"
  >

    {/* ── LEFT: Logo + Brand Name ── */}
    <Link href="/" className="flex items-center gap-3 flex-shrink-0">
      <Image
        src="/fedright-logo-gemini-v2.png"
        alt="FedRight logo"
        width={40}
        height={40}
        priority
        className="rounded-lg"
      />
      <span className="text-xl font-bold text-text-primary tracking-tight">
        FedRight
      </span>
    </Link>

    {/* ── CENTER: Desktop Nav Links (hidden on mobile/tablet) ── */}
    <ul
      className="hidden md:flex items-center gap-8 list-none"
      role="list"
    >
      {NAV_LINKS.map(({ label, sectionId }) => (
        <li key={sectionId}>
          <button
            onClick={() => scrollToSection(sectionId)}
            className={cn(
              'text-sm font-medium text-text-secondary',
              'hover:text-text-primary transition-colors duration-200',
              'focus-visible:outline-none focus-visible:ring-2',
              'focus-visible:ring-brand-green focus-visible:rounded-sm'
            )}
          >
            {label}
          </button>
        </li>
      ))}
    </ul>

    {/* ── RIGHT: CTA Buttons (desktop) + Hamburger (mobile) ── */}
    <div className="flex items-center gap-3">

      {/* Log In — desktop only */}
      <Link
        href="/login"
        className={cn(
          'hidden md:inline-flex items-center px-4 py-2 rounded-lg',
          'text-sm font-medium text-white',
          'border border-white/10',
          'hover:bg-white/5 transition-colors duration-200',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-green'
        )}
      >
        Log In
      </Link>

      {/* Get Started Free — desktop only */}
      <Link
        href="/signup"
        className={cn(
          'hidden md:inline-flex items-center px-5 py-2 rounded-lg',
          'text-sm font-semibold text-white bg-brand-green',
          'hover:bg-brand-green-light hover:shadow-glow-green',
          'transition-all duration-300',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-green'
        )}
      >
        Get Started Free
      </Link>

      {/* Hamburger — mobile only */}
      <button
        onClick={() => setIsMobileMenuOpen(true)}
        className={cn(
          'md:hidden flex flex-col justify-center items-center gap-1.5 w-10 h-10',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-green rounded-md'
        )}
        aria-label="Open navigation menu"
        aria-expanded={isMobileMenuOpen}
        aria-controls="mobile-nav-drawer"
      >
        <span className="w-5 h-0.5 bg-text-primary rounded-full" />
        <span className="w-5 h-0.5 bg-text-primary rounded-full" />
        <span className="w-3 h-0.5 bg-text-primary rounded-full self-start" />
      </button>

    </div>
  </nav>

  {/* ── MOBILE DRAWER ── */}
  <AnimatePresence>
    {isMobileMenuOpen && (
      <>
        {/* Backdrop overlay */}
        <motion.div
          key="backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[99]"
          onClick={() => setIsMobileMenuOpen(false)}
          aria-hidden="true"
        />

        {/* Drawer panel */}
        <motion.div
          id="mobile-nav-drawer"
          key="drawer"
          role="dialog"
          aria-modal="true"
          aria-label="Navigation menu"
          initial={{ x: '100%' }}
          animate={{ x: 0 }}
          exit={{ x: '100%' }}
          transition={{ type: 'spring', stiffness: 300, damping: 30 }}
          className={cn(
            'fixed top-0 right-0 bottom-0 w-[280px]',
            'bg-bg-secondary border-l border-surface-border',
            'flex flex-col px-6 py-8 z-[100]',
            'overflow-y-auto'
          )}
        >
          {/* Close button */}
          <button
            onClick={() => setIsMobileMenuOpen(false)}
            className="self-end mb-10 text-text-muted hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-green rounded-sm"
            aria-label="Close navigation menu"
          >
            <XIcon className="w-6 h-6" />
          </button>

          {/* Nav links */}
          <ul className="flex flex-col gap-1 list-none">
            {NAV_LINKS.map(({ label, sectionId }) => (
              <li key={sectionId}>
                <button
                  onClick={() => {
                    setIsMobileMenuOpen(false);
                    // Small delay allows drawer close animation to start before scroll
                    setTimeout(() => scrollToSection(sectionId), 200);
                  }}
                  className={cn(
                    'w-full text-left px-4 py-3 rounded-lg',
                    'text-base font-medium text-text-secondary',
                    'hover:text-text-primary hover:bg-bg-hover',
                    'transition-colors duration-200',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-green'
                  )}
                >
                  {label}
                </button>
              </li>
            ))}
          </ul>

          {/* Divider */}
          <div className="my-6 h-px bg-surface-border" />

          {/* CTA buttons */}
          <div className="flex flex-col gap-3">
            <Link
              href="/login"
              onClick={() => setIsMobileMenuOpen(false)}
              className="flex justify-center px-4 py-3 rounded-lg text-sm font-medium text-white border border-white/10 hover:bg-white/5 transition-colors duration-200"
            >
              Log In
            </Link>
            <Link
              href="/signup"
              onClick={() => setIsMobileMenuOpen(false)}
              className="flex justify-center px-4 py-3 rounded-lg text-sm font-semibold text-white bg-brand-green hover:bg-brand-green-light transition-colors duration-200"
            >
              Get Started Free
            </Link>
          </div>
        </motion.div>
      </>
    )}
  </AnimatePresence>

</motion.header>
```

### Animation Details

| Element            | Trigger             | Config                                                                        |
|--------------------|---------------------|-------------------------------------------------------------------------------|
| Header background  | `scrollY > 80px`    | CSS `transition: background 300ms ease, border-color 300ms ease`             |
| Mobile drawer      | `isMobileMenuOpen`  | `spring { stiffness: 300, damping: 30 }` — slides in from right              |
| Backdrop           | `isMobileMenuOpen`  | `duration: 0.2` opacity fade                                                  |

### Responsive Behavior

| Breakpoint     | Behavior                                                                |
|----------------|-------------------------------------------------------------------------|
| `< md (768px)` | Center nav hidden, Log In button hidden, hamburger visible              |
| `>= md (768px)`| Full nav visible, hamburger hidden, drawer not rendered in DOM          |

### Accessibility

- `<nav>` has `aria-label="Primary navigation"`
- Hamburger button has `aria-expanded` and `aria-controls` bound to drawer id
- Drawer has `role="dialog"` and `aria-modal="true"`
- All interactive elements have `focus-visible` ring styles using `focus-visible:` variant (not `focus:`)
- Backdrop click closes drawer (pointer users); Escape key should also close it — add `useEffect` listening for `keydown` Escape when `isMobileMenuOpen` is true
- Close button is the first focusable element inside drawer (focus trap recommended via `focus-trap-react` or manual implementation)

---

## Section 2 — Hero

**File path:** `frontend/src/components/landing/Hero.tsx`

### Props Interface

```typescript
// No external props. All content is hardcoded in this component.
export interface HeroProps {}
```

### Floating Particles Sub-Component

```typescript
// Defined locally within Hero.tsx — not exported.
// Generates N particles with randomised position, size, color, and animation duration.
interface Particle {
  id: number;
  x: number;     // vw percentage (0–100)
  y: number;     // vh percentage (0–100)
  size: number;  // px (2–4)
  color: 'green' | 'amber';
  duration: number; // animation duration in seconds (20–40)
  delay: number;    // animation delay (0–10s)
}

function generateParticles(count: number): Particle[] {
  return Array.from({ length: count }, (_, i) => ({
    id: i,
    x: Math.random() * 100,
    y: Math.random() * 100,
    size: 2 + Math.random() * 2,
    color: Math.random() > 0.5 ? 'green' : 'amber',
    duration: 20 + Math.random() * 20,
    delay: Math.random() * 10,
  }));
}

// Particles are generated once with useMemo to prevent re-generation on re-renders.
const particles = useMemo(() => generateParticles(25), []);
```

### Particle CSS (in globals.css via @layer utilities)

```css
@layer utilities {
  @keyframes particle-drift {
    0%, 100% { transform: translateY(0px) translateX(0px) scale(1); opacity: 0.4; }
    33%       { transform: translateY(-20px) translateX(10px) scale(1.1); opacity: 0.6; }
    66%       { transform: translateY(-10px) translateX(-8px) scale(0.9); opacity: 0.3; }
  }
}
```

### Internal Hooks

```typescript
const { scrollY } = useScroll();
// Parallax: image moves up 50px as user scrolls down 500px from page top.
const imageY = useTransform(scrollY, [0, 500], [0, -50]);
```

### Trust Strip Avatar Data

```typescript
// 4 placeholder avatar images. Replace with real user photos before launch.
const TRUST_AVATARS = [
  '/images/landing/avatar-1.jpg',
  '/images/landing/avatar-2.jpg',
  '/images/landing/avatar-3.jpg',
  '/images/landing/avatar-4.jpg',
];
// If photos are unavailable, render colored circles with initials instead.
```

### JSX Structure

```tsx
<section
  className="relative min-h-screen flex items-center overflow-hidden bg-bg-primary"
  aria-label="Hero section"
>

  {/* ── BACKGROUND LAYER (z-0) ── */}
  <div className="absolute inset-0 z-0 pointer-events-none" aria-hidden="true">

    {/* Radial glow from top-left */}
    <div
      className="absolute inset-0"
      style={{
        background:
          'radial-gradient(ellipse 80% 50% at 30% 20%, rgba(27,139,77,0.08), transparent)',
      }}
    />

    {/* SVG noise/grain filter overlay */}
    {/* See "CSS Additions" section for SVG filter definition */}
    <div
      className="absolute inset-0 opacity-[0.03]"
      style={{ filter: 'url(#noise-filter)' }}
    />

    {/* Floating particles */}
    {particles.map((p) => (
      <span
        key={p.id}
        className="absolute rounded-full"
        style={{
          left: `${p.x}vw`,
          top: `${p.y}vh`,
          width: `${p.size}px`,
          height: `${p.size}px`,
          backgroundColor:
            p.color === 'green' ? '#1B8B4D' : '#E6920A',
          animation: `particle-drift ${p.duration}s ${p.delay}s ease-in-out infinite`,
          opacity: 0.4,
        }}
      />
    ))}
  </div>

  {/* ── CONTENT GRID (z-10) ── */}
  <div className="relative z-10 max-w-7xl mx-auto px-6 w-full py-24 lg:py-0">
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center">

      {/* ── LEFT: Text Content (spans 7 of 12 cols on desktop) ── */}
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
              'border border-brand-green/30 bg-brand-green-subtle',
              'rounded-full px-4 py-1.5',
              'text-xs font-semibold uppercase tracking-widest text-brand-green-light'
            )}
          >
            <SparklesIcon className="w-3.5 h-3.5" aria-hidden="true" />
            AI-Powered Nutrition for Indian Families
          </span>
        </motion.div>

        {/* H1 — 3 separate animated lines */}
        <h1 className="flex flex-col gap-1">
          {['One Kitchen.', 'Every Body.', 'Perfectly Fed.'].map((line, i) => (
            <motion.span
              key={line}
              className={cn(
                'block text-4xl lg:text-7xl font-extrabold leading-[1.1] tracking-tight',
                // Line 3 gets amber gradient
                i === 2
                  ? 'bg-gradient-to-r from-brand-amber to-brand-amber-light bg-clip-text text-transparent'
                  : 'text-text-primary'
              )}
              variants={{
                hidden: { opacity: 0, y: 24 },
                visible: {
                  opacity: 1,
                  y: 0,
                  transition: { duration: 0.6, ease: [0.16, 1, 0.3, 1] }, // expo ease
                },
              }}
            >
              {line}
            </motion.span>
          ))}
        </h1>

        {/* Subtitle */}
        <motion.p
          className="text-lg lg:text-xl text-text-secondary max-w-xl leading-[1.7]"
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
            href="/signup"
            className={cn(
              'inline-flex justify-center items-center',
              'bg-brand-green px-8 py-4 rounded-xl',
              'text-white font-semibold text-lg',
              'hover:bg-brand-green-light hover:shadow-glow-green',
              'transition-all duration-300',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-green focus-visible:ring-offset-2 focus-visible:ring-offset-bg-primary'
            )}
          >
            Start Your Free Plan
          </Link>

          {/* Secondary CTA */}
          <button
            className={cn(
              'inline-flex justify-center items-center gap-2',
              'border border-white/10 px-6 py-4 rounded-xl',
              'text-text-secondary font-medium',
              'hover:bg-white/5 hover:text-text-primary',
              'transition-all duration-200',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-green focus-visible:ring-offset-2 focus-visible:ring-offset-bg-primary'
            )}
            aria-label="Watch product demo video"
          >
            <PlayIcon className="w-4 h-4" aria-hidden="true" />
            Watch Demo
          </button>
        </motion.div>

        {/* Trust strip */}
        <motion.div
          className="flex items-center gap-3 mt-2"
          variants={{
            hidden: { opacity: 0 },
            visible: { opacity: 1, transition: { duration: 0.4, delay: 0.1 } },
          }}
          aria-label="Social proof"
        >
          {/* Overlapping avatars */}
          <div className="flex items-center" aria-hidden="true">
            {TRUST_AVATARS.map((src, idx) => (
              <div
                key={src}
                className={cn(
                  'w-8 h-8 rounded-full border-2 border-bg-primary overflow-hidden',
                  idx > 0 && '-ml-2'
                )}
                style={{ zIndex: TRUST_AVATARS.length - idx }}
              >
                <Image src={src} alt="" width={32} height={32} className="object-cover" />
              </div>
            ))}
          </div>

          {/* Trust text */}
          <p className="text-sm text-text-muted">
            Trusted by{' '}
            <span className="text-text-secondary font-medium">500+ Indian families</span>
          </p>

          {/* Divider */}
          <span className="text-text-muted/30" aria-hidden="true">|</span>

          {/* Star rating */}
          <div className="flex items-center gap-1" role="img" aria-label="Rated 4.9 out of 5 stars">
            {Array.from({ length: 5 }).map((_, i) => (
              <StarIcon key={i} className="w-3.5 h-3.5 fill-brand-amber text-brand-amber" aria-hidden="true" />
            ))}
            <span className="text-sm font-semibold text-text-secondary ml-1">4.9</span>
          </div>
        </motion.div>

      </motion.div>

      {/* ── RIGHT: Hero Image (spans 5 of 12 cols on desktop) ── */}
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
        <motion.div
          style={{ y: imageY }}
          className="relative"
        >
          {/* Image container */}
          <motion.div
            className="relative aspect-[4/5] rounded-2xl overflow-hidden shadow-2xl"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.8, ease: 'easeOut', delay: 0.3 }}
          >
            <Image
              src="/images/landing/hero-family.png"
              alt="An Indian family enjoying a meal together — FedRight helps plan nutritious meals for everyone"
              fill
              className="object-cover"
              priority   // LCP image — always priority
              sizes="(max-width: 1024px) 100vw, 42vw"
            />
          </motion.div>
        </motion.div>

      </div>

    </div>
  </div>

  {/* SVG noise filter definition (hidden, referenced by CSS filter above) */}
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

</section>
```

### Responsive Behavior

| Breakpoint     | Layout                                                                                           |
|----------------|--------------------------------------------------------------------------------------------------|
| `< lg (1024px)`| Single column. Image appears ABOVE text (`order-first` on image div). Full width image.          |
| `>= lg (1024px)`| Two-column grid (7/5 split). Image on right. Vertical padding from `py-24` removed (flex centering handles it). |
| H1 size        | `text-4xl` (mobile) → `text-7xl` (lg+)                                                          |
| CTA row        | `flex-col` (mobile) → `flex-row` (sm+)                                                          |

### Animation Summary

| Element        | Type          | Config                                                                    |
|----------------|---------------|---------------------------------------------------------------------------|
| Text group     | Stagger mount | `staggerChildren: 0.12`, each child: `y: 24→0, opacity: 0→1, duration 0.6` |
| H1 lines       | Stagger mount | Same parent, custom easing `[0.16, 1, 0.3, 1]` (expo-out)               |
| Hero image     | Scale mount   | `scale: 0.9→1, opacity: 0→1, duration: 0.8, delay: 0.3`                  |
| Image parallax | Scroll-driven | `scrollY [0, 500] → y [0, -50]` (translateY)                             |
| Particles      | CSS keyframes | `particle-drift`, individual durations 20–40s, perpetual loop             |

### Accessibility

- Hero `<section>` has `aria-label="Hero section"`
- H1 is a real heading element, not a div
- Hero image `alt` text describes the scene meaningfully (not "hero image")
- Trust avatar images use empty alt `""` (decorative)
- Star rating `<div>` has `role="img"` and `aria-label="Rated 4.9 out of 5 stars"`
- Watch Demo button has explicit `aria-label` since the icon alone is not sufficient
- `priority` prop on hero image ensures it is not lazy-loaded (LCP optimization)

---

## Section 3 — Problem Statement

**File path:** `frontend/src/components/landing/ProblemStatement.tsx`

### Props Interface

```typescript
export interface ProblemStatementProps {
  id?: string; // Scroll anchor id, e.g. "problem"
}
```

### Exact Copy Text

```
Planning meals for a family where everyone eats differently shouldn't feel
like a second job. Dad needs low-carb. Mom is vegetarian. Your teenager wants
protein for the gym. Your toddler needs allergen-free portions. One app. Every plate. Sorted.
```

Total words: ~43. Word-by-word tokenization splits on whitespace.

### Highlighted Phrase Definitions

```typescript
// Phrases that receive amber gradient treatment when active (visible)
const AMBER_PHRASES = [
  'everyone eats differently',
  'second job.',
];

// Phrases that receive green gradient treatment when active
const GREEN_PHRASES = [
  'One app.',
  'Every plate.',
  'Sorted.',
];
```

**Implementation note:** Pre-tokenize the text into an array of word objects at module level (not inside the component) to prevent re-computation on render. Each word object carries: `{ text: string, highlight: 'amber' | 'green' | null, index: number }`. Mark consecutive words that belong to a highlight phrase with the same group index so the color change fires as a unit.

### Word Tokenization Logic

```typescript
type WordHighlight = 'amber' | 'green' | null;

interface WordToken {
  text: string;
  highlight: WordHighlight;
  trailingSpace: boolean;
}

// Pre-built at module level — NOT inside the component
const WORDS: WordToken[] = buildWordTokens(FULL_TEXT, AMBER_PHRASES, GREEN_PHRASES);
```

### Scroll Animation Mechanism

```typescript
// The section uses a "scroll scrubbing" pattern:
// 1. The outer wrapper is very tall (300vh) to create scroll headroom.
// 2. The text block is sticky inside it, centered vertically.
// 3. useScroll with target + offset measures progress through the tall container.
// 4. Progress 0→1 maps to word index 0→totalWords.

const containerRef = useRef<HTMLDivElement>(null);
const { scrollYProgress } = useScroll({
  target: containerRef,
  // Start counting when top of container reaches top of viewport.
  // Stop counting when bottom of container leaves bottom of viewport.
  offset: ['start start', 'end end'],
});

// Smooth-spring the raw progress to reduce jumpiness
const smoothProgress = useSpring(scrollYProgress, { stiffness: 50, damping: 20 });

// Convert smooth progress to an active word index
const activeWordIndex = useTransform(smoothProgress, (p) =>
  Math.floor(p * WORDS.length)
);
```

### Per-Word Color Subscription

```typescript
// Each WordSpan is a separate client component that subscribes to activeWordIndex.
// This way only the word that changes colour triggers a re-render, not the entire paragraph.
// Use motion.span with useTransform to avoid React re-renders entirely.

function WordSpan({
  word,
  index,
  activeWordIndex,
}: {
  word: WordToken;
  index: number;
  activeWordIndex: MotionValue<number>;
}) {
  // Color based on whether this word is "past" the scroll cursor
  const color = useTransform(activeWordIndex, (active) => {
    if (index <= active) {
      if (word.highlight === 'amber') return AMBER_GRADIENT_COLOR;
      if (word.highlight === 'green') return GREEN_GRADIENT_COLOR;
      return TEXT_PRIMARY_COLOR; // '#F0F0F2'
    }
    return TEXT_MUTED_COLOR; // 'rgba(92,92,107,0.4)'
  });

  return (
    <motion.span
      style={{ color, willChange: 'color' }}
      className="inline transition-colors duration-150"
    >
      {word.text}
      {word.trailingSpace ? ' ' : ''}
    </motion.span>
  );
}
```

**Note on gradient text with motion.span:** CSS `background-clip: text` cannot be animated via `color`. For highlighted words that need gradient treatment, swap the `color` approach for a CSS class toggle instead: add/remove a class that applies `bg-gradient-to-r from-brand-amber to-brand-amber-light bg-clip-text text-transparent`. Use `useTransform` to compute a boolean, subscribe with `useMotionValueEvent`, and update a state variable for just the highlight spans. This avoids the CSS `color` + `background-clip` conflict.

### JSX Structure

```tsx
<div
  ref={containerRef}
  id={id}
  className="relative h-[300vh]"          // Tall container creates scroll headroom
  aria-label="Problem statement section"
>
  {/* Dot grid background */}
  <div
    className="absolute inset-0 pointer-events-none"
    style={{
      backgroundImage:
        'radial-gradient(circle, rgba(255,255,255,0.05) 1px, transparent 1px)',
      backgroundSize: '24px 24px',
    }}
    aria-hidden="true"
  />

  {/* Sticky text block */}
  <div className="sticky top-0 h-screen flex items-center justify-center px-6">
    <div className="max-w-4xl mx-auto text-center">

      {/* Overline */}
      <p className="text-xs font-semibold uppercase tracking-widest text-brand-green mb-8">
        Sound Familiar?
      </p>

      {/* Word-by-word animated paragraph */}
      <p
        className="text-3xl lg:text-5xl font-bold leading-tight"
        aria-label={FULL_TEXT}  // Full readable text for screen readers
      >
        {WORDS.map((word, i) => (
          <WordSpan
            key={i}
            word={word}
            index={i}
            activeWordIndex={activeWordIndex}
          />
        ))}
      </p>

    </div>
  </div>
</div>
```

### Responsive Behavior

| Breakpoint     | Change                                             |
|----------------|----------------------------------------------------|
| `< lg (1024px)`| `text-3xl`                                         |
| `>= lg (1024px)`| `text-5xl`                                        |
| All sizes      | Full viewport width sticky container; max-w-4xl text |

### Performance Notes

- `will-change: color` on word spans — add only to the 2–3 spans that are "about to change" (within 3 words of cursor). Adding it to all 43 spans wastes GPU memory.
- Alternative: Use CSS `contain: style` on the paragraph container to limit style recalculation scope.
- Consider debouncing the `useMotionValueEvent` callback to once per animation frame using `requestAnimationFrame`.

### Accessibility

- Outer container has `aria-label`
- The animated `<p>` has `aria-label` set to the full unobfuscated text for screen readers (who will read the static label, not individual spans)
- `aria-hidden="true"` on individual word spans would be ideal if the `aria-label` on `<p>` is reliable — test with VoiceOver/NVDA
- `h-[300vh]` container causes significant scroll distance. Add `prefers-reduced-motion` media query: when `reduced-motion` is preferred, disable scroll-scrub animation and render all words fully visible.

---

## Section 4 — How It Works

**File path:** `frontend/src/components/landing/HowItWorks.tsx`

### Props Interface

```typescript
export interface HowItWorksProps {
  id?: string;
}

interface Step {
  number: number;
  title: string;
  description: string;
  image: string;     // path relative to /images/landing/
  imageAlt: string;
}
```

### Steps Data (hardcoded at module level)

```typescript
const STEPS: Step[] = [
  {
    number: 1,
    title: 'Tell Us About Your Household',
    description:
      'Set up profiles for each family member — their age, health goals, '
      + 'allergies, and food preferences.',
    image: '/images/landing/mom-profiles.png',
    imageAlt:
      'A mother setting up family member health profiles in the FedRight app',
  },
  {
    number: 2,
    title: 'AI Crafts Your Weekly Plan',
    description:
      'Our AI builds a personalized 7-day meal plan for your entire household '
      + 'from one kitchen.',
    image: '/images/landing/dishes-overhead.png',
    imageAlt:
      'Overhead view of a variety of Indian dishes representing a full meal plan',
  },
  {
    number: 3,
    title: 'Smart Grocery List, Ready to Shop',
    description:
      'Auto-generated grocery list organized by category. Nothing missed, nothing wasted.',
    image: '/images/landing/fresh-vegetables.png',
    imageAlt:
      'Fresh vegetables and groceries organized by category',
  },
  {
    number: 4,
    title: 'Track, Adapt, Thrive',
    description:
      'Log meals, track nutrition, and watch your family\'s health transform week by week.',
    image: '/images/landing/family-eating.png',
    imageAlt:
      'Indian family eating together at a table, happy and healthy',
  },
];
```

### SVG Connector Lines

```tsx
// Rendered between step cards on desktop only (hidden on mobile via CSS)
// Each SVG spans the gap between two adjacent step circles.
// The SVG uses a curved path (cubic bezier) for visual elegance.
// framer-motion animates pathLength 0→1 when the connector enters viewport.

function StepConnector({ index }: { index: number }) {
  return (
    <div
      className="hidden lg:flex items-center justify-center"
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
          initial={{ pathLength: 0 }}
          whileInView={{ pathLength: 1 }}
          viewport={{ once: true, margin: '-100px' }}
          transition={{ duration: 0.8, ease: 'easeInOut', delay: index * 0.15 + 0.3 }}
        />
        {/* Arrowhead */}
        <motion.polygon
          points="76,8 80,12 76,16"
          fill="rgba(27,139,77,0.5)"
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ delay: index * 0.15 + 1.1, duration: 0.2 }}
        />
      </svg>
    </div>
  );
}
```

### JSX Structure

```tsx
<section
  id={id}
  className="py-24 lg:py-32 bg-bg-primary"
  aria-labelledby="how-it-works-heading"
>
  <div className="max-w-7xl mx-auto px-6">

    {/* Section header */}
    <div className="text-center mb-16">
      <p className="text-xs font-semibold uppercase tracking-widest text-brand-green mb-3">
        HOW IT WORKS
      </p>
      <h2
        id="how-it-works-heading"
        className="text-3xl lg:text-4xl font-bold text-text-primary"
      >
        Your Family&apos;s Nutrition, Handled in 4 Steps
      </h2>
    </div>

    {/*
      Desktop: 4-column grid with connector SVGs between cards.
      The connector SVGs are siblings to step cards, using a 7-column grid
      (4 cards + 3 connectors). Each step takes 1 col, each connector takes
      the gap space — achieved with grid-cols-[1fr_auto_1fr_auto_1fr_auto_1fr].
    */}
    <div
      className="hidden lg:grid gap-0 items-start"
      style={{
        gridTemplateColumns: '1fr auto 1fr auto 1fr auto 1fr',
      }}
    >
      {STEPS.map((step, i) => (
        <>
          <StepCard key={step.number} step={step} index={i} />
          {i < STEPS.length - 1 && (
            <StepConnector key={`connector-${i}`} index={i} />
          )}
        </>
      ))}
    </div>

    {/* Mobile / Tablet: Simple vertical stack */}
    <div className="grid grid-cols-1 md:grid-cols-2 gap-8 lg:hidden">
      {STEPS.map((step, i) => (
        <StepCard key={step.number} step={step} index={i} />
      ))}
    </div>

  </div>
</section>
```

### StepCard Sub-Component

```tsx
function StepCard({ step, index }: { step: Step; index: number }) {
  return (
    <motion.article
      className="flex flex-col"
      initial={{ opacity: 0, y: 40 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-100px' }}
      transition={{ duration: 0.5, ease: 'easeOut', delay: index * 0.15 }}
      aria-label={`Step ${step.number}: ${step.title}`}
    >
      {/* Step number circle */}
      <div
        className={cn(
          'w-12 h-12 rounded-full flex items-center justify-center mb-5',
          'bg-brand-green/10 border border-brand-green/20',
          'text-brand-green font-bold text-lg'
        )}
        aria-hidden="true"
      >
        {step.number}
      </div>

      {/* Image */}
      <div className="relative h-48 rounded-xl overflow-hidden mb-5 bg-bg-tertiary">
        <Image
          src={step.image}
          alt={step.imageAlt}
          fill
          className="object-cover"
          sizes="(max-width: 768px) 100vw, (max-width: 1024px) 50vw, 25vw"
          loading="lazy"
        />
      </div>

      {/* Text */}
      <h3 className="text-xl font-semibold text-text-primary">
        {step.title}
      </h3>
      <p className="text-sm text-text-secondary mt-2 leading-[1.6]">
        {step.description}
      </p>

    </motion.article>
  );
}
```

### Responsive Behavior

| Breakpoint      | Layout                                                        |
|-----------------|---------------------------------------------------------------|
| `< md (768px)`  | Single column, 4 cards stacked                                |
| `md–lg`         | 2-column grid, 4 cards in 2 rows, no connectors              |
| `>= lg (1024px)`| 7-column custom grid (4 cards + 3 connectors), horizontal    |

### Animation Summary

| Element          | Trigger         | Config                                          |
|------------------|-----------------|-------------------------------------------------|
| Step cards       | whileInView     | `y: 40→0, opacity: 0→1`, stagger `delay: i*0.15` |
| SVG connector    | whileInView     | `pathLength: 0→1`, stagger `delay: i*0.15+0.3`  |
| Arrowhead        | whileInView     | `opacity: 0→1`, delay after path completes      |

### Accessibility

- Section has `aria-labelledby` pointing to the H2 id
- Each step card is an `<article>` with `aria-label` combining step number and title
- Step number circles are `aria-hidden` (redundant with article label)
- Connector SVGs are `aria-hidden`
- Images have descriptive `alt` text

---

## Section 5 — Feature Showcase

**File path:** `frontend/src/components/landing/FeatureShowcase.tsx`

### Props Interface

```typescript
export interface FeatureShowcaseProps {
  id?: string;
}

interface Feature {
  id: string;
  title: string;
  shortDescription: string;  // Shown in tab
  fullDescription: string;   // Shown in showcase area
  bullets: string[];
  icon: React.ComponentType<{ className?: string }>;  // Lucide icon component
  mockupLabel: string;       // Text overlay on dark mockup placeholder
}
```

### Features Data

```typescript
import {
  Sparkles,
  Users,
  ChefHat,
  ShoppingCart,
  BarChart3,
} from 'lucide-react';

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
    mockupLabel: 'AI Meal Plan Grid',
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
    mockupLabel: 'Family Profiles Screen',
  },
  {
    id: 'chefs-view',
    title: 'Chef\'s View',
    shortDescription: 'One cooking grid for the whole family. See what to cook, for whom, and how much.',
    fullDescription:
      'The Chef\'s View is built for the family cook. See all meals for all family members in one grid. Scale portions per person, view kids\' safe portions, and access any recipe with a single tap.',
    bullets: [
      'Multi-profile meal grid',
      'Portion scaling per person',
      'One-click recipe access',
      'Filter by meal type',
    ],
    icon: ChefHat,
    mockupLabel: 'Chef\'s View Grid',
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
    mockupLabel: 'Grocery List Screen',
  },
  {
    id: 'nutrition-dashboard',
    title: 'Nutrition Dashboard',
    shortDescription: 'Calories, macros, adherence tracking, consistency scores.',
    fullDescription:
      'Track every family member\'s nutrition over time. Daily calorie and macro charts, meal adherence rates, and weekly consistency scores give you and your family a clear picture of your health journey.',
    bullets: [
      'Daily calorie trends',
      'Macro breakdown charts',
      'Meal adherence tracking',
      'Weekly consistency scores',
    ],
    icon: BarChart3,
    mockupLabel: 'Nutrition Dashboard',
  },
];
```

### Internal State

```typescript
const [activeFeatureId, setActiveFeatureId] = useState<string>(FEATURES[0].id);
const activeFeature = FEATURES.find((f) => f.id === activeFeatureId)!;
const activeIndex = FEATURES.findIndex((f) => f.id === activeFeatureId);
```

### Desktop Layout (Tab + Showcase Grid)

```tsx
{/* Desktop: col-span-4 tabs + col-span-8 showcase */}
<div className="hidden md:grid grid-cols-12 gap-8 mt-16">

  {/* ── LEFT: Feature Tabs ── */}
  <div
    className="col-span-4 flex flex-col relative"
    role="tablist"
    aria-label="Feature list"
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
          onClick={() => setActiveFeatureId(feature.id)}
          className={cn(
            'relative flex items-start gap-4 px-6 py-5 rounded-xl text-left transition-all duration-200',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-green',
            isActive
              ? 'bg-bg-tertiary text-text-primary'
              : 'bg-transparent text-text-muted hover:text-text-secondary hover:bg-bg-hover'
          )}
        >
          {/* Active indicator line — uses layoutId for smooth slide */}
          {isActive && (
            <motion.div
              layoutId="activeTabIndicator"
              className="absolute left-0 top-3 bottom-3 w-0.5 rounded-full bg-brand-green"
              transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            />
          )}

          {/* Icon */}
          <div
            className={cn(
              'flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center mt-0.5',
              isActive ? 'bg-brand-green/15 text-brand-green' : 'bg-bg-tertiary text-text-muted'
            )}
            aria-hidden="true"
          >
            <Icon className="w-5 h-5" />
          </div>

          {/* Text */}
          <div>
            <p className="font-semibold text-sm">{feature.title}</p>
            <p className="text-xs text-text-muted mt-1 leading-relaxed line-clamp-2">
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

        {/* App mockup placeholder (replace with real screenshots pre-launch) */}
        <div
          className={cn(
            'relative rounded-2xl overflow-hidden bg-bg-secondary',
            'border border-surface-border',
            'aspect-video flex items-center justify-center'
          )}
          aria-label={`${activeFeature.title} app screenshot`}
        >
          {/* Dark placeholder with feature label */}
          <div className="text-center">
            <div
              className="w-16 h-16 rounded-2xl bg-brand-green/10 border border-brand-green/20 flex items-center justify-center mx-auto mb-4"
              aria-hidden="true"
            >
              <activeFeature.icon className="w-8 h-8 text-brand-green" />
            </div>
            <p className="text-text-muted text-sm">{activeFeature.mockupLabel}</p>
            <p className="text-text-muted/50 text-xs mt-1">Screenshot coming soon</p>
          </div>

          {/* Subtle glow */}
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
          <h3 className="text-2xl font-bold text-text-primary mb-3">
            {activeFeature.title}
          </h3>
          <p className="text-text-secondary leading-relaxed mb-6">
            {activeFeature.fullDescription}
          </p>

          {/* Bullet list */}
          <ul className="grid grid-cols-2 gap-3" role="list">
            {activeFeature.bullets.map((bullet) => (
              <li
                key={bullet}
                className="flex items-start gap-2 text-sm text-text-secondary"
              >
                <CheckCircleIcon
                  className="w-4 h-4 text-brand-green flex-shrink-0 mt-0.5"
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
```

### Mobile Layout (Swiper Carousel)

```tsx
{/* Mobile: Swiper carousel (hidden on md+) */}
<div className="md:hidden mt-12">
  <Swiper
    slidesPerView={1.1}          // Peek of next card on right
    spaceBetween={16}
    centeredSlides={false}
    pagination={{ clickable: true }}
    modules={[Pagination]}
    className="!overflow-visible"
  >
    {FEATURES.map((feature) => {
      const Icon = feature.icon;
      return (
        <SwiperSlide key={feature.id}>
          <div
            className={cn(
              'rounded-2xl bg-bg-secondary border border-surface-border p-6',
              'flex flex-col gap-5'
            )}
          >
            {/* Icon */}
            <div className="w-12 h-12 rounded-xl bg-brand-green/10 flex items-center justify-center">
              <Icon className="w-6 h-6 text-brand-green" aria-hidden="true" />
            </div>

            {/* Mockup placeholder */}
            <div className="aspect-video rounded-xl bg-bg-tertiary flex items-center justify-center">
              <p className="text-text-muted text-xs">{feature.mockupLabel}</p>
            </div>

            {/* Text */}
            <div>
              <h3 className="font-bold text-text-primary mb-2">{feature.title}</h3>
              <p className="text-sm text-text-secondary">{feature.shortDescription}</p>
            </div>

            {/* Bullets */}
            <ul className="flex flex-col gap-2" role="list">
              {feature.bullets.map((b) => (
                <li key={b} className="flex items-center gap-2 text-xs text-text-secondary">
                  <CheckCircleIcon className="w-3.5 h-3.5 text-brand-green flex-shrink-0" aria-hidden="true" />
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
```

### Animation Summary

| Element              | Type            | Config                                                          |
|----------------------|-----------------|-----------------------------------------------------------------|
| Tab indicator bar    | Layout anim     | `layoutId="activeTabIndicator"`, spring `stiffness 300 damping 30` |
| Showcase panel swap  | AnimatePresence | `x: ±20, opacity: 0→1`, `mode="wait"`, `duration 0.25`        |
| Section entry        | whileInView     | Header fades up; cards stagger in viewport                      |

### Accessibility

- Tab buttons use proper `role="tab"`, `aria-selected`, `aria-controls`
- Showcase panel uses `role="tabpanel"`, `aria-labelledby`
- All icons are `aria-hidden`
- Keyboard navigation: Tab key moves between tabs; Enter/Space activates. Arrow keys for tab list navigation should be implemented via `onKeyDown` handler (standard ARIA tab widget pattern).
- Swiper (mobile) — add `aria-label` to Swiper container; each slide should have a meaningful heading

---

## Section 6 — Cuisine Marquee

**File path:** `frontend/src/components/landing/CuisineMarquee.tsx`

### Props Interface

```typescript
export interface CuisineMarqueeProps {
  id?: string;
}

interface CuisineCard {
  name: string;       // Dish name, e.g. "Butter Chicken"
  cuisine: string;    // Region, e.g. "Punjabi"
  image: string;      // Path: /images/landing/cuisine-punjabi.png
  imageAlt: string;
}
```

### Cuisine Data (duplicated for seamless loop)

```typescript
// SOURCE data (6 cards). Duplicate this array to get 12 cards for the loop.
// Each marquee strip renders: [...SOURCE_CARDS, ...SOURCE_CARDS]
// The animation only moves -50% (the width of one set), creating a seamless loop.

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

const MARQUEE_CARDS = [...SOURCE_CARDS, ...SOURCE_CARDS]; // 12 cards total

const BADGE_NAMES = [
  'Punjabi', 'South Indian', 'Gujarati', 'Bengali', 'Marathi',
  'Rajasthani', 'Hyderabadi', 'Kerala', 'Chettinad', 'Mughlai',
  'Street Food', 'Healthy Fusion',
];
const MARQUEE_BADGES = [...BADGE_NAMES, ...BADGE_NAMES]; // 24 badges total
```

### CSS Keyframes (add to `globals.css` inside `@layer utilities`)

```css
@layer utilities {
  @keyframes marquee-left {
    from { transform: translateX(0); }
    to   { transform: translateX(-50%); }
  }

  @keyframes marquee-right {
    from { transform: translateX(-50%); }
    to   { transform: translateX(0); }
  }

  .animate-marquee-left {
    animation: marquee-left 40s linear infinite;
  }

  .animate-marquee-right {
    animation: marquee-right 40s linear infinite;
  }
}
```

**Why -50%:** The content array is doubled (2x). So the full scroll width is 2× one set of cards. Moving -50% moves exactly one full set, which loops seamlessly back to the identical start.

### JSX Structure

```tsx
<section
  id={id}
  className="py-24 lg:py-32 overflow-hidden"
  aria-labelledby="cuisines-heading"
>

  {/* Section header */}
  <div className="max-w-7xl mx-auto px-6 text-center mb-16">
    <p className="text-xs font-semibold uppercase tracking-widest text-brand-green mb-3">
      CUISINES
    </p>
    <h2
      id="cuisines-heading"
      className="text-3xl lg:text-4xl font-bold text-text-primary"
    >
      From Chole Bhature to Masala Dosa
    </h2>
    <p className="text-text-secondary mt-3 text-lg">
      Every Cuisine, Every Kitchen
    </p>
  </div>

  {/* ── TOP MARQUEE: Cuisine image cards (scrolls LEFT) ── */}
  <div
    className="relative group"
    aria-label="Cuisine images carousel"
    aria-live="off"  // Suppress screen reader announcements for marquee
  >
    {/* Left fade edge */}
    <div
      className={cn(
        'absolute left-0 top-0 bottom-0 w-32 z-10 pointer-events-none',
        'bg-gradient-to-r from-bg-primary to-transparent'
      )}
      aria-hidden="true"
    />
    {/* Right fade edge */}
    <div
      className={cn(
        'absolute right-0 top-0 bottom-0 w-32 z-10 pointer-events-none',
        'bg-gradient-to-l from-bg-primary to-transparent'
      )}
      aria-hidden="true"
    />

    {/* Scrolling track */}
    <div
      className="flex gap-4 group-hover:[animation-play-state:paused] animate-marquee-left"
      style={{ width: 'max-content' }}
    >
      {MARQUEE_CARDS.map((card, i) => (
        <CuisineCard key={`${card.name}-${i}`} card={card} />
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
    {/* Edge fades (same as top) */}
    <div className="absolute left-0 top-0 bottom-0 w-32 z-10 pointer-events-none bg-gradient-to-r from-bg-primary to-transparent" aria-hidden="true" />
    <div className="absolute right-0 top-0 bottom-0 w-32 z-10 pointer-events-none bg-gradient-to-l from-bg-primary to-transparent" aria-hidden="true" />

    {/* Scrolling track */}
    <div
      className="flex items-center gap-4 group-hover:[animation-play-state:paused] animate-marquee-right"
      style={{ width: 'max-content' }}
    >
      {MARQUEE_BADGES.map((badge, i) => (
        <span
          key={`${badge}-${i}`}
          className={cn(
            'flex-shrink-0 px-4 py-2 rounded-full',
            'border border-white/10 bg-white/5',
            'text-text-secondary text-sm font-medium whitespace-nowrap'
          )}
          aria-hidden={i >= BADGE_NAMES.length} // Duplicates are hidden from screen readers
        >
          {badge}
        </span>
      ))}
    </div>
  </div>

</section>
```

### CuisineCard Sub-Component

```tsx
function CuisineCard({ card }: { card: CuisineCard }) {
  return (
    <div
      className="relative flex-shrink-0 w-64 h-40 rounded-xl overflow-hidden"
      aria-label={`${card.name} — ${card.cuisine} cuisine`}
    >
      {/* Dish image */}
      <Image
        src={card.image}
        alt={card.imageAlt}
        fill
        className="object-cover"
        sizes="256px"
        loading="lazy"
      />

      {/* Gradient overlay + text */}
      <div
        className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent"
        aria-hidden="true"
      />
      <div className="absolute bottom-0 left-0 right-0 p-4">
        <p className="text-white font-semibold text-sm leading-tight">{card.name}</p>
        <p className="text-brand-amber text-xs mt-0.5">{card.cuisine}</p>
      </div>
    </div>
  );
}
```

### Responsive Behavior

| Breakpoint  | Change                                                                    |
|-------------|---------------------------------------------------------------------------|
| All sizes   | Full-width marquee (no max-width constraint)                              |
| Mobile      | Card width stays at `w-64` — fewer cards visible at once. Works naturally.|
| Motion pref | When `prefers-reduced-motion: reduce`, set `animation-play-state: paused` and show static grid instead |

### Accessibility

- `aria-live="off"` prevents screen readers from continuously reading scrolling content
- Duplicate cards/badges (`i >= source.length`) have `aria-hidden="true"` to avoid repetition
- Each `CuisineCard` has a meaningful `aria-label`
- `group-hover` pause on marquee allows keyboard/pointer users to read at their pace
- Also pause on `focus-within`: `group-focus-within:[animation-play-state:paused]`

---

## Section 7 — AI Difference

**File path:** `frontend/src/components/landing/AIDifference.tsx`

### Props Interface

```typescript
export interface AIDifferenceProps {
  id?: string;
}

interface ComparisonRow {
  others: string;
  fedright: string;
}
```

### Comparison Data

```typescript
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
```

### JSX Structure

```tsx
<section
  id={id}
  className="py-24 lg:py-32 bg-bg-primary"
  aria-labelledby="ai-difference-heading"
>
  <div className="max-w-5xl mx-auto px-6">

    {/* Section header */}
    <div className="text-center mb-16">
      <p className="text-xs font-semibold uppercase tracking-widest text-brand-green mb-3">
        THE AI DIFFERENCE
      </p>
      <h2
        id="ai-difference-heading"
        className="text-3xl lg:text-4xl font-bold text-text-primary"
      >
        Not Another Calorie Counter
      </h2>
    </div>

    {/* Comparison grid */}
    <div className="grid grid-cols-1 md:grid-cols-2 gap-8 lg:gap-12">

      {/* ── LEFT: Other Apps ── */}
      <div>
        <h3 className="text-sm font-semibold uppercase tracking-wider text-text-muted mb-6 text-center md:text-left">
          Other Apps
        </h3>
        <div className="flex flex-col" role="list" aria-label="What other apps offer">
          {COMPARISONS.map((row, i) => (
            <motion.div
              key={row.others}
              role="listitem"
              className="flex items-start gap-3 py-4 border-b border-white/5"
              initial={{ opacity: 0, x: -20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true, margin: '-50px' }}
              transition={{ duration: 0.4, ease: 'easeOut', delay: i * 0.1 }}
            >
              <XCircleIcon
                className="w-5 h-5 text-red-400/50 flex-shrink-0 mt-0.5"
                aria-hidden="true"
              />
              <span className="text-text-muted text-sm leading-relaxed">
                {row.others}
              </span>
            </motion.div>
          ))}
        </div>
      </div>

      {/* ── RIGHT: FedRight ── */}
      <div className="border-l-0 md:border-l-2 md:border-brand-green/30 md:pl-6">
        <h3 className="text-sm font-semibold uppercase tracking-wider text-brand-green mb-6 text-center md:text-left">
          FedRight
        </h3>
        <div className="flex flex-col" role="list" aria-label="What FedRight offers">
          {COMPARISONS.map((row, i) => (
            <motion.div
              key={row.fedright}
              role="listitem"
              className="flex items-start gap-3 py-4 border-b border-white/5"
              initial={{ opacity: 0, x: 20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true, margin: '-50px' }}
              transition={{ duration: 0.4, ease: 'easeOut', delay: i * 0.1 }}
            >
              <CheckCircleIcon
                className="w-5 h-5 text-brand-green flex-shrink-0 mt-0.5"
                aria-hidden="true"
              />
              <span className="text-text-primary font-medium text-sm leading-relaxed">
                {row.fedright}
              </span>
            </motion.div>
          ))}
        </div>
      </div>

    </div>
  </div>
</section>
```

### Responsive Behavior

| Breakpoint      | Layout                                                             |
|-----------------|--------------------------------------------------------------------|
| `< md (768px)`  | Single column, stacked. Left column first (Others), then FedRight. Left border on FedRight column removed. |
| `>= md (768px)` | Side-by-side two-column grid. FedRight column gets `border-l-2 border-brand-green/30 pl-6`. |

### Animation Summary

| Element       | Direction  | Config                                                   |
|---------------|------------|----------------------------------------------------------|
| Others rows   | Left slide | `x: -20→0, opacity: 0→1`, stagger `delay: i*0.1`        |
| FedRight rows | Right slide| `x: 20→0, opacity: 0→1`, stagger `delay: i*0.1`         |
| Both          | Trigger    | `whileInView`, `viewport: { once: true, margin: '-50px' }` |

### Accessibility

- Section has `aria-labelledby`
- Each column's list has `role="list"` and `aria-label` describing what it represents
- Icons are `aria-hidden`
- Both columns animate with the same delay stagger — they visually "answer" each other row-by-row, which is intentional

---

## Section 8 — Testimonials

**File path:** `frontend/src/components/landing/Testimonials.tsx`

### Props Interface

```typescript
export interface TestimonialsProps {
  id?: string;
}

interface Testimonial {
  id: string;
  quote: string;
  name: string;
  location: string;
  householdDesc: string;   // e.g. "Family of 4"
  initials: string;        // 2 chars, e.g. "PS"
  healthMetric: string;    // e.g. "HbA1c: 8.2→6.5"
  avatarColor: string;     // Tailwind bg class, e.g. "bg-emerald-900"
}

interface StatItem {
  value: number;
  suffix: string;
  label: string;
}
```

### Data

```typescript
const STATS: StatItem[] = [
  { value: 5000, suffix: '+', label: 'Meals Planned' },
  { value: 500,  suffix: '+', label: 'Families Served' },
  { value: 15,   suffix: '+', label: 'Indian Cuisines' },
  { value: 98,   suffix: '%', label: 'Satisfaction Rate' },
];

const TESTIMONIALS: Testimonial[] = [
  {
    id: 'priya',
    quote:
      'FedRight transformed our kitchen. My father-in-law\'s diabetes is finally managed '
      + 'through diet, and my kids actually look forward to eating healthy now. The AI just '
      + 'gets what every person in our house needs.',
    name: 'Priya Sharma',
    location: 'Mumbai',
    householdDesc: 'Family of 4',
    initials: 'PS',
    healthMetric: 'HbA1c: 8.2 → 6.5',
    avatarColor: 'bg-emerald-900',
  },
  {
    id: 'rajesh-meena',
    quote:
      'Managing vegetarian meals for five people with different preferences was exhausting. '
      + 'FedRight handles it all — the kids get balanced nutrition, and the grocery list '
      + 'actually makes sense. We\'ve saved ₹3,000 a month on food waste.',
    name: 'Rajesh & Meena Patel',
    location: 'Ahmedabad',
    householdDesc: 'Family of 5',
    initials: 'RP',
    healthMetric: 'Weight: −12kg in 6 months',
    avatarColor: 'bg-amber-900',
  },
  {
    id: 'ananya',
    quote:
      'As a doctor, I\'m particular about nutrition science. FedRight\'s recommendations '
      + 'are medically sound — macro targets, micronutrient balance, appropriate caloric '
      + 'deficits. I recommend it to my own patients now.',
    name: 'Dr. Ananya Iyer',
    location: 'Bangalore',
    householdDesc: 'Family of 3',
    initials: 'AI',
    healthMetric: 'Cholesterol: 240 → 185',
    avatarColor: 'bg-blue-900',
  },
  {
    id: 'vikram',
    quote:
      'With my mother\'s diabetes and my son\'s nut allergy, meal planning felt like navigating '
      + 'a minefield. FedRight handles every constraint automatically. The Chef\'s View is '
      + 'a game-changer — I know exactly what to cook and how much for each person.',
    name: 'Vikram Singh',
    location: 'Delhi',
    householdDesc: 'Family of 6',
    initials: 'VS',
    healthMetric: 'Blood Sugar: Controlled',
    avatarColor: 'bg-purple-900',
  },
  {
    id: 'lakshmi',
    quote:
      'The variety of Kerala and South Indian recipes is incredible. I can plan the whole '
      + 'week with traditional dishes I actually love, and the nutrition tracking proves '
      + 'they\'re just as healthy as anything else. Lost 15kg eating food I enjoy.',
    name: 'Lakshmi Nair',
    location: 'Kochi',
    householdDesc: 'Family of 4',
    initials: 'LN',
    healthMetric: 'BMI: 31 → 24',
    avatarColor: 'bg-rose-900',
  },
];
```

### AnimatedCounter Sub-Component

**File path:** `frontend/src/components/landing/AnimatedCounter.tsx`

```typescript
// Props interface
export interface AnimatedCounterProps {
  value: number;        // Target number to count to
  suffix: string;       // e.g. "+" or "%"
  label: string;        // e.g. "Meals Planned"
  duration?: number;    // Animation duration in ms (default: 2000)
  className?: string;
}
```

```tsx
// Implementation approach: IntersectionObserver triggers requestAnimationFrame loop.
// easeOutExpo easing: value decelerates as it approaches the target.
// Does NOT use framer-motion animate — RAF loop is more performant for numeric counting.

'use client';

import { useEffect, useRef, useState } from 'react';

function easeOutExpo(t: number): number {
  // t is normalised [0, 1]. Returns eased value [0, 1].
  return t === 1 ? 1 : 1 - Math.pow(2, -10 * t);
}

export function AnimatedCounter({
  value,
  suffix,
  label,
  duration = 2000,
  className,
}: AnimatedCounterProps) {
  const [displayValue, setDisplayValue] = useState(0);
  const [hasTriggered, setHasTriggered] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
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
      { threshold: 0.3 } // Trigger when 30% of element is visible
    );

    observer.observe(el);

    return () => {
      observer.disconnect();
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, [value, duration, hasTriggered]);

  return (
    <div ref={containerRef} className={cn('text-center', className)}>
      <p className="text-4xl font-bold text-text-primary tabular-nums" aria-live="polite">
        {displayValue.toLocaleString('en-IN')}{suffix}
      </p>
      <p className="text-sm text-text-muted mt-1">{label}</p>
    </div>
  );
}
```

**Note:** `aria-live="polite"` is intentional — it announces the final value to screen readers without interrupting them mid-read. The count-up animation itself is purely visual; screen readers only announce when the value settles.

### Swiper Configuration

```typescript
import { Swiper, SwiperSlide } from 'swiper/react';
import { Autoplay, Navigation, Pagination } from 'swiper/modules';
import 'swiper/css';
import 'swiper/css/pagination';
import 'swiper/css/navigation';

const SWIPER_CONFIG = {
  modules: [Autoplay, Navigation, Pagination],
  slidesPerView: 1 as const,
  spaceBetween: 24,
  loop: true,
  autoplay: {
    delay: 5000,
    disableOnInteraction: false,
    pauseOnMouseEnter: true,
  },
  pagination: {
    clickable: true,
  },
  navigation: true,
  breakpoints: {
    768: { slidesPerView: 2 },
    1024: { slidesPerView: 3 },
  },
};
```

### Testimonial Card JSX

```tsx
function TestimonialCard({ testimonial }: { testimonial: Testimonial }) {
  return (
    <article
      className={cn(
        'bg-bg-secondary rounded-2xl p-8',
        'border border-surface-border',
        'flex flex-col h-full',
        'shadow-card'
      )}
      aria-label={`Testimonial from ${testimonial.name}`}
    >
      {/* Quote icon */}
      <QuoteIcon
        className="w-8 h-8 text-brand-green/20 mb-4 flex-shrink-0"
        aria-hidden="true"
      />

      {/* Quote text */}
      <blockquote className="text-text-secondary text-base leading-relaxed italic flex-1">
        &ldquo;{testimonial.quote}&rdquo;
      </blockquote>

      {/* Divider */}
      <div className="h-px bg-white/5 my-6" aria-hidden="true" />

      {/* Author row */}
      <footer>
        <div className="flex items-center gap-4">
          {/* Avatar */}
          <div
            className={cn(
              'w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0',
              testimonial.avatarColor
            )}
            aria-hidden="true"
          >
            <span className="text-brand-green font-bold text-sm">
              {testimonial.initials}
            </span>
          </div>

          {/* Name + location */}
          <div className="flex-1 min-w-0">
            <p className="text-text-primary font-semibold text-sm truncate">
              {testimonial.name}
            </p>
            <p className="text-text-muted text-xs mt-0.5">
              {testimonial.location} · {testimonial.householdDesc}
            </p>
          </div>

          {/* Health metric badge */}
          <span
            className={cn(
              'flex-shrink-0 bg-brand-green-subtle text-brand-green',
              'text-xs font-medium px-2 py-1 rounded-full',
              'whitespace-nowrap'
            )}
            aria-label={`Health result: ${testimonial.healthMetric}`}
          >
            {testimonial.healthMetric}
          </span>
        </div>
      </footer>
    </article>
  );
}
```

### Full Section JSX Outline

```tsx
<section
  id={id}
  className="py-24 lg:py-32 bg-bg-primary"
  aria-labelledby="testimonials-heading"
>
  <div className="max-w-7xl mx-auto px-6">

    {/* Header */}
    <div className="text-center mb-16">
      <h2 id="testimonials-heading" className="text-3xl lg:text-4xl font-bold text-text-primary">
        Families Who Eat Better, Together
      </h2>
    </div>

    {/* Stats bar */}
    <div
      className="grid grid-cols-2 lg:grid-cols-4 gap-8 mb-16"
      aria-label="FedRight statistics"
    >
      {STATS.map((stat) => (
        <AnimatedCounter key={stat.label} {...stat} />
      ))}
    </div>

    {/* Swiper carousel */}
    <Swiper {...SWIPER_CONFIG} className="testimonials-swiper">
      {TESTIMONIALS.map((t) => (
        <SwiperSlide key={t.id} className="h-auto">
          <TestimonialCard testimonial={t} />
        </SwiperSlide>
      ))}
    </Swiper>

  </div>
</section>
```

### Swiper Custom CSS (in `globals.css` inside `@layer components`)

```css
@layer components {
  .testimonials-swiper .swiper-pagination-bullet {
    @apply bg-text-muted opacity-50;
  }
  .testimonials-swiper .swiper-pagination-bullet-active {
    @apply bg-brand-green opacity-100;
  }
  .testimonials-swiper .swiper-button-prev,
  .testimonials-swiper .swiper-button-next {
    @apply text-text-muted;
    --swiper-navigation-size: 20px;
  }
  .testimonials-swiper .swiper-button-prev:hover,
  .testimonials-swiper .swiper-button-next:hover {
    @apply text-text-primary;
  }
}
```

### Responsive Behavior

| Breakpoint      | Slides visible | Stats grid  |
|-----------------|----------------|-------------|
| `< md (768px)`  | 1              | 2 columns   |
| `md–lg`         | 2              | 2 columns   |
| `>= lg (1024px)`| 3              | 4 columns   |

### Accessibility

- Section has `aria-labelledby`
- Stats container has `aria-label`
- `AnimatedCounter` uses `aria-live="polite"` on the number display
- Each testimonial card is an `<article>` with `aria-label`
- `<blockquote>` semantic element used for quotes
- `<footer>` within article for attribution
- Health metric badge has `aria-label` for full readability

---

## Section 9 — Final CTA

**File path:** `frontend/src/components/landing/FinalCTA.tsx`

### Props Interface

```typescript
export interface FinalCTAProps {
  id?: string;
}
```

### Background Gradient Mesh CSS

```css
/* Add to globals.css inside @layer utilities */
@layer utilities {
  @keyframes gradient-mesh {
    0%   { background-position: 0% 50%; }
    50%  { background-position: 100% 50%; }
    100% { background-position: 0% 50%; }
  }

  .animate-gradient-mesh {
    background: linear-gradient(
      135deg,
      rgba(27,139,77,0.15)   0%,
      rgba(230,146,10,0.10)  50%,
      rgba(27,139,77,0.15)   100%
    );
    background-size: 400% 400%;
    animation: gradient-mesh 15s ease infinite;
  }
}
```

### JSX Structure

```tsx
<section
  id={id}
  className="py-24 lg:py-32 relative overflow-hidden bg-bg-primary"
  aria-labelledby="final-cta-heading"
>

  {/* Animated gradient mesh background */}
  <div
    className="absolute inset-0 animate-gradient-mesh pointer-events-none"
    aria-hidden="true"
  />

  {/* Subtle grid pattern on top of gradient */}
  <div
    className="absolute inset-0 pointer-events-none opacity-[0.03]"
    style={{
      backgroundImage:
        'linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), '
        + 'linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)',
      backgroundSize: '40px 40px',
    }}
    aria-hidden="true"
  />

  {/* Content */}
  <div className="relative z-10 max-w-3xl mx-auto px-6 text-center">

    {/* Headline — two animated lines */}
    <motion.div
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, margin: '-80px' }}
      variants={{ hidden: {}, visible: { transition: { staggerChildren: 0.1 } } }}
    >
      <motion.h2
        id="final-cta-heading"
        className="text-3xl lg:text-5xl font-bold text-text-primary"
        variants={{
          hidden: { opacity: 0, y: 20 },
          visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: 'easeOut' } },
        }}
      >
        Stop Agonizing Over Dinner.<br />
        <span className="bg-gradient-to-r from-brand-green to-brand-green-light bg-clip-text text-transparent">
          Start Nourishing Your Family.
        </span>
      </motion.h2>

      {/* Subtitle */}
      <motion.p
        className="text-lg text-text-secondary mt-6 max-w-xl mx-auto leading-relaxed"
        variants={{
          hidden: { opacity: 0, y: 16 },
          visible: { opacity: 1, y: 0, transition: { duration: 0.4, ease: 'easeOut' } },
        }}
      >
        Set up your household in 2 minutes. Get your first AI-crafted meal plan instantly.
      </motion.p>

      {/* Primary CTA button */}
      <motion.div
        className="mt-10"
        variants={{
          hidden: { opacity: 0, y: 16 },
          visible: { opacity: 1, y: 0, transition: { duration: 0.4, ease: 'easeOut' } },
        }}
      >
        <motion.a
          href="/signup"
          className={cn(
            'inline-flex items-center justify-center',
            'bg-brand-green px-10 py-5 rounded-2xl',
            'text-white font-semibold text-xl',
            'hover:bg-brand-green-light',
            'transition-colors duration-300',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-green focus-visible:ring-offset-4 focus-visible:ring-offset-bg-primary'
          )}
          whileHover={{ scale: 1.02, boxShadow: '0 0 30px rgba(27,139,77,0.4)' }}
          whileTap={{ scale: 0.98 }}
          transition={{ type: 'spring', stiffness: 400, damping: 20 }}
        >
          Get Started Free
        </motion.a>
      </motion.div>

      {/* Sub-CTA reassurance text */}
      <motion.p
        className="text-sm text-text-muted mt-4"
        variants={{
          hidden: { opacity: 0 },
          visible: { opacity: 1, transition: { duration: 0.4, delay: 0.1 } },
        }}
        aria-label="No credit card required to sign up"
      >
        No credit card required
      </motion.p>

    </motion.div>

    {/* Optional: feature icon strips for social proof */}
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
          className="flex items-center gap-1.5 text-xs text-text-muted"
        >
          <CheckCircleIcon className="w-3.5 h-3.5 text-brand-green" />
          {item}
        </span>
      ))}
    </motion.div>

  </div>
</section>
```

### Animation Summary

| Element       | Config                                                                            |
|---------------|-----------------------------------------------------------------------------------|
| H2 + subtitle | `whileInView` stagger, `y: 20→0, opacity: 0→1`                                   |
| CTA button    | `whileHover: scale 1.02 + boxShadow`, `whileTap: scale 0.98`, spring transition  |
| Trust strip   | `whileInView opacity: 0→1, delay: 0.4`                                           |
| Background    | CSS `gradient-mesh` keyframe, `15s ease infinite`, no framer-motion              |

### Accessibility

- Section has `aria-labelledby` pointing to H2 id
- CTA link has strong focus-visible styling (high contrast ring)
- `whileTap` scale does not interfere with usability — keep scale close to 1.0 (0.98 is safe)
- Reassurance text has `aria-label` for complete screen reader phrase
- Trust strip icons strip is `aria-hidden` (decorative)
- `prefers-reduced-motion`: disable `gradient-mesh` animation and `whileHover` scale. Use `useReducedMotion()` from framer-motion for the button hover.

---

## Section 10 — Footer

**File path:** `frontend/src/components/landing/Footer.tsx`

### Props Interface

```typescript
// No external props.
export interface FooterProps {}
```

### Footer Link Data

```typescript
interface FooterColumn {
  heading: string;
  links: { label: string; href: string }[];
}

const FOOTER_COLUMNS: FooterColumn[] = [
  {
    heading: 'Product',
    links: [
      { label: 'Features',      href: '/#features'      },
      { label: 'How It Works',  href: '/#how-it-works'  },
      { label: 'Pricing',       href: '/pricing'         },
      { label: 'Cuisines',      href: '/#cuisines'       },
    ],
  },
  {
    heading: 'Company',
    links: [
      { label: 'About',    href: '/about'    },
      { label: 'Blog',     href: '/blog'     },
      { label: 'Careers',  href: '/careers'  },
      { label: 'Contact',  href: '/contact'  },
    ],
  },
  {
    heading: 'Legal',
    links: [
      { label: 'Privacy Policy',  href: '/privacy'  },
      { label: 'Terms of Service', href: '/terms'   },
      { label: 'Cookie Policy',   href: '/cookies'  },
    ],
  },
];
```

### Social Icons Data

```typescript
// Use SVG icons or lucide-react equivalents.
// Lucide does not have Twitter/X or YouTube as named exports in all versions.
// Use @icons-pack/react-simple-icons or custom SVG for brand logos.
// Fallback: use ExternalLinkIcon with text labels.

interface SocialLink {
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
}

// Define SOCIAL_LINKS array with Instagram, Twitter/X, LinkedIn, YouTube
```

### JSX Structure

```tsx
<footer
  className="border-t border-white/5 bg-bg-secondary"
  aria-label="Site footer"
>
  {/* Top gradient border line */}
  <div
    className="h-px bg-gradient-to-r from-transparent via-brand-green/30 to-transparent"
    aria-hidden="true"
  />

  <div className="max-w-7xl mx-auto px-6 py-16">

    {/* Main grid: Logo col + 3 link columns */}
    <div className="grid grid-cols-2 md:grid-cols-4 gap-8 lg:gap-12">

      {/* ── Column 1: Brand ── */}
      <div className="col-span-2 md:col-span-1">
        {/* Logo + name */}
        <Link href="/" className="flex items-center gap-2.5 mb-3">
          <Image
            src="/fedright-logo-gemini-v2.png"
            alt="FedRight"
            width={32}
            height={32}
            className="rounded-md"
          />
          <span className="text-lg font-bold text-text-primary">FedRight</span>
        </Link>

        {/* Tagline */}
        <p className="text-sm text-text-muted leading-relaxed max-w-[200px]">
          One Kitchen. Every Body. Perfectly Fed.
        </p>

        {/* Social icons */}
        <div className="flex items-center gap-4 mt-6" aria-label="Social media links">
          {SOCIAL_LINKS.map(({ label, href, icon: Icon }) => (
            <a
              key={label}
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={`Follow FedRight on ${label}`}
              className={cn(
                'w-8 h-8 flex items-center justify-center rounded-md',
                'text-text-muted hover:text-text-primary',
                'hover:bg-bg-hover transition-colors duration-200',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-green'
              )}
            >
              <Icon className="w-4 h-4" aria-hidden="true" />
            </a>
          ))}
        </div>
      </div>

      {/* ── Columns 2–4: Link columns ── */}
      {FOOTER_COLUMNS.map((col) => (
        <nav
          key={col.heading}
          aria-label={`${col.heading} links`}
        >
          <h3 className="text-sm font-semibold text-text-primary uppercase tracking-wider mb-4">
            {col.heading}
          </h3>
          <ul className="flex flex-col gap-3 list-none" role="list">
            {col.links.map(({ label, href }) => (
              <li key={label}>
                <Link
                  href={href}
                  className={cn(
                    'text-sm text-text-muted',
                    'hover:text-text-primary transition-colors duration-200',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-green focus-visible:rounded-sm'
                  )}
                >
                  {label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      ))}

    </div>

    {/* ── Bottom bar ── */}
    <div
      className={cn(
        'mt-12 pt-8 border-t border-white/5',
        'flex flex-col sm:flex-row justify-between items-center gap-4'
      )}
    >
      {/* Copyright */}
      <p className="text-sm text-text-muted text-center sm:text-left">
        &copy; 2026 FedRight. Made with love in India.
      </p>

      {/* Powered by AI badge */}
      <div
        className={cn(
          'flex items-center gap-1.5',
          'text-xs text-text-muted',
          'border border-white/10 rounded-full px-3 py-1.5'
        )}
        aria-label="Powered by artificial intelligence"
      >
        <SparklesIcon className="w-3 h-3 text-brand-green" aria-hidden="true" />
        <span>Powered by AI</span>
      </div>
    </div>

  </div>
</footer>
```

### Responsive Behavior

| Breakpoint      | Grid Layout                                                              |
|-----------------|--------------------------------------------------------------------------|
| `< sm (640px)`  | 2-column grid. Brand col spans both columns. Link cols: Product + Company in col1, Legal in col2 (approximately). Bottom bar stacks vertically. |
| `sm–md`         | 2-column grid. Bottom bar in a row.                                      |
| `>= md (768px)` | 4-column grid: Brand col + 3 link columns side by side.                  |

### Accessibility

- `<footer>` has `aria-label="Site footer"`
- Social icon links have `aria-label` with full text (not just icon)
- Each link column uses `<nav>` with `aria-label`
- Link lists use `<ul role="list">` (Safari does not expose list semantics without this when `list-style: none`)
- External social links have `rel="noopener noreferrer"` and `target="_blank"`
- Copyright symbol uses `&copy;` (not the raw `©` character, though both are acceptable)

---

## Shared Sub-Components

### `cn` Utility

```typescript
// frontend/src/lib/cn.ts
// Class merging utility — required by all components above.
import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
```

Install: `npm install clsx tailwind-merge`

### Icon Library

All icons used are from `lucide-react`. Full list of icons required:

```
Sparkles, Users, ChefHat, ShoppingCart, BarChart3,
CheckCircle2 (as CheckCircleIcon), XCircle (as XCircleIcon),
Star (as StarIcon), Play (as PlayIcon), Quote (as QuoteIcon),
X (as XIcon), ExternalLink
```

For social media brand icons (Instagram, LinkedIn, YouTube, Twitter/X), use:
- `@icons-pack/react-simple-icons` — `npm install @icons-pack/react-simple-icons`
- Exports: `SiInstagram`, `SiLinkedin`, `SiX`, `SiYoutube`

---

## CSS Additions Required in `globals.css`

All custom CSS must be inside `@layer` directives. Raw unlayered CSS in Tailwind v4 silently overrides all utilities — this is the critical Tailwind v4 cascade gotcha documented in MEMORY.md.

```css
/* frontend/src/app/globals.css */

@import "tailwindcss";

@layer base {
  :root {
    /* If using CSS custom properties for tokens */
    --color-brand-green: #1B8B4D;
    --color-brand-amber: #E6920A;
  }

  html {
    /* Prevent horizontal scroll caused by marquee overflow */
    overflow-x: hidden;
  }

  body {
    font-family: 'Inter', sans-serif;
    background-color: #0A0A0B;
    color: #F0F0F2;
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
  }

  /* Respect user's reduced motion preference globally */
  @media (prefers-reduced-motion: reduce) {
    * {
      animation-duration: 0.01ms !important;
      animation-iteration-count: 1 !important;
      transition-duration: 0.01ms !important;
    }
  }
}

@layer utilities {
  /* Particle drift (Hero section) */
  @keyframes particle-drift {
    0%, 100% { transform: translateY(0px)   translateX(0px)   scale(1);   opacity: 0.4; }
    33%       { transform: translateY(-20px) translateX(10px)  scale(1.1); opacity: 0.6; }
    66%       { transform: translateY(-10px) translateX(-8px)  scale(0.9); opacity: 0.3; }
  }

  /* Cuisine marquee (CuisineMarquee section) */
  @keyframes marquee-left {
    from { transform: translateX(0); }
    to   { transform: translateX(-50%); }
  }
  @keyframes marquee-right {
    from { transform: translateX(-50%); }
    to   { transform: translateX(0); }
  }

  .animate-marquee-left {
    animation: marquee-left 40s linear infinite;
  }
  .animate-marquee-right {
    animation: marquee-right 40s linear infinite;
  }

  /* Gradient mesh (FinalCTA section) */
  @keyframes gradient-mesh {
    0%   { background-position: 0%   50%; }
    50%  { background-position: 100% 50%; }
    100% { background-position: 0%   50%; }
  }
  .animate-gradient-mesh {
    background: linear-gradient(
      135deg,
      rgba(27,139,77,0.15)   0%,
      rgba(230,146,10,0.10)  50%,
      rgba(27,139,77,0.15)   100%
    );
    background-size: 400% 400%;
    animation: gradient-mesh 15s ease infinite;
  }
}

@layer components {
  /* Swiper pagination + navigation overrides (Testimonials) */
  .testimonials-swiper .swiper-pagination-bullet {
    @apply bg-[#5C5C6B] opacity-50;
  }
  .testimonials-swiper .swiper-pagination-bullet-active {
    @apply bg-[#1B8B4D] opacity-100;
  }
  .testimonials-swiper .swiper-button-prev,
  .testimonials-swiper .swiper-button-next {
    color: #5C5C6B;
    --swiper-navigation-size: 20px;
  }
  .testimonials-swiper .swiper-button-prev:hover,
  .testimonials-swiper .swiper-button-next:hover {
    color: #F0F0F2;
  }
}
```

---

## Dependencies Checklist

The following packages must be installed in `frontend/` before development:

| Package                          | Version  | Purpose                                             |
|----------------------------------|----------|-----------------------------------------------------|
| `framer-motion`                  | `^11`    | All scroll-driven and whileInView animations        |
| `lenis`                          | `^1`     | Smooth scroll (check npm for latest package name)   |
| `swiper`                         | `^11`    | Testimonial carousel, Feature mobile carousel       |
| `lucide-react`                   | `^0.400` | All UI icons                                        |
| `clsx`                           | `^2`     | Class name utility                                  |
| `tailwind-merge`                 | `^2`     | Tailwind class deduplication                        |
| `@icons-pack/react-simple-icons` | latest   | Social media brand icons                            |

Install command:
```bash
cd frontend && npm install framer-motion lenis swiper lucide-react clsx tailwind-merge @icons-pack/react-simple-icons
```

**Existing in project (do not reinstall):** `next`, `react`, `react-dom`, `typescript`, `tailwindcss`

---

## File Structure Summary

```
frontend/src/
├── app/
│   ├── (landing)/
│   │   ├── layout.tsx          ← No sidebar, no auth. Font + metadata only.
│   │   └── page.tsx            ← Imports all 10 section components
│   └── globals.css             ← Add keyframes + custom CSS (all inside @layer)
├── components/
│   └── landing/
│       ├── Navbar.tsx
│       ├── Hero.tsx
│       ├── ProblemStatement.tsx
│       ├── HowItWorks.tsx
│       ├── FeatureShowcase.tsx
│       ├── CuisineMarquee.tsx
│       ├── AIDifference.tsx
│       ├── Testimonials.tsx
│       ├── AnimatedCounter.tsx  ← Sub-component used by Testimonials
│       ├── FinalCTA.tsx
│       ├── Footer.tsx
│       └── SmoothScroll.tsx
└── lib/
    └── cn.ts                   ← clsx + tailwind-merge utility
```

---

*End of spec document. All sections, props, copy text, animations, and responsive behavior are fully specified. Implementation may proceed section by section in the order listed; sections have no cross-dependencies except the shared `cn` utility and design tokens.*
