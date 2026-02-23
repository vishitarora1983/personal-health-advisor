/**
 * animations.ts
 *
 * Centralized framer-motion variant definitions for the FedRight landing page.
 * Defining variants outside components prevents recreation on every render.
 * Import from here rather than inline-defining in individual components.
 *
 * All animations use transform + opacity only for GPU compositing.
 * All viewport-triggered animations use once: true to avoid re-firing.
 */

import { Variants } from 'framer-motion';

// ─── Easing Curves ────────────────────────────────────────────────────────────
// easeOutExpo approximation: fast start, very gradual deceleration.
// This is the "premium" easing used throughout the UI.
const EASE_OUT_EXPO = [0.16, 1, 0.3, 1] as const;

// ─── Fade Up ──────────────────────────────────────────────────────────────────
// Used for: section headers, individual cards, any single-element reveal.
// Element starts 30px below, fades in and rises to its natural position.
export const fadeUpVariants: Variants = {
  hidden: { opacity: 0, y: 30 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.6, ease: EASE_OUT_EXPO },
  },
};

// ─── Stagger Container ────────────────────────────────────────────────────────
// Used as the wrapper for any group of elements that should stagger-reveal.
// Place StaggerItem variants inside for children.
export const staggerContainerVariants: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      // 150ms between each child's animation start
      staggerChildren: 0.15,
      // Small delay so the container paints before children animate
      delayChildren: 0.1,
    },
  },
};

// ─── Stagger Item ─────────────────────────────────────────────────────────────
// Used as children inside a staggerContainerVariants parent.
export const staggerItemVariants: Variants = {
  hidden: { opacity: 0, y: 30 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.6, ease: EASE_OUT_EXPO },
  },
};

// ─── Scale In ─────────────────────────────────────────────────────────────────
// Used for: modal dialogs, popover cards, feature highlight cards.
// Scales from 92% to 100% while fading in — creates a "pop" effect.
export const scaleInVariants: Variants = {
  hidden: { opacity: 0, scale: 0.92 },
  visible: {
    opacity: 1,
    scale: 1,
    transition: { duration: 0.5, ease: EASE_OUT_EXPO },
  },
};

// ─── Slide From Left ──────────────────────────────────────────────────────────
// Used for: left panel of comparison section (AIDifference), step-by-step items
// that should feel like they're coming from off-screen left.
export const slideFromLeftVariants: Variants = {
  hidden: { opacity: 0, x: -40 },
  visible: {
    opacity: 1,
    x: 0,
    transition: { duration: 0.5, ease: EASE_OUT_EXPO },
  },
};

// ─── Slide From Right ─────────────────────────────────────────────────────────
// Used for: right panel of comparison section, feature showcase panels.
export const slideFromRightVariants: Variants = {
  hidden: { opacity: 0, x: 40 },
  visible: {
    opacity: 1,
    x: 0,
    transition: { duration: 0.5, ease: EASE_OUT_EXPO },
  },
};

// ─── Fade In (no transform) ───────────────────────────────────────────────────
// Used for: overlay backgrounds, trust strips, subtle reveals where motion
// would feel excessive. Pure opacity transition only.
export const fadeInVariants: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { duration: 0.5, ease: 'easeOut' },
  },
};

// ─── Stagger Container (hero-specific) ───────────────────────────────────────
// Like staggerContainerVariants but starts immediately (no delayChildren).
// Used by hero section which animates on page load (no scroll trigger).
export const heroContainerVariants: Variants = {
  hidden: {},
  visible: {
    transition: {
      staggerChildren: 0.12,
    },
  },
};

// ─── Hero Item ────────────────────────────────────────────────────────────────
// Individual children inside heroContainerVariants.
export const heroItemVariants: Variants = {
  hidden: { opacity: 0, y: 24 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.6, ease: EASE_OUT_EXPO },
  },
};

// ─── Tab Panel Transition ─────────────────────────────────────────────────────
// Used with AnimatePresence for feature showcase tab switching.
// Exit: slides left and fades. Enter: slides in from right and fades in.
export const tabPanelVariants: Variants = {
  hidden: { opacity: 0, x: 20 },
  visible: {
    opacity: 1,
    x: 0,
    transition: { duration: 0.25, ease: 'easeInOut' },
  },
  exit: { opacity: 0, x: -20 },
};

// ─── Counter Config ───────────────────────────────────────────────────────────
// Shared timing config for animated number counters.
// Not a Variants object — used directly in useAnimation/useSpring calls.
export const counterConfig = {
  duration: 2000, // milliseconds
  ease: EASE_OUT_EXPO,
} as const;

// ─── Viewport Defaults ────────────────────────────────────────────────────────
// Standard viewport options for whileInView animations.
// once: true = animation fires only on first entry (avoids replay distractions).
// margin: '-100px' = triggers 100px before element reaches viewport edge.
export const VIEWPORT_ONCE = { once: true, margin: '-100px' } as const;
export const VIEWPORT_ONCE_NEAR = { once: true, margin: '-50px' } as const;
export const VIEWPORT_ONCE_GENEROUS = { once: true, margin: '-80px' } as const;
