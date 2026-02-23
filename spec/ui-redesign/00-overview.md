# FedRight UI Redesign — Master Overview & Executive Summary

**Document Version:** 1.0
**Date:** 2026-02-20
**Status:** Approved for Implementation
**Author:** Design System Team

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Confirmed Technical Decisions](#2-confirmed-technical-decisions)
3. [Delivery Phases](#3-delivery-phases)
4. [File Structure](#4-file-structure)
5. [Dependencies & Prerequisites](#5-dependencies--prerequisites)
6. [Risk & Mitigation](#6-risk--mitigation)

---

## 1. Executive Summary

### What We Are Building

FedRight is being redesigned from a functional internal tool into a consumer-facing AI-powered household meal planning product targeting Indian families. The current state is a light "Botanical Luxe" themed app with no public landing page — users land directly on the app dashboard, which is inappropriate for a consumer product requiring onboarding, trust-building, and conversion.

This redesign accomplishes two things simultaneously:

1. **A cinematic, dark-mode-first public landing page** that sells the product before a user ever creates an account.
2. **A full dark-mode conversion of the authenticated app**, creating a unified, premium visual identity.

### Brand Positioning

FedRight occupies a unique dual-angle position in the market:

**Angle A — Household Intelligence (Primary):**
FedRight is not just a personal nutrition app. It is the first AI nutritionist designed for the *entire household* — understanding that in an Indian family context, one person's dietary need (a diabetic grandparent, a growing child, a postpartum mother) affects what *everyone* eats. FedRight generates a single weekly meal plan that works for every member simultaneously, with intelligent portion scaling and kid-friendly adaptations built in.

**Angle B — Cultural Authenticity (Supporting):**
Every recommendation is rooted in Indian culinary tradition. FedRight does not suggest quinoa bowls or Greek salads to a family that cooks Punjabi tadka dal. The AI understands regional cuisine — Punjabi, South Indian, Gujarati, Bengali, Hyderabadi, Kerala — and generates plans that are practically executable in an Indian kitchen.

### Tagline & Core Messaging

**Primary Tagline:** "One Kitchen. Every Body. Perfectly Fed."

**Supporting Messages:**
- "AI that understands your whole family, not just you."
- "From dals to dosas — nutrition that fits your kitchen."
- "Your family's health. One plan. Zero compromise."
- "Built for the Indian household. Powered by AI."

### What This Is Not

This is NOT a generic fitness app with an Indian skin. The AI engine deeply understands joint household profiles, inter-member dietary constraints, regional cuisine substitutions, and Indian meal timing conventions (e.g., heavy lunch, light dinner in many regions). The landing page must communicate this specificity clearly — the target user should feel "this was built for me."

---

## 2. Confirmed Technical Decisions

### 2.1 Logo Choice

**Selected:** `fedright-logo-gemini-v2.png` (green rounded-square with white "F" + integrated checkmark)

**Reasoning:**
- The checkmark integrated into the "F" communicates "fed correctly / verified" without explanation
- The green color palette (`#22c55e` / Tailwind `green-500`) maps naturally to health and freshness
- The rounded-square container scales cleanly across all sizes (favicon 16px → hero display 120px)
- v1 alternatives were rejected for being less legible at small sizes and lacking the checkmark metaphor

**Usage Rules:**
- Minimum display size: 24px × 24px
- Always maintain aspect ratio (1:1 square)
- On dark backgrounds: use full-color logo (white F + green square)
- On light backgrounds: same — the green provides sufficient contrast
- Never apply additional drop shadows — the logo carries its own visual weight
- Approved file: `brand_assets/fedright-logo-gemini-v2.png`

### 2.2 Route Restructuring

**Current routing problem:** All app pages live at root-level paths (`/`, `/profile`, `/meal-plan`, etc.) with no public surface.

**New routing architecture:**

| Route | Access | Purpose |
|---|---|---|
| `/` | Public | Landing page (10 sections, scroll-driven) |
| `/login` | Public | Email/password + Google OAuth login |
| `/signup` | Public | Registration form |
| `/app` | Authenticated | Home dashboard (redirect target post-login) |
| `/app/profile` | Authenticated | Profile management |
| `/app/meal-plan` | Authenticated | Meal plan view |
| `/app/tracking` | Authenticated | Meal tracking |
| `/app/grocery` | Authenticated | Grocery list |
| `/app/chefs-view` | Authenticated | Chef's view |
| `/app/dashboard` | Authenticated | Analytics dashboard |
| `/app/settings` | Authenticated | App settings |

**Implementation mechanism:** Next.js App Router file-based routing. All current page files under `src/app/` (except `layout.tsx` and `globals.css`) are MOVED to `src/app/app/`. A middleware at `src/middleware.ts` guards all `/app/*` routes and redirects unauthenticated users to `/login`.

**Backward compatibility:** A `next.config.ts` redirect rule maps all old paths to new `/app/*` equivalents so existing bookmarks/links do not 404.

### 2.3 Dark-Mode-First Approach

The redesign adopts **dark-as-default**, not dark-as-option. This means:

- CSS custom properties are defined with dark values as the base
- Light mode (if ever introduced) would require an explicit class override
- All color decisions are made for dark first, then verified for accessibility
- The landing page uses a `#0a0a0a` near-black base
- The app uses `#111827` (Tailwind `gray-900`) as the primary surface

**Why dark-first:** The Indian tech-savvy demographic the product targets (25–45 age bracket using apps in evenings / on mobile) strongly prefers dark interfaces. Premium SaaS products in this space (Notion, Linear, Raycast) all default dark. This also makes AI-generated food photography images pop dramatically better.

### 2.4 Font Choice: Inter

**Selected font:** Inter (Google Fonts)

**Replacing:** DM Serif Display (display headings) and Source Sans 3 (body text)

**Reasoning:**
- Inter was designed specifically for screen readability at all sizes — especially critical for data-dense health app screens (meal tables, nutrition charts)
- Single-font system reduces HTTP requests and eliminates the style mismatch between the old serif/sans pairing
- Inter's numerical tabular figures are excellent for nutrition data (calories, macros, weights)
- Font variable: `--font-inter` defined in `layout.tsx` via `next/font/google`

**Type scale (rem-based):**

| Token | Value | Usage |
|---|---|---|
| `--text-xs` | 0.75rem / 12px | Labels, captions, badges |
| `--text-sm` | 0.875rem / 14px | Secondary body, table cells |
| `--text-base` | 1rem / 16px | Primary body text |
| `--text-lg` | 1.125rem / 18px | Card titles, section intros |
| `--text-xl` | 1.25rem / 20px | Section headings (small) |
| `--text-2xl` | 1.5rem / 24px | Section headings |
| `--text-3xl` | 1.875rem / 30px | Page headings |
| `--text-4xl` | 2.25rem / 36px | Hero subtitle |
| `--text-5xl` | 3rem / 48px | Hero title (mobile) |
| `--text-7xl` | 4.5rem / 72px | Hero title (desktop) |

**Font weights used:** 400 (regular), 500 (medium), 600 (semibold), 700 (bold)

### 2.5 New Dependencies

The following packages must be added to `frontend/package.json`:

#### framer-motion ^11.x
- **Purpose:** Scroll-driven animations, stagger effects, page transitions, the Problem Statement text reveal, counter animations
- **Why not CSS animations:** framer-motion's `useInView`, `useScroll`, and `useTransform` hooks provide JavaScript-controlled scroll-linked animation that CSS cannot replicate with sufficient control
- **Bundle impact:** ~50KB gzipped. Acceptable given the animation-heavy landing page requirement.
- **Import pattern:** Import only used hooks to enable tree-shaking: `import { motion, useInView, useScroll, useTransform } from 'framer-motion'`

#### swiper ^11.x
- **Purpose:** Testimonials carousel, mobile feature showcase carousel fallback
- **Why not a custom carousel:** Swiper provides battle-tested touch handling, momentum physics, and accessibility (keyboard navigation, ARIA) that would take weeks to replicate
- **Bundle impact:** ~25KB gzipped (core + autoplay + pagination modules only). Use module-level imports to avoid importing unused Swiper modules.
- **Import pattern:** `import { Swiper, SwiperSlide } from 'swiper/react'` + selective module CSS

#### @studio-freight/lenis ^1.x
- **Purpose:** Smooth scroll polyfill. Replaces native browser scroll with physics-based momentum scrolling on the landing page.
- **Why:** Creates the premium "cinematic" feel for the scroll-driven storytelling sections. Without Lenis, scroll-linked framer-motion animations feel slightly jerky on trackpads.
- **Integration point:** Initialized once in `LandingLayout.tsx`, connects to framer-motion's scroll listener via `lenis.on('scroll', ScrollTrigger.update)` pattern
- **Important:** Lenis must NOT be initialized in the `/app/*` layout — only on the public landing page. App pages use native scroll.

### 2.6 Existing Dependencies to Preserve

The following packages are already installed and must NOT be removed or version-bumped without explicit testing:

| Package | Current Version | Role |
|---|---|---|
| `recharts` | ^2.x | Dashboard analytics charts |
| `lucide-react` | ^0.x | Icon system throughout app |
| `axios` | ^1.x | HTTP client for backend API |
| `@react-oauth/google` | ^0.x | Google OAuth login flow |
| `tailwindcss` | ^4.x (via `@tailwindcss/postcss`) | Utility CSS framework |

**Critical note on `tailwindcss` v4:** Do not upgrade or reinstall. The v4 cascade layer behavior is already accounted for in the current `globals.css`. All new CSS added during this redesign MUST be placed inside `@layer base` or `@layer components` blocks. Any unlayered CSS will silently override all Tailwind utilities.

### 2.7 No Component Library

**Decision:** This project uses zero external component libraries (no shadcn/ui, no MUI, no Radix primitives, no Headless UI).

**All UI components are custom-built with Tailwind CSS.**

**Reasoning:**
- Component libraries impose opinionated dark-mode implementations that conflict with our custom design tokens
- The cinematic landing page requires components that no off-the-shelf library provides (animated cuisine marquee, scroll-linked text reveal, etc.)
- Custom components give full control over animation integration points with framer-motion
- The existing codebase has no component library dependency, so introducing one mid-project creates integration risk

**Implication for dev team:** Every new component in this redesign is built from scratch. Refer to the brand style guide (Phase 0 deliverable) for the design token system and reusable utility patterns.

---

## 3. Delivery Phases

The redesign is split into two top-level **Deliveries**, each broken into sequential **Phases**. Phases within a Delivery can be partially parallelized but have dependencies noted below.

### Delivery 1 — Landing Page Experience

**Goal:** Ship a fully animated, visually polished public landing page at `/` that converts visitors to signups.

---

#### Phase 0: Brand Identity & Design System

**Spec document:** `spec/ui-redesign/01-brand-style-guide.md`
**Output files:**
- `frontend/src/styles/globals.css` (REWRITE — new CSS custom properties, color tokens, typography tokens, dark-first base styles)
- `frontend/src/styles/design-tokens.ts` (NEW — TypeScript constants mirroring CSS tokens for use in framer-motion values)

**What this phase delivers:**
- Complete color palette: primary greens, neutrals, accent amber/orange for Indian warmth, semantic colors (success, warning, error, info)
- All CSS custom properties (`--color-*`, `--text-*`, `--radius-*`, `--shadow-*`, `--spacing-*`)
- Typography base styles in `@layer base`
- Global dark background established on `<body>`
- Animation timing constants (`--ease-spring`, `--ease-cinematic`, `--duration-fast`, `--duration-medium`, `--duration-slow`)

**Dependencies:** None. This phase must complete before any other phase.

---

#### Phase 1: Public Landing Page — Structure & Components

**Spec document:** `spec/ui-redesign/02-landing-page.md`
**Output files:**
- `frontend/src/app/page.tsx` (REWRITE — currently redirects to app, becomes landing page)
- `frontend/src/app/(landing)/layout.tsx` (NEW — landing page layout with Lenis scroll init)
- `frontend/src/components/landing/Navbar.tsx` (NEW)
- `frontend/src/components/landing/HeroSection.tsx` (NEW)
- `frontend/src/components/landing/ProblemSection.tsx` (NEW)
- `frontend/src/components/landing/HowItWorksSection.tsx` (NEW)
- `frontend/src/components/landing/FeatureShowcaseSection.tsx` (NEW)
- `frontend/src/components/landing/CuisineMarquee.tsx` (NEW)
- `frontend/src/components/landing/AIDifferenceSection.tsx` (NEW)
- `frontend/src/components/landing/TestimonialsSection.tsx` (NEW)
- `frontend/src/components/landing/FinalCTASection.tsx` (NEW)
- `frontend/src/components/landing/Footer.tsx` (NEW)
- `frontend/src/components/landing/index.ts` (NEW — barrel export)

**What this phase delivers (10 sections):**

| # | Section | Primary Component | Description |
|---|---|---|---|
| 1 | Navbar | `Navbar.tsx` | Transparent → glass on scroll, sticky, mobile hamburger |
| 2 | Hero | `HeroSection.tsx` | Full-viewport, text stagger, parallax image, particle bg |
| 3 | Problem Statement | `ProblemSection.tsx` | Scroll-linked word-highlight text reveal |
| 4 | How It Works | `HowItWorksSection.tsx` | 3-step with connector line, counter animation |
| 5 | Feature Showcase | `FeatureShowcaseSection.tsx` | Tab/panel UI, content slide animation |
| 6 | Cuisine Marquee | `CuisineMarquee.tsx` | Infinite bi-directional scroll, hover pause |
| 7 | AI Difference | `AIDifferenceSection.tsx` | FedRight vs Traditional comparison table |
| 8 | Testimonials | `TestimonialsSection.tsx` | Swiper carousel, autoplay, touch-enabled |
| 9 | Final CTA | `FinalCTASection.tsx` | Gradient mesh bg, glow button, urgency text |
| 10 | Footer | `Footer.tsx` | 4-column, responsive, all links |

**Dependencies:** Phase 0 must be complete (design tokens needed). Phase 3 images can be placeholders initially.

---

#### Phase 3: AI Image Generation

**Spec document:** `spec/ui-redesign/04-image-generation.md`
**Output directory:** `frontend/public/images/landing/`
**Tool:** Google Gemini Pro image generation API (Python script)
**Script:** `scripts/generate-images.py` (NEW)

**Images to generate (12 total):**

| Filename | Section | Description | Dimensions |
|---|---|---|---|
| `hero-family-dinner.webp` | Hero | Multi-generational Indian family at dinner table, warm lighting | 1200×800 |
| `hero-meal-plan-ui.webp` | Hero | Floating phone showing FedRight app UI (can be composite) | 600×800 |
| `problem-chaos.webp` | Problem | Stressed parent with multiple food containers, chaotic kitchen | 800×600 |
| `hiw-step-1-profile.webp` | How It Works | Simple onboarding form on phone, clean UI | 400×400 |
| `hiw-step-2-ai.webp` | How It Works | Abstract AI/neural network visualization, green tones | 400×400 |
| `hiw-step-3-plan.webp` | How It Works | Beautiful weekly meal plan on screen | 400×400 |
| `cuisine-punjabi.webp` | Marquee | Dal makhani, naan, close-up food photography style | 300×300 |
| `cuisine-south-indian.webp` | Marquee | Masala dosa with sambar and chutneys | 300×300 |
| `cuisine-gujarati.webp` | Marquee | Dhokla and thali spread | 300×300 |
| `cuisine-bengali.webp` | Marquee | Mustard fish curry and rice | 300×300 |
| `cuisine-hyderabadi.webp` | Marquee | Biryani with raita close-up | 300×300 |
| `cuisine-kerala.webp` | Marquee | Kerala fish curry with appam | 300×300 |

**Optimization requirements:** All images converted to WebP, max quality 85, progressive loading. The `next/image` component handles optimization at serve time, but pre-optimizing reduces build-time processing.

**Dependencies:** Requires `GEMINI_API_KEY` environment variable. Can run in parallel with Phase 1 component development.

---

#### Phase 4: Animation System

**Spec document:** `spec/ui-redesign/05-animation-system.md`
**Output files:**
- `frontend/src/lib/animations.ts` (NEW — framer-motion variant definitions, shared timing constants)
- `frontend/src/hooks/useSmoothScroll.ts` (NEW — Lenis initialization hook)
- `frontend/src/hooks/useScrollAnimation.ts` (NEW — reusable scroll-triggered animation hook)
- Updates to all 10 landing section components (wire in animation variants)

**Animation inventory:**

| Animation | Component | Trigger | Implementation |
|---|---|---|---|
| Text stagger fade-up | Hero | On mount | framer-motion `staggerChildren` |
| Parallax scroll | Hero image | Scroll position | `useScroll` + `useTransform` |
| Particle background | Hero | Continuous | CSS `@keyframes` + JS canvas |
| Word highlight reveal | Problem | Scroll into view | `useInView` + stagger per word |
| Connector line draw | How It Works | Scroll | SVG `stroke-dashoffset` animation |
| Step counter count-up | How It Works | Viewport entry | framer-motion + `useInView` |
| Tab slide transition | Feature Showcase | Click | `AnimatePresence` + slide |
| Marquee infinite scroll | Cuisine | Continuous | CSS `animation: marquee` + JS pause |
| Stagger row reveal | AI Difference | Viewport entry | `staggerChildren` |
| Swiper carousel | Testimonials | Auto + touch | Swiper.js |
| Gradient mesh pulse | Final CTA | Continuous | CSS `@keyframes` |
| Button glow pulse | Final CTA | Hover | framer-motion `whileHover` |

**Performance rules (mandatory):**
- Only use `transform` and `opacity` for animations (no layout-triggering properties: width, height, top, left, margin, padding)
- Apply `will-change: transform` only to elements actively animating, remove after animation completes
- All scroll listeners debounced or managed via framer-motion's built-in RAF scheduler
- Reduce-motion: all animations respect `prefers-reduced-motion` media query via framer-motion's `useReducedMotion` hook

**Dependencies:** Phase 1 components must exist. Phase 0 animation timing tokens needed.

---

### Delivery 2 — App Dark Mode

**Goal:** Convert all authenticated app pages to the dark design system established in Delivery 1.

---

#### Phase 2: Full App Dark Mode

**Spec document:** `spec/ui-redesign/03-app-dark-mode.md`
**Scope:** Every component and page under `src/app/` (post-restructuring, `src/app/app/`)

**Pages to convert:**

| Page | Key Components | Dark Mode Challenges |
|---|---|---|
| Home / Dashboard | Stats cards, recent meals list | Card surface layers (surface-1, surface-2) |
| Profile | Profile card, member list, edit forms | Form input dark states, avatar placeholders |
| Meal Plan | Weekly grid, meal cards, swap UI | Dense color-coded meal status chips |
| Tracking | Meal status buttons, progress bars | 3-state button active colors on dark |
| Grocery | Category groups, checkbox items, export btn | Checkbox custom styling on dark |
| Chef's View | Cooking instructions, ingredient lists | Typography contrast on surface-2 |
| Dashboard | Recharts: line, bar, pie charts | Chart colors, grid lines, tooltip dark bg |
| Settings | Toggle switches, danger zone | Red danger actions on dark surfaces |

**Shared components to convert:**
- `Sidebar.tsx` — full dark sidebar, active state highlight
- `TopBar.tsx` — dark glass top bar
- All form input components — dark input fields (`bg-gray-800 border-gray-700`)
- Modal/dialog overlays — `bg-gray-950/80` backdrop
- Toast notifications — dark surface toast
- Loading skeletons — dark shimmer animation

**Recharts dark mode specifics:**
- Grid lines: `stroke="#374151"` (gray-700)
- Axis text: `fill="#9ca3af"` (gray-400)
- Tooltip: `contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151' }}`
- Line/bar colors: keep existing green/amber/blue but increase saturation by 10% for dark bg legibility

**Dependencies:** Phase 0 must be complete. Phase 5 (route restructuring) can happen before or after Phase 2 — they are independent.

---

#### Phase 5: Route Restructuring

**Spec document:** `spec/ui-redesign/06-route-restructuring.md`
**Scope:** Moving all app pages from `/` to `/app/*`, adding auth middleware

**Files to move (MOVE operations):**

| Current Path | New Path |
|---|---|
| `src/app/(app)/page.tsx` (home) | `src/app/app/page.tsx` |
| `src/app/profile/page.tsx` | `src/app/app/profile/page.tsx` |
| `src/app/meal-plan/page.tsx` | `src/app/app/meal-plan/page.tsx` |
| `src/app/tracking/page.tsx` | `src/app/app/tracking/page.tsx` |
| `src/app/grocery/page.tsx` | `src/app/app/grocery/page.tsx` |
| `src/app/chefs-view/page.tsx` | `src/app/app/chefs-view/page.tsx` |
| `src/app/dashboard/page.tsx` | `src/app/app/dashboard/page.tsx` |
| `src/app/settings/page.tsx` | `src/app/app/settings/page.tsx` |

**New files required:**
- `src/middleware.ts` — Next.js middleware for auth guard on `/app/*` routes
- `src/app/app/layout.tsx` — App layout (sidebar + topbar, replaces current root layout for app pages)
- `src/app/(landing)/layout.tsx` — Landing layout (Lenis scroll, no sidebar)
- `src/app/login/page.tsx` — Login page
- `src/app/signup/page.tsx` — Signup page

**Redirect rules in `next.config.ts`:**
```typescript
async redirects() {
  return [
    { source: '/profile', destination: '/app/profile', permanent: true },
    { source: '/meal-plan', destination: '/app/meal-plan', permanent: true },
    { source: '/tracking', destination: '/app/tracking', permanent: true },
    { source: '/grocery', destination: '/app/grocery', permanent: true },
    { source: '/chefs-view', destination: '/app/chefs-view', permanent: true },
    { source: '/dashboard', destination: '/app/dashboard', permanent: true },
    { source: '/settings', destination: '/app/settings', permanent: true },
  ];
}
```

**Middleware auth logic:**
```typescript
// src/middleware.ts
// Intercepts all /app/* requests
// Checks for auth token in cookies (key: 'fedright_token')
// If no valid token: redirect to /login?from=[original path]
// After login: redirect to the `from` param or /app as default
```

**Dependencies:** Independent of Phase 2. Can run in parallel with dark mode conversion.

---

## 4. File Structure

The following is the complete file tree for the redesign. Files are labeled with their action:

- **NEW** — Does not exist, must be created
- **MODIFY** — Exists, needs targeted changes (not a full rewrite)
- **REWRITE** — Exists, replace content entirely
- **MOVE** — Relocate to new path (content may also be modified)
- **KEEP** — No changes required, listed for completeness

```
frontend/
├── package.json                                    [MODIFY — add framer-motion, swiper, lenis]
├── next.config.ts                                  [MODIFY — add redirect rules]
├── tailwind.config.ts                              [KEEP — v4 uses PostCSS, minimal config]
├── postcss.config.ts                               [KEEP]
│
├── public/
│   ├── images/
│   │   └── landing/                               [NEW directory]
│   │       ├── hero-family-dinner.webp            [NEW — Phase 3]
│   │       ├── hero-meal-plan-ui.webp             [NEW — Phase 3]
│   │       ├── problem-chaos.webp                 [NEW — Phase 3]
│   │       ├── hiw-step-1-profile.webp            [NEW — Phase 3]
│   │       ├── hiw-step-2-ai.webp                 [NEW — Phase 3]
│   │       ├── hiw-step-3-plan.webp               [NEW — Phase 3]
│   │       ├── cuisine-punjabi.webp               [NEW — Phase 3]
│   │       ├── cuisine-south-indian.webp          [NEW — Phase 3]
│   │       ├── cuisine-gujarati.webp              [NEW — Phase 3]
│   │       ├── cuisine-bengali.webp               [NEW — Phase 3]
│   │       ├── cuisine-hyderabadi.webp            [NEW — Phase 3]
│   │       └── cuisine-kerala.webp                [NEW — Phase 3]
│   └── fedright-logo-gemini-v2.png               [KEEP — existing brand asset]
│
├── src/
│   ├── middleware.ts                               [NEW — Phase 5, auth guard]
│   │
│   ├── styles/
│   │   ├── globals.css                            [REWRITE — Phase 0, new design tokens]
│   │   └── design-tokens.ts                       [NEW — Phase 0, TS mirror of CSS tokens]
│   │
│   ├── app/
│   │   ├── layout.tsx                             [MODIFY — root layout, Inter font, minimal]
│   │   ├── page.tsx                               [REWRITE — Phase 1, landing page root]
│   │   │
│   │   ├── (landing)/                             [NEW route group — Phase 1]
│   │   │   └── layout.tsx                         [NEW — Lenis init, no sidebar]
│   │   │
│   │   ├── login/
│   │   │   └── page.tsx                           [NEW — Phase 5, login page]
│   │   │
│   │   ├── signup/
│   │   │   └── page.tsx                           [NEW — Phase 5, signup page]
│   │   │
│   │   └── app/                                   [NEW directory — Phase 5]
│   │       ├── layout.tsx                         [NEW — app layout: sidebar + topbar]
│   │       ├── page.tsx                           [MOVE from current home page]
│   │       ├── profile/
│   │       │   └── page.tsx                       [MOVE + MODIFY]
│   │       ├── meal-plan/
│   │       │   └── page.tsx                       [MOVE + MODIFY]
│   │       ├── tracking/
│   │       │   └── page.tsx                       [MOVE + MODIFY]
│   │       ├── grocery/
│   │       │   └── page.tsx                       [MOVE + MODIFY]
│   │       ├── chefs-view/
│   │       │   └── page.tsx                       [MOVE + MODIFY]
│   │       ├── dashboard/
│   │       │   └── page.tsx                       [MOVE + MODIFY]
│   │       └── settings/
│   │           └── page.tsx                       [MOVE + MODIFY]
│   │
│   ├── components/
│   │   ├── landing/                               [NEW directory — Phase 1]
│   │   │   ├── index.ts                           [NEW — barrel export]
│   │   │   ├── Navbar.tsx                         [NEW]
│   │   │   ├── HeroSection.tsx                    [NEW]
│   │   │   ├── ProblemSection.tsx                 [NEW]
│   │   │   ├── HowItWorksSection.tsx              [NEW]
│   │   │   ├── FeatureShowcaseSection.tsx         [NEW]
│   │   │   ├── CuisineMarquee.tsx                 [NEW]
│   │   │   ├── AIDifferenceSection.tsx            [NEW]
│   │   │   ├── TestimonialsSection.tsx            [NEW]
│   │   │   ├── FinalCTASection.tsx                [NEW]
│   │   │   └── Footer.tsx                         [NEW]
│   │   │
│   │   ├── auth/                                  [KEEP — existing auth components]
│   │   │   └── (existing files)
│   │   │
│   │   └── layout/
│   │       ├── Sidebar.tsx                        [MODIFY — Phase 2, dark mode + new /app/* links]
│   │       └── (other layout components)          [MODIFY — Phase 2, dark mode]
│   │
│   ├── lib/
│   │   ├── animations.ts                          [NEW — Phase 4, framer-motion variants]
│   │   ├── api.ts                                 [KEEP — existing API client]
│   │   └── AuthContext.tsx                        [KEEP — existing auth context]
│   │
│   ├── hooks/
│   │   ├── useSmoothScroll.ts                     [NEW — Phase 4, Lenis hook]
│   │   └── useScrollAnimation.ts                  [NEW — Phase 4, scroll trigger hook]
│   │
│   └── types/
│       └── index.ts                               [KEEP — existing TypeScript types]
│
backend/                                           [KEEP — no backend changes in this redesign]
│
brand_assets/
│   └── fedright-logo-gemini-v2.png               [KEEP — source of truth for logo]
│
scripts/
│   └── generate-images.py                         [NEW — Phase 3, Gemini image generation]
│
spec/
│   └── ui-redesign/
│       ├── 00-overview.md                         [THIS FILE]
│       ├── 01-brand-style-guide.md                [TO BE WRITTEN]
│       ├── 02-landing-page.md                     [TO BE WRITTEN]
│       ├── 03-app-dark-mode.md                    [TO BE WRITTEN]
│       ├── 04-image-generation.md                 [TO BE WRITTEN]
│       ├── 05-animation-system.md                 [TO BE WRITTEN]
│       ├── 06-route-restructuring.md              [TO BE WRITTEN]
│       └── 08-verification-testing.md             [TO BE WRITTEN]
```

---

## 5. Dependencies & Prerequisites

### 5.1 Runtime Environment

| Requirement | Version | Notes |
|---|---|---|
| Node.js | >= 20.x LTS | Required for Next.js 15 |
| npm | >= 10.x | Comes with Node 20 |
| Python | 3.11+ | Backend FastAPI + image gen script |

**Verify before starting:**
```bash
node --version   # Must be >= 20.0.0
npm --version    # Must be >= 10.0.0
```

### 5.2 New npm Dependencies

Run from `frontend/` directory:

```bash
npm install framer-motion@^11 swiper@^11 @studio-freight/lenis@^1
```

**Expected peer dependency notes:** framer-motion ^11 requires React >= 18. The project uses React 19 — this is compatible.

**Post-install verification:**
```bash
npm ls framer-motion swiper @studio-freight/lenis
# Should show installed versions without peer dep warnings
```

### 5.3 Backend Requirements

The backend must be running on port 8000 for:
- Authentication endpoints (`/api/auth/*`) used by `/login` and `/signup` pages
- All authenticated app features (`/api/*`)

The landing page itself makes zero backend API calls — it is fully static/SSG. Only the authenticated `/app/*` routes require the backend.

**Backend startup:**
```bash
cd backend && ./venv/bin/python -m uvicorn main:app --reload --port 8000
```

### 5.4 Environment Variables

**Frontend (`.env.local`):**
```
NEXT_PUBLIC_API_URL=http://localhost:8000
NEXT_PUBLIC_GOOGLE_CLIENT_ID=<from Google Console>
```

**For image generation script only (not needed for app runtime):**
```
GEMINI_API_KEY=<from Google AI Studio>
```

**Security note:** `GEMINI_API_KEY` is only used by the Python script run locally during Phase 3. It must never be committed, bundled into the frontend, or exposed to the browser. The generated images are static assets — no Gemini API calls happen at runtime.

### 5.5 Development Workflow

Two terminals required for local development:

**Terminal 1 — Backend:**
```bash
cd /path/to/project/backend
./venv/bin/python -m uvicorn main:app --reload --port 8000
```

**Terminal 2 — Frontend:**
```bash
cd /path/to/project/frontend
npm run dev
# Starts on http://localhost:3000
```

---

## 6. Risk & Mitigation

### Risk 1: Route Restructuring Breaks Existing Bookmarks & Links

**Description:** Moving all app pages from `/profile`, `/meal-plan`, etc. to `/app/profile`, `/app/meal-plan`, etc. will cause 404 errors for any bookmarked URLs, links in emails, or frontend code that uses hardcoded paths.

**Mitigation strategy:**
1. Add `next.config.ts` redirect rules (permanent 308 redirects) for all old paths — covers browser bookmarks and external links.
2. Audit all `<Link href="">` and `router.push("")` calls across the codebase before Phase 5. Replace all hardcoded paths with route constants from a new `src/lib/routes.ts` file.
3. Update `src/lib/api.ts` if any frontend API calls include path-based logic.
4. After Phase 5 deployment, run a full regression test of all app pages (see `08-verification-testing.md` Section 9).

**Detection:** Run `grep -r "href=\"/profile" src/` and similar for each route before Phase 5.

### Risk 2: Large Image Payload Degrades Performance

**Description:** 12 AI-generated images for the landing page, even at WebP 85% quality, may total 3–8MB if not properly optimized. This would catastrophically fail Lighthouse performance targets (LCP > 4s on mobile).

**Mitigation strategy:**
1. All images are served through Next.js `<Image>` component, which auto-generates srcset for responsive sizes and converts to optimal format per browser.
2. Only the hero image (`hero-family-dinner.webp`) uses `priority` prop (eager load). All other images use default lazy loading.
3. Cuisine marquee images (300×300 source) are displayed at 200×200px — Next.js Image generates the smaller srcset automatically.
4. Add `sizes` prop to all `<Image>` components reflecting actual rendered dimensions.
5. Run `npm run build` and check `.next/static/media/` for output sizes before deployment. Target: hero < 200KB, each cuisine < 40KB.

### Risk 3: Animation Performance Causes Scroll Jank

**Description:** Scroll-linked animations (parallax, word reveal) can cause layout thrashing and dropped frames if implemented incorrectly, especially on mobile CPUs.

**Mitigation strategy:**
1. Use only `transform` and `opacity` for animated properties — these run on the GPU compositor thread and do not trigger layout or paint.
2. Apply `will-change: transform` sparingly and only on elements that are actively animating. Remove after animation completes via framer-motion's `onAnimationComplete`.
3. All scroll listeners must go through framer-motion's `useScroll` (which uses `requestAnimationFrame` internally) rather than raw `window.addEventListener('scroll', ...)`.
4. Lenis smooth scroll must be initialized once in the landing layout — not re-initialized on each component mount.
5. Implement `prefers-reduced-motion` check via framer-motion's `useReducedMotion()` hook. When true, all animations are instant (no transforms, no transitions).
6. Performance test on a throttled (4x CPU slowdown, Fast 3G) Chrome DevTools profile before marking Phase 4 complete.

### Risk 4: Tailwind v4 Cascade Layer Override Silently Breaks Utilities

**Description:** In Tailwind v4, all utility classes are emitted inside `@layer utilities`. Any unlayered CSS rule in `globals.css` has higher cascade specificity and will silently override Tailwind utilities. This has already caused issues in the project history (see MEMORY.md).

**Mitigation strategy:**
1. **Mandatory rule:** Every custom CSS rule written in `globals.css` during Phase 0 (and any subsequent phases) MUST be placed inside `@layer base` or `@layer components`.
2. The Phase 0 `globals.css` rewrite will establish the correct pattern. The brand style guide spec (`01-brand-style-guide.md`) will include a code template showing the correct layer structure.
3. In code review, any PR that adds unlayered CSS to `globals.css` is automatically rejected.

**Pattern to enforce:**
```css
/* WRONG — unlayered, overrides all Tailwind utilities */
.card {
  background-color: #1f2937;
}

/* CORRECT — inside @layer components */
@layer components {
  .card {
    background-color: #1f2937;
  }
}
```

### Risk 5: Google OAuth Breaks After Route Restructuring

**Description:** Google OAuth requires an explicitly whitelisted redirect URI in the Google Console. After Phase 5, the post-OAuth redirect will go to `/app` (new home) instead of the previous home route. If the Google Console is not updated, OAuth will fail.

**Mitigation strategy:**
1. Before Phase 5 deployment, update the Google Console OAuth redirect URIs to include the new post-login destination.
2. The `@react-oauth/google` configuration in the frontend must use the new `/app` redirect.
3. Test Google OAuth login in staging environment before production Phase 5 cutover.

### Risk 6: Lenis Scroll Conflicts with Next.js Route Transitions

**Description:** Lenis overrides native browser scroll behavior. Next.js App Router's route transitions may conflict with Lenis, causing scroll position to not reset on navigation or Lenis to continue running on non-landing pages.

**Mitigation strategy:**
1. Lenis initialization is scoped ONLY to the `(landing)` route group layout. The `/app/*` layout does NOT initialize Lenis.
2. The `useSmoothScroll` hook must call `lenis.destroy()` in its cleanup function (useEffect return) to prevent memory leaks and scroll conflicts on route changes.
3. Test navigation from landing page to `/login` and `/signup` — verify native scroll resumes on those pages.

---

*End of Document — `spec/ui-redesign/00-overview.md`*
