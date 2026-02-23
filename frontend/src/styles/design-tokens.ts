/**
 * FedRight Design Tokens — TypeScript Mirror
 *
 * This file mirrors the CSS custom properties defined in globals.css as typed
 * TypeScript constants. Use these values when you need design tokens in
 * JavaScript context — most commonly for framer-motion animation values,
 * programmatic style calculations, and canvas/SVG rendering.
 *
 * IMPORTANT: These values must remain in sync with the CSS custom properties
 * in `frontend/src/app/globals.css`. When updating one, update both.
 * The CSS properties are the single source of truth for browser rendering;
 * this file provides type-safe access to the same values in JS.
 *
 * Source of truth: spec/ui-redesign/01-brand-design-system.md
 */

// ─────────────────────────────────────────────────────────────
// COLOR TOKENS
// Maps to CSS :root custom properties --bg-*, --brand-*, --text-*, etc.
// ─────────────────────────────────────────────────────────────

export const colors = {
  // Background hierarchy — lower = darker = further back in z-stack
  bgPrimary: '#0B0D0F',
  bgSecondary: '#12151A',
  bgTertiary: '#1A1E26',
  bgHover: '#222833',
  bgInput: '#0F1218',

  // Brand Green — extracted from FedRight v2 logo icon
  brandGreen: '#1B8B4D',
  brandGreenLight: '#2AAF65',
  brandGreenDark: '#146B3A',
  brandGreenGlow: 'rgba(27, 139, 77, 0.20)',
  brandGreenSubtle: 'rgba(27, 139, 77, 0.08)',
  brandGreenBorder: 'rgba(27, 139, 77, 0.25)',

  // Brand Amber — secondary accent from v1 logo fork color
  brandAmber: '#E6920A',
  brandAmberLight: '#F0A830',
  brandAmberGlow: 'rgba(230, 146, 10, 0.20)',
  brandAmberSubtle: 'rgba(230, 146, 10, 0.08)',

  // Text hierarchy
  textPrimary: '#F0F2F5',
  textSecondary: '#9BA3B0',
  textMuted: '#5C6370',
  textInverse: '#0B0D0F',

  // Glassmorphism surfaces — transparent whites layered on dark bg
  surfaceGlass: 'rgba(255, 255, 255, 0.03)',
  surfaceGlassHover: 'rgba(255, 255, 255, 0.06)',
  surfaceBorder: 'rgba(255, 255, 255, 0.06)',
  surfaceBorderHover: 'rgba(255, 255, 255, 0.10)',
  surfaceElevated: 'rgba(255, 255, 255, 0.04)',

  // Semantic status colors
  success: '#2AAF65',
  successBg: 'rgba(42, 175, 101, 0.10)',
  warning: '#F0A830',
  warningBg: 'rgba(240, 168, 48, 0.10)',
  error: '#E5534B',
  errorBg: 'rgba(229, 83, 75, 0.10)',
  info: '#539BF5',
  infoBg: 'rgba(83, 155, 245, 0.10)',
} as const;

// ─────────────────────────────────────────────────────────────
// EASING TOKENS
// Framer-motion accepts cubic-bezier values as [x1, y1, x2, y2] tuples.
// These match the CSS cubic-bezier() values in globals.css.
// ─────────────────────────────────────────────────────────────

export const easing = {
  // Default easing: fast start, gradual settle. Use for most UI transitions.
  outExpo: [0.16, 1, 0.3, 1] as [number, number, number, number],

  // Springy overshoot: element briefly exceeds target then settles.
  // Use for delight moments: modal scale-in, badge pop, success checkmark.
  outBack: [0.34, 1.56, 0.64, 1] as [number, number, number, number],

  // Strong spring: pronounced overshoot. Use only for prominent reveals.
  spring: [0.175, 0.885, 0.32, 1.275] as [number, number, number, number],
} as const;

// ─────────────────────────────────────────────────────────────
// DURATION TOKENS
// Values in seconds (framer-motion convention), not milliseconds (CSS).
// CSS --duration-fast = 150ms → JS duration.fast = 0.15
// ─────────────────────────────────────────────────────────────

export const duration = {
  // Micro-interactions: button press, checkbox toggle, hover color changes
  fast: 0.15,

  // Standard transitions: menu open/close, card hover, tab switching
  normal: 0.25,

  // Page section reveals, modal entry, skeleton-to-content transitions
  slow: 0.4,

  // Background gradient mesh, ambient floating elements, onboarding sequences
  glacial: 0.6,
} as const;

// ─────────────────────────────────────────────────────────────
// BORDER RADIUS TOKENS
// Values in pixels for use with framer-motion's borderRadius property.
// ─────────────────────────────────────────────────────────────

export const radius = {
  // Badges, tags, small interactive elements
  sm: 8,

  // Buttons, inputs, small cards
  md: 12,

  // Standard cards, panels, section containers
  lg: 16,

  // Modals, sheet panels, feature highlight cards
  xl: 20,

  // Large hero cards, full-width banners, onboarding surfaces
  '2xl': 24,

  // Pills, circular buttons, avatars, progress bars
  full: 9999,
} as const;

// ─────────────────────────────────────────────────────────────
// SHADOW TOKENS
// String values for use with framer-motion's boxShadow property.
// ─────────────────────────────────────────────────────────────

export const shadows = {
  sm: '0 1px 3px rgba(0, 0, 0, 0.3), 0 1px 2px rgba(0, 0, 0, 0.2)',
  md: '0 4px 12px rgba(0, 0, 0, 0.4), 0 2px 4px rgba(0, 0, 0, 0.3)',
  lg: '0 12px 32px rgba(0, 0, 0, 0.5), 0 4px 8px rgba(0, 0, 0, 0.3)',
  xl: '0 20px 48px rgba(0, 0, 0, 0.6), 0 8px 16px rgba(0, 0, 0, 0.4)',
  glowGreen: '0 0 20px rgba(27, 139, 77, 0.20), 0 0 40px rgba(27, 139, 77, 0.10)',
  glowAmber: '0 0 20px rgba(230, 146, 10, 0.20), 0 0 40px rgba(230, 146, 10, 0.10)',
} as const;

// ─────────────────────────────────────────────────────────────
// TYPE EXPORTS
// Derived union types for type-safe token usage in components.
// ─────────────────────────────────────────────────────────────

export type ColorToken = keyof typeof colors;
export type EasingToken = keyof typeof easing;
export type DurationToken = keyof typeof duration;
export type RadiusToken = keyof typeof radius;
export type ShadowToken = keyof typeof shadows;
