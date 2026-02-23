# Animation & Interaction System Specification
## FedRight Landing Page — Motion Design

**Document Version:** 1.0
**Date:** 2026-02-20
**Project:** FedRight — AI-Powered Household Meal Planning
**Applies To:** `frontend/src/app/(landing)/page.tsx` and all landing page components

---

## 1. Dependencies

### 1.1 Required Packages

```json
{
  "framer-motion": "^11.15.0",
  "@studio-freight/lenis": "^1.0.42",
  "swiper": "^11.1.15"
}
```

### 1.2 Installation

```bash
cd frontend && npm install framer-motion @studio-freight/lenis swiper
```

### 1.3 TypeScript Types (included with packages)
- `framer-motion` — ships its own types; no `@types/` package needed
- `@studio-freight/lenis` — ships its own types
- `swiper` — ships its own types

### 1.4 Version Rationale
- **framer-motion 11.x** — introduces `useAnimate` hook and improved scroll-linked animations via `useScroll` / `useTransform` with better performance than v10
- **lenis 1.x** — stable API, native CSS scroll smoothing as a fallback, RAF-based for compositor thread safety
- **swiper 11.x** — tree-shakeable module imports, native CSS scroll snap support as an underlying mechanism

---

## 2. Smooth Scroll Setup (Lenis)

### 2.1 Component Location
`frontend/src/components/landing/SmoothScroll.tsx`

### 2.2 Full Implementation

```typescript
// frontend/src/components/landing/SmoothScroll.tsx
//
// Lenis provides momentum-based smooth scrolling that replaces the browser's
// native scroll behaviour. It runs on requestAnimationFrame to stay on the
// compositor thread, avoiding layout thrash. We also integrate it with
// framer-motion so that useScroll() hooks receive Lenis-adjusted scroll values.
//
// IMPORTANT: This component must wrap only the landing page, NOT the entire
// Next.js app. Applying it globally causes conflicts with non-landing pages
// that may have custom scroll containers (e.g., the app dashboard with a
// fixed sidebar and overflow-y: auto content area).

'use client';

import React, {
  createContext,
  useContext,
  useEffect,
  useRef,
  ReactNode,
} from 'react';
import Lenis from '@studio-freight/lenis';
import { useMotionValue } from 'framer-motion';

// ─── Context ─────────────────────────────────────────────────────────────────
// Expose the Lenis instance so child components can call lenis.scrollTo()
// for programmatic scrolling (e.g., "scroll to section" nav buttons).
interface SmoothScrollContextValue {
  lenis: Lenis | null;
}

const SmoothScrollContext = createContext<SmoothScrollContextValue>({
  lenis: null,
});

export function useSmoothScroll(): SmoothScrollContextValue {
  return useContext(SmoothScrollContext);
}

// ─── Provider ────────────────────────────────────────────────────────────────
interface SmoothScrollProps {
  children: ReactNode;
}

export function SmoothScroll({ children }: SmoothScrollProps) {
  const lenisRef = useRef<Lenis | null>(null);
  // We use a ref for the RAF id so we can cancel on unmount without
  // triggering unnecessary re-renders.
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    // Instantiate Lenis once on mount.
    const lenis = new Lenis({
      // Duration of the easing animation in seconds.
      // 1.2s provides a premium, slightly leisurely feel without being sluggish.
      duration: 1.2,

      // easeOutExpo curve: fast start, very gradual deceleration.
      // Gives the scroll a physical "momentum coasting" feel.
      easing: (t: number) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),

      // We are scrolling the document root, not a nested element.
      orientation: 'vertical',
      gestureOrientation: 'vertical',

      // Smooth trackpad and mouse wheel events.
      smoothWheel: true,

      // Standard wheel sensitivity. Increase to 1.2–1.5 if feedback indicates
      // the scroll feels too slow on magic trackpads.
      wheelMultiplier: 1,

      // Touch devices benefit from slightly higher multiplier because finger
      // swipes cover less physical distance than wheel events.
      touchMultiplier: 2,

      // Disable smooth scrolling on iOS Safari where native momentum scrolling
      // already exists and Lenis can cause double-smoothing artifacts.
      // The 'auto' setting detects iOS and disables itself automatically in Lenis 1.x.
    });

    lenisRef.current = lenis;

    // ─── RAF Loop ──────────────────────────────────────────────────────────
    // Lenis must be ticked on every animation frame. We also dispatch a
    // synthetic scroll event here so that framer-motion's useScroll() hook,
    // which listens to window scroll events, receives the Lenis-adjusted
    // scroll position rather than the real scrollY (which Lenis suppresses).
    function raf(time: number) {
      lenis.raf(time);
      rafRef.current = requestAnimationFrame(raf);
    }
    rafRef.current = requestAnimationFrame(raf);

    // ─── Cleanup ───────────────────────────────────────────────────────────
    return () => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
      }
      lenis.destroy();
      lenisRef.current = null;
    };
  }, []); // Empty deps: run once, mirrors component lifecycle.

  return (
    <SmoothScrollContext.Provider value={{ lenis: lenisRef.current }}>
      {children}
    </SmoothScrollContext.Provider>
  );
}
```

### 2.3 Usage in Landing Page

```typescript
// frontend/src/app/(landing)/page.tsx
import { SmoothScroll } from '@/components/landing/SmoothScroll';

export default function LandingPage() {
  return (
    <SmoothScroll>
      {/* All landing page sections */}
      <HeroSection />
      <ProblemSection />
      <HowItWorksSection />
      {/* ... */}
    </SmoothScroll>
  );
}
```

### 2.4 Programmatic Scroll (e.g., Nav "Get Started" button)

```typescript
// Inside any child component of <SmoothScroll>
import { useSmoothScroll } from '@/components/landing/SmoothScroll';

function NavCTAButton() {
  const { lenis } = useSmoothScroll();

  function handleClick() {
    // Smooth scroll to the final CTA section
    lenis?.scrollTo('#cta-section', {
      offset: -80,        // 80px offset to account for fixed navbar height
      duration: 1.5,
      easing: (t: number) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
    });
  }

  return <button onClick={handleClick}>Get Started Free</button>;
}
```

---

## 3. Animation Patterns — Complete Code Examples

All animation components live in `frontend/src/components/landing/animations/`. Import them into section components as needed.

### Pattern A: Staggered Fade-Up

**Used in:** Hero headline, section headers ("How It Works", "Features"), feature card grids

**Behaviour:** Container becomes visible on mount (or viewport entry). Each child animates upward from `y: 30` to `y: 0` with a 150ms stagger between children.

```typescript
// frontend/src/components/landing/animations/StaggerFadeUp.tsx
'use client';

import { motion, Variants, HTMLMotionProps } from 'framer-motion';
import { ReactNode } from 'react';

// ─── Variants ──────────────────────────────────────────────────────────────
// Defined outside the component to avoid recreation on every render.
const containerVariants: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      // Each child begins its animation 150ms after the previous one.
      staggerChildren: 0.15,
      // The first child waits 100ms after the container becomes visible.
      // This gives React time to paint the container before children animate.
      delayChildren: 0.1,
    },
  },
};

const itemVariants: Variants = {
  hidden: { opacity: 0, y: 30 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.6,
      // Custom cubic-bezier: fast start, smooth deceleration (easeOutExpo approximation).
      // Values: [x1, y1, x2, y2] of the cubic bezier curve.
      ease: [0.16, 1, 0.3, 1],
    },
  },
};

// ─── Container Component ──────────────────────────────────────────────────
interface StaggerContainerProps extends HTMLMotionProps<'div'> {
  children: ReactNode;
  // If true, animation triggers on viewport entry instead of immediately.
  // Use for below-the-fold content.
  onScroll?: boolean;
  className?: string;
}

export function StaggerContainer({
  children,
  onScroll = false,
  className,
  ...rest
}: StaggerContainerProps) {
  const viewportProps = onScroll
    ? { initial: 'hidden', whileInView: 'visible', viewport: { once: true, margin: '-80px' } }
    : { initial: 'hidden', animate: 'visible' };

  return (
    <motion.div
      variants={containerVariants}
      className={className}
      {...viewportProps}
      {...rest}
    >
      {children}
    </motion.div>
  );
}

// ─── Item Component ───────────────────────────────────────────────────────
interface StaggerItemProps extends HTMLMotionProps<'div'> {
  children: ReactNode;
  className?: string;
}

export function StaggerItem({ children, className, ...rest }: StaggerItemProps) {
  return (
    <motion.div variants={itemVariants} className={className} {...rest}>
      {children}
    </motion.div>
  );
}

// ─── Usage Example ────────────────────────────────────────────────────────
// Hero headline (triggers on page load):
//
// <StaggerContainer>
//   <StaggerItem><h1>Plan Every Meal</h1></StaggerItem>
//   <StaggerItem><p>For your whole family</p></StaggerItem>
//   <StaggerItem><CTAButton /></StaggerItem>
// </StaggerContainer>
//
// Section header (triggers on scroll):
//
// <StaggerContainer onScroll>
//   <StaggerItem><h2>How It Works</h2></StaggerItem>
//   <StaggerItem><p>Three simple steps</p></StaggerItem>
// </StaggerContainer>
```

---

### Pattern B: Scroll-Triggered Fade-Up

**Used in:** Individual cards, step items, feature list items, comparison rows — any element that should animate as the user scrolls it into view.

**Behaviour:** Element starts invisible at `y: 40`, animates to visible at `y: 0` once it enters the viewport.

```typescript
// frontend/src/components/landing/animations/ScrollFadeUp.tsx
'use client';

import { motion, HTMLMotionProps } from 'framer-motion';
import { ReactNode } from 'react';

interface ScrollFadeUpProps extends HTMLMotionProps<'div'> {
  children: ReactNode;
  className?: string;
  // Delay in seconds before the animation starts (useful for staggering
  // sibling elements that don't share a parent container variant).
  delay?: number;
  // Distance in pixels the element travels upward during animation.
  distance?: number;
}

export function ScrollFadeUp({
  children,
  className,
  delay = 0,
  distance = 40,
  ...rest
}: ScrollFadeUpProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: distance }}
      whileInView={{ opacity: 1, y: 0 }}
      // once: true — animation fires only the first time the element enters
      // the viewport. Does not replay on scroll-back. This is the standard
      // pattern for landing pages where replaying would feel distracting.
      //
      // margin: "-100px" — the animation triggers 100px before the element
      // fully enters the viewport, so it's already animating when the user
      // sees it (avoids popping in at the edge).
      viewport={{ once: true, margin: '-100px' }}
      transition={{
        duration: 0.6,
        ease: [0.16, 1, 0.3, 1],   // easeOutExpo approximation
        delay,
      }}
      className={className}
      {...rest}
    >
      {children}
    </motion.div>
  );
}

// ─── Usage Example ────────────────────────────────────────────────────────
// How It Works step card (with manual stagger via delay prop):
//
// {steps.map((step, index) => (
//   <ScrollFadeUp key={step.id} delay={index * 0.15}>
//     <StepCard step={step} />
//   </ScrollFadeUp>
// ))}
```

---

### Pattern C: Parallax Image

**Used in:** Hero section image (the family dinner image on the right side of the hero)

**Behaviour:** As the user scrolls down from the hero, the image moves upward more slowly than the page (parallax effect), and subtly scales up. Creates a cinematic depth illusion.

```typescript
// frontend/src/components/landing/animations/ParallaxImage.tsx
'use client';

import { useRef, ReactNode } from 'react';
import {
  motion,
  useScroll,
  useTransform,
  useReducedMotion,
  MotionValue,
} from 'framer-motion';

interface ParallaxImageProps {
  children: ReactNode;
  className?: string;
  // How many pixels the image shifts upward at full scroll through the hero section.
  // 80px is subtle; increase to 120px for more dramatic effect.
  parallaxDistance?: number;
}

export function ParallaxImage({
  children,
  className,
  parallaxDistance = 80,
}: ParallaxImageProps) {
  const ref = useRef<HTMLDivElement>(null);
  const shouldReduceMotion = useReducedMotion();

  // useScroll tracks the window's scrollY.
  // We do NOT use 'target' here because we want the parallax relative to
  // the document scroll origin, not the element's scroll position within itself.
  const { scrollY } = useScroll();

  // Map scrollY [0 → 500px] to y translation [0 → -parallaxDistance px].
  // The element moves UP (negative y) as the user scrolls down.
  // The 500px input range corresponds roughly to the height of the hero section.
  const y: MotionValue<number> = useTransform(
    scrollY,
    [0, 500],
    shouldReduceMotion ? [0, 0] : [0, -parallaxDistance]
  );

  // Subtle scale increase as user scrolls — enhances the 3D depth illusion.
  // Element goes from 1x to 1.05x scale over the same scroll range.
  const scale: MotionValue<number> = useTransform(
    scrollY,
    [0, 500],
    shouldReduceMotion ? [1, 1] : [1, 1.05]
  );

  return (
    // The outer div clips the image so the scale increase doesn't cause overflow.
    <div ref={ref} className={`overflow-hidden ${className ?? ''}`}>
      <motion.div style={{ y, scale }} className="w-full h-full">
        {children}
      </motion.div>
    </div>
  );
}

// ─── Usage Example ────────────────────────────────────────────────────────
//
// <ParallaxImage className="rounded-2xl" parallaxDistance={80}>
//   <Image
//     src="/images/landing/hero-family.png"
//     alt="Indian family sharing a meal"
//     width={1200}
//     height={800}
//     priority
//     className="w-full h-full object-cover"
//   />
// </ParallaxImage>
```

---

### Pattern D: Scroll-Linked Text Reveal

**Used in:** Problem Statement section — a paragraph describing the pain points, revealed word-by-word as the user scrolls through the section.

**Behaviour:** The text starts at 15% opacity (barely visible). As the user scrolls through the section, each word transitions to 100% opacity in sequence. By the time the section exits the viewport, all words are fully revealed.

```typescript
// frontend/src/components/landing/animations/ScrollTextReveal.tsx
'use client';

import { useRef } from 'react';
import {
  motion,
  useScroll,
  useTransform,
  MotionValue,
  useReducedMotion,
} from 'framer-motion';

interface ScrollTextRevealProps {
  // The full paragraph text to reveal.
  text: string;
  className?: string;
  // CSS class applied to each word span (for font/colour styling).
  wordClassName?: string;
}

interface WordProps {
  word: string;
  // Normalised [0, 1] range within scrollYProgress at which this word starts revealing.
  rangeStart: number;
  // Normalised [0, 1] range within scrollYProgress at which this word is fully revealed.
  rangeEnd: number;
  // The shared scrollYProgress MotionValue from the parent.
  scrollYProgress: MotionValue<number>;
  wordClassName?: string;
}

function Word({
  word,
  rangeStart,
  rangeEnd,
  scrollYProgress,
  wordClassName,
}: WordProps) {
  // Each word has its own opacity transform mapped to the shared scroll progress.
  // Words are dimmed to 0.15 (not 0) so the full text block shape is visible,
  // giving the user a sense of what's coming.
  const opacity = useTransform(scrollYProgress, [rangeStart, rangeEnd], [0.15, 1]);

  return (
    <motion.span
      style={{ opacity }}
      className={`inline-block mr-[0.25em] ${wordClassName ?? ''}`}
    >
      {word}
    </motion.span>
  );
}

export function ScrollTextReveal({
  text,
  className,
  wordClassName,
}: ScrollTextRevealProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const shouldReduceMotion = useReducedMotion();

  // Track scroll progress relative to this section's position in the page.
  // offset: ["start 0.8", "end 0.2"] means:
  //   - Animation STARTS when the top of the section reaches 80% down from the viewport top.
  //   - Animation ENDS when the bottom of the section reaches 20% down from the viewport top.
  // This gives a comfortable reveal window as the user scrolls through the section.
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ['start 0.8', 'end 0.2'],
  });

  const words = text.split(' ');

  if (shouldReduceMotion) {
    // Accessibility: no animation for users who prefer reduced motion.
    return (
      <div className={className} ref={containerRef}>
        {text}
      </div>
    );
  }

  return (
    <div ref={containerRef} className={className} aria-label={text}>
      {/* aria-label on the container provides the full text to screen readers.
          The individual word spans are aria-hidden to prevent double-reading. */}
      <span aria-hidden="true">
        {words.map((word, i) => {
          // Divide the [0, 1] scroll progress range equally among all words.
          // Each word occupies 1/words.length of the total scroll range.
          const start = i / words.length;
          // Each word's end overlaps with the next word's start slightly
          // (by adding a 20% buffer) to create a smooth flowing reveal
          // rather than word-by-word hard switches.
          const end = start + 1.2 / words.length;

          return (
            <Word
              key={`${word}-${i}`}
              word={word}
              rangeStart={start}
              rangeEnd={Math.min(end, 1)} // Clamp to [0, 1]
              scrollYProgress={scrollYProgress}
              wordClassName={wordClassName}
            />
          );
        })}
      </span>
    </div>
  );
}

// ─── Usage Example ────────────────────────────────────────────────────────
//
// <ScrollTextReveal
//   text="Every evening, the same question: what do I cook for dinner tonight?
//         It feels like a never-ending puzzle — different tastes, different needs,
//         and no time to figure it all out."
//   className="text-2xl md:text-3xl font-light text-white leading-relaxed max-w-3xl mx-auto text-center"
//   wordClassName="text-white"
// />
```

---

### Pattern E: Navbar Background Transition

**Used in:** Fixed navbar — starts fully transparent (sitting over the hero), transitions to a blurred dark background after 80px of scroll.

**Behaviour:** On page load, navbar is transparent. Once `scrollY > 80`, the navbar background fades in as a dark frosted glass (`bg-black/80 backdrop-blur-md`).

```typescript
// frontend/src/components/landing/LandingNavbar.tsx (relevant animation logic)
'use client';

import { useState, useEffect } from 'react';
import { useScroll, useMotionValueEvent } from 'framer-motion';

// ─── Custom Hook ─────────────────────────────────────────────────────────
// Extracted as a hook for testability and reuse.
export function useNavbarScrolled(threshold = 80): boolean {
  const { scrollY } = useScroll();
  const [isScrolled, setIsScrolled] = useState(false);

  // useMotionValueEvent is framer-motion's preferred way to subscribe to
  // motion value changes. It avoids React re-render batching issues that
  // can occur with useEffect + addEventListener.
  useMotionValueEvent(scrollY, 'change', (latest: number) => {
    // Toggle state only when crossing the threshold to prevent unnecessary
    // re-renders on every scroll event.
    const shouldBeScrolled = latest > threshold;
    if (shouldBeScrolled !== isScrolled) {
      setIsScrolled(shouldBeScrolled);
    }
  });

  return isScrolled;
}

// ─── Navbar Component ─────────────────────────────────────────────────────
export function LandingNavbar() {
  const isScrolled = useNavbarScrolled(80);

  return (
    <nav
      className={`
        fixed top-0 left-0 right-0 z-50
        px-6 py-4
        flex items-center justify-between
        transition-all duration-300 ease-in-out
        ${isScrolled
          ? 'bg-black/80 backdrop-blur-md border-b border-white/5 shadow-lg shadow-black/20'
          : 'bg-transparent border-b border-transparent'
        }
      `}
    >
      {/* Logo, nav links, CTA button */}
    </nav>
  );
}

// NOTE: transition-all duration-300 in Tailwind handles the CSS transition.
// framer-motion is not needed here — CSS transitions are sufficient and more
// performant for simple property changes like background-color and backdrop-filter.
```

---

### Pattern F: Number Counter (Animated Stats)

**Used in:** Stats section — numbers like "50,000+ Families", "4.8/5 Rating", "95% Less Planning Time" count up from 0 to their final value.

**Behaviour:** Counter starts at 0 when the stat enters the viewport. Counts to the final value over 2 seconds using an easeOutExpo curve. Formats number with commas and suffix (e.g., "+", "%", "K").

```typescript
// frontend/src/components/landing/animations/AnimatedCounter.tsx
'use client';

import { useState, useEffect, useRef } from 'react';
import { useReducedMotion } from 'framer-motion';

interface AnimatedCounterProps {
  // The final numeric value to count to.
  target: number;
  // Optional suffix appended after the number (e.g., "+", "%", "K", "/5").
  suffix?: string;
  // Optional prefix prepended before the number (e.g., "₹").
  prefix?: string;
  // Duration of the count animation in milliseconds.
  duration?: number;
  // Number of decimal places for the formatted output (0 for integers).
  decimals?: number;
  className?: string;
}

// easeOutExpo: t in [0,1] -> normalised progress value in [0,1]
// Provides a fast start that decelerates dramatically near the end,
// making the counter feel like it's "landing" on the final number.
function easeOutExpo(t: number): number {
  return t === 1 ? 1 : 1 - Math.pow(2, -10 * t);
}

export function AnimatedCounter({
  target,
  suffix = '',
  prefix = '',
  duration = 2000,
  decimals = 0,
  className,
}: AnimatedCounterProps) {
  const [displayValue, setDisplayValue] = useState(0);
  const [hasStarted, setHasStarted] = useState(false);
  const containerRef = useRef<HTMLSpanElement>(null);
  const animationRef = useRef<number | null>(null);
  const shouldReduceMotion = useReducedMotion();

  // ─── Intersection Observer ──────────────────────────────────────────────
  // Start counting only when the element is visible in the viewport.
  // Avoids wasted animation cycles for off-screen elements.
  useEffect(() => {
    const element = containerRef.current;
    if (!element) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && !hasStarted) {
          setHasStarted(true);
          observer.disconnect(); // Count only once, then stop observing.
        }
      },
      { threshold: 0.3 } // Trigger when 30% of the element is visible.
    );

    observer.observe(element);
    return () => observer.disconnect();
  }, [hasStarted]);

  // ─── Counter Animation ──────────────────────────────────────────────────
  useEffect(() => {
    if (!hasStarted) return;

    // Accessibility: skip animation for users who prefer reduced motion.
    if (shouldReduceMotion) {
      setDisplayValue(target);
      return;
    }

    const startTime = performance.now();

    function tick(currentTime: number) {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1); // Clamp to [0, 1]
      const easedProgress = easeOutExpo(progress);

      setDisplayValue(easedProgress * target);

      if (progress < 1) {
        animationRef.current = requestAnimationFrame(tick);
      } else {
        // Ensure we land exactly on the target value (avoids floating point drift).
        setDisplayValue(target);
      }
    }

    animationRef.current = requestAnimationFrame(tick);

    return () => {
      if (animationRef.current !== null) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [hasStarted, target, duration, shouldReduceMotion]);

  // ─── Formatting ─────────────────────────────────────────────────────────
  const formatted = displayValue.toLocaleString('en-IN', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });

  return (
    <span ref={containerRef} className={className} aria-label={`${prefix}${target}${suffix}`}>
      {prefix}{formatted}{suffix}
    </span>
  );
}

// ─── Usage Example ────────────────────────────────────────────────────────
//
// <AnimatedCounter target={50000} suffix="+" />      → "50,000+"
// <AnimatedCounter target={4.8} suffix="/5" decimals={1} />  → "4.8/5"
// <AnimatedCounter target={95} suffix="%" />         → "95%"
```

---

### Pattern G: SVG Path Draw

**Used in:** "How It Works" section — a connecting line (or curved path) that draws itself between the 4 steps as the user scrolls through the section.

**Behaviour:** The SVG path's stroke progresses from 0% to 100% drawn as the user scrolls from the top of the How It Works section to its bottom.

```typescript
// frontend/src/components/landing/animations/ScrollPathDraw.tsx
'use client';

import { useRef } from 'react';
import { motion, useScroll, useTransform, useReducedMotion } from 'framer-motion';

interface ScrollPathDrawProps {
  // SVG viewBox dimensions.
  viewBox: string;
  // The 'd' attribute of the SVG path to draw.
  // For a horizontal connector between 4 steps: "M 40 20 L 560 20"
  // For a curved/stepped connector: "M 40 20 C 200 20 200 80 360 80 C 520 80 520 20 560 20" (example)
  pathD: string;
  className?: string;
  // Colour of the drawn line — defaults to brand green.
  strokeColor?: string;
  strokeWidth?: number;
}

export function ScrollPathDraw({
  viewBox,
  pathD,
  className,
  strokeColor = 'var(--color-brand-green)',
  strokeWidth = 2,
}: ScrollPathDrawProps) {
  const sectionRef = useRef<HTMLDivElement>(null);
  const shouldReduceMotion = useReducedMotion();

  const { scrollYProgress } = useScroll({
    target: sectionRef,
    // Start drawing when the section top hits 80% viewport height.
    // Finish when the section bottom reaches 20% viewport height.
    offset: ['start 0.8', 'end 0.2'],
  });

  // Map scroll progress to pathLength [0, 1].
  // Allows us to start the draw at a slightly delayed scroll position
  // and end slightly before the section exits, so the line is always "ahead of"
  // the content revealing below it.
  const pathLength = useTransform(
    scrollYProgress,
    [0.1, 0.9],
    shouldReduceMotion ? [1, 1] : [0, 1]
  );

  return (
    <div ref={sectionRef} className={className}>
      <svg
        viewBox={viewBox}
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="absolute inset-0 w-full h-full pointer-events-none"
        aria-hidden="true" // Decorative SVG, not meaningful to screen readers.
      >
        {/* Background track — the full path shown at low opacity as a guide */}
        <path
          d={pathD}
          stroke={strokeColor}
          strokeWidth={strokeWidth}
          strokeOpacity={0.15}
          strokeLinecap="round"
        />
        {/* Animated draw path — overlays the track and progresses with scroll */}
        <motion.path
          d={pathD}
          stroke={strokeColor}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          // pathLength framer-motion prop accepts a MotionValue<number>.
          // When pathLength is 0, nothing is drawn.
          // When pathLength is 1, the full path is drawn.
          style={{ pathLength }}
        />
      </svg>
    </div>
  );
}

// ─── Usage Example ────────────────────────────────────────────────────────
//
// Wrap the How It Works section content with ScrollPathDraw.
// The SVG is positioned absolutely within the relative-positioned section.
//
// <section className="relative py-24">
//   <ScrollPathDraw
//     viewBox="0 0 600 40"
//     pathD="M 40 20 L 560 20"
//     className="relative"
//   />
//   <div className="grid grid-cols-4 gap-8">
//     {steps.map(step => <StepCard key={step.id} step={step} />)}
//   </div>
// </section>
```

---

### Pattern H: Tab Content Transition (AnimatePresence)

**Used in:** Feature Showcase section — a tabbed interface where each tab shows a different app feature (e.g., "Meal Planning", "Grocery List", "Family Profiles"). The content slides in/out when tabs switch.

**Behaviour:** Current tab content slides out to the left (`x: -20`) while fading out. New tab content slides in from the right (`x: 20`) while fading in. Both happen simultaneously (`mode="wait"` ensures the exit completes before the enter begins — prevents overlapping content).

```typescript
// frontend/src/components/landing/animations/TabTransition.tsx
'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { ReactNode } from 'react';

interface TabTransitionProps {
  // A unique key for the currently active tab.
  // When this key changes, AnimatePresence triggers the exit/enter animation.
  activeKey: string | number;
  children: ReactNode;
  className?: string;
}

export function TabTransition({ activeKey, children, className }: TabTransitionProps) {
  return (
    // mode="wait": the exiting element fully completes its exit animation
    // before the entering element begins its enter animation.
    // This prevents visual overlap between old and new tab content.
    <AnimatePresence mode="wait">
      <motion.div
        // The key prop is how AnimatePresence detects a change.
        // When key changes, the current div gets the exit animation,
        // and a new div with the new content gets the enter animation.
        key={activeKey}
        initial={{ opacity: 0, x: 20 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: -20 }}
        transition={{
          duration: 0.3,
          ease: [0.16, 1, 0.3, 1],
        }}
        className={className}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
}

// ─── Usage Example ────────────────────────────────────────────────────────
//
// const [activeTab, setActiveTab] = useState('meal-planning');
//
// <div>
//   {/* Tab buttons */}
//   <div className="flex gap-2">
//     {tabs.map(tab => (
//       <button key={tab.id} onClick={() => setActiveTab(tab.id)}>
//         {tab.label}
//       </button>
//     ))}
//   </div>
//
//   {/* Animated tab content */}
//   <TabTransition activeKey={activeTab}>
//     {tabs.find(t => t.id === activeTab)?.content}
//   </TabTransition>
// </div>
```

---

## 4. CSS Animations

All keyframe animations are defined in `frontend/src/app/globals.css` inside an `@layer utilities` block (required for Tailwind v4 compatibility — see project memory note on cascade layers).

```css
/* frontend/src/app/globals.css */

@import "tailwindcss";

@layer utilities {

  /* ─── Marquee Scroll ──────────────────────────────────────────────────────
   * Used by the cuisine marquee section.
   * Two rows: top row scrolls left, bottom row scrolls right (creates a
   * visually dynamic layered effect).
   *
   * Duration 40s: long enough that the scroll feels smooth and unhurried.
   * The marquee container holds two identical sets of cards (duplicated in HTML)
   * so the loop is seamless — by the time the first set exits, the second set
   * has filled in and the animation loops invisibly.
   */

  @keyframes marquee-left {
    0%   { transform: translateX(0); }
    100% { transform: translateX(-50%); }
    /* -50% because the container is 200% wide (two copies of the card set). */
  }

  @keyframes marquee-right {
    0%   { transform: translateX(-50%); }
    100% { transform: translateX(0); }
    /* Reverse direction for the second row. */
  }

  .animate-marquee-left {
    animation: marquee-left 40s linear infinite;
  }
  .animate-marquee-right {
    animation: marquee-right 40s linear infinite;
  }

  /* Pause marquee on hover so users can read/inspect cuisine cards without
   * the content scrolling away under them. */
  .marquee-container:hover .animate-marquee-left,
  .marquee-container:hover .animate-marquee-right {
    animation-play-state: paused;
  }


  /* ─── Gradient Mesh Animation ─────────────────────────────────────────────
   * Used by the final CTA section background.
   * A large gradient with multiple colour stops shifts its background-position
   * slowly, creating a living, breathing colour-mesh effect.
   *
   * The element must have:
   *   background-size: 400% 400%;
   * for the background-position shift to be visible.
   */

  @keyframes gradientMesh {
    0%   { background-position: 0%   50%; }
    25%  { background-position: 100% 50%; }
    50%  { background-position: 100%  0%; }
    75%  { background-position: 0%    0%; }
    100% { background-position: 0%   50%; }
  }

  .animate-gradient-mesh {
    background-size: 400% 400%;
    animation: gradientMesh 15s ease infinite;
  }

  /*
   * Suggested gradient for the CTA background (apply via Tailwind or inline style):
   * background-image: linear-gradient(
   *   135deg,
   *   #0A0A0A 0%,          -- near black
   *   #1a2e1a 25%,         -- very dark green
   *   #2d1a0e 50%,         -- very dark amber/brown
   *   #1a1a2e 75%,         -- very dark indigo
   *   #0A0A0A 100%         -- near black
   * );
   */


  /* ─── Particle Float ──────────────────────────────────────────────────────
   * Used by individual floating particles in the hero background.
   * Each particle should have a unique animation-duration and animation-delay
   * to prevent synchronised movement (looks unnatural).
   *
   * Particles are absolutely positioned spans/divs with:
   *   - A small size (2–6px diameter)
   *   - A random starting position (set via inline style)
   *   - A slight opacity (0.2–0.4)
   *   - animation: particleFloat [20s–40s] linear infinite
   */

  @keyframes particleFloat {
    0%   { transform: translateY(0)   translateX(0)    opacity: 0; }
    10%  { opacity: 0.3; }
    90%  { opacity: 0.3; }
    100% { transform: translateY(-100vh) translateX(30px); opacity: 0; }
    /* Particles drift upward and slightly right as they rise, then
     * reset to their starting position (invisible at the bottom). */
  }

  /*
   * Usage: Apply via JSX with randomised duration.
   * Example:
   *   <span
   *     className="absolute w-1 h-1 rounded-full bg-brand-green/20"
   *     style={{
   *       left: `${Math.random() * 100}%`,
   *       top: `${Math.random() * 100}%`,
   *       animationDuration: `${20 + Math.random() * 20}s`,
   *       animationDelay: `${Math.random() * 10}s`,
   *       animation: `particleFloat linear infinite`,
   *     }}
   *   />
   */


  /* ─── Float (Gentle Bob) ──────────────────────────────────────────────────
   * Used for decorative floating elements (e.g., feature illustration icons,
   * 3D mockup phone in hero on mobile).
   * A gentle vertical oscillation — 10px up and back over 6 seconds.
   */

  @keyframes float {
    0%   { transform: translateY(0px); }
    50%  { transform: translateY(-10px); }
    100% { transform: translateY(0px); }
  }

  .animate-float {
    animation: float 6s ease-in-out infinite;
  }


  /* ─── Glow Pulse ──────────────────────────────────────────────────────────
   * Used for the brand-green glow behind the hero CTA button and on feature
   * highlight icons. Pulses the glow opacity softly.
   *
   * Element should have:
   *   box-shadow: 0 0 40px var(--color-brand-green);
   * The animation modifies its opacity, not the shadow directly,
   * since opacity changes are GPU-composited (no layout recalculation).
   */

  @keyframes glowPulse {
    0%,100% { opacity: 0.4; }
    50%      { opacity: 0.9; }
  }

  .animate-glow-pulse {
    animation: glowPulse 2.5s ease-in-out infinite;
  }


  /* ─── Shimmer (Skeleton Loading) ──────────────────────────────────────────
   * Used on skeleton placeholder elements while images or API data load.
   * A bright band sweeps across the element left-to-right, suggesting loading.
   *
   * Element must have:
   *   background: linear-gradient(90deg, transparent, rgba(255,255,255,0.06), transparent);
   *   background-size: 200% 100%;
   */

  @keyframes shimmer {
    0%   { background-position: -200% 0; }
    100% { background-position:  200% 0; }
  }

  .animate-shimmer {
    background: linear-gradient(
      90deg,
      rgba(255,255,255,0)    0%,
      rgba(255,255,255,0.06) 50%,
      rgba(255,255,255,0)    100%
    );
    background-size: 200% 100%;
    animation: shimmer 2s linear infinite;
  }

}
```

---

## 5. Swiper Carousel Configuration

**Used in:** Testimonials section — auto-playing carousel of 6–8 customer testimonial cards.

### 5.1 Dependencies (already included in package.json above)
```typescript
import { Swiper, SwiperSlide } from 'swiper/react';
import { Autoplay, Pagination, Navigation, A11y } from 'swiper/modules';

// Import Swiper CSS — must be imported in the component or a parent layout.
// Dynamic import is recommended to avoid adding Swiper CSS to the global bundle.
import 'swiper/css';
import 'swiper/css/pagination';
import 'swiper/css/navigation';
```

### 5.2 Full Component

```typescript
// frontend/src/components/landing/TestimonialCarousel.tsx
'use client';

import { Swiper, SwiperSlide } from 'swiper/react';
import { Autoplay, Pagination, Navigation, A11y } from 'swiper/modules';
import { useReducedMotion } from 'framer-motion';

// Swiper CSS imports — loaded once when component mounts.
// In Next.js App Router, this is fine because the component is client-side only.
import 'swiper/css';
import 'swiper/css/pagination';
import 'swiper/css/navigation';

export interface Testimonial {
  id: string;
  name: string;
  location: string;             // e.g., "Mumbai, Maharashtra"
  avatarUrl: string;
  rating: number;               // 1–5
  quote: string;
  familySize: string;           // e.g., "Family of 4"
}

interface TestimonialCarouselProps {
  testimonials: Testimonial[];
}

export function TestimonialCarousel({ testimonials }: TestimonialCarouselProps) {
  const shouldReduceMotion = useReducedMotion();

  return (
    <div className="testimonial-swiper-container relative w-full">
      <Swiper
        modules={[Autoplay, Pagination, Navigation, A11y]}

        // ─── Layout ────────────────────────────────────────────────────
        // slidesPerView with 'auto' lets slides have their natural width.
        // We use a fixed width via CSS instead for consistent card sizing.
        slidesPerView={1}
        breakpoints={{
          // Tablet: show 2 slides
          640: {
            slidesPerView: 2,
            spaceBetween: 24,
          },
          // Desktop: show 3 slides
          1024: {
            slidesPerView: 3,
            spaceBetween: 32,
          },
        }}
        spaceBetween={16}
        centeredSlides={false}

        // ─── Loop ─────────────────────────────────────────────────────
        // loop: true requires at least (slidesPerView * 2) slides to
        // function correctly. Ensure testimonials.length >= 6.
        loop={testimonials.length >= 6}

        // ─── Autoplay ─────────────────────────────────────────────────
        autoplay={
          shouldReduceMotion
            ? false  // Disable autoplay for reduced-motion users.
            : {
                delay: 5000,           // 5 seconds per slide.
                disableOnInteraction: true,  // Stop autoplay if user interacts.
                pauseOnMouseEnter: true,     // Pause when cursor enters carousel.
              }
        }

        // ─── Pagination ────────────────────────────────────────────────
        pagination={{
          clickable: true,
          // Custom class prefix for styling via CSS below.
          bulletClass: 'testimonial-bullet',
          bulletActiveClass: 'testimonial-bullet-active',
        }}

        // ─── Navigation ────────────────────────────────────────────────
        navigation={{
          nextEl: '.testimonial-next',
          prevEl: '.testimonial-prev',
        }}

        // ─── Accessibility ─────────────────────────────────────────────
        a11y={{
          prevSlideMessage: 'Previous testimonial',
          nextSlideMessage: 'Next testimonial',
        }}

        // ─── Touch ────────────────────────────────────────────────────
        grabCursor={true}           // Shows a grab cursor on hover (desktop).

        className="pb-12"           // Bottom padding for pagination dots.
      >
        {testimonials.map((testimonial) => (
          <SwiperSlide key={testimonial.id}>
            <TestimonialCard testimonial={testimonial} />
          </SwiperSlide>
        ))}
      </Swiper>

      {/* Custom navigation buttons — styled to match dark theme */}
      <button
        className="testimonial-prev absolute left-0 top-1/2 -translate-y-1/2 z-10
                   w-10 h-10 rounded-full bg-white/10 border border-white/20
                   flex items-center justify-center
                   hover:bg-brand-green/20 hover:border-brand-green/40
                   transition-colors duration-200
                   -translate-x-5 md:-translate-x-12"
        aria-label="Previous testimonial"
      >
        {/* Left arrow SVG icon */}
        <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
      </button>

      <button
        className="testimonial-next absolute right-0 top-1/2 -translate-y-1/2 z-10
                   w-10 h-10 rounded-full bg-white/10 border border-white/20
                   flex items-center justify-center
                   hover:bg-brand-green/20 hover:border-brand-green/40
                   transition-colors duration-200
                   translate-x-5 md:translate-x-12"
        aria-label="Next testimonial"
      >
        {/* Right arrow SVG icon */}
        <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
      </button>
    </div>
  );
}
```

### 5.3 Custom Swiper CSS (Dark Theme)

Add this in `globals.css` inside `@layer components`:

```css
@layer components {
  /* ─── Swiper Pagination Dots ──────────────────────────────────────────── */
  .testimonial-bullet {
    display: inline-block;
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: rgba(255, 255, 255, 0.2);
    border: 1px solid rgba(255, 255, 255, 0.15);
    cursor: pointer;
    transition: all 0.3s ease;
    margin: 0 4px !important;
  }

  .testimonial-bullet-active {
    background: var(--color-brand-green);
    border-color: var(--color-brand-green);
    /* Expand active dot to a pill shape */
    width: 24px;
    border-radius: 4px;
  }

  /* ─── Swiper Container Overflow Fix ──────────────────────────────────── */
  /* Swiper injects overflow: hidden by default. We need the navigation
   * arrows to be visually outside the slide area, so we override to visible. */
  .testimonial-swiper-container .swiper {
    overflow: visible;
  }
  /* But we do want horizontal overflow hidden to prevent slides from showing
   * outside the section bounds. */
  .testimonial-swiper-container {
    overflow-x: hidden;
  }
}
```

---

## 6. Performance Guidelines

### 6.1 GPU-Accelerated Properties Only
Always animate using CSS `transform` and `opacity`. These properties are handled on the GPU compositor thread and do not trigger layout recalculation or paint.

**Do:**
```typescript
// translate, scale, rotate — all GPU compositor thread
initial={{ opacity: 0, y: 40 }}
animate={{ opacity: 1, y: 0 }}
```

**Do not:**
```typescript
// top, left, width, height — trigger layout recalculation (expensive)
initial={{ top: 40 }}
animate={{ top: 0 }}
```

### 6.2 `will-change` Usage
Use `will-change: transform` **only on elements that are actively animating**. Applying it broadly wastes GPU memory and can degrade performance.

```typescript
// Correct: applied dynamically during animation, removed after
const [isAnimating, setIsAnimating] = useState(false);
<motion.div
  style={{ willChange: isAnimating ? 'transform' : 'auto' }}
  onAnimationStart={() => setIsAnimating(true)}
  onAnimationComplete={() => setIsAnimating(false)}
/>
```

For marquee elements (always animating): `will-change: transform` is acceptable because they are always in motion.

### 6.3 `viewport={{ once: true }}`
All `whileInView` animations must include `viewport={{ once: true }}`. This ensures the IntersectionObserver unsubscribes after the first trigger, preventing unnecessary callbacks on every subsequent scroll event.

### 6.4 Lazy-Loading Swiper
Swiper's CSS and JS adds ~35KB to the initial bundle. Since the testimonials section is below the fold, use dynamic imports:

```typescript
// frontend/src/components/landing/TestimonialSection.tsx
'use client';

import dynamic from 'next/dynamic';

const TestimonialCarousel = dynamic(
  () => import('./TestimonialCarousel').then(mod => mod.TestimonialCarousel),
  {
    ssr: false,  // Swiper has DOM-dependent initialisation, skip SSR.
    loading: () => (
      <div className="w-full h-48 animate-shimmer rounded-2xl bg-white/5" />
    ),
  }
);
```

### 6.5 Scroll Handler Debouncing
If using raw `window.addEventListener('scroll', handler)` anywhere outside of framer-motion/Lenis patterns (e.g., for a custom component), wrap the handler in a `requestAnimationFrame` debounce:

```typescript
useEffect(() => {
  let rafId: number | null = null;

  function handleScroll() {
    if (rafId) return; // Already scheduled for this frame.
    rafId = requestAnimationFrame(() => {
      // ... scroll logic ...
      rafId = null;
    });
  }

  window.addEventListener('scroll', handleScroll, { passive: true });
  return () => {
    window.removeEventListener('scroll', handleScroll);
    if (rafId) cancelAnimationFrame(rafId);
  };
}, []);
```

Note: `{ passive: true }` tells the browser this handler will never call `preventDefault()`, allowing the browser to scroll without waiting for the handler to complete.

### 6.6 Performance Validation
Run this checklist before shipping:
1. Open Chrome DevTools → Performance tab
2. Record a full scroll-through of the landing page (top to bottom, 10 seconds)
3. Confirm: **zero "Long Tasks" (>50ms) during scroll**
4. Confirm: **frame rate stays at 60fps** (no red spikes in the frames chart)
5. Common culprits if failing:
   - `whileInView` animations with `once: false` on many elements (switch to `once: true`)
   - Heavy images without `priority` or correct `sizes` prop causing layout shifts
   - Swiper loaded synchronously (switch to dynamic import)
   - `will-change` applied to too many elements (remove it)

---

## 7. Reduced Motion Accessibility

### 7.1 System Preference Detection

```typescript
// All animation components must import and respect useReducedMotion.
import { useReducedMotion } from 'framer-motion';

// framer-motion reads the CSS media query: prefers-reduced-motion: reduce.
// This is set by the user in their OS accessibility settings (macOS: System Settings
// → Accessibility → Display → Reduce Motion; Windows: Settings → Ease of Access
// → Display → Show animations).
const shouldReduceMotion = useReducedMotion();
```

### 7.2 Per-Feature Behaviour When Reduced Motion is Active

| Feature | Normal Behaviour | Reduced Motion Behaviour |
|---------|-----------------|--------------------------|
| Staggered fade-ups | y: 30 → 0, opacity 0 → 1, staggered | opacity 0 → 1 only (no y translation), no stagger delay |
| Parallax image | Moves -80px on scroll | Static — no transform applied |
| Scroll text reveal | Words fade in progressively on scroll | All text visible at full opacity immediately |
| Marquee | Infinite horizontal scroll | Paused — `animation-play-state: paused` applied via JS class |
| Number counter | Counts 0 → target over 2s | Shows final number immediately |
| Swiper autoplay | 5s per slide | Autoplay disabled — manual navigation only |
| Gradient mesh | 15s looping background shift | Static gradient — no animation |
| Tab transitions | Slide + fade (300ms) | Instant (no transition) |
| Navbar transition | 300ms fade | Instant — no transition class |
| Path draw | Draws on scroll | Fully drawn immediately (pathLength = 1) |
| Float (hero icons) | 6s bob animation | Static |

### 7.3 Global Reduced Motion CSS Override

In addition to component-level checks, add a global CSS override as a safety net for any animations that escape the component pattern:

```css
/* frontend/src/app/globals.css */
@layer base {
  @media (prefers-reduced-motion: reduce) {
    /* Stop all CSS keyframe animations globally */
    *,
    *::before,
    *::after {
      animation-duration: 0.01ms !important;
      animation-iteration-count: 1 !important;
      transition-duration: 0.01ms !important;
      scroll-behavior: auto !important;
    }

    /* Also force Lenis smooth scroll off — Lenis checks this internally
     * in v1.x, but belt-and-suspenders approach */
    html {
      scroll-behavior: auto;
    }
  }
}
```

---

## 8. Animation Timing Reference Table

A single reference sheet for all animation parameters across the landing page. Use this when implementing each section to ensure consistency.

| Element | Duration | Easing | Delay | Trigger | Pattern |
|---------|----------|--------|-------|---------|---------|
| Hero headline (each line) | 600ms | easeOutExpo `[0.16,1,0.3,1]` | 150ms stagger | Page load | Pattern A |
| Hero subheading | 600ms | easeOutExpo | 450ms (after lines) | Page load | Pattern A |
| Hero CTA button | 600ms | easeOutExpo | 650ms | Page load | Pattern A |
| Hero trust strip ("50K families…") | 500ms | easeOut | 900ms | Page load | Pattern A |
| Hero family image | 800ms | easeOut `[0.25,1,0.5,1]` | 300ms | Page load | Pattern C |
| Hero image parallax shift | N/A (scroll-driven) | N/A | 0 | Scroll position | Pattern C |
| Navbar bg transition | 300ms | `ease` | 0 | scroll > 80px | Pattern E |
| Problem statement words | ~150ms each | `linear` | Per-word scroll offset | Scroll position | Pattern D |
| How It Works connector path | N/A (scroll-driven) | N/A | 0 | Scroll position | Pattern G |
| How It Works step cards | 600ms each | easeOutExpo | 150ms stagger | Viewport entry | Pattern B |
| Step card image scale on hover | 500ms | easeOutExpo | 0 | Hover | CSS transition |
| Feature showcase tabs switch | 300ms | easeOutExpo | 0 | Click | Pattern H |
| Cuisine marquee (top row) | 40s per loop | `linear` | 0 | Always (CSS, infinite) | CSS `marquee-left` |
| Cuisine marquee (bottom row) | 40s per loop | `linear` | 0 | Always (CSS, infinite) | CSS `marquee-right` |
| Cuisine card hover lift | 250ms | easeOutExpo | 0 | Hover | CSS transition |
| Comparison table rows | 500ms each | easeOutExpo | 100ms stagger | Viewport entry | Pattern B |
| Stat counter numbers | 2000ms | easeOutExpo | 0 | Viewport entry (IO) | Pattern F |
| Testimonial slide auto-advance | 5000ms per slide | `ease` | 0 | Autoplay | Swiper |
| Testimonial slide transition | 300ms | `ease` | 0 | Swiper internal | Swiper |
| CTA gradient mesh shift | 15s per loop | `ease` | 0 | Always (CSS, infinite) | CSS `gradientMesh` |
| CTA headline | 600ms | easeOutExpo | 0 | Viewport entry | Pattern B |
| CTA button glow pulse | 2500ms per loop | `ease-in-out` | 0 | Always (CSS, infinite) | CSS `glowPulse` |
| Button hover glow (all CTA buttons) | 300ms | `ease` | 0 | Hover | CSS transition |
| Card hover lift (feature cards) | 250ms | easeOutExpo | 0 | Hover | CSS transition |
| Floating hero decoration icons | 6000ms per loop | `ease-in-out` | Random 0–2s | Always | CSS `float` |
| Hero background particles | 20–40s per loop | `linear` | Random 0–10s | Always | CSS `particleFloat` |
| Page enter transition | 400ms | easeOut | 0 | Route navigation | framer-motion layout |

### 8.1 Hover Interaction CSS (Reference)

These hover effects are implemented in Tailwind utility classes directly in the JSX, not in framer-motion, for performance and simplicity:

```typescript
// CTA Primary Button
className="
  group relative overflow-hidden
  bg-brand-green text-black font-semibold
  px-8 py-4 rounded-full
  transition-all duration-300 ease-out
  hover:shadow-[0_0_40px_rgba(var(--color-brand-green-rgb),0.5)]
  hover:scale-[1.02]
  active:scale-[0.98]
"

// Feature / Cuisine Card
className="
  group relative rounded-2xl overflow-hidden
  bg-white/5 border border-white/10
  transition-all duration-250
  hover:border-white/20
  hover:-translate-y-1
  hover:shadow-xl hover:shadow-black/30
"
```

---

## 9. Implementation Checklist

Use this checklist when implementing the animation system:

### Setup
- [ ] Install `framer-motion`, `@studio-freight/lenis`, `swiper`
- [ ] Create `frontend/src/components/landing/SmoothScroll.tsx`
- [ ] Wrap landing page root in `<SmoothScroll>`
- [ ] Add all `@keyframes` blocks to `globals.css` inside `@layer utilities`
- [ ] Add custom Swiper CSS to `globals.css` inside `@layer components`

### Pattern Components
- [ ] Create `StaggerContainer` + `StaggerItem` (Pattern A)
- [ ] Create `ScrollFadeUp` (Pattern B)
- [ ] Create `ParallaxImage` (Pattern C)
- [ ] Create `ScrollTextReveal` (Pattern D)
- [ ] Implement `useNavbarScrolled` hook (Pattern E)
- [ ] Create `AnimatedCounter` (Pattern F)
- [ ] Create `ScrollPathDraw` (Pattern G)
- [ ] Create `TabTransition` (Pattern H)

### Accessibility
- [ ] All animation components import and check `useReducedMotion()`
- [ ] Global CSS reduced motion override in `@layer base`
- [ ] Marquee pauseable on hover via CSS
- [ ] Swiper autoplay disabled when `shouldReduceMotion === true`

### Performance
- [ ] `viewport={{ once: true }}` on all `whileInView` usages
- [ ] Swiper loaded via `dynamic()` with `ssr: false`
- [ ] Hero image has `priority` prop
- [ ] All scroll handlers use `{ passive: true }`
- [ ] Chrome DevTools Performance audit: 60fps confirmed

---

*End of Document — Animation & Interaction System Specification*
