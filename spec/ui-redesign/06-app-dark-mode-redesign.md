# FedRight — App-Wide Dark Mode Redesign Specification
## Document: `06-app-dark-mode-redesign.md`
## Version: 1.0 | Date: 2026-02-20
## Status: APPROVED FOR IMPLEMENTATION
## Prerequisite: `01-brand-design-system.md` must be implemented first (globals.css and CSS tokens)

---

## Table of Contents

1. [Overview](#1-overview)
2. [Component Restyling — UI Primitives](#2-component-restyling--ui-primitives)
3. [Sidebar Dark Mode Redesign](#3-sidebar-dark-mode-redesign)
4. [Page-by-Page Dark Mode Specifications](#4-page-by-page-dark-mode-specifications)
5. [Recharts Dark Theme Configuration](#5-recharts-dark-theme-configuration)
6. [Implementation Order & Dependencies](#6-implementation-order--dependencies)
7. [Migration Quick Reference](#7-migration-quick-reference)

---

## 1. Overview

### 1.1 Scope

This document specifies the exact dark mode styling for every UI primitive component and every authenticated app page. It is the implementation blueprint for converting the Botanical Luxe (light, emerald/cream) design to the FedRight Dark design system defined in `01-brand-design-system.md`.

**Every class name, CSS custom property reference, and pixel value in this document is exact and final.** Developers should not need to make design decisions — all decisions are pre-made here.

### 1.2 Token Reference

All CSS custom properties (`--bg-primary`, `--brand-green`, etc.) are defined in `globals.css` as specified in `01-brand-design-system.md`. This document uses those token names throughout. If a token is not recognized during implementation, refer to Section 2 of `01-brand-design-system.md` for the full token list with hex values.

### 1.3 Before/After Framing

For each component, the current "before" state is described in terms of its dominant color language (emerald on cream, amber accents, botanical gradients). The "after" state specifies exact replacement classes and token values. The goal of the before description is to help developers identify what to remove — not to preserve it.

### 1.4 Inline Style vs Tailwind Class

For CSS custom properties defined in `:root`, two approaches work in Tailwind v4:

```tsx
// Option A: Tailwind arbitrary value syntax (preferred when the token maps to a Tailwind property)
<div className="bg-[var(--bg-secondary)] text-[var(--text-primary)]">

// Option B: Inline style (preferred for complex properties like shadows, gradients, transitions)
<div style={{ backgroundColor: 'var(--bg-secondary)', boxShadow: 'var(--shadow-md)' }}>

// Option C: Custom CSS class in globals.css @layer components (preferred for reusable patterns)
<div className="glass-surface">
```

**Rule:** Use Tailwind arbitrary value syntax for background, text, border, and ring colors. Use inline `style` for `box-shadow`, `transition`, and `animation` since Tailwind doesn't support custom property references there without config changes. Use `@layer components` utility classes for complex combinations that repeat across many components (e.g., `glass-surface`).

---

## 2. Component Restyling — UI Primitives

### 2.1 Button.tsx

**File:** `frontend/src/components/ui/Button.tsx`

**Current state (BEFORE):** Emerald gradient backgrounds (`from-emerald-700 to-emerald-600`) on primary, cream border (`border-stone-300`) on secondary, amber accents (`bg-amber-500`) on some variants. Text uses `text-cream-50` or `text-stone-800`.

**Required variants and their exact styling:**

#### Primary Variant

```typescript
// Primary — main CTA, one per screen maximum
const primaryClasses = `
  bg-[var(--brand-green)]
  text-[var(--text-inverse)]
  border-0
  rounded-[var(--radius-md)]
  font-semibold
  transition-all
  duration-150
  hover:bg-[var(--brand-green-light)]
  active:bg-[var(--brand-green-dark)]
  active:scale-[0.98]
  disabled:opacity-50
  disabled:cursor-not-allowed
  disabled:pointer-events-none
  focus-visible:outline-2
  focus-visible:outline-[var(--brand-green)]
  focus-visible:outline-offset-2
`;

// Hover shadow applied via inline style (Tailwind can't reference box-shadow tokens):
// style={{ boxShadow: isHovered ? 'var(--shadow-glow-green)' : 'none' }}
// OR use CSS class: className="hover:shadow-[var(--shadow-glow-green)]"
// Prefer inline style for the glow because Tailwind shadow arbitrary values
// can conflict with the complex multi-value shadow definition.
```

**Size variants:**

| Size | Padding | Font Size | Applies To |
|------|---------|-----------|------------|
| `sm` | `px-4 py-2` | `text-sm` (14px) | Compact contexts, table rows, inline actions |
| `md` | `px-6 py-3` | `text-base` (16px) | Standard buttons, form submits |
| `lg` | `px-8 py-4` | `text-lg` (18px) | Hero CTAs, prominent actions |

#### Secondary Variant

```typescript
// Secondary — supporting actions, can appear alongside primary
const secondaryClasses = `
  bg-transparent
  text-[var(--text-primary)]
  border
  border-[var(--surface-border)]
  rounded-[var(--radius-md)]
  font-semibold
  transition-all
  duration-150
  hover:bg-[var(--surface-glass-hover)]
  hover:border-[var(--surface-border-hover)]
  active:bg-[var(--surface-glass)]
  active:scale-[0.98]
  disabled:opacity-50
  disabled:cursor-not-allowed
  focus-visible:outline-2
  focus-visible:outline-[var(--brand-green)]
  focus-visible:outline-offset-2
`;
```

#### Danger Variant

```typescript
// Danger — destructive actions (delete, remove, reset)
// ALWAYS require a confirmation step before executing
const dangerClasses = `
  bg-[var(--color-error)]
  text-white
  border-0
  rounded-[var(--radius-md)]
  font-semibold
  transition-all
  duration-150
  hover:opacity-90
  active:opacity-80
  active:scale-[0.98]
  disabled:opacity-50
  disabled:cursor-not-allowed
  focus-visible:outline-2
  focus-visible:outline-[var(--color-error)]
  focus-visible:outline-offset-2
`;
```

#### Ghost Variant

```typescript
// Ghost — tertiary actions, nav-adjacent buttons, icon labels
const ghostClasses = `
  bg-transparent
  text-[var(--text-secondary)]
  border-0
  rounded-[var(--radius-md)]
  font-medium
  transition-all
  duration-150
  hover:text-[var(--text-primary)]
  hover:bg-[var(--surface-glass)]
  active:bg-[var(--surface-glass-hover)]
  disabled:opacity-50
  disabled:cursor-not-allowed
`;
```

#### Icon Button Variant

```typescript
// Icon-only button — always pair with a tooltip for accessibility
const iconButtonClasses = `
  flex
  items-center
  justify-center
  w-9
  h-9
  bg-transparent
  text-[var(--text-muted)]
  border
  border-transparent
  rounded-[var(--radius-md)]
  transition-all
  duration-150
  hover:text-[var(--text-secondary)]
  hover:bg-[var(--surface-glass)]
  hover:border-[var(--surface-border)]
  active:bg-[var(--surface-glass-hover)]
`;
// Compact variant: w-7 h-7 (28px × 28px)
```

#### Loading State

When `isLoading` prop is true, the button should:
- Show a spinner inside the button (replace label text, preserve button dimensions)
- Keep the button disabled (`disabled` attribute = true, `cursor-not-allowed`)
- NOT change the background color (the button stays green/secondary/etc.)
- Spinner: `border-2 border-white/20 border-t-white/80 rounded-full w-4 h-4 animate-spin`

**Props interface update:**

```typescript
interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant: 'primary' | 'secondary' | 'danger' | 'ghost' | 'icon';
  size?: 'sm' | 'md' | 'lg';
  isLoading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}
```

---

### 2.2 Card.tsx

**File:** `frontend/src/components/ui/Card.tsx`

**Current state (BEFORE):** `bg-white/70` or `bg-cream-50` backgrounds, `border-stone-200` borders, emerald left-border accents, `rounded-2xl`. Light shadow.

**New base Card styling:**

```typescript
// Base Card — the foundation of all content containers in the app
const baseCardClasses = `
  bg-[var(--bg-secondary)]
  border
  border-[var(--surface-border)]
  rounded-[var(--radius-lg)]
  overflow-hidden
`;
// Shadow applied via inline style:
// style={{ boxShadow: 'var(--shadow-md)' }}
```

**Hover/interactive card variant (for clickable cards):**

```typescript
// Use when the entire card is a clickable element
const interactiveCardClasses = `
  ${baseCardClasses}
  cursor-pointer
  transition-all
  duration-250
  hover:border-[var(--surface-border-hover)]
  hover:bg-[var(--bg-hover)]
  hover:-translate-y-px
`;
// Hover shadow via inline style or onMouseEnter/onMouseLeave:
// resting: boxShadow: 'var(--shadow-md)'
// hover: boxShadow: 'var(--shadow-lg)'
```

**Featured/highlighted card variant (green accent border):**

```typescript
// For featured items, selected plans, highlighted recommendations
const featuredCardClasses = `
  bg-[var(--bg-secondary)]
  border
  border-[var(--brand-green-border)]
  rounded-[var(--radius-lg)]
  overflow-hidden
`;
// Shadow: boxShadow: 'var(--shadow-md), 0 0 12px var(--brand-green-glow)'
```

**Padding props remain as-is:**

| Prop Value | Tailwind Class | Pixel Value |
|-----------|----------------|-------------|
| `none` | — | 0px |
| `sm` | `p-4` | 16px |
| `md` | `p-5` | 20px |
| `lg` | `p-6` | 24px |

**Compound sub-components:**

```typescript
// Card.Header — title area above divider
// Divider is bottom border: border-b border-[var(--surface-border)]
const cardHeaderClasses = `
  px-6 py-4
  border-b
  border-[var(--surface-border)]
`;

// Card.Body — main content area
const cardBodyClasses = `p-6`;

// Card.Footer — action area below divider
// Divider is top border: border-t border-[var(--surface-border)]
const cardFooterClasses = `
  px-6 py-4
  border-t
  border-[var(--surface-border)]
  flex items-center justify-end gap-3
`;
```

---

### 2.3 Input.tsx

**File:** `frontend/src/components/ui/Input.tsx`

**Current state (BEFORE):** `bg-white border-stone-300 text-stone-800` with `focus:border-emerald-500 focus:ring-emerald-100`. Labels use `text-stone-700`. Placeholder is `text-stone-400`.

**New dark Input styling:**

```typescript
// Base input element
const inputClasses = `
  w-full
  bg-[var(--bg-input)]
  border
  border-[var(--surface-border)]
  text-[var(--text-primary)]
  placeholder:text-[var(--text-muted)]
  rounded-[var(--radius-md)]
  px-4
  py-3
  text-sm
  transition-all
  duration-150
  focus:outline-none
  focus:border-[var(--brand-green)]
  disabled:bg-[var(--bg-secondary)]
  disabled:text-[var(--text-muted)]
  disabled:cursor-not-allowed
`;
// Focus ring via inline style on :focus (requires onFocus/onBlur handlers):
// boxShadow: '0 0 0 3px var(--brand-green-subtle)'
// OR use Tailwind: focus:ring-2 focus:ring-[var(--brand-green-subtle)]

// Error state — additional classes when error prop is present
const inputErrorClasses = `
  border-[var(--color-error)]
`;
// Error ring: boxShadow: '0 0 0 3px var(--color-error-bg)'
```

**Label styling:**

```typescript
const labelClasses = `
  block
  text-[var(--text-secondary)]
  text-sm
  font-medium
  mb-1.5
`;
// Required field asterisk: <span className="text-[var(--color-error)] ml-0.5">*</span>
```

**Helper text / error message styling:**

```typescript
// Neutral helper text (instructions, hints)
const helperTextClasses = `
  text-[var(--text-muted)]
  text-xs
  mt-1
`;

// Error message (shown when error prop is present)
const errorTextClasses = `
  text-[var(--color-error)]
  text-xs
  mt-1
  flex items-center gap-1
`;
// Prefix with a small icon: <AlertCircle className="w-3 h-3 flex-shrink-0" />
```

**Show/hide toggle for password inputs:**

```typescript
// Toggle button positioned absolutely inside the input wrapper
const passwordToggleClasses = `
  absolute
  right-3
  top-1/2
  -translate-y-1/2
  text-[var(--text-muted)]
  hover:text-[var(--text-secondary)]
  transition-colors
  duration-150
`;
// Icon: Eye / EyeOff from lucide-react, size w-4 h-4
```

**Props interface update:**

```typescript
interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  helperText?: string;
  error?: string;
  required?: boolean;
  // leftIcon and rightIcon for icon-adorned inputs
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}
```

---

### 2.4 Select.tsx

**File:** `frontend/src/components/ui/Select.tsx`

**Current state (BEFORE):** Same light theme as Input — white background, stone borders, emerald focus.

**New dark Select styling:**

```typescript
// Select element — shares token language with Input for visual consistency
const selectClasses = `
  w-full
  bg-[var(--bg-input)]
  border
  border-[var(--surface-border)]
  text-[var(--text-primary)]
  rounded-[var(--radius-md)]
  px-4
  py-3
  text-sm
  appearance-none
  transition-all
  duration-150
  focus:outline-none
  focus:border-[var(--brand-green)]
  disabled:bg-[var(--bg-secondary)]
  disabled:text-[var(--text-muted)]
  disabled:cursor-not-allowed
  cursor-pointer
`;

// Custom dropdown arrow (replaces browser default arrow)
// Applied as background-image on the select element wrapper div:
const selectWrapperClasses = `relative`;
// Arrow icon (ChevronDown from lucide-react) positioned absolutely:
const selectArrowClasses = `
  absolute
  right-3
  top-1/2
  -translate-y-1/2
  text-[var(--text-muted)]
  pointer-events-none
  w-4 h-4
`;
```

**Option elements:** Native `<option>` elements inside a `<select>` inherit the browser's OS-level dropdown styling. On macOS/Windows, options are rendered by the OS, not the browser, so option hover/selected state cannot be fully styled with CSS. On macOS, options will use the system light appearance regardless of the dark page. This is a known browser limitation. If fully custom dropdown options are required, replace the native `<select>` with a custom dropdown built from `<div>` elements and `role="listbox"` ARIA attributes.

**For the current implementation, the native select is acceptable.** Wrap in a container with `bg-[var(--bg-input)]` to ensure the collapsed select shows the dark background. The open dropdown options will show OS default appearance.

---

### 2.5 Modal.tsx

**File:** `frontend/src/components/ui/Modal.tsx`

**Current state (BEFORE):** `bg-white` modal on a `bg-black/40` overlay. Light border. Standard browser scroll behavior for tall content.

**New dark Modal styling:**

```typescript
// Overlay — covers entire viewport, blurs page content behind modal
const overlayClasses = `
  fixed
  inset-0
  bg-black/60
  backdrop-blur-sm
  z-50
  flex
  items-center
  justify-center
  p-4
  animate-fade-in
`;

// Modal container
const modalClasses = `
  relative
  w-full
  max-w-[560px]
  bg-[var(--bg-tertiary)]
  border
  border-[var(--surface-border)]
  rounded-[var(--radius-xl)]
  overflow-hidden
  animate-scale-in
`;
// Shadow: boxShadow: 'var(--shadow-xl)'

// Wide modal variant (for recipe views, complex forms)
const modalWideClasses = `
  relative
  w-full
  max-w-[760px]
  bg-[var(--bg-tertiary)]
  border
  border-[var(--surface-border)]
  rounded-[var(--radius-xl)]
  overflow-hidden
  animate-scale-in
`;

// Modal header section
const modalHeaderClasses = `
  flex
  items-center
  justify-between
  px-6
  py-4
  border-b
  border-[var(--surface-border)]
`;
// Title: <h2 className="type-h4 text-[var(--text-primary)]">
// Close button: icon button variant from Button.tsx

// Modal body section
const modalBodyClasses = `
  px-6
  py-5
  overflow-y-auto
  max-h-[70vh]
`;

// Modal footer section
const modalFooterClasses = `
  flex
  items-center
  justify-end
  gap-3
  px-6
  py-4
  border-t
  border-[var(--surface-border)]
`;
```

**Framer-motion animation (if framer-motion is installed):**

```typescript
// Overlay animation
const overlayVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { duration: 0.25, ease: [0.16, 1, 0.3, 1] } },
  exit: { opacity: 0, transition: { duration: 0.2 } },
};

// Modal container animation
const modalVariants = {
  hidden: { opacity: 0, scale: 0.92 },
  visible: {
    opacity: 1,
    scale: 1,
    transition: {
      duration: 0.25,
      ease: [0.34, 1.56, 0.64, 1], // ease-out-back for springy pop-in
    },
  },
  exit: {
    opacity: 0,
    scale: 0.95,
    transition: { duration: 0.15 },
  },
};

// Wrap in <AnimatePresence> for mount/unmount animation
// <AnimatePresence mode="wait">
//   {isOpen && (
//     <motion.div variants={overlayVariants} initial="hidden" animate="visible" exit="exit">
//       <motion.div variants={modalVariants} initial="hidden" animate="visible" exit="exit">
//         ...modal content...
//       </motion.div>
//     </motion.div>
//   )}
// </AnimatePresence>
```

**If framer-motion is NOT yet installed:** Use the CSS animation classes `.animate-fade-in` and `.animate-scale-in` defined in globals.css. The CSS approach has no exit animation (the modal disappears instantly on close), which is acceptable until framer-motion is added.

---

### 2.6 Badge.tsx

**File:** `frontend/src/components/ui/Badge.tsx`

**Current state (BEFORE):** `bg-emerald-100 text-emerald-800` for success, `bg-amber-100 text-amber-800` for warnings, etc. on a light background. Pill shape already correct.

**New dark Badge variants:**

```typescript
// All badges share these base classes:
const baseBadgeClasses = `
  inline-flex
  items-center
  gap-1
  rounded-full
  px-3
  py-1
  text-xs
  font-medium
  border
`;

// Success badge
const successBadgeClasses = `
  ${baseBadgeClasses}
  bg-[var(--color-success-bg)]
  text-[var(--color-success)]
  border-[rgba(42,175,101,0.20)]
`;

// Warning badge
const warningBadgeClasses = `
  ${baseBadgeClasses}
  bg-[var(--color-warning-bg)]
  text-[var(--color-warning)]
  border-[rgba(240,168,48,0.20)]
`;

// Error badge
const errorBadgeClasses = `
  ${baseBadgeClasses}
  bg-[var(--color-error-bg)]
  text-[var(--color-error)]
  border-[rgba(229,83,75,0.20)]
`;

// Info badge
const infoBadgeClasses = `
  ${baseBadgeClasses}
  bg-[var(--color-info-bg)]
  text-[var(--color-info)]
  border-[rgba(83,155,245,0.20)]
`;

// Default / neutral badge
const defaultBadgeClasses = `
  ${baseBadgeClasses}
  bg-[var(--surface-glass)]
  text-[var(--text-secondary)]
  border-[var(--surface-border)]
`;

// Brand badge (for premium features, active states)
const brandBadgeClasses = `
  ${baseBadgeClasses}
  bg-[var(--brand-green-subtle)]
  text-[var(--brand-green-light)]
  border-[var(--brand-green-border)]
`;
```

**Icon support:** Add optional `icon` prop that renders a small (12px) icon before the badge text.

---

### 2.7 Toast.tsx

**File:** `frontend/src/components/ui/Toast.tsx`

**Current state (BEFORE):** Light surface toasts with emerald/amber/red backgrounds. Positioned bottom-right.

**New dark Toast styling:**

```typescript
// Toast container — rendered inside a fixed portal at bottom-right
const toastContainerClasses = `
  fixed
  bottom-6
  right-6
  z-[100]
  flex
  flex-col
  gap-3
  pointer-events-none
`;

// Individual toast
const toastBaseClasses = `
  pointer-events-auto
  relative
  flex
  items-start
  gap-3
  min-w-[320px]
  max-w-[400px]
  bg-[var(--bg-tertiary)]
  border
  border-[var(--surface-border)]
  rounded-[var(--radius-lg)]
  p-4
  overflow-hidden
  animate-slide-up
`;
// Shadow: boxShadow: 'var(--shadow-lg)'

// Left accent bar — 4px wide colored left edge
// Applied as an absolutely positioned div inside the toast:
const toastAccentBarClasses = `absolute left-0 top-0 bottom-0 w-1 rounded-l-[var(--radius-lg)]`;
// Color per type via inline style: style={{ backgroundColor: 'var(--color-success)' }}

// Type → accent color mapping
const toastAccentColors = {
  success: 'var(--color-success)',
  warning: 'var(--color-warning)',
  error: 'var(--color-error)',
  info: 'var(--color-info)',
};

// Toast title
const toastTitleClasses = `
  text-[var(--text-primary)]
  text-sm
  font-semibold
  leading-tight
`;

// Toast message/description
const toastMessageClasses = `
  text-[var(--text-secondary)]
  text-xs
  mt-0.5
  leading-relaxed
`;

// Close button inside toast
const toastCloseClasses = `
  ml-auto
  flex-shrink-0
  text-[var(--text-muted)]
  hover:text-[var(--text-primary)]
  transition-colors
  duration-150
`;
// Icon: X from lucide-react, w-4 h-4
```

**Toast icon per type:**

| Type | Icon | Color |
|------|------|-------|
| `success` | `CheckCircle` | `var(--color-success)` |
| `warning` | `AlertTriangle` | `var(--color-warning)` |
| `error` | `XCircle` | `var(--color-error)` |
| `info` | `Info` | `var(--color-info)` |

**Auto-dismiss timing:** 4000ms for success/info, 6000ms for warning/error (error messages may need to be read more carefully).

---

### 2.8 EmptyState.tsx

**File:** `frontend/src/components/ui/EmptyState.tsx`

**Current state (BEFORE):** Centered layout with emerald tinted icon, dark text heading on light background.

**New dark EmptyState styling:**

```typescript
// Container
const emptyStateClasses = `
  flex
  flex-col
  items-center
  justify-center
  text-center
  py-16
  px-6
  gap-4
`;

// Icon wrapper — subtle circular background
const iconWrapperClasses = `
  flex
  items-center
  justify-center
  w-16
  h-16
  rounded-full
  bg-[var(--surface-glass)]
  border
  border-[var(--surface-border)]
  mb-2
`;
// Icon: w-8 h-8, text-[var(--text-muted)]

// Title
const emptyTitleClasses = `
  type-h4
  text-[var(--text-primary)]
`;

// Description
const emptyDescriptionClasses = `
  text-[var(--text-secondary)]
  text-sm
  max-w-xs
  leading-relaxed
`;

// Action area — rendered below description
// Use primary Button variant for the action button
```

---

### 2.9 LoadingSkeleton.tsx

**File:** `frontend/src/components/ui/LoadingSkeleton.tsx`

**Current state (BEFORE):** Simple spinner with emerald color, or pulsing gray blocks on light background.

**New dark LoadingSkeleton styling:**

**Spinner component:**

```typescript
// Full-page or section loading spinner
const spinnerClasses = `
  inline-block
  rounded-full
  border-2
  border-[var(--surface-border)]
  border-t-[var(--brand-green)]
  animate-spin
`;

// Size variants
const spinnerSizes = {
  sm: 'w-4 h-4',    // 16px — for inline/button spinners
  md: 'w-6 h-6',    // 24px — for card loading states
  lg: 'w-10 h-10',  // 40px — for full-section loading states
  xl: 'w-16 h-16',  // 64px — for full-screen loading states
};
```

**Skeleton block component (for content placeholders):**

```typescript
// Use the .skeleton class from globals.css (shimmer gradient animation)
// Render shaped blocks matching the layout of the content being loaded

// Example: Skeleton for a card with title, subtitle, and action
// <div className="p-6 bg-[var(--bg-secondary)] border border-[var(--surface-border)] rounded-[var(--radius-lg)]">
//   <div className="skeleton h-4 w-3/4 mb-3" />           {/* title */}
//   <div className="skeleton h-3 w-full mb-1.5" />         {/* description line 1 */}
//   <div className="skeleton h-3 w-5/6 mb-6" />           {/* description line 2 */}
//   <div className="skeleton h-9 w-32 rounded-[var(--radius-md)]" />  {/* button */}
// </div>
```

**Staggered skeleton rows (for list loading):**

```typescript
// Apply stagger delay classes from globals.css to create a wave effect:
// <div className="skeleton h-12 w-full rounded-[var(--radius-md)] stagger-1" />
// <div className="skeleton h-12 w-full rounded-[var(--radius-md)] stagger-2" />
// <div className="skeleton h-12 w-full rounded-[var(--radius-md)] stagger-3" />
```

---

## 3. Sidebar Dark Mode Redesign

**File:** `frontend/src/components/layout/Sidebar.tsx`

### 3.1 Overall Sidebar Structure

The sidebar has four vertical sections:
1. **Logo area** (top) — brand lockup
2. **Profile switcher** — active profile + dropdown
3. **Nav items** — main navigation (scrollable if needed)
4. **User footer** (bottom) — user info + logout

### 3.2 Sidebar Shell

```typescript
// Desktop sidebar — fixed left panel
const sidebarClasses = `
  fixed
  top-0
  left-0
  h-screen
  w-64
  flex
  flex-col
  z-40
  bg-[var(--bg-secondary)]
  border-r
  border-[var(--surface-border)]
`;

// Mobile sidebar — overlay drawer (hidden by default, slides in from left)
// Controlled by a `isOpen` state from a hamburger button in the top bar
const mobileSidebarOverlayClasses = `
  fixed
  inset-0
  z-50
  lg:hidden
`;
// Dark overlay behind drawer: bg-black/60 backdrop-blur-sm
// Drawer itself: same styling as desktop sidebar + animate-slide-right (from left)
```

### 3.3 Logo Area

```typescript
// Container — 64px tall, same height on all screens
const logoAreaClasses = `
  flex
  items-center
  gap-3
  h-16
  px-4
  border-b
  border-[var(--surface-border)]
  flex-shrink-0
`;

// Logo image
// <Image src="/fedright-logo-gemini-v2.png" alt="FedRight" width={32} height={32} />

// App name text
const appNameClasses = `
  text-[var(--text-primary)]
  font-bold
  text-base
  leading-none
`;
// "FedRight" — Inter 700, 16px

// Optional tagline (condensed, 10px — only show if there is space)
const taglineClasses = `
  text-[var(--text-muted)]
  text-[10px]
  leading-none
  mt-0.5
`;
// "One Kitchen. Every Body." — truncate at 2 lines if shown
```

### 3.4 Profile Switcher

The profile switcher allows users to switch between saved household member profiles.

```typescript
// Profile switcher button (collapsed state)
const profileSwitcherClasses = `
  flex
  items-center
  gap-2.5
  w-full
  px-3
  py-2.5
  mx-2
  rounded-[var(--radius-md)]
  bg-[var(--bg-tertiary)]
  border
  border-[var(--surface-border)]
  cursor-pointer
  transition-all
  duration-150
  hover:border-[var(--surface-border-hover)]
  hover:bg-[var(--bg-hover)]
`;

// Active profile name
const activeProfileNameClasses = `
  flex-1
  text-left
  text-[var(--text-primary)]
  text-sm
  font-medium
  truncate
`;

// Chevron icon
// <ChevronDown className="w-4 h-4 text-[var(--text-muted)] transition-transform duration-150" />
// Rotate 180deg when dropdown is open: rotate-180

// Profile dropdown (open state)
const profileDropdownClasses = `
  absolute
  top-full
  left-0
  right-0
  mt-1
  bg-[var(--bg-tertiary)]
  border
  border-[var(--surface-border)]
  rounded-[var(--radius-lg)]
  overflow-hidden
  z-50
  animate-slide-down
`;
// Shadow: boxShadow: 'var(--shadow-xl)'

// Dropdown item
const dropdownItemClasses = `
  flex
  items-center
  gap-2.5
  px-3
  py-2.5
  cursor-pointer
  transition-colors
  duration-150
  text-[var(--text-secondary)]
  text-sm
  hover:bg-[var(--bg-hover)]
  hover:text-[var(--text-primary)]
`;
// Active profile item gets additional: text-[var(--brand-green-light)] bg-[var(--brand-green-subtle)]
```

### 3.5 Navigation Items

```typescript
// Nav section container
const navSectionClasses = `
  flex-1
  overflow-y-auto
  py-4
  px-2
  flex
  flex-col
  gap-0.5
`;

// Individual nav item — default (not active)
const navItemClasses = `
  relative
  flex
  items-center
  gap-3
  px-3
  py-2
  rounded-[var(--radius-md)]
  text-[var(--text-secondary)]
  transition-all
  duration-150
  hover:bg-[var(--surface-glass-hover)]
  hover:text-[var(--text-primary)]
  cursor-pointer
`;

// Nav item icon — default state
// className="w-5 h-5 text-[var(--text-muted)] transition-colors duration-150 flex-shrink-0"
// On hover (via parent hover): group-hover:text-[var(--text-secondary)]
// Use group utility: add `group` class to nav item, `group-hover:text-[...]` on icon

// Nav item label
// className="text-sm font-medium"

// Active nav item — overrides default
const activeNavItemClasses = `
  relative
  flex
  items-center
  gap-3
  px-3
  py-2
  rounded-[var(--radius-md)]
  text-[var(--brand-green-light)]
  bg-[var(--brand-green-subtle)]
  cursor-pointer
`;

// Active left indicator bar — positioned absolutely on the left edge
const activeIndicatorClasses = `
  absolute
  left-0
  top-2
  bottom-2
  w-0.5
  bg-[var(--brand-green)]
  rounded-r-full
`;

// Active nav item icon
// className="w-5 h-5 text-[var(--brand-green-light)] flex-shrink-0"
```

**Active state detection:**

```typescript
import { usePathname } from 'next/navigation';
const pathname = usePathname();

// A nav item is active if the current pathname starts with (or equals) its href
const isActive = (href: string): boolean => {
  if (href === '/app') return pathname === '/app'; // exact match for home
  return pathname.startsWith(href);
};
```

### 3.6 User Footer

```typescript
// Footer container — fixed at bottom of sidebar
const footerClasses = `
  flex-shrink-0
  border-t
  border-[var(--surface-border)]
  px-4
  py-3
`;

// User info row
const userInfoClasses = `
  flex
  items-center
  gap-3
`;

// Avatar placeholder (if no user photo)
const avatarClasses = `
  w-8
  h-8
  rounded-full
  bg-[var(--brand-green-subtle)]
  border
  border-[var(--brand-green-border)]
  flex
  items-center
  justify-center
  text-[var(--brand-green-light)]
  text-xs
  font-semibold
  flex-shrink-0
`;
// Shows first initial of user's name/email

// User name/email text
const userEmailClasses = `
  flex-1
  text-[var(--text-muted)]
  text-xs
  truncate
`;

// Logout button — icon button
// <button className="text-[var(--text-muted)] hover:text-[var(--color-error)] transition-colors duration-150">
//   <LogOut className="w-4 h-4" />
// </button>
```

---

## 4. Page-by-Page Dark Mode Specifications

### 4.1 App Home (/app)

**File:** `frontend/src/app/app/page.tsx` (NEW — does not exist yet)

**Layout:** A welcome screen that serves as the dashboard entry point.

```
Page structure:
├── Top greeting banner (full-width card with gradient)
│   └── "Welcome back, [Name]." + subtitle + current date
├── Quick navigation grid (2×3 or 3×2 responsive grid)
│   └── 6 cards, one per app section (Profile, Meal Plan, Tracking, Grocery, Chef's View, Dashboard)
└── Recent activity strip (optional, if API supports it)
    └── Last 3 tracked meals or last plan generation date
```

**Greeting banner:**

```typescript
// Full-width card with gradient green left accent
// bg-[var(--bg-secondary)] border border-[var(--surface-border)]
// Left border: border-l-4 border-l-[var(--brand-green)]
// Heading: text-[var(--text-primary)] type-h3
// Subtitle: text-[var(--text-secondary)] text-sm
// Date: text-[var(--text-muted)] text-xs type-overline
```

**Quick nav grid cards:**

Each of the 6 nav cards has:
- `bg-[var(--bg-secondary)] border border-[var(--surface-border)] rounded-[var(--radius-lg)]`
- Icon in a 48×48 pill with `bg-[var(--brand-green-subtle)] text-[var(--brand-green-light)]`
- Card title: `text-[var(--text-primary)] text-sm font-semibold`
- Card description: `text-[var(--text-secondary)] text-xs`
- Hover: `hover:border-[var(--surface-border-hover)] hover:bg-[var(--bg-hover)] hover:-translate-y-px transition-all`
- Full card is wrapped in `<Link href={ROUTES.APP.xxx}>` for navigation

---

### 4.2 Profile Page (/app/profile)

**File:** `frontend/src/app/app/profile/page.tsx` (moved from `src/app/profile/page.tsx`)

**Layout:** Vertical stacked sections separated by dividers.

**Section container pattern:**

```typescript
// Each form section (Personal Info, Dietary Info, Health Goals, etc.)
const sectionClasses = `
  bg-[var(--bg-secondary)]
  border
  border-[var(--surface-border)]
  rounded-[var(--radius-lg)]
  overflow-hidden
  mb-4
`;

// Section header
// <div className="px-6 py-4 border-b border-[var(--surface-border)]">
//   <p className="type-overline text-[var(--brand-green)] mb-0.5">Section Name</p>
//   <h2 className="type-h4 text-[var(--text-primary)]">Personal Information</h2>
// </div>

// Section body
// <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-5">
//   ...Input components...
// </div>
```

**Profile type badge:**

```typescript
// Shown near the profile name, indicates the profile type
// e.g., "Individual", "Family Head", "Child"
// Use the neutral or brand Badge variant based on profile type:
// Family Head: brand badge (bg-[var(--brand-green-subtle)] text-[var(--brand-green-light)])
// Individual: neutral badge
// Child: info badge (bg-[var(--color-info-bg)] text-[var(--color-info)])
```

**Save button:** Primary Button variant, right-aligned in the footer of each section card.

**Member list (if showing household members):**

```typescript
// Each member card in the list
// bg-[var(--bg-tertiary)] border border-[var(--surface-border)] rounded-[var(--radius-md)] p-4
// Member avatar: w-10 h-10 rounded-full bg-[var(--brand-green-subtle)] text-[var(--brand-green-light)]
// Member name: text-[var(--text-primary)] text-sm font-medium
// Member role: text-[var(--text-muted)] text-xs
// Edit button: ghost Button variant or icon button
```

---

### 4.3 Meal Plan Page (/app/meal-plan)

**File:** `frontend/src/app/app/meal-plan/page.tsx`

**Day navigation tabs:**

```typescript
// Tab bar container
// bg-[var(--bg-secondary)] border border-[var(--surface-border)] rounded-[var(--radius-lg)] p-1

// Individual tab (not active)
const tabClasses = `
  px-4 py-2 rounded-[var(--radius-md)] text-sm font-medium
  text-[var(--text-secondary)]
  transition-all duration-150
  hover:text-[var(--text-primary)] hover:bg-[var(--surface-glass-hover)]
  cursor-pointer
`;

// Active tab
const activeTabClasses = `
  px-4 py-2 rounded-[var(--radius-md)] text-sm font-medium
  text-[var(--brand-green-light)]
  bg-[var(--brand-green-subtle)]
  border border-[var(--brand-green-border)]
`;
```

**Meal cards (Breakfast, Lunch, Dinner, Snacks):**

```typescript
// Base meal card
// bg-[var(--bg-secondary)] border border-[var(--surface-border)] rounded-[var(--radius-lg)]

// Meal type header accent colors:
// Breakfast: left-border color var(--brand-amber) — warm morning accent
// Lunch:     left-border color var(--brand-green) — main meal
// Dinner:    left-border color var(--color-info) — evening tone
// Snacks:    left-border color var(--text-muted)  — neutral
// Applied as: border-l-4 border-l-[var(--brand-amber)] etc.

// Meal name: text-[var(--text-primary)] font-semibold text-sm
// Cuisine tag: neutral Badge variant
// Nutrition summary row: text-[var(--text-muted)] text-xs
//   Protein value: text-[var(--brand-green-light)]
//   Carbs value:   text-[var(--brand-amber)]
//   Fat value:     text-[var(--color-info)]
//   Calories:      text-[var(--text-secondary)]
```

**Generate/Regenerate button:**

```typescript
// Full-width or right-aligned primary Button
// "Generate Meal Plan" — primary variant, lg size
// Loading state shows spinner inside button
// After generation, show success Toast
```

**Recipe expansion panel:**

```typescript
// Expanded recipe section inside a meal card
// bg-[var(--bg-tertiary)] border-t border-[var(--surface-border)]
// Ingredients list: text-[var(--text-secondary)] text-sm, bullet: text-[var(--brand-green)]
// Steps: text-[var(--text-secondary)] text-sm, step numbers: text-[var(--brand-green-light)] font-semibold
```

**Swap / Edit controls:**

```typescript
// Action buttons per meal card (swap, edit, copy, share)
// Ghost Button variant with icon
// Icons: RefreshCw, Edit2, Copy, Share2 from lucide-react
// Color: text-[var(--text-muted)] on default, text-[var(--text-secondary)] on hover
```

---

### 4.4 Tracking Page (/app/tracking)

**File:** `frontend/src/app/app/tracking/page.tsx`

**Date picker bar:**

```typescript
// Week navigation — previous/next buttons + date display
// bg-[var(--bg-secondary)] border border-[var(--surface-border)] rounded-[var(--radius-lg)] px-4 py-3
// Day buttons: same tab styling as Meal Plan day tabs
// Today button: primary Button sm variant
```

**Tracking status — 3-state per meal:**

```typescript
// Status option buttons (ate as planned, skipped, ate something else)
// Rendered as a row of 3 buttons per meal, compact size

// Ate as planned (green):
// Selected: bg-[var(--color-success-bg)] text-[var(--color-success)] border border-[rgba(42,175,101,0.20)]
// Not selected: bg-transparent text-[var(--text-muted)] border border-[var(--surface-border)]

// Skipped (amber):
// Selected: bg-[var(--color-warning-bg)] text-[var(--color-warning)] border border-[rgba(240,168,48,0.20)]

// Ate something else (blue):
// Selected: bg-[var(--color-info-bg)] text-[var(--color-info)] border border-[rgba(83,155,245,0.20)]

// All transition-colors duration-150 rounded-[var(--radius-md)]
```

**Meal tracking rows:**

```typescript
// Each meal row in the daily tracking view
// bg-[var(--bg-secondary)] border border-[var(--surface-border)] rounded-[var(--radius-md)] px-4 py-3

// Left status indicator dot (4×4, colored by status):
// ate_as_planned: bg-[var(--color-success)]
// skipped: bg-[var(--color-warning)]
// ate_something_else: bg-[var(--color-info)]
// untracked: bg-[var(--text-muted)]

// Meal name: text-[var(--text-primary)] text-sm font-medium
// Meal time label: text-[var(--text-muted)] text-xs
```

**Daily summary card:**

```typescript
// Pinned at bottom or top of the page
// bg-[var(--bg-tertiary)] border border-[var(--surface-border)] rounded-[var(--radius-lg)] p-5

// Section heading: type-overline text-[var(--brand-green)]
// Stat label: text-[var(--text-muted)] text-xs
// Stat value: text-[var(--text-primary)] text-lg font-semibold

// Adherence percentage bar:
// Track: bg-[var(--surface-border)] rounded-full h-2
// Fill: bg-[var(--brand-green)] rounded-full (width = adherence %)
// If adherence < 50%: fill color = var(--color-warning)
// If adherence < 25%: fill color = var(--color-error)
```

---

### 4.5 Grocery Page (/app/grocery)

**File:** `frontend/src/app/app/grocery/page.tsx`

**Page header:**

```typescript
// Title: type-h3 text-[var(--text-primary)]
// Subtitle: text-[var(--text-secondary)] text-sm
// Action: secondary Button "Export PDF" with Download icon
```

**Overall progress bar:**

```typescript
// Full-width, shows X of Y items checked
// Track: bg-[var(--bg-tertiary)] h-2 rounded-full
// Fill: bg-[var(--brand-green)] rounded-full, transition-all duration-300
// Label: text-[var(--text-muted)] text-xs "12 of 28 items"
```

**Category sections:**

```typescript
// Category header
// <div className="flex items-center justify-between py-2">
//   <h3 className="text-[var(--text-primary)] text-sm font-semibold">{category}</h3>
//   <span className="text-[var(--text-muted)] text-xs">{count} items</span>
// </div>

// Item row
const groceryItemClasses = `
  flex items-center gap-3
  py-2.5 px-1
  border-b border-[var(--surface-border)]
  last:border-b-0
  transition-colors duration-150
`;

// Item checked state — strikethrough and muted
const checkedItemClasses = `
  flex items-center gap-3
  py-2.5 px-1
  border-b border-[var(--surface-border)]
  last:border-b-0
  opacity-50
`;
// Item text: line-through text-[var(--text-muted)]

// Custom checkbox — use .checkbox-fedright from globals.css
// <input type="checkbox" className="checkbox-fedright" />

// Item name: text-[var(--text-primary)] text-sm (or text-[var(--text-muted)] line-through when checked)
// Item quantity: text-[var(--text-muted)] text-xs ml-auto
```

---

### 4.6 Chef's View Page (/app/chefs-view)

**File:** `frontend/src/app/app/chefs-view/page.tsx`

**Profile selector:**

```typescript
// Row of profile toggle pills at top of page
// Each profile: pill button with avatar initial + name
// Not selected: bg-transparent border border-[var(--surface-border)] text-[var(--text-secondary)]
// Selected: bg-[var(--brand-green-subtle)] border border-[var(--brand-green-border)] text-[var(--brand-green-light)]
// hover: bg-[var(--surface-glass-hover)] text-[var(--text-primary)]
// All: rounded-full px-4 py-2 text-sm font-medium transition-all duration-150
```

**Meal type filter (Breakfast, Lunch, Dinner, Snacks):**

```typescript
// Horizontally scrollable toggle group
// Container: flex gap-2 overflow-x-auto pb-2 (hide scrollbar with scrollbar-none)

// Each toggle button
// Not active: bg-[var(--bg-secondary)] border border-[var(--surface-border)] text-[var(--text-secondary)]
// Active: bg-[var(--brand-green)] text-[var(--text-inverse)] border-[var(--brand-green)]
// rounded-[var(--radius-md)] px-4 py-2 text-sm font-medium transition-all duration-150
```

**Recipe grid / table:**

```typescript
// Each meal cell in the grid
// bg-[var(--bg-secondary)] border border-[var(--surface-border)] rounded-[var(--radius-md)] p-4

// Member name header: text-[var(--text-muted)] text-xs type-overline
// Meal name: text-[var(--text-primary)] text-sm font-semibold
// Portion info: text-[var(--text-secondary)] text-xs
// Kid adaptation badge: info Badge variant "Kid's portion"
```

**Recipe detail modal:**

Use the dark Modal component (Section 2.5). Inside:
- Ingredients list: dark styled, bullet color `var(--brand-green)`
- Steps: numbered with `text-[var(--brand-green-light)] font-bold` step numbers
- Full-width image: `rounded-[var(--radius-md)] object-cover`

---

### 4.7 Dashboard Page (/app/dashboard)

**File:** `frontend/src/app/app/dashboard/page.tsx`

**Stat cards row:**

```typescript
// Each stat card (Adherence %, Calories Avg, Meals Tracked, Streak)
// bg-[var(--bg-secondary)] border border-[var(--surface-border)] rounded-[var(--radius-lg)] p-5

// Accent top border colored by stat type:
// border-t-2 applied to individual stat meaning:
// Adherence: border-t-[var(--brand-green)]
// Calories: border-t-[var(--brand-amber)]
// Tracked: border-t-[var(--color-info)]
// Streak: border-t-[var(--color-warning)]

// Stat label: type-overline text-[var(--text-muted)]
// Stat value: text-[var(--text-primary)] text-3xl font-bold
// Change indicator: small badge — up: success, down: error
```

**Chart section cards:**

```typescript
// Chart container card
// bg-[var(--bg-secondary)] border border-[var(--surface-border)] rounded-[var(--radius-lg)] p-5

// Chart title: type-h4 text-[var(--text-primary)]
// Chart subtitle: text-[var(--text-secondary)] text-sm
// Recharts customization: see Section 5 below
```

---

### 4.8 Settings Page (/app/settings)

**File:** `frontend/src/app/app/settings/page.tsx`

**Settings sections:**

Standard section card pattern (same as Profile page) for:
- Notification preferences
- Display preferences
- Data export
- Account management

**Danger zone card:**

```typescript
// Special card for destructive actions — visually distinct from other cards
const dangerZoneClasses = `
  bg-[var(--color-error-bg)]
  border
  border-[rgba(229,83,75,0.20)]
  rounded-[var(--radius-lg)]
  p-5
  mt-6
`;

// Section label: type-overline text-[var(--color-error)]
// Title: type-h4 text-[var(--text-primary)]
// Description: text-[var(--text-secondary)] text-sm
// Reset button: Danger Button variant

// Confirmation modal for reset action:
// Uses dark Modal with danger Button in footer
// Modal title: "Reset All Data?"
// Warning text: text-[var(--color-error)] text-sm — explains data loss
// Confirm button: danger variant "Yes, Reset Everything"
// Cancel button: secondary variant "Cancel"
```

---

## 5. Recharts Dark Theme Configuration

### 5.1 Shared Dark Chart Theme Object

Create this configuration object in `frontend/src/lib/chartTheme.ts` and import it into every chart component.

```typescript
// frontend/src/lib/chartTheme.ts
//
// Recharts dark theme configuration for FedRight.
// Import and spread these props onto Recharts components.
//
// Usage example:
//   import { darkChartTheme, tooltipStyle } from '@/lib/chartTheme';
//   <CartesianGrid {...darkChartTheme.cartesianGrid} />
//   <Tooltip contentStyle={tooltipStyle} />

export const darkChartTheme = {
  // Background for the chart container (applied to ResponsiveContainer wrapper div)
  backgroundColor: 'var(--bg-secondary)',

  // CartesianGrid — the subtle grid lines in the chart background
  // Using rgba directly because Recharts `stroke` prop doesn't accept CSS var()
  // Note: The hex value of --surface-border is rgba(255,255,255,0.06)
  cartesianGrid: {
    strokeDasharray: '3 3',
    stroke: 'rgba(255, 255, 255, 0.05)',
    vertical: false,  // Show only horizontal lines for cleaner look
  },

  // XAxis and YAxis shared props
  axis: {
    tick: {
      fill: 'var(--text-muted)',    // #5C6370 — subtle axis labels
      fontSize: 12,
      fontFamily: 'var(--font-inter)',
    },
    axisLine: {
      stroke: 'rgba(255, 255, 255, 0.06)',  // --surface-border
    },
    tickLine: false,  // Remove tick marks for cleaner look
  },

  // Data colors by semantic meaning
  colors: {
    primary: 'var(--brand-green)',       // #1B8B4D — main data series
    secondary: 'var(--brand-amber)',     // #E6920A — secondary data series
    tertiary: 'var(--color-info)',       // #539BF5 — third data series
    danger: 'var(--color-error)',        // #E5534B — negative/error data
    success: 'var(--color-success)',     // #2AAF65 — success/positive data
    muted: 'var(--text-muted)',          // #5C6370 — de-emphasized data
  },

  // Specific hex values for Recharts props that don't support CSS var()
  // (Recharts renders via SVG which has limited CSS variable support)
  hexColors: {
    primary: '#1B8B4D',
    primaryLight: '#2AAF65',
    primarySubtle: 'rgba(27, 139, 77, 0.15)',   // for area chart fills
    secondary: '#E6920A',
    secondarySubtle: 'rgba(230, 146, 10, 0.15)',
    tertiary: '#539BF5',
    tertiarySubtle: 'rgba(83, 155, 245, 0.15)',
    danger: '#E5534B',
    muted: '#5C6370',
    gridLine: 'rgba(255, 255, 255, 0.05)',
    axisText: '#5C6370',
  },
};

// Custom tooltip content style object
// Pass as: <Tooltip contentStyle={tooltipStyle} />
export const tooltipStyle: React.CSSProperties = {
  backgroundColor: 'var(--bg-tertiary)',  // #1A1E26
  border: '1px solid rgba(255, 255, 255, 0.06)',
  borderRadius: '12px',  // --radius-md
  color: 'var(--text-primary)',
  fontSize: '12px',
  fontFamily: 'var(--font-inter), sans-serif',
  padding: '10px 14px',
  boxShadow: '0 12px 32px rgba(0,0,0,0.5), 0 4px 8px rgba(0,0,0,0.3)',
};

// Tooltip label style
export const tooltipLabelStyle: React.CSSProperties = {
  color: 'var(--text-secondary)',
  marginBottom: '4px',
  fontWeight: 600,
};

// Legend style
export const legendStyle: React.CSSProperties = {
  color: 'var(--text-secondary)',
  fontSize: '12px',
  fontFamily: 'var(--font-inter), sans-serif',
};
```

### 5.2 Chart-Specific Configurations

**CalorieChart (Line Chart):**

```typescript
// Primary calorie intake line
<Line
  type="monotone"
  dataKey="calories"
  stroke={darkChartTheme.hexColors.primary}  // brand-green
  strokeWidth={2}
  dot={{ fill: darkChartTheme.hexColors.primary, r: 4, strokeWidth: 0 }}
  activeDot={{ r: 6, fill: darkChartTheme.hexColors.primaryLight }}
/>

// Target calorie reference line (dashed)
<ReferenceLine
  y={targetCalories}
  stroke={darkChartTheme.hexColors.muted}
  strokeDasharray="4 4"
  label={{ value: 'Target', fill: darkChartTheme.hexColors.axisText, fontSize: 11 }}
/>

// Area fill under the line (subtle green tint)
// Use <Area> instead of <Line> for this effect:
<Area
  type="monotone"
  dataKey="calories"
  stroke={darkChartTheme.hexColors.primary}
  strokeWidth={2}
  fill={darkChartTheme.hexColors.primarySubtle}  // rgba(27,139,77,0.15)
/>
```

**MacroBarChart (Stacked or Grouped Bar Chart):**

```typescript
// Protein bars — brand green
<Bar dataKey="protein" fill={darkChartTheme.hexColors.primary} radius={[4, 4, 0, 0]} />

// Carbs bars — brand amber
<Bar dataKey="carbs" fill={darkChartTheme.hexColors.secondary} radius={[4, 4, 0, 0]} />

// Fat bars — color-info blue
<Bar dataKey="fat" fill={darkChartTheme.hexColors.tertiary} radius={[4, 4, 0, 0]} />

// Bar radius [topLeft, topRight, bottomRight, bottomLeft] — rounds the top only
// This gives a modern "pill top" look to individual bars
```

**AdherenceChart (Pie / Donut Chart):**

```typescript
// Pie chart sectors
// Ate as planned: darkChartTheme.hexColors.primary      (green)
// Skipped:        darkChartTheme.hexColors.secondary    (amber)
// Substituted:    darkChartTheme.hexColors.tertiary     (blue)

// Center label (donut chart):
// Large number: text-[var(--text-primary)] type-h2
// Label: text-[var(--text-muted)] type-caption
// Rendered as a custom <Label> inside the Pie component or absolutely positioned div
```

**ConsistencyScore (Radial Bar / Circular Progress):**

```typescript
// Single radial bar showing overall consistency percentage
<RadialBarChart innerRadius="70%" outerRadius="90%">
  {/* Background track */}
  <RadialBar
    dataKey="max"
    fill={darkChartTheme.hexColors.gridLine}
    cornerRadius={10}
    background={false}
  />
  {/* Score fill */}
  <RadialBar
    dataKey="score"
    fill={darkChartTheme.hexColors.primary}
    cornerRadius={10}
  />
</RadialBarChart>

// Score text in center (absolutely positioned over the chart):
// Score value: text-[var(--text-primary)] text-4xl font-bold
// "consistency" label: text-[var(--text-muted)] text-xs type-overline
```

### 5.3 Recharts SVG Rendering Note

Recharts renders charts as SVG elements. CSS custom properties (`var(--brand-green)`) work in SVG attributes **only if** the SVG is inline (embedded in the DOM, not an `<img src="*.svg">`). Since Recharts outputs inline SVG, CSS variables in `fill`, `stroke`, and `color` props will work in modern browsers.

**Exception:** Internet Explorer does not support CSS variables in SVG. IE is not a supported browser for FedRight, so this is not a concern.

**Exception:** Some Recharts components internally use inline styles (not CSS classes), bypassing the CSS variable cascade. If a CSS variable appears to not work in a chart prop, fall back to the `hexColors` values defined in the `darkChartTheme` object.

---

## 6. Implementation Order & Dependencies

### 6.1 Recommended Implementation Sequence

The following order minimizes dependency conflicts and allows incremental visual progress:

| Step | Task | Prerequisite |
|------|------|-------------|
| 1 | Implement `globals.css` (01-brand-design-system.md Section 8) | None |
| 2 | Update `layout.tsx` with Inter font (this doc Section 4) | Step 1 |
| 3 | Restyle `Button.tsx` — all variants | Steps 1-2 |
| 4 | Restyle `Card.tsx` | Steps 1-2 |
| 5 | Restyle `Input.tsx` and `Select.tsx` | Steps 1-2 |
| 6 | Restyle `Badge.tsx` and `Toast.tsx` | Steps 1-2 |
| 7 | Restyle `Modal.tsx` | Steps 1-6 (uses Button) |
| 8 | Restyle `EmptyState.tsx` and `LoadingSkeleton.tsx` | Steps 1-4 |
| 9 | Restyle `Sidebar.tsx` | Steps 1-8 (uses all primitives) |
| 10 | Restyle each app page in order: Profile → Meal Plan → Tracking → Grocery → Chef's View → Dashboard → Settings | Step 9 |
| 11 | Implement Recharts dark theme (`chartTheme.ts`) | Step 1 |
| 12 | Apply chart theme to Dashboard page | Steps 10-11 |

### 6.2 Testing Each Component After Restyling

After completing each component restyling, verify:

- [ ] Dark background appears correctly (no white flash or light surfaces)
- [ ] All text meets minimum contrast on dark backgrounds (use browser DevTools accessibility checker)
- [ ] Focus states are visible (tab through all interactive elements)
- [ ] Hover states animate correctly (transition durations feel snappy, not slow)
- [ ] Loading/disabled states are visually distinct
- [ ] The component looks correct at all breakpoints (mobile, tablet, desktop)

---

## 7. Migration Quick Reference

### 7.1 Color Class Replacement Table

Use this table to find-and-replace old color classes during migration. Run each `grep` to find files containing old patterns.

| Old Class (Botanical/Light) | New Class (FedRight Dark) | Grep Pattern |
|------------------------------|---------------------------|--------------|
| `bg-white` | `bg-[var(--bg-secondary)]` | `grep -rn "bg-white"` |
| `bg-cream-50` / `bg-stone-50` | `bg-[var(--bg-secondary)]` | `grep -rn "bg-cream\|bg-stone-50"` |
| `bg-white/70` | `bg-[var(--surface-glass)]` | `grep -rn "bg-white/70"` |
| `text-stone-800` / `text-stone-900` | `text-[var(--text-primary)]` | `grep -rn "text-stone-[89]"` |
| `text-stone-600` / `text-stone-700` | `text-[var(--text-secondary)]` | `grep -rn "text-stone-[67]"` |
| `text-stone-400` / `text-stone-500` | `text-[var(--text-muted)]` | `grep -rn "text-stone-[45]"` |
| `border-stone-200` | `border-[var(--surface-border)]` | `grep -rn "border-stone-2"` |
| `bg-emerald-600` | `bg-[var(--brand-green)]` | `grep -rn "bg-emerald"` |
| `text-emerald-600` | `text-[var(--brand-green-light)]` | `grep -rn "text-emerald"` |
| `border-emerald-500` | `border-[var(--brand-green)]` | `grep -rn "border-emerald"` |
| `ring-emerald-200` | `ring-[var(--brand-green-subtle)]` | `grep -rn "ring-emerald"` |
| `bg-emerald-50` | `bg-[var(--brand-green-subtle)]` | `grep -rn "bg-emerald-50"` |
| `bg-amber-500` | `bg-[var(--brand-amber)]` | `grep -rn "bg-amber"` |
| `text-amber-600` | `text-[var(--brand-amber)]` | `grep -rn "text-amber"` |
| `from-emerald-700 to-emerald-600` | `bg-[var(--brand-green)]` | `grep -rn "from-emerald"` |
| `rounded-2xl` | `rounded-[var(--radius-lg)]` or keep `rounded-2xl` | `grep -rn "rounded-2xl"` |
| `shadow-md` (Tailwind default) | inline `boxShadow: 'var(--shadow-md)'` | `grep -rn "shadow-md"` |
| `.font-display` / DM Serif Display | Remove — Inter handles all headings | `grep -rn "font-display"` |

### 7.2 Provider and Import Changes

After route restructuring (per `05-route-restructuring.md`), these imports in moved page files may need path adjustments:

```typescript
// If a page was at src/app/profile/page.tsx and is now at src/app/app/profile/page.tsx,
// any relative imports (../../components/...) must be updated to (../../../components/...)
// or, better, use the @/ path alias which is absolute and unaffected by moves:

// Fragile relative import (update after move):
import Card from '../../components/ui/Card';

// Robust absolute import (no update needed after move):
import Card from '@/components/ui/Card';

// Audit: grep for relative imports in moved page files
grep -rn "from '\.\." frontend/src/app/app/
```

---

*End of Document — `spec/ui-redesign/06-app-dark-mode-redesign.md`*
*Previous: `spec/ui-redesign/05-route-restructuring.md`*
*Next: `spec/ui-redesign/07-auth-pages-redesign.md` — Login and Signup page specs*
