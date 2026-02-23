# FedRight — Brand & Design System Specification
## Document: `01-brand-design-system.md`
## Version: 1.0 | Date: 2026-02-20
## Status: APPROVED FOR IMPLEMENTATION

---

## Purpose

This document is the single source of truth for the FedRight visual design system. It replaces the previous "Botanical Luxe" light theme (emerald/cream/amber) with a **dark-mode-first** premium design language. Every design decision in this document is final and must be implemented exactly as specified. A developer should be able to implement the entire visual system from this document alone without requiring additional design consultation.

**Scope:** CSS custom properties, typography, color palette, animation library, component tokens, and complete replacement `globals.css` file content.

---

## Table of Contents

1. [Brand Identity](#1-brand-identity)
2. [Color Palette — CSS Custom Properties](#2-color-palette--css-custom-properties)
3. [Typography](#3-typography)
4. [Shadows](#4-shadows)
5. [Border Radii](#5-border-radii)
6. [Spacing](#6-spacing)
7. [Transitions & Easing](#7-transitions--easing)
8. [Complete globals.css Replacement](#8-complete-globalscss-replacement)
9. [Component Design Tokens](#9-component-design-tokens)
10. [layout.tsx Font Update](#10-layouttsx-font-update)
11. [Cross-Reference: brand_assets/brand-style-guide.md](#11-cross-reference-brand_assetsbrand-style-guidemd)

---

## 1. Brand Identity

### 1.1 App Name & Tagline

| Property | Value |
|---|---|
| **App Name** | FedRight |
| **Tagline** | "One Kitchen. Every Body. Perfectly Fed." |
| **Category** | AI-powered household meal planning |
| **Primary Audience** | Indian families, health-conscious households |

### 1.2 Brand Voice

The FedRight voice is built on four pillars that must inform every UI copy decision:

- **Premium** — Language is polished, confident, and never casual. Avoid jargon and abbreviations in UI labels.
- **Warm** — The app speaks like a knowledgeable friend, not a cold algorithm. Encouragement over instruction.
- **Intelligent** — AI capabilities are surfaced naturally, not as gimmicks. Insights feel earned.
- **Family-Oriented** — The UI acknowledges multi-person households as the default, never an edge case.

### 1.3 Logo Assets

Two logo files exist in the codebase. Usage rules are strict.

| File | Path | Usage |
|---|---|---|
| **Primary (v2)** | `brand_assets/fedright-logo-gemini-v2.png` | App icon, sidebar nav, browser favicon, app loading screen, all in-product placements |
| **Secondary (v1)** | `brand_assets/fedright-logo-gemini.png` | Marketing materials, landing pages, social assets, external-facing contexts only |

**Logo Description — Primary (v2):**
A rounded-square icon (similar to iOS app icon shape) with a deep brand-green background (`#1B8B4D`). A bold white "F" letterform with an integrated checkmark replaces the crossbar of the "F". The logotype "FedRight" rendered in `--text-primary` (`#F0F2F5`) sits to the right in Inter Bold. On dark backgrounds, use the full lockup. Never place the v2 logo on a white or cream background.

**Logo Description — Secondary (v1):**
A fork-and-checkmark icon treatment with amber-orange accent color. Use exclusively in marketing and landing page contexts. Never use inside the authenticated application UI.

**Minimum Clear Space:** Equal to the height of the "F" letterform on all four sides. Never crowd the logo with adjacent text or icons.

**Forbidden Treatments:**
- Do not recolor the logo icon
- Do not add drop shadows to the logo image
- Do not stretch or distort aspect ratio
- Do not place v2 logo on light backgrounds
- Do not use v1 logo inside authenticated app UI

---

## 2. Color Palette — CSS Custom Properties

### 2.1 Naming Convention

All custom properties use semantic naming, not descriptive naming. A property named `--bg-primary` communicates intent; a property named `--color-almost-black` does not. This ensures the system can be adapted without renaming variables.

### 2.2 Background Hierarchy

Five background levels create depth without borders or explicit shadows. Surfaces higher in the z-stack use a lighter background value, creating implicit layering.

| Token | Hex Value | Usage |
|---|---|---|
| `--bg-primary` | `#0B0D0F` | Page-level background. Applied to `body`. Near-black with a subtle cool blue-gray undertone that prevents the "pure void" feeling of `#000000`. |
| `--bg-secondary` | `#12151A` | Card and panel backgrounds. The primary surface for content containers. ~70% of all visible UI surfaces will use this value. |
| `--bg-tertiary` | `#1A1E26` | Elevated surfaces: modals, dropdowns, popovers, command palettes. Visually "above" secondary surfaces. |
| `--bg-hover` | `#222833` | Interactive row and card hover states. Applied on `:hover` in addition to the base background. Creates a clear affordance without color change. |
| `--bg-input` | `#0F1218` | Form input backgrounds. Slightly darker than `--bg-primary` to create an inset well effect. |

**The Rule of Z-Depth:** As a surface's elevation increases (z-index or perceived layer), its background lightens. `bg-primary` < `bg-secondary` < `bg-tertiary` < `bg-hover`. Never reverse this hierarchy.

### 2.3 Brand Green

Extracted from the FedRight v2 logo icon. This is the primary interactive color throughout the application.

| Token | Value | Usage |
|---|---|---|
| `--brand-green` | `#1B8B4D` | Primary CTA buttons, active nav items, active toggle states, links, progress indicators |
| `--brand-green-light` | `#2AAF65` | Hover state for brand-green elements. Also used as `--color-success`. |
| `--brand-green-dark` | `#146B3A` | Pressed/active state for buttons. Used on `:active` pseudo-class. |
| `--brand-green-glow` | `rgba(27, 139, 77, 0.20)` | Box-shadow glow effects on green elements. Spread value in shadow definitions. |
| `--brand-green-subtle` | `rgba(27, 139, 77, 0.08)` | Tinted background for selected rows, highlighted sections, active list items |
| `--brand-green-border` | `rgba(27, 139, 77, 0.25)` | Borders on green-tinted components, focus rings on inputs |

### 2.4 Brand Amber/Orange (Accent)

Sourced from the v1 logo's fork accent. Used sparingly as a secondary accent — never competing with green, always supporting it.

| Token | Value | Usage |
|---|---|---|
| `--brand-amber` | `#E6920A` | Secondary accent: warnings, highlights, "streak" indicators, premium feature badges, nutrient excess indicators |
| `--brand-amber-light` | `#F0A830` | Hover state for amber elements |
| `--brand-amber-glow` | `rgba(230, 146, 10, 0.20)` | Box-shadow glow effects on amber elements |
| `--brand-amber-subtle` | `rgba(230, 146, 10, 0.08)` | Tinted background for warning banners, amber-accented sections |

**Amber Usage Ratio:** Amber should appear less than 15% as often as green in any given screen. Amber communicates "attention required" — overuse dilutes this signal.

### 2.5 Text Hierarchy

Four levels of text opacity establish clear information hierarchy. Use strictly in order of importance.

| Token | Value | Usage |
|---|---|---|
| `--text-primary` | `#F0F2F5` | Headings, card titles, primary labels, any content users must read to understand the page |
| `--text-secondary` | `#9BA3B0` | Body text, descriptions, supporting labels, secondary metadata. The default text color for most prose. |
| `--text-muted` | `#5C6370` | Captions, placeholders, timestamps, disabled state text, helper text below inputs |
| `--text-inverse` | `#0B0D0F` | Text rendered on top of light or green-filled button surfaces. Same as `--bg-primary`. |

**Contrast Compliance:** `--text-primary` on `--bg-secondary` achieves WCAG AA (4.5:1 minimum) at all tested sizes. `--text-secondary` on `--bg-secondary` achieves 3.1:1 — acceptable for non-essential body text but must not be used for labels, error messages, or interactive affordances. `--text-muted` is decorative only and must never carry essential information.

### 2.6 Glassmorphism Surface Tokens

Used for frosted-glass overlay effects. These are transparent whites that layer on top of the background hierarchy.

| Token | Value | Usage |
|---|---|---|
| `--surface-glass` | `rgba(255, 255, 255, 0.03)` | Base glass surface background. Very subtle tint over dark backgrounds. |
| `--surface-glass-hover` | `rgba(255, 255, 255, 0.06)` | Hover state for glass surfaces. Applied on `:hover`. |
| `--surface-border` | `rgba(255, 255, 255, 0.06)` | Default 1px border for all cards and panels. Creates separation without harsh lines. |
| `--surface-border-hover` | `rgba(255, 255, 255, 0.10)` | Border color on `:hover` for interactive cards. Communicates interactivity. |
| `--surface-elevated` | `rgba(255, 255, 255, 0.04)` | Background for elements that need slight lift above their container without changing to `bg-tertiary`. |

**The Glass Rule:** `backdrop-filter: blur()` must always accompany glass surface backgrounds. Without blur, the transparent backgrounds become invisible. Standard blur value: `16px`. For floating elements (tooltips, dropdowns): `24px`. Always include `-webkit-backdrop-filter` for Safari compatibility.

### 2.7 Semantic / Status Colors

Four semantic states with paired background tints. Never use raw colors for semantic meaning — always use these tokens.

| Token | Value | Usage |
|---|---|---|
| `--color-success` | `#2AAF65` | Success states, check icons, completed items (same as `--brand-green-light`) |
| `--color-success-bg` | `rgba(42, 175, 101, 0.10)` | Background tint for success banners, toasts, badges |
| `--color-warning` | `#F0A830` | Warning states, caution icons, macronutrient excess (same as `--brand-amber-light`) |
| `--color-warning-bg` | `rgba(240, 168, 48, 0.10)` | Background tint for warning banners, toasts, badges |
| `--color-error` | `#E5534B` | Error states, destructive actions, validation failures |
| `--color-error-bg` | `rgba(229, 83, 75, 0.10)` | Background tint for error banners, toasts, badges |
| `--color-info` | `#539BF5` | Informational states, AI tip indicators, help text |
| `--color-info-bg` | `rgba(83, 155, 245, 0.10)` | Background tint for info banners, toasts, badges |

---

## 3. Typography

### 3.1 Font Decision

**Inter replaces both DM Serif Display and Source Sans 3.** This is a deliberate brand shift from "editorial wellness blog" to "premium software product." Inter was designed specifically for screens and renders with exceptional clarity at all sizes on both retina and standard displays.

**Rationale:**
- DM Serif Display's editorial warmth was appropriate for the botanical theme but reads as dated for a tech-forward AI product
- Source Sans 3 performed well but Inter's geometric precision better supports the dark UI aesthetic
- Consolidating to a single typeface simplifies the font loading and reduces layout shift

### 3.2 Font Import (layout.tsx)

The existing `layout.tsx` imports DM Serif Display and Source Sans 3. This must be replaced entirely.

**Replace the existing font import block with:**

```typescript
import { Inter } from 'next/font/google';

const inter = Inter({
  subsets: ['latin'],
  // Load all weights needed by the type scale
  weight: ['400', '500', '600', '700', '800'],
  // Expose as a CSS custom property for use in globals.css
  variable: '--font-inter',
  // Prevent flash of unstyled text — blocks render until font loads
  display: 'swap',
});
```

**Update the `<body>` className to:**
```tsx
<body className={`${inter.variable} antialiased`}>
```

**Update the `<body>` style to:**
```tsx
style={{ fontFamily: "var(--font-inter), -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" }}
```

The system font stack fallback (`-apple-system, BlinkMacSystemFont, 'Segoe UI'`) ensures visually coherent text renders during font load on first visit before the Inter WOFF2 is cached.

### 3.3 Type Scale

All sizes use `rem` in implementation. The base is `16px` (`1rem`). Values listed in both `px` (for design tools) and `rem` (for implementation).

| Role | Size (px) | Size (rem) | Line Height | Weight | Letter Spacing | CSS Utility Class |
|---|---|---|---|---|---|---|
| **Display / H1** | 56px | 3.5rem | 1.1 (62px) | 800 | -0.03em | `.type-display` |
| **H2** | 40px | 2.5rem | 1.2 (48px) | 700 | -0.02em | `.type-h2` |
| **H3** | 28px | 1.75rem | 1.3 (36px) | 700 | -0.01em | `.type-h3` |
| **H4** | 20px | 1.25rem | 1.4 (28px) | 600 | -0.01em | `.type-h4` |
| **Body Large** | 18px | 1.125rem | 1.7 (30px) | 400 | 0 | `.type-body-lg` |
| **Body** | 16px | 1rem | 1.6 (26px) | 400 | 0 | `.type-body` |
| **Body Small** | 14px | 0.875rem | 1.5 (21px) | 400 | 0 | `.type-body-sm` |
| **Caption** | 12px | 0.75rem | 1.4 (17px) | 500 | 0.02em | `.type-caption` |
| **Overline** | 11px | 0.6875rem | 1.4 (15px) | 600 | 0.1em | `.type-overline` |

**Overline text-transform:** Always `uppercase`. This is the only type role that uses uppercase transformation.

**Heading element defaults:** `h1` through `h6` HTML elements do NOT automatically map to the scale above. Elements inherit body size by default (Tailwind CSS reset). Apply type utility classes explicitly. This ensures semantic HTML is decoupled from visual scale.

### 3.4 Font Rendering

Apply these rendering properties on `html` element (see globals.css section for implementation):

```css
-webkit-font-smoothing: antialiased;
-moz-osx-font-smoothing: grayscale;
text-rendering: optimizeLegibility;
```

These are critical for Inter's quality on macOS. Without `antialiased`, Inter can appear slightly heavy-stroked on dark backgrounds.

---

## 4. Shadows

All shadows use pure black with opacity rather than colored blacks. This ensures they work correctly over any background color in the hierarchy.

| Token | Value | Usage |
|---|---|---|
| `--shadow-sm` | `0 1px 3px rgba(0,0,0,0.3), 0 1px 2px rgba(0,0,0,0.2)` | Subtle depth for small elements: badges, tags, chips |
| `--shadow-md` | `0 4px 12px rgba(0,0,0,0.4), 0 2px 4px rgba(0,0,0,0.3)` | Cards, standard panels, popovers |
| `--shadow-lg` | `0 12px 32px rgba(0,0,0,0.5), 0 4px 8px rgba(0,0,0,0.3)` | Elevated cards on hover, floating elements |
| `--shadow-xl` | `0 20px 48px rgba(0,0,0,0.6), 0 8px 16px rgba(0,0,0,0.4)` | Modals, drawer panels, fullscreen overlays |
| `--shadow-glow-green` | `0 0 20px var(--brand-green-glow), 0 0 40px rgba(27,139,77,0.10)` | Primary CTA buttons on hover/focus, active nav items, progress ring completions |
| `--shadow-glow-amber` | `0 0 20px var(--brand-amber-glow), 0 0 40px rgba(230,146,10,0.10)` | Warning-state elements, amber accent badges on hover |

**Shadow Layering:** For interactive cards that have both a resting and hover state, use: resting = `--shadow-md`, hover = `--shadow-lg`. The transition between them must use the standard `--duration-normal` timing with `--ease-out-expo` easing.

---

## 5. Border Radii

Consistent rounding across the system. The scale is intentionally large — sharp corners are a light-mode convention. Dark mode UIs feel more refined with generous rounding.

| Token | Value | Primary Usage |
|---|---|---|
| `--radius-sm` | `8px` | Badges, tags, small interactive elements, inner content within cards |
| `--radius-md` | `12px` | Buttons, inputs, small cards, dropdown items |
| `--radius-lg` | `16px` | Standard cards, panels, section containers |
| `--radius-xl` | `20px` | Modals, sheet panels, feature highlight cards |
| `--radius-2xl` | `24px` | Large hero cards, full-width banners, onboarding surfaces |
| `--radius-full` | `9999px` | Pills, circular buttons, avatars, progress bars |

**Nesting Rule:** When a child element is inside a rounded container, apply a slightly smaller radius. Example: a button (`--radius-md`) inside a card (`--radius-lg`) should use `--radius-sm` if it bleeds to the edge, or match `--radius-md` if it's inset with padding.

---

## 6. Spacing

FedRight uses **Tailwind's standard 4px-base spacing scale** exclusively. No custom spacing tokens are defined.

| Tailwind Class | Value | Common Usage |
|---|---|---|
| `p-1` / `gap-1` | 4px | Icon-to-label gap, inner badge padding |
| `p-2` / `gap-2` | 8px | Compact list items, chip padding |
| `p-3` / `gap-3` | 12px | Button padding (vertical), form element spacing |
| `p-4` / `gap-4` | 16px | Card inner padding (minimum), section gaps |
| `p-5` / `gap-5` | 20px | Card inner padding (standard) |
| `p-6` / `gap-6` | 24px | Card inner padding (spacious), modal padding |
| `p-8` / `gap-8` | 32px | Section padding, large spacing between groups |
| `p-10` / `gap-10` | 40px | Page-level section gaps |
| `p-12` / `gap-12` | 48px | Hero section vertical padding |

**Consistency Requirement:** All card inner padding must use either `p-4`, `p-5`, or `p-6`. Do not mix within the same card. Sidebar nav items use `px-3 py-2` (12px horizontal, 8px vertical). Do not deviate from these values.

---

## 7. Transitions & Easing

### 7.1 Easing Functions

Three custom bezier curves. Each serves a specific motion intent.

| Token | Value | Intent |
|---|---|---|
| `--ease-out-expo` | `cubic-bezier(0.16, 1, 0.3, 1)` | **Default easing.** Fast start, gradual settle. Use for most UI transitions: panels opening, menus appearing, cards scaling. Feels snappy and responsive. |
| `--ease-out-back` | `cubic-bezier(0.34, 1.56, 0.64, 1)` | **Springy/overshoot.** Element briefly exceeds its target then settles. Use for delight moments: modal scale-in, badge pop, success checkmark. Do not overuse — max 2-3 uses per screen. |
| `--ease-spring` | `cubic-bezier(0.175, 0.885, 0.32, 1.275)` | **Strong spring.** More pronounced overshoot than out-back. Use only for prominent interactions: feature unlock animations, first-time onboarding reveals. |

### 7.2 Duration Scale

| Token | Value | Usage |
|---|---|---|
| `--duration-fast` | `150ms` | Micro-interactions: button press feedback, checkbox toggle, hover color changes |
| `--duration-normal` | `250ms` | Standard transitions: menu open/close, card hover state changes, tab switching |
| `--duration-slow` | `400ms` | Page section reveals, modal/panel entry animations, skeleton-to-content transitions |
| `--duration-glacial` | `600ms` | Background gradient mesh animations, ambient floating elements, onboarding sequences |

**The 100ms Rule:** Any interaction that takes longer than 100ms to respond to user input (click, type, toggle) feels sluggish. Interactive state changes (button press visual, checkbox check) must use `--duration-fast`. Reserve longer durations for non-blocking decorative animations.

---

## 8. Complete globals.css Replacement

The following is the **full, complete content** of `frontend/src/app/globals.css`. This replaces the existing Botanical Luxe system entirely. Copy this verbatim.

**Critical:** Every custom CSS rule is inside `@layer base` or `@layer components`. The `@keyframes` declarations intentionally live outside any layer. In Tailwind v4, `@import "tailwindcss"` places its utilities inside `@layer utilities`. CSS placed outside layers has higher cascade specificity than layered rules — this is the core Tailwind v4 gotcha. Keyframes are not utilities and are safe outside layers. All other custom CSS must be layered.

```css
@import "tailwindcss";

/* ══════════════════════════════════════════════════════════════
   FEDRIGHT DESIGN SYSTEM — Dark Mode First
   Premium dark UI: near-black backgrounds, brand green (#1B8B4D)
   from the FedRight v2 logo, amber accent from v1 logo.
   Glassmorphism surfaces, Inter typography, fluid animations.

   CRITICAL (Tailwind v4): ALL custom CSS must be inside @layer base
   or @layer components. Unlayered CSS silently overrides ALL Tailwind
   utilities due to CSS cascade layer precedence.
   ══════════════════════════════════════════════════════════════ */

/* ─────────────────────────────────────────────────────────────
   LAYER: BASE — Design tokens, resets, element defaults
   ───────────────────────────────────────────────────────────── */
@layer base {

  /* ── Design Tokens ─────────────────────────────────────────── */
  :root {

    /* Background hierarchy
       Lower number = darker = further back in z-stack
       Rule: as z-elevation increases, background lightens          */
    --bg-primary:           #0B0D0F;
    --bg-secondary:         #12151A;
    --bg-tertiary:          #1A1E26;
    --bg-hover:             #222833;
    --bg-input:             #0F1218;

    /* Brand Green — extracted from FedRight v2 logo icon           */
    --brand-green:          #1B8B4D;
    --brand-green-light:    #2AAF65;
    --brand-green-dark:     #146B3A;
    --brand-green-glow:     rgba(27, 139, 77, 0.20);
    --brand-green-subtle:   rgba(27, 139, 77, 0.08);
    --brand-green-border:   rgba(27, 139, 77, 0.25);

    /* Brand Amber — secondary accent from v1 logo's fork color
       Use sparingly: warnings, streaks, premium indicators         */
    --brand-amber:          #E6920A;
    --brand-amber-light:    #F0A830;
    --brand-amber-glow:     rgba(230, 146, 10, 0.20);
    --brand-amber-subtle:   rgba(230, 146, 10, 0.08);

    /* Text hierarchy
       primary   → headings, critical content  (high contrast)
       secondary → body text, descriptions     (medium contrast)
       muted     → captions, disabled, helpers (decorative only)
       inverse   → text on green/light buttons                      */
    --text-primary:         #F0F2F5;
    --text-secondary:       #9BA3B0;
    --text-muted:           #5C6370;
    --text-inverse:         #0B0D0F;

    /* Glassmorphism surfaces — transparent whites layered on dark bg
       Always pair with backdrop-filter: blur() for visual effect   */
    --surface-glass:        rgba(255, 255, 255, 0.03);
    --surface-glass-hover:  rgba(255, 255, 255, 0.06);
    --surface-border:       rgba(255, 255, 255, 0.06);
    --surface-border-hover: rgba(255, 255, 255, 0.10);
    --surface-elevated:     rgba(255, 255, 255, 0.04);

    /* Semantic status colors — always use tokens, never raw hex
       Each has a paired -bg variant for banner/badge backgrounds   */
    --color-success:        #2AAF65;
    --color-success-bg:     rgba(42, 175, 101, 0.10);
    --color-warning:        #F0A830;
    --color-warning-bg:     rgba(240, 168, 48, 0.10);
    --color-error:          #E5534B;
    --color-error-bg:       rgba(229, 83, 75, 0.10);
    --color-info:           #539BF5;
    --color-info-bg:        rgba(83, 155, 245, 0.10);

    /* Shadows — pure black with opacity, works on any bg color
       glow variants add colored bloom for green/amber elements      */
    --shadow-sm:            0 1px 3px rgba(0, 0, 0, 0.3), 0 1px 2px rgba(0, 0, 0, 0.2);
    --shadow-md:            0 4px 12px rgba(0, 0, 0, 0.4), 0 2px 4px rgba(0, 0, 0, 0.3);
    --shadow-lg:            0 12px 32px rgba(0, 0, 0, 0.5), 0 4px 8px rgba(0, 0, 0, 0.3);
    --shadow-xl:            0 20px 48px rgba(0, 0, 0, 0.6), 0 8px 16px rgba(0, 0, 0, 0.4);
    --shadow-glow-green:    0 0 20px var(--brand-green-glow), 0 0 40px rgba(27, 139, 77, 0.10);
    --shadow-glow-amber:    0 0 20px var(--brand-amber-glow), 0 0 40px rgba(230, 146, 10, 0.10);

    /* Border radii — generous rounding for premium dark UI feel    */
    --radius-sm:            8px;
    --radius-md:            12px;
    --radius-lg:            16px;
    --radius-xl:            20px;
    --radius-2xl:           24px;
    --radius-full:          9999px;

    /* Transitions & Easing
       ease-out-expo  → default, snappy settle (most UI transitions)
       ease-out-back  → springy overshoot (delight moments)
       ease-spring    → strong spring (prominent reveals)            */
    --ease-out-expo:        cubic-bezier(0.16, 1, 0.3, 1);
    --ease-out-back:        cubic-bezier(0.34, 1.56, 0.64, 1);
    --ease-spring:          cubic-bezier(0.175, 0.885, 0.32, 1.275);
    --duration-fast:        150ms;
    --duration-normal:      250ms;
    --duration-slow:        400ms;
    --duration-glacial:     600ms;

    /* Glass blur — consistent backdrop-filter values               */
    --glass-blur:           16px;
    --glass-blur-heavy:     24px;
    --glass-saturate:       1.4;
  }

  /* ── HTML root ─────────────────────────────────────────────── */
  html {
    /* Subpixel antialiasing produces correct results on dark
       backgrounds with Inter font on both macOS and Windows        */
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
    /* optimizeLegibility enables kerning pairs and ligatures
       in Inter, which significantly improves heading quality       */
    text-rendering: optimizeLegibility;
    scroll-behavior: smooth;
    /* Prevent layout shift from scrollbar appearing/disappearing   */
    scrollbar-gutter: stable;
  }

  /* ── Body ──────────────────────────────────────────────────── */
  body {
    color: var(--text-secondary);
    background-color: var(--bg-primary);
    font-family: var(--font-inter), -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;

    /* Subtle gradient mesh: green top-left, amber bottom-right,
       gives depth without distracting from content.
       background-attachment: fixed means it doesn't scroll with page.
       Critical: do not increase opacity above listed values —
       higher values make the surface busy and reduce contrast.      */
    background-image:
      radial-gradient(ellipse 70% 50% at 15% 0%,  rgba(27, 139, 77, 0.06),  transparent),
      radial-gradient(ellipse 50% 40% at 85% 100%, rgba(230, 146, 10, 0.04), transparent),
      radial-gradient(ellipse 40% 60% at 50% 50%,  rgba(83, 155, 245, 0.02), transparent);
    background-attachment: fixed;
  }

  /* ── Text selection ─────────────────────────────────────────── */
  ::selection {
    /* Brand green selection tint with dark text for readability    */
    background-color: var(--brand-green-subtle);
    color: var(--text-primary);
  }

  /* ── Scrollbar (WebKit/Blink) ────────────────────────────────
     Mozilla Firefox uses scrollbar-color and scrollbar-width
     which must be set separately if Firefox support is needed.    */
  ::-webkit-scrollbar {
    width: 6px;
    height: 6px;
  }

  ::-webkit-scrollbar-track {
    /* Transparent track blends into the dark background           */
    background: transparent;
  }

  ::-webkit-scrollbar-thumb {
    /* Subtle scrollbar thumb — visible but not distracting        */
    background: rgba(255, 255, 255, 0.12);
    border-radius: var(--radius-full);
    transition: background var(--duration-fast) var(--ease-out-expo);
  }

  ::-webkit-scrollbar-thumb:hover {
    background: rgba(255, 255, 255, 0.22);
  }

  /* Firefox scrollbar */
  * {
    scrollbar-color: rgba(255, 255, 255, 0.12) transparent;
    scrollbar-width: thin;
  }

  /* ── Focus visibility ────────────────────────────────────────
     Critical for keyboard accessibility. Uses brand green to
     maintain visual consistency with the interactive color.       */
  :focus-visible {
    outline: 2px solid var(--brand-green);
    outline-offset: 2px;
    border-radius: 2px;
  }

  /* ── Heading defaults ─────────────────────────────────────────
     Headings default to primary text color and tight tracking.
     Font-family explicitly set to Inter (inherits from body but
     this guards against any accidental override).
     NOTE: Visual scale is NOT applied here — use .type-* utility
     classes for size. Semantic HTML ≠ visual hierarchy.           */
  h1, h2, h3, h4, h5, h6 {
    font-family: var(--font-inter), -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    color: var(--text-primary);
    letter-spacing: -0.02em;
    line-height: 1.2;
  }

  /* ── Anchor defaults ──────────────────────────────────────── */
  a {
    color: var(--brand-green-light);
    text-decoration: none;
    transition: color var(--duration-fast) var(--ease-out-expo);
  }

  a:hover {
    color: var(--brand-green);
  }

  /* ── Type scale utility classes ───────────────────────────────
     Apply these classes explicitly rather than relying on h1-h6
     element defaults. Keeps semantic markup decoupled from visual. */
  .type-display {
    font-size: 3.5rem;       /* 56px */
    font-weight: 800;
    line-height: 1.1;
    letter-spacing: -0.03em;
  }

  .type-h2 {
    font-size: 2.5rem;       /* 40px */
    font-weight: 700;
    line-height: 1.2;
    letter-spacing: -0.02em;
  }

  .type-h3 {
    font-size: 1.75rem;      /* 28px */
    font-weight: 700;
    line-height: 1.3;
    letter-spacing: -0.01em;
  }

  .type-h4 {
    font-size: 1.25rem;      /* 20px */
    font-weight: 600;
    line-height: 1.4;
    letter-spacing: -0.01em;
  }

  .type-body-lg {
    font-size: 1.125rem;     /* 18px */
    font-weight: 400;
    line-height: 1.7;
    letter-spacing: 0;
  }

  .type-body {
    font-size: 1rem;         /* 16px */
    font-weight: 400;
    line-height: 1.6;
    letter-spacing: 0;
  }

  .type-body-sm {
    font-size: 0.875rem;     /* 14px */
    font-weight: 400;
    line-height: 1.5;
    letter-spacing: 0;
  }

  .type-caption {
    font-size: 0.75rem;      /* 12px */
    font-weight: 500;
    line-height: 1.4;
    letter-spacing: 0.02em;
  }

  .type-overline {
    font-size: 0.6875rem;    /* 11px */
    font-weight: 600;
    line-height: 1.4;
    letter-spacing: 0.1em;
    text-transform: uppercase;
  }
}


/* ─────────────────────────────────────────────────────────────
   LAYER: COMPONENTS — Reusable UI patterns, animations, surfaces
   ───────────────────────────────────────────────────────────── */
@layer components {

  /* ────────────────────────────────────────────────────────────
     ANIMATION UTILITY CLASSES
     Each class applies a pre-defined keyframe animation.
     Duration and easing are baked in per the spec. Override via
     inline style only if a specific instance needs adjustment.
     ──────────────────────────────────────────────────────────── */

  /* Slide Down — for dropdown menus, notification banners, drawers
     that enter from above the viewport                             */
  .animate-slide-down {
    animation: slideDown var(--duration-normal) var(--ease-out-expo) both;
  }

  /* Slide Up — for bottom sheets, toast notifications, elements
     that enter from below                                          */
  .animate-slide-up {
    animation: slideUp var(--duration-slow) var(--ease-out-expo) both;
  }

  /* Fade In — for content that appears without directional motion:
     page content on load, lazy-loaded images                       */
  .animate-fade-in {
    animation: fadeIn var(--duration-slow) var(--ease-out-expo) both;
  }

  /* Scale In — for modals, popovers, cards that pop into existence.
     Uses ease-out-back for the springy overshoot effect.           */
  .animate-scale-in {
    animation: scaleIn var(--duration-normal) var(--ease-out-back) both;
  }

  /* Shimmer — for skeleton loading states. Apply to the skeleton
     container along with the shimmer background gradient.          */
  .animate-shimmer {
    animation: shimmer 2s ease-in-out infinite;
    background-size: 200% 100%;
    /* The background gradient must be applied separately:
       background: linear-gradient(
         90deg,
         var(--bg-secondary) 0%,
         var(--bg-hover) 50%,
         var(--bg-secondary) 100%
       );                                                          */
  }

  /* Glow Pulse — for active indicators, processing states, elements
     that need to communicate "live" or "active" status             */
  .animate-glow-pulse {
    animation: glowPulse 2.5s ease-in-out infinite;
  }

  /* Float — for decorative background elements, illustration
     accents, empty state illustrations. Use sparingly.             */
  .animate-float {
    animation: float 6s ease-in-out infinite;
  }

  /* Marquee — for scrolling text tickers, announcement banners.
     Container must have overflow: hidden.                          */
  .animate-marquee {
    animation: marquee 20s linear infinite;
  }

  /* Gradient Mesh — for the animated background gradient on hero
     sections or premium feature cards. CPU-intensive; use once per
     screen maximum.                                                 */
  .animate-gradient-mesh {
    animation: gradientMesh var(--duration-glacial) ease-in-out infinite alternate;
    background-size: 200% 200%;
  }

  /* Particle Float — for decorative floating dot/sparkle elements.
     Each particle instance should have a different delay via stagger. */
  .animate-particle-float {
    animation: particleFloat 8s ease-in-out infinite;
  }

  /* ── Stagger delay classes ────────────────────────────────────
     Apply to sibling elements to create orchestrated list reveals.
     Parent must trigger each child's animation.
     Usage: <li class="animate-fade-in stagger-2">...</li>
     animation-fill-mode: backwards keeps the element invisible
     until the animation begins (prevents flash of content).        */
  .stagger-1 { animation-delay: 0.05s; animation-fill-mode: backwards; }
  .stagger-2 { animation-delay: 0.10s; animation-fill-mode: backwards; }
  .stagger-3 { animation-delay: 0.15s; animation-fill-mode: backwards; }
  .stagger-4 { animation-delay: 0.20s; animation-fill-mode: backwards; }
  .stagger-5 { animation-delay: 0.25s; animation-fill-mode: backwards; }
  .stagger-6 { animation-delay: 0.30s; animation-fill-mode: backwards; }
  .stagger-7 { animation-delay: 0.35s; animation-fill-mode: backwards; }
  .stagger-8 { animation-delay: 0.40s; animation-fill-mode: backwards; }

  /* ────────────────────────────────────────────────────────────
     GLASSMORPHISM SURFACES
     Always pair with a dark background — glass is invisible on
     light surfaces. backdrop-filter is the key property.
     -webkit-backdrop-filter required for Safari/iOS support.
     ──────────────────────────────────────────────────────────── */

  /* Standard glass — cards, panels, nav containers                  */
  .glass-surface {
    background: var(--surface-glass);
    backdrop-filter: blur(var(--glass-blur)) saturate(var(--glass-saturate));
    -webkit-backdrop-filter: blur(var(--glass-blur)) saturate(var(--glass-saturate));
    border: 1px solid var(--surface-border);
    box-shadow: var(--shadow-md);
    transition:
      background var(--duration-normal) var(--ease-out-expo),
      border-color var(--duration-normal) var(--ease-out-expo),
      box-shadow var(--duration-normal) var(--ease-out-expo);
  }

  .glass-surface:hover {
    background: var(--surface-glass-hover);
    border-color: var(--surface-border-hover);
    box-shadow: var(--shadow-lg);
  }

  /* Elevated glass — modals, dropdowns, command palettes.
     Heavier blur creates stronger depth separation.                 */
  .glass-surface-elevated {
    background: var(--surface-elevated);
    backdrop-filter: blur(var(--glass-blur-heavy)) saturate(var(--glass-saturate));
    -webkit-backdrop-filter: blur(var(--glass-blur-heavy)) saturate(var(--glass-saturate));
    border: 1px solid var(--surface-border);
    box-shadow: var(--shadow-xl);
  }

  /* Green-tinted glass — for selected/active state cards           */
  .glass-surface-green {
    background: var(--brand-green-subtle);
    backdrop-filter: blur(var(--glass-blur)) saturate(var(--glass-saturate));
    -webkit-backdrop-filter: blur(var(--glass-blur)) saturate(var(--glass-saturate));
    border: 1px solid var(--brand-green-border);
    box-shadow: var(--shadow-md), 0 0 12px var(--brand-green-glow);
  }

  /* ────────────────────────────────────────────────────────────
     GRADIENT UTILITIES
     Named by color family, not semantic meaning.
     ──────────────────────────────────────────────────────────── */

  /* Brand green gradient — primary CTA backgrounds, active badges  */
  .gradient-green {
    background: linear-gradient(
      135deg,
      var(--brand-green-dark) 0%,
      var(--brand-green) 50%,
      var(--brand-green-light) 100%
    );
  }

  /* Amber gradient — warning banners, streak highlights            */
  .gradient-amber {
    background: linear-gradient(
      135deg,
      var(--brand-amber) 0%,
      var(--brand-amber-light) 100%
    );
  }

  /* Dark gradient — hero sections, premium feature headers         */
  .gradient-dark {
    background: linear-gradient(
      145deg,
      var(--bg-tertiary) 0%,
      var(--bg-secondary) 60%,
      rgba(27, 139, 77, 0.05) 100%
    );
  }

  /* Mesh gradient — animated background for landing/hero sections  */
  .gradient-mesh {
    background:
      radial-gradient(ellipse 80% 60% at 20% 20%, rgba(27, 139, 77, 0.12), transparent 60%),
      radial-gradient(ellipse 60% 80% at 80% 80%, rgba(83, 155, 245, 0.08), transparent 60%),
      radial-gradient(ellipse 50% 50% at 50% 50%, rgba(230, 146, 10, 0.06), transparent 70%),
      var(--bg-primary);
  }

  /* ── Text gradient utilities ──────────────────────────────────
     background-clip: text with transparent fill creates gradient
     text. The parent element must NOT have overflow: hidden or
     the gradient text will be clipped.                             */
  .text-gradient-green {
    background: linear-gradient(
      135deg,
      var(--brand-green-light),
      var(--brand-green)
    );
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
  }

  .text-gradient-amber {
    background: linear-gradient(
      135deg,
      var(--brand-amber),
      var(--brand-amber-light)
    );
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
  }

  /* Multicolor hero gradient text                                  */
  .text-gradient-hero {
    background: linear-gradient(
      135deg,
      var(--text-primary) 0%,
      var(--brand-green-light) 50%,
      var(--brand-amber-light) 100%
    );
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
  }

  /* ── Accent line ──────────────────────────────────────────────
     Horizontal rule / decorative separator with gradient fade.    */
  .accent-line {
    height: 1px;
    background: linear-gradient(
      90deg,
      transparent,
      var(--surface-border) 20%,
      var(--surface-border) 80%,
      transparent
    );
  }

  .accent-line-green {
    height: 2px;
    background: linear-gradient(
      90deg,
      var(--brand-green),
      var(--brand-green-light),
      transparent
    );
    border-radius: var(--radius-full);
  }

  /* ────────────────────────────────────────────────────────────
     CUSTOM CHECKBOX
     Replaces .checkbox-botanical from the old Botanical theme.
     ──────────────────────────────────────────────────────────── */
  .checkbox-fedright {
    appearance: none;
    -webkit-appearance: none;
    width: 18px;
    height: 18px;
    border: 2px solid var(--surface-border-hover);
    border-radius: 5px;
    background: var(--bg-input);
    cursor: pointer;
    position: relative;
    flex-shrink: 0;
    transition:
      background var(--duration-fast) var(--ease-out-expo),
      border-color var(--duration-fast) var(--ease-out-expo),
      box-shadow var(--duration-fast) var(--ease-out-expo);
  }

  .checkbox-fedright:checked {
    /* Green gradient fill when checked                             */
    background: linear-gradient(
      135deg,
      var(--brand-green),
      var(--brand-green-light)
    );
    border-color: var(--brand-green);
    box-shadow: 0 0 0 0px var(--brand-green-glow);
  }

  /* Checkmark via CSS — white rotated rectangle                    */
  .checkbox-fedright:checked::after {
    content: '';
    position: absolute;
    top: 2px;
    left: 5px;
    width: 5px;
    height: 9px;
    border: 2px solid white;
    border-top: none;
    border-left: none;
    transform: rotate(45deg);
  }

  .checkbox-fedright:hover {
    border-color: var(--brand-green);
    box-shadow: 0 0 0 3px var(--brand-green-subtle);
  }

  .checkbox-fedright:focus-visible {
    outline: 2px solid var(--brand-green);
    outline-offset: 2px;
    box-shadow: 0 0 0 4px var(--brand-green-subtle);
  }

  /* ────────────────────────────────────────────────────────────
     NOISE TEXTURE OVERLAY
     Subtle organic grain applied via an inline SVG turbulence
     filter. Adds tactile quality to flat dark surfaces.
     The ::before pseudo-element must not capture pointer events.
     Parent must be position: relative.
     ──────────────────────────────────────────────────────────── */
  .texture-overlay {
    position: relative;
  }

  .texture-overlay::before {
    content: '';
    position: absolute;
    inset: 0;
    /* opacity 0.018 is the maximum that adds texture without
       visible grain on standard displays                           */
    opacity: 0.018;
    background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E");
    pointer-events: none;
    border-radius: inherit;
    z-index: 0;
  }

  /* ────────────────────────────────────────────────────────────
     SKELETON LOADING PATTERN
     Standard implementation for skeleton/shimmer loading states.
     ──────────────────────────────────────────────────────────── */
  .skeleton {
    background: linear-gradient(
      90deg,
      var(--bg-secondary) 0%,
      var(--bg-hover) 50%,
      var(--bg-secondary) 100%
    );
    background-size: 200% 100%;
    animation: shimmer 2s ease-in-out infinite;
    border-radius: var(--radius-sm);
  }

  /* ────────────────────────────────────────────────────────────
     BADGE VARIANTS
     Semantic status badges. Apply role-specific class to
     a <span> element with base classes: type-caption, px-2, py-1
     ──────────────────────────────────────────────────────────── */
  .badge-success {
    background: var(--color-success-bg);
    color: var(--color-success);
    border: 1px solid rgba(42, 175, 101, 0.20);
    border-radius: var(--radius-full);
  }

  .badge-warning {
    background: var(--color-warning-bg);
    color: var(--color-warning);
    border: 1px solid rgba(240, 168, 48, 0.20);
    border-radius: var(--radius-full);
  }

  .badge-error {
    background: var(--color-error-bg);
    color: var(--color-error);
    border: 1px solid rgba(229, 83, 75, 0.20);
    border-radius: var(--radius-full);
  }

  .badge-info {
    background: var(--color-info-bg);
    color: var(--color-info);
    border: 1px solid rgba(83, 155, 245, 0.20);
    border-radius: var(--radius-full);
  }

  .badge-neutral {
    background: var(--surface-glass);
    color: var(--text-secondary);
    border: 1px solid var(--surface-border);
    border-radius: var(--radius-full);
  }
}


/* ─────────────────────────────────────────────────────────────
   KEYFRAMES — Intentionally outside @layer

   CSS @keyframes are not subject to cascade layer specificity
   and are safe outside layers. However, the animation classes
   that reference these keyframes must still be inside @layer
   components (see above).
   ───────────────────────────────────────────────────────────── */

/* Elements entering from above (dropdowns, notification bars)     */
@keyframes slideDown {
  from {
    opacity: 0;
    transform: translateY(-12px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

/* Elements entering from below (bottom sheets, toasts)            */
@keyframes slideUp {
  from {
    opacity: 0;
    transform: translateY(16px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

/* Simple opacity transition — no transform, no layout shift       */
@keyframes fadeIn {
  from { opacity: 0; }
  to   { opacity: 1; }
}

/* Scale-in for modals, popovers — slight overshoot via ease-out-back */
@keyframes scaleIn {
  from {
    opacity: 0;
    transform: scale(0.92);
  }
  to {
    opacity: 1;
    transform: scale(1);
  }
}

/* Skeleton shimmer — horizontal light sweep                        */
@keyframes shimmer {
  0%   { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}

/* Breathing opacity for "live" indicators, processing states       */
@keyframes glowPulse {
  0%, 100% { opacity: 0.5; }
  50%       { opacity: 1; }
}

/* Gentle vertical float for decorative elements, illustrations     */
@keyframes float {
  0%, 100% { transform: translateY(0px); }
  50%       { transform: translateY(-8px); }
}

/* Horizontal marquee for scrolling tickers
   Container must be: overflow: hidden; white-space: nowrap;        */
@keyframes marquee {
  from { transform: translateX(0); }
  to   { transform: translateX(-50%); }
}

/* Background gradient position animation
   Use with background-size: 200% 200%                              */
@keyframes gradientMesh {
  0%   { background-position: 0% 50%; }
  50%  { background-position: 100% 50%; }
  100% { background-position: 0% 50%; }
}

/* Floating sparkle/particle for decorative hero elements           */
@keyframes particleFloat {
  0%   { transform: translateY(0) translateX(0) scale(1); opacity: 0.6; }
  25%  { transform: translateY(-12px) translateX(6px) scale(1.05); opacity: 1; }
  50%  { transform: translateY(-8px) translateX(-4px) scale(0.95); opacity: 0.8; }
  75%  { transform: translateY(-16px) translateX(8px) scale(1.02); opacity: 1; }
  100% { transform: translateY(0) translateX(0) scale(1); opacity: 0.6; }
}
```

---

## 9. Component Design Tokens

The following table specifies the exact token mapping for every component type in the system. Implementation must use these tokens — never hardcoded hex values.

### 9.1 Button Components

#### Primary Button

The primary call-to-action. Use for the single most important action on any given screen.

| Property | Token | Notes |
|---|---|---|
| Background | `--brand-green` | `#1B8B4D` |
| Text color | `--text-inverse` | `#0B0D0F` — dark text on green |
| Border | None | No border on solid buttons |
| Border radius | `--radius-md` | `12px` |
| Hover background | `--brand-green-light` | `#2AAF65` |
| Hover shadow | `--shadow-glow-green` | Green bloom effect |
| Active/pressed bg | `--brand-green-dark` | `#146B3A` |
| Focus ring | `--brand-green` outline, `--brand-green-subtle` shadow | 2px outline + 4px shadow spread |
| Disabled opacity | `0.4` | Apply `cursor: not-allowed` |
| Transition | `--duration-fast` + `--ease-out-expo` | Background, shadow, transform |
| Padding | `px-5 py-2.5` (20px, 10px) | Standard size |
| Font weight | `600` | Semi-bold |
| Font size | `0.9375rem` (15px) | Between body and body-sm |

**Micro-interaction:** On press (`:active`), add `transform: scale(0.98)` with `--duration-fast` to simulate physical button depression.

#### Secondary / Ghost Button

For supporting actions that do not compete with the primary.

| Property | Token | Notes |
|---|---|---|
| Background | `transparent` | No fill at rest |
| Text color | `--text-primary` | `#F0F2F5` |
| Border | `1px solid var(--surface-border)` | Subtle definition |
| Border radius | `--radius-md` | `12px` |
| Hover background | `--surface-glass-hover` | `rgba(255,255,255,0.06)` |
| Hover border | `--surface-border-hover` | `rgba(255,255,255,0.10)` |
| Active background | `--surface-glass` | Slightly darker than hover |
| Focus ring | `--brand-green` | Same as primary for consistency |
| Transition | `--duration-fast` + `--ease-out-expo` | Background, border-color |

#### Danger Button

For destructive actions (delete, remove, disconnect).

| Property | Token | Notes |
|---|---|---|
| Background | `--color-error` | `#E5534B` |
| Text color | `white` | `#FFFFFF` — white (not inverse) |
| Border radius | `--radius-md` | `12px` |
| Hover opacity | `0.9` | Slight dim on hover |
| Active opacity | `0.85` | Deeper dim on press |
| Focus ring | `--color-error` | Red focus ring for danger affordance |

**Confirmation Pattern:** Danger buttons must always be preceded by a confirmation step (modal or inline confirm-cancel UI). Never allow a single click to execute a destructive action.

#### Icon Button

Circular/square icon-only button. Includes tooltip on hover.

| Property | Token | Notes |
|---|---|---|
| Background | `transparent` at rest, `--surface-glass-hover` on hover | |
| Border | `1px solid transparent` at rest, `--surface-border` on hover | |
| Border radius | `--radius-md` for square, `--radius-full` for circular | |
| Size | `36px × 36px` (standard), `28px × 28px` (compact) | |
| Icon color | `--text-muted` at rest, `--text-secondary` on hover | Subtle-to-visible transition |

### 9.2 Card Component

The fundamental container for content sections.

| Property | Token | Notes |
|---|---|---|
| Background | `--bg-secondary` | `#12151A` — the primary card bg |
| Border | `1px solid var(--surface-border)` | `rgba(255,255,255,0.06)` |
| Border radius | `--radius-lg` | `16px` |
| Shadow | `--shadow-md` | Resting state |
| Hover border | `--surface-border-hover` | `rgba(255,255,255,0.10)` |
| Hover shadow | `--shadow-lg` | Lifts on hover |
| Padding | `p-5` or `p-6` | `20px` or `24px` |
| Transition | `--duration-normal` + `--ease-out-expo` | Border, shadow |

**Interactive Card (clickable):** Add cursor-pointer and `transform: translateY(-1px)` on hover. The background should change to `--bg-hover` (`#222833`) on hover for additional visual feedback.

**Featured/Highlighted Card:** Replace `--surface-border` with `--brand-green-border` and add `box-shadow: var(--shadow-md), 0 0 12px var(--brand-green-glow)` for a green-highlighted variant.

### 9.3 Input / Form Controls

| Property | Token | Notes |
|---|---|---|
| Background | `--bg-input` | `#0F1218` — darker than page bg for inset effect |
| Border | `1px solid var(--surface-border)` | Subtle at rest |
| Border radius | `--radius-md` | `12px` |
| Text color | `--text-primary` | User-typed content must be high contrast |
| Placeholder color | `--text-muted` | `#5C6370` |
| Focus border | `--brand-green` | Full opacity green border on focus |
| Focus ring | `box-shadow: 0 0 0 3px var(--brand-green-subtle)` | Outer glow ring |
| Error border | `--color-error` | Full opacity red border |
| Error ring | `box-shadow: 0 0 0 3px var(--color-error-bg)` | Red outer glow |
| Disabled background | `--bg-secondary` | Slightly lighter than input bg |
| Disabled text | `--text-muted` | Visually communicates disabled state |
| Padding | `px-4 py-2.5` (16px, 10px) | Standard input padding |
| Height | `42px` | Standard single-line input height |
| Transition | `--duration-fast` + `--ease-out-expo` | Border, box-shadow |

**Label:** Position above input. Use `--text-secondary` at weight 500, 14px (`.type-body-sm`). Add 4px gap between label and input. Required fields append a `*` in `--color-error`.

**Helper text / validation message:** Position below input with 4px gap. Use `--text-muted` for neutral helper, `--color-error` + `--color-error-bg` background for error messages. Use `.type-caption` size (12px).

### 9.4 Modal / Dialog

| Property | Token | Notes |
|---|---|---|
| Overlay background | `rgba(0, 0, 0, 0.6)` | Not tokenized — always this value |
| Overlay blur | `backdrop-filter: blur(4px)` | Slight blur of page content behind modal |
| Modal background | `--bg-tertiary` | `#1A1E26` |
| Modal border | `1px solid var(--surface-border)` | |
| Modal border radius | `--radius-xl` | `20px` |
| Modal shadow | `--shadow-xl` | Maximum shadow depth |
| Max width | `560px` (standard), `760px` (wide) | Responsive: full width below 600px |
| Padding | `p-6` | `24px` |
| Entry animation | `.animate-scale-in` | Springy pop-in |
| Overlay entry | `.animate-fade-in` | Simple fade |

**Header:** Title in `--text-primary` at `.type-h4` (20px, weight 600). Close button top-right: `--radius-md` icon button variant. 1px border separator (`--surface-border`) between header and body if body has scroll.

**Footer:** Right-aligned button group. Cancel button (secondary) on left, confirm button (primary or danger) on right. `gap-3` (12px) between buttons.

### 9.5 Badge

Small inline status indicator. Always use semantic variants.

| Variant | Background | Text | Border |
|---|---|---|---|
| Success | `--color-success-bg` | `--color-success` | `rgba(42,175,101,0.20)` |
| Warning | `--color-warning-bg` | `--color-warning` | `rgba(240,168,48,0.20)` |
| Error | `--color-error-bg` | `--color-error` | `rgba(229,83,75,0.20)` |
| Info | `--color-info-bg` | `--color-info` | `rgba(83,155,245,0.20)` |
| Neutral | `--surface-glass` | `--text-secondary` | `--surface-border` |
| Brand | `--brand-green-subtle` | `--brand-green-light` | `--brand-green-border` |

All badges:
- Border radius: `--radius-full` (`9999px`) — pill shape
- Padding: `px-2.5 py-0.5` (10px, 2px)
- Font: `.type-caption` (12px, weight 500)
- Border: `1px solid` (color per variant above)

### 9.6 Toast / Notification

Ephemeral feedback messages. Appear at bottom-right, stack vertically.

| Property | Token | Notes |
|---|---|---|
| Background | `--bg-tertiary` | `#1A1E26` — elevated surface |
| Border | `1px solid var(--surface-border)` | |
| Left accent border | `4px solid [semantic-color]` | Colored left edge communicates type |
| Border radius | `--radius-lg` | `16px` |
| Shadow | `--shadow-lg` | Prominent to float above page content |
| Min width | `320px` | |
| Max width | `400px` | |
| Padding | `p-4` | `16px` |
| Entry animation | `.animate-slide-up` | Enters from bottom |
| Exit animation | `fadeOut` (opacity + translateY) | Exits to right |

**Left accent colors by type:**
- Success: `--color-success` (`#2AAF65`)
- Warning: `--color-warning` (`#F0A830`)
- Error: `--color-error` (`#E5534B`)
- Info: `--color-info` (`#539BF5`)

**Structure:** Icon (left, 20px, semantic color) + title (`--text-primary`, weight 600, 14px) + description (`--text-secondary`, 13px) + optional action link (`--brand-green-light`, 13px). Close button top-right.

### 9.7 Sidebar Navigation

| Property | Token | Notes |
|---|---|---|
| Sidebar background | `--bg-secondary` | `#12151A` |
| Sidebar border-right | `1px solid var(--surface-border)` | |
| Nav item: resting bg | `transparent` | No background at rest |
| Nav item: resting text | `--text-secondary` | Muted until selected |
| Nav item: resting icon | `--text-muted` | Very muted at rest |
| Nav item: hover bg | `--surface-glass-hover` | Subtle highlight |
| Nav item: hover text | `--text-primary` | |
| Nav item: active bg | `--brand-green-subtle` | Green tint |
| Nav item: active text | `--brand-green-light` | `#2AAF65` |
| Nav item: active icon | `--brand-green-light` | Matches text |
| Nav item: active border | `2px solid var(--brand-green)` on left edge | Left indicator bar |
| Nav item border radius | `--radius-md` | `12px` (the item itself) |
| Nav item padding | `px-3 py-2` | `12px × 8px` |
| Transition | `--duration-fast` + `--ease-out-expo` | All properties |

**Logo area:** 64px height. Logo image 32px tall. App name "FedRight" in Inter 600, `--text-primary`. Tagline optional — if shown, use `.type-caption` in `--text-muted`.

### 9.8 Dropdown / Select Menu

| Property | Token | Notes |
|---|---|---|
| Background | `--bg-tertiary` | `#1A1E26` |
| Border | `1px solid var(--surface-border)` | |
| Border radius | `--radius-lg` | `16px` |
| Shadow | `--shadow-lg` | |
| Entry animation | `.animate-slide-down` | |
| Item: resting bg | `transparent` | |
| Item: resting text | `--text-secondary` | |
| Item: hover bg | `--bg-hover` | `#222833` |
| Item: hover text | `--text-primary` | |
| Item: selected bg | `--brand-green-subtle` | |
| Item: selected text | `--brand-green-light` | |
| Item border radius | `--radius-sm` | `8px` (for items inside the container) |
| Item padding | `px-3 py-2` | |
| Section separator | `1px solid var(--surface-border)` | Between option groups |

### 9.9 Progress Bar / Ring

| State | Foreground | Background | Notes |
|---|---|---|---|
| Default | `--brand-green` | `--surface-border` | Standard progress |
| Warning (75-90%) | `--brand-amber` | `--brand-amber-subtle` | Approaching limit |
| Exceeded (>90%) | `--color-error` | `--color-error-bg` | Over limit |
| Completed (100%) | `--brand-green-light` | `--color-success-bg` | Celebration state |

Bar height: `6px` standard, `10px` large, `4px` compact. Border radius: `--radius-full` on both bar and track.

---

## 10. layout.tsx Font Update

### 10.1 Required Changes

The following changes must be made to `frontend/src/app/layout.tsx`:

**Remove (lines 2-20 in current file):**
```typescript
import { DM_Serif_Display, Source_Sans_3 } from "next/font/google";

const displayFont = DM_Serif_Display({
  subsets: ["latin"],
  weight: "400",
  variable: "--font-display",
});

const bodyFont = Source_Sans_3({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
  variable: "--font-body",
});
```

**Replace with:**
```typescript
import { Inter } from "next/font/google";

const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-inter",
  display: "swap",
});
```

**Update `<html>` tag (add `className` for CSS variable exposure):**
```tsx
<html lang="en" className={inter.variable}>
```

**Update `<body>` tag:**
```tsx
<body
  className="antialiased"
  style={{ fontFamily: "var(--font-inter), -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" }}
>
```

**Update metadata:**
```typescript
export const metadata: Metadata = {
  title: "FedRight — One Kitchen. Every Body. Perfectly Fed.",
  description: "AI-powered household meal planning for Indian families. Personalized nutrition, smart grocery lists, and family-aware meal planning.",
};
```

### 10.2 CSS Variable Mapping

After this change, the CSS custom properties for fonts are:

| Old Variable | New Variable | Notes |
|---|---|---|
| `var(--font-display)` | `var(--font-inter)` | Replace all references |
| `var(--font-body)` | `var(--font-inter)` | Replace all references |

Search the codebase for both `--font-display` and `--font-body` and replace with `--font-inter`.

---

## 11. Cross-Reference: brand_assets/brand-style-guide.md

This same design system content must be maintained as a reference document outside the spec folder for use by designers, marketing, and external contractors who may not have access to the spec directory.

**File path:** `brand_assets/brand-style-guide.md`

**The `brand_assets/brand-style-guide.md` file should contain:**
1. All sections from this document (Brand Identity through Component Design Tokens)
2. A note at the top indicating it is a reference copy and the authoritative version is at `spec/ui-redesign/01-brand-design-system.md`
3. The color palette rendered as visual swatches (using markdown code blocks with hex values clearly labeled)
4. Quick-reference tables for the most frequently needed tokens (colors, shadows, radii, typography)
5. A "Before/After" section showing the Botanical Luxe → FedRight Dark token mapping for each category (to aid migration)

**Migration Mapping (Botanical Luxe → FedRight Dark):**

| Old Token (Botanical) | New Token (FedRight) | Context |
|---|---|---|
| `--color-emerald-deep: #1a3a2a` | `--brand-green-dark: #146B3A` | Deep brand color |
| `--color-emerald: #2d5a3f` | `--brand-green: #1B8B4D` | Primary brand |
| `--color-emerald-light: #3d7a56` | `--brand-green-light: #2AAF65` | Light brand |
| `--color-amber: #d4940a` | `--brand-amber: #E6920A` | Amber accent |
| `--color-cream: #faf8f4` | `--bg-primary: #0B0D0F` | Page background |
| `--color-clay: #4a3f35` | `--text-primary: #F0F2F5` | Primary text |
| `--color-clay-muted: #8a7d72` | `--text-secondary: #9BA3B0` | Secondary text |
| `--surface-primary: rgba(255,255,253,0.72)` | `--surface-glass: rgba(255,255,255,0.03)` | Glass surface |
| `--shadow-glow-emerald` | `--shadow-glow-green` | Brand glow |
| `.checkbox-botanical` | `.checkbox-fedright` | Custom checkbox |
| `.gradient-botanical` | `.gradient-dark` | Dark gradient |
| `.gradient-emerald` | `.gradient-green` | Brand gradient |
| `--font-display` (DM Serif Display) | `--font-inter` (Inter) | Display font |
| `--font-body` (Source Sans 3) | `--font-inter` (Inter) | Body font |

---

## Appendix A: Implementation Checklist

Use this checklist to verify complete implementation of the design system.

### Phase 1: Foundation

- [ ] `frontend/src/app/globals.css` replaced with content from Section 8
- [ ] `frontend/src/app/layout.tsx` updated with Inter font (Section 10)
- [ ] All `--font-display` and `--font-body` references replaced with `--font-inter` across all component files
- [ ] All `--color-emerald*`, `--color-cream*`, `--color-clay*` references replaced with new tokens
- [ ] `.checkbox-botanical` renamed to `.checkbox-fedright` in all usages
- [ ] Background color of `body` renders as `#0B0D0F`
- [ ] Scrollbar appears dark (not the light botanical scrollbar)

### Phase 2: Component Migration

- [ ] Sidebar: active state uses `--brand-green-subtle` bg + `--brand-green-light` text
- [ ] Sidebar: inactive items use `--text-muted` icons + `--text-secondary` text
- [ ] All primary buttons: green bg (`--brand-green`), dark text (`--text-inverse`), glow on hover
- [ ] All cards: `--bg-secondary` bg, `--surface-border` border, `--radius-lg`
- [ ] All inputs: `--bg-input` bg, green focus ring
- [ ] All modals: `--bg-tertiary` bg, `--radius-xl`, scale-in animation
- [ ] Toast notifications: left-colored border stripe per semantic type

### Phase 3: Polish

- [ ] Page background has subtle green/amber radial gradient mesh (body `background-image`)
- [ ] Skeleton loading states use `.skeleton` class (shimmer animation)
- [ ] Stagger animations applied to list renders (dashboard cards, meal list items)
- [ ] Logo: only v2 (`fedright-logo-gemini-v2.png`) used inside authenticated app
- [ ] `<title>` updated to "FedRight — One Kitchen. Every Body. Perfectly Fed."
- [ ] `brand_assets/brand-style-guide.md` created with reference content

---

## Appendix B: Color Contrast Quick Reference

| Combination | Ratio | WCAG Level | Approved Use |
|---|---|---|---|
| `--text-primary` on `--bg-secondary` | ~9.5:1 | AAA | All text |
| `--text-secondary` on `--bg-secondary` | ~3.1:1 | AA (large text) | Body prose, descriptions |
| `--text-primary` on `--bg-primary` | ~10.2:1 | AAA | All text |
| `--text-inverse` on `--brand-green` | ~5.8:1 | AA | Button labels |
| `--brand-green-light` on `--bg-primary` | ~5.2:1 | AA | Links, active text |
| `--color-error` on `--bg-secondary` | ~4.6:1 | AA | Error messages |
| `--text-muted` on `--bg-secondary` | ~1.9:1 | Fail | Decorative only — never for essential content |

**Enforcement:** `--text-muted` must NEVER carry information critical to task completion, error states, or accessibility. It is purely decorative.

---

*End of document. Authoritative version maintained at `spec/ui-redesign/01-brand-design-system.md`.*
*Reference copy should be maintained at `brand_assets/brand-style-guide.md`.*
*Next document: `spec/ui-redesign/02-component-library.md` — Individual component implementation specs.*
