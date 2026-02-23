# FedRight — Route Restructuring Specification
## Document: `05-route-restructuring.md`
## Version: 1.0 | Date: 2026-02-20
## Status: APPROVED FOR IMPLEMENTATION

---

## Table of Contents

1. [Overview](#1-overview)
2. [New Route Map](#2-new-route-map)
3. [Layout Architecture](#3-layout-architecture)
4. [Root layout.tsx Specification (REWRITE)](#4-root-layouttsx-specification-rewrite)
5. [App layout.tsx Specification (NEW)](#5-app-layouttsx-specification-new)
6. [File Move Checklist](#6-file-move-checklist)
7. [Internal Link Updates](#7-internal-link-updates)
8. [AuthGate Behavior Change](#8-authgate-behavior-change)
9. [Next.js Middleware](#9-nextjs-middleware)
10. [next.config.ts Backward Compatibility Redirects](#10-nextconfigts-backward-compatibility-redirects)
11. [Route Constants File](#11-route-constants-file)
12. [Post-Migration Verification Checklist](#12-post-migration-verification-checklist)

---

## 1. Overview

### 1.1 Problem Statement

The current FedRight routing architecture has a critical structural flaw: all app pages live at the root level (`/profile`, `/meal-plan`, `/tracking`, etc.) with no distinction between public and authenticated surfaces. The root path `/` currently redirects immediately to the authenticated home, meaning there is no public landing page and unauthenticated visitors bounce without ever understanding what FedRight does.

This document specifies the complete route restructuring required to:

1. Establish `/` as a fully public, unauthenticated marketing landing page
2. Create `/login` and `/signup` as dedicated public auth pages
3. Move all authenticated app pages under the `/app/*` namespace
4. Implement proper authentication guards at both the layout level and the middleware level
5. Maintain backward compatibility for existing bookmarks and hardcoded links

### 1.2 Implementation Mechanism

Next.js App Router's **nested layout** and **route group** system makes this restructuring clean and explicit:

- A **root layout** (`app/layout.tsx`) wraps ALL routes — public and authenticated — with only the minimal providers needed globally (fonts, toast notifications)
- A **nested app layout** (`app/app/layout.tsx`) wraps ONLY the authenticated routes under `/app/*` and contains the Sidebar, AuthGate, and auth-specific providers
- Public routes (`/`, `/login`, `/signup`) are direct children of the root layout and are completely unaware of any authentication state

### 1.3 Scope

This document covers frontend routing changes only. The FastAPI backend requires no changes — the backend API endpoints remain at `/api/*` on port 8000 and are consumed by the same frontend logic post-restructuring. The only backend change is updating CORS allowed origins if the origin URL changes (it does not change in local development).

---

## 2. New Route Map

### 2.1 Complete Before/After Table

| Old Route | New Route | HTTP Status | Action Required |
|-----------|-----------|-------------|-----------------|
| `/` | `/` | 200 (rewrite, same URL) | REWRITE — was app home, becomes public landing page |
| N/A | `/login` | 200 (new) | CREATE — dedicated dark login page |
| N/A | `/signup` | 200 (new) | CREATE — dedicated dark signup page |
| N/A | `/app` | 200 (new) | CREATE — authenticated app home / welcome dashboard |
| `/profile` | `/app/profile` | 308 redirect → 200 | MOVE + add backward-compat redirect |
| `/meal-plan` | `/app/meal-plan` | 308 redirect → 200 | MOVE + add backward-compat redirect |
| `/tracking` | `/app/tracking` | 308 redirect → 200 | MOVE + add backward-compat redirect |
| `/grocery` | `/app/grocery` | 308 redirect → 200 | MOVE + add backward-compat redirect |
| `/chefs-view` | `/app/chefs-view` | 308 redirect → 200 | MOVE + add backward-compat redirect |
| `/dashboard` | `/app/dashboard` | 308 redirect → 200 | MOVE + add backward-compat redirect |
| `/settings` | `/app/settings` | 308 redirect → 200 | MOVE + add backward-compat redirect |

**308 vs 301:** Use 308 (Permanent Redirect, method-preserving) rather than 301 for all backward-compatibility redirects. Next.js `redirects()` uses 308 by default when `permanent: true` is set. This is appropriate as these pages accept no form submissions at the old URLs.

### 2.2 Access Control Matrix

| Route Pattern | Auth Required | AuthGate Enforced | Middleware Guard | Notes |
|---------------|---------------|-------------------|-----------------|-------|
| `/` | No | No | No | Fully public |
| `/login` | No | No | No | Redirect to `/app` if already authenticated |
| `/signup` | No | No | No | Redirect to `/app` if already authenticated |
| `/app` | Yes | Yes | Yes | Post-login destination default |
| `/app/*` (all) | Yes | Yes | Yes | Full auth required, double-guarded |

**Double-guarding rationale:** Both the Next.js middleware AND the React AuthGate component guard `/app/*`. This defense-in-depth approach means:
- Middleware provides fast edge-level redirect before React renders (better UX, no flash of unauthenticated state)
- AuthGate provides React-level protection in case middleware is bypassed (e.g., client-side navigation from a public page directly to an `/app/*` URL)

---

## 3. Layout Architecture

### 3.1 Hierarchy Diagram

```
frontend/src/app/
│
├── layout.tsx                   ← ROOT LAYOUT
│   │  Applies to: ALL routes (/, /login, /signup, /app/*)
│   │  Contains: <html>, <body>, Inter font, ToastProvider ONLY
│   │  Does NOT contain: AuthProviderWrapper, AuthGate, ProfileProvider, Sidebar
│   │
│   ├── page.tsx                 ← PUBLIC LANDING PAGE (/)
│   │      No auth required. Contains all 10 landing sections.
│   │
│   ├── login/
│   │   └── page.tsx             ← PUBLIC LOGIN PAGE (/login)
│   │          No auth required.
│   │
│   ├── signup/
│   │   └── page.tsx             ← PUBLIC SIGNUP PAGE (/signup)
│   │          No auth required.
│   │
│   └── app/
│       ├── layout.tsx           ← APP LAYOUT (nested, /app/*)
│       │      Applies to: /app and all /app/* routes ONLY
│       │      Contains: AuthProviderWrapper, AuthGate, ProfileProvider, Sidebar
│       │      Renders the sidebar + main content offset
│       │
│       ├── page.tsx             ← APP HOME (/app)
│       ├── profile/
│       │   └── page.tsx         ← /app/profile
│       ├── meal-plan/
│       │   └── page.tsx         ← /app/meal-plan
│       ├── tracking/
│       │   └── page.tsx         ← /app/tracking
│       ├── grocery/
│       │   └── page.tsx         ← /app/grocery
│       ├── chefs-view/
│       │   └── page.tsx         ← /app/chefs-view
│       ├── dashboard/
│       │   └── page.tsx         ← /app/dashboard
│       └── settings/
│           └── page.tsx         ← /app/settings
```

### 3.2 Provider Responsibility Table

| Provider | Root layout.tsx | App layout.tsx | Rationale |
|----------|----------------|----------------|-----------|
| `<html>`, `<body>` | Yes | No | Every route needs document structure |
| Inter font variable | Yes | No | Font applies everywhere including landing |
| `ToastProvider` | Yes | No | Login/signup pages also need toasts for error feedback |
| `AuthProviderWrapper` | No | Yes | Only auth routes need auth state |
| `AuthGate` | No | Yes | Only auth routes need the gate |
| `ProfileProvider` | No | Yes | Profile data is irrelevant on public pages |
| `Sidebar` | No | Yes | Public pages have no sidebar |

### 3.3 Why NOT Use a Route Group for App Routes

An alternative approach would be to use a Next.js route group `(app)` instead of a directory named `app`. Route groups use parentheses, e.g., `(app)/layout.tsx`, and the group name does NOT appear in the URL — so `(app)/profile/page.tsx` would serve at `/profile`, not `/app/profile`.

**This approach is explicitly rejected.** The requirement is that authenticated routes appear under the `/app` URL prefix. This communicates to users and developers that they are in an authenticated application context. Route groups that strip the prefix from URLs would not achieve this goal.

The `app/` directory name (without parentheses) results in URLs at `/app/*` which is the specified requirement.

---

## 4. Root layout.tsx Specification (REWRITE)

### 4.1 Location

`frontend/src/app/layout.tsx`

### 4.2 What to REMOVE from Current File

The current `layout.tsx` contains providers and UI that must be removed entirely:

```typescript
// REMOVE THESE IMPORTS:
import AuthProviderWrapper from '@/components/auth/AuthGate';  // or wherever it's imported from
import { ProfileProvider } from '@/lib/ProfileContext';
import Sidebar from '@/components/layout/Sidebar';
// (any other auth-related imports)

// REMOVE THIS JSX STRUCTURE:
<AuthProviderWrapper>
  <AuthGate>
    <ProfileProvider>
      <Sidebar />
      <main className="lg:ml-64 ...">
        {children}
      </main>
    </ProfileProvider>
  </AuthGate>
</AuthProviderWrapper>
```

### 4.3 Complete New Root layout.tsx

```typescript
// frontend/src/app/layout.tsx
//
// ROOT LAYOUT — applies to ALL routes (public and authenticated)
//
// INTENTIONALLY MINIMAL: This layout contains only what every single route
// in the app needs — the HTML document structure, the global font, and the
// toast notification system. Authentication, sidebar, and profile state are
// scoped to the nested app/layout.tsx.
//
// Tailwind v4 note: The Inter font CSS variable is exposed via the <html>
// className. The <body> then references it via font-family in globals.css.

import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { ToastProvider } from '@/components/ui/Toast';

// Load Inter with all weights used by the type scale defined in 01-brand-design-system.md.
// display: 'swap' prevents FOUT (flash of unstyled text) — Inter WOFF2 is
// typically cached after first load, so swap only affects cold first visits.
// variable: '--font-inter' exposes Inter as a CSS custom property that
// globals.css body rule consumes via font-family.
const inter = Inter({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800'],
  variable: '--font-inter',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'FedRight — One Kitchen. Every Body. Perfectly Fed.',
  description:
    'AI-powered household meal planning for Indian families. Personalized nutrition, smart grocery lists, and family-aware meal planning that works for every member simultaneously.',
  // Open Graph / social sharing metadata
  openGraph: {
    title: 'FedRight — One Kitchen. Every Body. Perfectly Fed.',
    description:
      'The first AI nutritionist designed for the entire Indian household.',
    type: 'website',
    // Image path relative to /public — update once brand asset is finalized
    images: [{ url: '/fedright-logo-gemini-v2.png' }],
  },
  // Instruct crawlers: public landing page is indexable; /app/* should not be indexed
  // (enforced via robots.txt or per-page metadata override, not here)
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    // inter.variable exposes --font-inter CSS custom property to the entire document.
    // The actual font-family is applied to <body> in globals.css @layer base.
    <html lang="en" className={inter.variable}>
      {/*
        antialiased: applies -webkit-font-smoothing and -moz-osx-font-smoothing
        for crisp Inter rendering on dark backgrounds (critical on macOS).
        globals.css also sets these on <html> explicitly for belt-and-suspenders.
      */}
      <body className="antialiased">
        {/*
          ToastProvider is at root level because both public pages (/login, /signup)
          and authenticated pages (/app/*) need toast notifications.
          For example: login errors, signup success messages.
        */}
        <ToastProvider>
          {children}
        </ToastProvider>
      </body>
    </html>
  );
}
```

### 4.4 Key Decisions in Root Layout

**No `'use client'` directive.** This is a Server Component by default. `ToastProvider` may require `'use client'` internally (because it uses `useState`/context), which is correct — the provider itself is a client component, but the root layout wrapper remains a server component. Next.js handles this boundary automatically.

**No dark mode class toggle.** FedRight is dark-mode-only (no light mode). The `background-color: var(--bg-primary)` on `body` in globals.css handles the dark background globally. There is no `dark` class needed.

---

## 5. App layout.tsx Specification (NEW)

### 5.1 Location

`frontend/src/app/app/layout.tsx`

**This file does not exist yet and must be created.**

### 5.2 Complete New App layout.tsx

```typescript
// frontend/src/app/app/layout.tsx
//
// APP LAYOUT — applies ONLY to routes under /app/* (authenticated app)
//
// This layout is responsible for:
//   1. Wrapping all authenticated routes with auth state (AuthProviderWrapper)
//   2. Guarding against unauthenticated access (AuthGate → redirects to /login)
//   3. Providing profile state to all app pages (ProfileProvider)
//   4. Rendering the persistent Sidebar navigation
//   5. Offsetting the main content area to account for the sidebar width
//
// Provider nesting order matters:
//   AuthProviderWrapper must be outermost — everything below it reads auth state
//   AuthGate must wrap ProfileProvider — profile should not load if not authed
//   ProfileProvider wraps page content — pages consume profile via context

'use client';

import { AuthProviderWrapper } from '@/lib/AuthContext';
import AuthGate from '@/components/auth/AuthGate';
import { ProfileProvider } from '@/lib/ProfileContext';
import Sidebar from '@/components/layout/Sidebar';

export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AuthProviderWrapper>
      {/*
        AuthGate checks authentication status on mount. If user is not
        authenticated, it redirects to /login (see AuthGate behavior spec
        in Section 8 of this document). While auth status is loading, it
        renders a full-screen loading spinner. It does NOT render the
        inline LoginPage component anymore — that pattern is retired.
      */}
      <AuthGate>
        <ProfileProvider>
          {/*
            Root flex container for the app shell.
            min-h-screen ensures the layout fills the viewport even on short pages.
          */}
          <div className="flex min-h-screen" style={{ backgroundColor: 'var(--bg-primary)' }}>

            {/*
              Sidebar: fixed-position on desktop (lg+), slide-in drawer on mobile.
              Width: 256px (w-64) on desktop. On mobile, controlled by hamburger toggle.
              Dark mode styling specified in 06-app-dark-mode-redesign.md Section 3.
            */}
            <Sidebar />

            {/*
              Main content area. Offset by sidebar width on large screens.
              On mobile (< lg), no offset — sidebar overlays content as a drawer.

              min-h-screen on the <main> ensures page backgrounds extend full height.
              overflow-x-hidden prevents horizontal scroll on pages with wide content.
            */}
            <main
              className="flex-1 min-h-screen overflow-x-hidden lg:ml-64"
              style={{ backgroundColor: 'var(--bg-primary)' }}
            >
              {children}
            </main>
          </div>
        </ProfileProvider>
      </AuthGate>
    </AuthProviderWrapper>
  );
}
```

### 5.3 Why `'use client'` on App Layout

The `AuthProviderWrapper` and `ProfileProvider` are context providers that require client-side rendering (they use `useState`, `useEffect`, and browser APIs to manage auth and profile state). Marking the layout `'use client'` propagates that boundary to all children, which is correct for the authenticated app shell. Individual page components that are pure server components (data fetching via server actions or RSC) can still work within this client boundary.

**Alternative considered:** Marking each provider file with `'use client'` individually and keeping the layout as a server component. **Rejected** because the AuthGate component uses `useRouter()` for redirects, which is client-only, making the layout effectively a client component boundary anyway.

### 5.4 Sidebar Width Constants

The `lg:ml-64` offset assumes the sidebar is exactly `256px` (Tailwind `w-64`) wide on desktop. This must match the sidebar's actual `width` value in `Sidebar.tsx`. If the sidebar width ever changes, update both `Sidebar.tsx` and this `lg:ml-64` class simultaneously.

---

## 6. File Move Checklist

### 6.1 Pre-Move: Create Directory Structure

Execute these operations in order. Do not skip steps.

```bash
# Step 1: Create the app sub-directory
mkdir -p frontend/src/app/app

# Step 2: Create all page sub-directories inside app/
mkdir -p frontend/src/app/app/profile
mkdir -p frontend/src/app/app/meal-plan
mkdir -p frontend/src/app/app/tracking
mkdir -p frontend/src/app/app/grocery
mkdir -p frontend/src/app/app/chefs-view
mkdir -p frontend/src/app/app/dashboard
mkdir -p frontend/src/app/app/settings

# Step 3: Create new public route directories
mkdir -p frontend/src/app/login
mkdir -p frontend/src/app/signup
```

### 6.2 Page File Move Operations

For each move below:
- Copy the file content
- Create a new file at the new path
- After verifying the new file is correct, delete the old file
- Do NOT rename/move in git directly — the file content also needs import path updates

| Step | Old Path | New Path | Notes |
|------|----------|----------|-------|
| 1 | `src/app/profile/page.tsx` | `src/app/app/profile/page.tsx` | Update any relative imports |
| 2 | `src/app/meal-plan/page.tsx` | `src/app/app/meal-plan/page.tsx` | Update any relative imports |
| 3 | `src/app/tracking/page.tsx` | `src/app/app/tracking/page.tsx` | Update any relative imports |
| 4 | `src/app/grocery/page.tsx` | `src/app/app/grocery/page.tsx` | Update any relative imports |
| 5 | `src/app/chefs-view/page.tsx` | `src/app/app/chefs-view/page.tsx` | Update any relative imports |
| 6 | `src/app/dashboard/page.tsx` | `src/app/app/dashboard/page.tsx` | Update any relative imports |
| 7 | `src/app/settings/page.tsx` | `src/app/app/settings/page.tsx` | Update any relative imports |
| 8 | `src/app/page.tsx` | REWRITE in place | Becomes the public landing page |

**Note on step 8:** The current `src/app/page.tsx` is the app home. It does NOT get moved — instead, its content is replaced entirely with the public landing page. A new `src/app/app/page.tsx` must be created for the authenticated app home.

### 6.3 New Files to Create

The following files must be created from scratch:

| File | Purpose | Based On |
|------|---------|----------|
| `src/app/app/layout.tsx` | App shell layout with sidebar + auth | Spec Section 5.2 above |
| `src/app/app/page.tsx` | Authenticated app home / welcome dashboard | New content per 06-app-dark-mode-redesign.md |
| `src/app/login/page.tsx` | Public login page | Per 07-auth-pages-redesign.md |
| `src/app/signup/page.tsx` | Public signup page | Per 07-auth-pages-redesign.md |
| `src/middleware.ts` | Next.js edge middleware for auth guard | Spec Section 9 below |

### 6.4 Old Directories to Delete After Move

After all pages are moved and verified working at new paths:

```bash
# Delete old page directories (only after confirming new paths work)
rm -rf frontend/src/app/profile
rm -rf frontend/src/app/meal-plan
rm -rf frontend/src/app/tracking
rm -rf frontend/src/app/grocery
rm -rf frontend/src/app/chefs-view
rm -rf frontend/src/app/dashboard
rm -rf frontend/src/app/settings
```

**Do NOT delete these (they contain new pages at the same path):**
- `src/app/login/` (newly created for public login)
- `src/app/signup/` (newly created for public signup)

### 6.5 Files Requiring Import Updates After Move

Any file that imports from the moved pages directly (unusual, but possible via barrel exports) needs updating. More importantly, these files contain hardcoded route strings that reference old paths:

| File | Old Reference | New Reference |
|------|---------------|---------------|
| `src/components/layout/Sidebar.tsx` | All nav `href` values | `/app/*` prefixed versions |
| `src/components/auth/AuthGate.tsx` | `router.push('/')` on success | `router.push('/app')` |
| `src/lib/AuthContext.tsx` | Any `router.push` after login | `router.push('/app')` |
| `src/lib/api.ts` | Any redirect on 401 | `window.location = '/login'` |
| All `app/app/*/page.tsx` files | `<Link href="/profile">`, etc. | `<Link href="/app/profile">`, etc. |

---

## 7. Internal Link Updates

### 7.1 Grep Commands to Find All Affected Instances

Run the following grep patterns from the `frontend/src/` directory. Every result must be reviewed and updated.

```bash
# Find all router.push calls — may reference old paths
grep -rn "router\.push" frontend/src/

# Find all Link components with href — may use old paths
grep -rn "href=\"/" frontend/src/

# Find all hardcoded path strings starting with / — may be old paths
grep -rn "'\"/profile\|'/meal-plan\|'/tracking\|'/grocery\|'/chefs-view\|'/dashboard\|'/settings" frontend/src/

# Find redirect() calls from server components
grep -rn "redirect(" frontend/src/

# Find window.location assignments
grep -rn "window\.location" frontend/src/

# Find any remaining old path strings after updates (verification pass)
grep -rn '"/profile"' frontend/src/
grep -rn '"/meal-plan"' frontend/src/
grep -rn '"/tracking"' frontend/src/
grep -rn '"/grocery"' frontend/src/
grep -rn '"/chefs-view"' frontend/src/
grep -rn '"/dashboard"' frontend/src/
grep -rn '"/settings"' frontend/src/
```

### 7.2 Sidebar.tsx — Complete Nav Items Update

The Sidebar currently defines navigation items with old `/` root paths. Every nav item href must gain the `/app` prefix.

**Current nav items (to be replaced):**

```typescript
// BEFORE — OLD paths, will 404 after route restructuring
const navItems = [
  { href: '/profile', label: 'Profile', icon: UserIcon },
  { href: '/meal-plan', label: 'Meal Plan', icon: CalendarIcon },
  { href: '/tracking', label: 'Tracking', icon: ActivityIcon },
  { href: '/grocery', label: 'Grocery', icon: ShoppingCartIcon },
  { href: '/chefs-view', label: "Chef's View", icon: ChefHatIcon },
  { href: '/dashboard', label: 'Dashboard', icon: BarChartIcon },
  { href: '/settings', label: 'Settings', icon: SettingsIcon },
];
```

**Replacement nav items:**

```typescript
// AFTER — NEW paths under /app/*
// Import ROUTES from '@/lib/routes' (defined in Section 11 below)
import { ROUTES } from '@/lib/routes';

const navItems = [
  { href: ROUTES.APP.PROFILE, label: 'Profile', icon: UserIcon },
  { href: ROUTES.APP.MEAL_PLAN, label: 'Meal Plan', icon: CalendarIcon },
  { href: ROUTES.APP.TRACKING, label: 'Tracking', icon: ActivityIcon },
  { href: ROUTES.APP.GROCERY, label: 'Grocery', icon: ShoppingCartIcon },
  { href: ROUTES.APP.CHEFS_VIEW, label: "Chef's View", icon: ChefHatIcon },
  { href: ROUTES.APP.DASHBOARD, label: 'Dashboard', icon: BarChartIcon },
  { href: ROUTES.APP.SETTINGS, label: 'Settings', icon: SettingsIcon },
];
```

**Active state detection update:** If the current active state logic uses `usePathname()` and compares against old paths (e.g., `pathname === '/profile'`), this comparison must also be updated to check against `/app/profile`. Using the `ROUTES` constants ensures consistency.

### 7.3 AuthGate.tsx — Redirect Target Update

```typescript
// BEFORE
router.push('/');   // or router.push('/dashboard')

// AFTER
router.push(ROUTES.APP.HOME);  // resolves to '/app'
// OR, if an intended URL was stored:
const redirectTo = searchParams.get('redirect') || ROUTES.APP.HOME;
router.push(redirectTo);
```

### 7.4 Cross-Page Links in App Pages

Each moved page may contain `<Link>` components pointing to sibling pages. Audit each page file:

**Profile page** — may link to Meal Plan: `href="/meal-plan"` → `href={ROUTES.APP.MEAL_PLAN}`

**Meal Plan page** — may link to Tracking and Grocery: update all cross-links

**Tracking page** — may link to Meal Plan: update

**Dashboard page** — quick-nav cards likely link to other app pages: update all six cards

**Settings page** — danger zone may redirect after account reset: `router.push('/')` → `router.push(ROUTES.PUBLIC.LANDING)`

### 7.5 api.ts — 401 Handler Update

The axios interceptor in `api.ts` likely redirects to the login/home page on a 401 Unauthorized response. Update this:

```typescript
// BEFORE — may have been routing to '/' or '/login'
axiosInstance.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      window.location.href = '/';
      // or: router.push('/login')
    }
    return Promise.reject(error);
  }
);

// AFTER
axiosInstance.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Clear stored auth token
      localStorage.removeItem('fedright_token');
      // Redirect to login, preserving the current path for post-login redirect
      const currentPath = window.location.pathname;
      window.location.href = `/login?redirect=${encodeURIComponent(currentPath)}`;
    }
    return Promise.reject(error);
  }
);
```

---

## 8. AuthGate Behavior Change

### 8.1 Current Behavior (TO BE REPLACED)

The current `AuthGate` component renders the `LoginPage` component inline when the user is not authenticated. This approach has two problems:

1. **UX problem:** The login UI appears at whatever URL the user was attempting to visit (e.g., showing a login form at `/app/meal-plan`), which is confusing and makes the URL meaningless
2. **Navigation problem:** After login, the user remains at the confusing URL instead of being explicitly routed to the app home

### 8.2 New Behavior

The new `AuthGate` must:

1. **On mount:** Read the auth token from `localStorage` (key: `fedright_token`) or from the auth context state
2. **While auth status is loading** (initial indeterminate state before the token is checked): Render a full-screen loading spinner. This prevents any flash of either the login redirect or the protected content.
3. **If not authenticated:** Redirect to `/login?redirect=[current-path]` using `router.push()`. Store the intended URL in the query param so the login page can redirect back after successful login.
4. **If authenticated:** Render children normally

### 8.3 New AuthGate Implementation Pattern

```typescript
// frontend/src/components/auth/AuthGate.tsx
'use client';

import { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuth } from '@/lib/AuthContext';
import LoadingSkeleton from '@/components/ui/LoadingSkeleton';

interface AuthGateProps {
  children: React.ReactNode;
}

export default function AuthGate({ children }: AuthGateProps) {
  const { isAuthenticated, isLoading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    // Don't redirect while auth state is still loading — wait for the check
    // to complete. Redirecting prematurely causes a flash of the login page
    // even for authenticated users (e.g., on hard refresh).
    if (isLoading) return;

    if (!isAuthenticated) {
      // Store the intended destination so login can redirect back to it.
      // encodeURIComponent prevents path injection issues.
      router.push(`/login?redirect=${encodeURIComponent(pathname)}`);
    }
  }, [isAuthenticated, isLoading, pathname, router]);

  // Show spinner while auth state is being determined.
  // This renders briefly on hard refresh while the stored token is being validated.
  if (isLoading) {
    return (
      <div
        className="flex items-center justify-center min-h-screen"
        style={{ backgroundColor: 'var(--bg-primary)' }}
      >
        <LoadingSkeleton size="lg" />
      </div>
    );
  }

  // If not authenticated, render nothing while the redirect is in progress.
  // The useEffect above has already initiated the router.push.
  if (!isAuthenticated) {
    return null;
  }

  // Authenticated — render the protected content
  return <>{children}</>;
}
```

### 8.4 Post-Login Redirect Flow

After a successful login in `/login/page.tsx`:

```typescript
// In the login form's onSubmit handler
const handleLoginSuccess = (token: string) => {
  // Store the auth token
  localStorage.setItem('fedright_token', token);

  // Check if there was an intended destination
  const redirectParam = searchParams.get('redirect');

  // Security: validate the redirect URL to prevent open redirect attacks.
  // Only allow redirects to internal /app/* paths. Any external URL or
  // non-/app path defaults to /app.
  const isValidRedirect = (url: string): boolean => {
    return url.startsWith('/app') && !url.startsWith('//') && !url.includes('://');
  };

  const destination =
    redirectParam && isValidRedirect(decodeURIComponent(redirectParam))
      ? decodeURIComponent(redirectParam)
      : '/app';

  router.push(destination);
};
```

**Open redirect security note:** The `isValidRedirect` check is critical. Without it, an attacker could craft a link like `/login?redirect=https://evil.com` and after a legitimate login, the user would be redirected to an attacker-controlled site. Always validate that redirect URLs are internal before using them.

---

## 9. Next.js Middleware

### 9.1 Location

`frontend/src/middleware.ts`

**This file does not exist yet and must be created.**

### 9.2 What Middleware Does vs What AuthGate Does

| Concern | Middleware | AuthGate |
|---------|-----------|----------|
| Execution environment | Edge runtime (before React renders) | Client-side React (after hydration) |
| When it runs | Every request to a matched path | On component mount in browser |
| Auth check method | Reads from request cookies (`fedright_token` cookie) | Reads from localStorage / React context |
| Redirect mechanism | `NextResponse.redirect()` | `router.push()` |
| Handles | Cold navigations, hard refresh, direct URL entry | Client-side navigation within the app |
| Protects against | Users who directly type a URL or follow a link | Client-side navigation that bypasses middleware |

**Important:** The middleware reads from a **cookie** (`fedright_token`), not localStorage. LocalStorage is not accessible in the Edge runtime. This requires that the auth token is stored in both localStorage (for client-side auth context reads) AND as a cookie (for middleware reads). The login/signup flow must set both when storing the auth token.

### 9.3 Token Storage Strategy

When a user logs in, the auth token must be persisted in two places:

```typescript
// In AuthContext.tsx login() function — store in BOTH places:

// 1. localStorage — for React auth context reads (client-side)
localStorage.setItem('fedright_token', token);

// 2. Cookie — for middleware reads (edge runtime)
// HttpOnly: false — must be readable by JS for axios Authorization headers
// SameSite: Strict — prevents CSRF attacks on this cookie
// Secure: true in production, false in development
// Max-Age: 30 days (same as token expiry)
document.cookie = `fedright_token=${token}; path=/; SameSite=Strict; Max-Age=${30 * 24 * 60 * 60}${process.env.NODE_ENV === 'production' ? '; Secure' : ''}`;
```

When a user logs out, clear both:

```typescript
// In AuthContext.tsx logout() function:
localStorage.removeItem('fedright_token');
document.cookie = 'fedright_token=; path=/; Max-Age=0';
```

### 9.4 Complete Middleware Implementation

```typescript
// frontend/src/middleware.ts
//
// Next.js Edge Middleware — Auth guard for /app/* routes
//
// This middleware runs at the Edge before any page renders. It provides
// the first line of defense against unauthenticated access to app routes.
// The AuthGate React component provides the second line of defense for
// client-side navigation.
//
// Token validation: The middleware only checks that the cookie EXISTS and
// is non-empty. Full JWT validation (signature, expiry) happens on the
// FastAPI backend when the token is used in API calls. Doing cryptographic
// JWT validation in Edge middleware would require the JWT secret as an
// environment variable accessible to the edge runtime, which adds complexity.
// The double-guard (middleware + AuthGate) means even if a user manipulates
// a cookie to pass middleware, their API calls will still fail on the backend.

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// Cookie key must match the key used in AuthContext.tsx login() function
const AUTH_COOKIE_KEY = 'fedright_token';

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Extract the auth token from cookies
  const token = request.cookies.get(AUTH_COOKIE_KEY)?.value;
  const isAuthenticated = Boolean(token && token.length > 0);

  // ── Guard: /app/* routes require authentication ──────────────────────
  // If user is not authenticated and trying to access /app or any sub-path:
  // Redirect to /login with the intended destination as a query param.
  if (pathname.startsWith('/app') && !isAuthenticated) {
    const loginUrl = new URL('/login', request.url);
    // Preserve the intended destination for post-login redirect
    loginUrl.searchParams.set('redirect', pathname);
    return NextResponse.redirect(loginUrl);
  }

  // ── Guard: /login and /signup redirect authenticated users ───────────
  // If user is already authenticated and visits /login or /signup,
  // redirect them to the app home. This prevents the "back button after
  // login shows the login form" problem.
  if ((pathname === '/login' || pathname === '/signup') && isAuthenticated) {
    return NextResponse.redirect(new URL('/app', request.url));
  }

  // All other routes (/, /login without auth, /signup without auth): allow through
  return NextResponse.next();
}

// Configure which paths this middleware runs on.
// Explicitly list the patterns rather than matching everything to avoid
// running middleware on static assets, images, and API routes.
export const config = {
  matcher: [
    // Match /app and all sub-paths
    '/app/:path*',
    // Match login and signup pages (for the "already authenticated" redirect)
    '/login',
    '/signup',
    // Explicitly exclude:
    // - Static files: /_next/static/*
    // - Image optimization: /_next/image/*
    // - Favicon and public assets: /favicon.ico, /fedright-logo-*
    // These exclusions are handled by the negative lookahead pattern below:
    '/((?!_next/static|_next/image|favicon.ico|fedright-logo).*)',
  ],
};
```

**Middleware matcher note:** The `config.matcher` array is the set of paths the middleware function is invoked on. The pattern above is intentionally broad (the last entry matches most paths). For production, benchmark whether running middleware on every request (minus static assets) has a measurable impact on Time To First Byte (TTFB). If it does, narrow the matcher to only `/app/:path*`, `/login`, and `/signup`.

---

## 10. next.config.ts Backward Compatibility Redirects

### 10.1 Purpose

Users who have bookmarked `/profile`, `/meal-plan`, or other old paths, and any external links pointing to old URLs, must not receive a 404 after the route restructuring. Next.js `redirects()` in `next.config.ts` handles this at the server level — the redirect happens before Next.js even renders a page.

### 10.2 Complete next.config.ts Update

```typescript
// frontend/next.config.ts
import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // ── Backward Compatibility Redirects ────────────────────────────────
  // Old app routes → new /app/* routes
  // permanent: true uses HTTP 308 (Permanent Redirect, method-preserving)
  // Search engines will update their indexes to point to the new URLs.
  // Browsers will cache the redirect and not request the old URL again.
  async redirects() {
    return [
      {
        source: '/profile',
        destination: '/app/profile',
        permanent: true,
      },
      {
        source: '/meal-plan',
        destination: '/app/meal-plan',
        permanent: true,
      },
      {
        source: '/tracking',
        destination: '/app/tracking',
        permanent: true,
      },
      {
        source: '/grocery',
        destination: '/app/grocery',
        permanent: true,
      },
      {
        source: '/chefs-view',
        destination: '/app/chefs-view',
        permanent: true,
      },
      {
        source: '/dashboard',
        destination: '/app/dashboard',
        permanent: true,
      },
      {
        source: '/settings',
        destination: '/app/settings',
        permanent: true,
      },
    ];
  },

  // Keep any existing next.config settings below this line (images, etc.)
};

export default nextConfig;
```

**Important:** After adding redirects, restart the Next.js dev server (`npm run dev`). Redirects are processed at startup and are not hot-reloaded.

---

## 11. Route Constants File

### 11.1 Why a Routes Constants File

Hardcoding route strings throughout the codebase creates a maintenance problem. When a route changes (as just happened with the entire `/app/*` prefix addition), every hardcoded string must be found and updated. The grep approach is error-prone — it is easy to miss a string in a template literal or ternary expression.

A central `ROUTES` constants object means route changes require a single edit in one file.

### 11.2 Implementation

```typescript
// frontend/src/lib/routes.ts
//
// Centralized route constants for all navigation in the FedRight app.
// Import ROUTES into any component that needs to navigate or generate links.
// NEVER hardcode route strings elsewhere in the codebase.
//
// Usage:
//   import { ROUTES } from '@/lib/routes';
//   <Link href={ROUTES.APP.PROFILE}>Profile</Link>
//   router.push(ROUTES.APP.MEAL_PLAN);

export const ROUTES = {
  // ── Public routes (no auth required) ──────────────────────────────
  PUBLIC: {
    /** Root public landing page */
    LANDING: '/',
    /** Login page — accepts ?redirect= query param */
    LOGIN: '/login',
    /** Signup/registration page */
    SIGNUP: '/signup',
  },

  // ── Authenticated app routes (/app/*) ──────────────────────────────
  APP: {
    /** App home / welcome dashboard — default post-login destination */
    HOME: '/app',
    /** User profile management */
    PROFILE: '/app/profile',
    /** Weekly meal plan view */
    MEAL_PLAN: '/app/meal-plan',
    /** Daily meal tracking */
    TRACKING: '/app/tracking',
    /** Smart grocery list */
    GROCERY: '/app/grocery',
    /** Chef's cooking view */
    CHEFS_VIEW: '/app/chefs-view',
    /** Analytics dashboard */
    DASHBOARD: '/app/dashboard',
    /** App settings and preferences */
    SETTINGS: '/app/settings',
  },
} as const;

// Type for app route values (useful for typed route params)
export type AppRoute = typeof ROUTES.APP[keyof typeof ROUTES.APP];
export type PublicRoute = typeof ROUTES.PUBLIC[keyof typeof ROUTES.PUBLIC];

// Helper: Construct login URL with redirect parameter
export const loginWithRedirect = (redirectTo: string): string => {
  return `${ROUTES.PUBLIC.LOGIN}?redirect=${encodeURIComponent(redirectTo)}`;
};
```

---

## 12. Post-Migration Verification Checklist

After completing all steps in this document, verify the following before marking the route restructuring complete.

### 12.1 URL Routing Verification

- [ ] `http://localhost:3000/` loads the public landing page (no auth required, no redirect)
- [ ] `http://localhost:3000/login` loads the dark login page
- [ ] `http://localhost:3000/signup` loads the dark signup page
- [ ] `http://localhost:3000/app` redirects to `/login?redirect=/app` when not authenticated
- [ ] `http://localhost:3000/app/profile` redirects to `/login?redirect=/app/profile` when not authenticated
- [ ] `http://localhost:3000/app/meal-plan` redirects to `/login?redirect=/app/meal-plan` when not authenticated
- [ ] After login, navigating to `http://localhost:3000/app` shows the authenticated app home
- [ ] After login, all 7 app pages load correctly at `/app/*` paths

### 12.2 Backward Compatibility Verification

- [ ] `http://localhost:3000/profile` redirects to `http://localhost:3000/app/profile` (308 status in Network tab)
- [ ] `http://localhost:3000/meal-plan` redirects to `http://localhost:3000/app/meal-plan`
- [ ] `http://localhost:3000/tracking` redirects to `http://localhost:3000/app/tracking`
- [ ] `http://localhost:3000/grocery` redirects to `http://localhost:3000/app/grocery`
- [ ] `http://localhost:3000/chefs-view` redirects to `http://localhost:3000/app/chefs-view`
- [ ] `http://localhost:3000/dashboard` redirects to `http://localhost:3000/app/dashboard`
- [ ] `http://localhost:3000/settings` redirects to `http://localhost:3000/app/settings`

### 12.3 Auth Flow Verification

- [ ] Not-authenticated user visiting `/app/meal-plan` is redirected to `/login?redirect=%2Fapp%2Fmeal-plan`
- [ ] After successful login on that `/login` page, user is redirected to `/app/meal-plan` (not just `/app`)
- [ ] Authenticated user visiting `/login` is immediately redirected to `/app`
- [ ] Authenticated user visiting `/signup` is immediately redirected to `/app`
- [ ] Logout clears the `fedright_token` cookie AND localStorage value
- [ ] After logout, navigating to `/app` redirects to `/login`
- [ ] Hard refreshing any `/app/*` page while authenticated keeps the user on that page (no spurious logout)

### 12.4 No Hardcoded Old Paths Remaining

Run these grep checks — any result is a bug that must be fixed:

```bash
grep -rn '"/profile"' frontend/src/
grep -rn '"/meal-plan"' frontend/src/
grep -rn '"/tracking"' frontend/src/
grep -rn '"/grocery"' frontend/src/
grep -rn '"/chefs-view"' frontend/src/
grep -rn '"/dashboard"' frontend/src/
grep -rn '"/settings"' frontend/src/
```

### 12.5 Console and Network Verification

- [ ] No 404 errors in browser DevTools Network tab for any page load
- [ ] No console errors related to routing or missing providers
- [ ] No CORS errors (backend API at :8000 still accessible from :3000)
- [ ] The root layout no longer imports `Sidebar`, `AuthGate`, or `ProfileProvider`

---

*End of Document — `spec/ui-redesign/05-route-restructuring.md`*
*Next: `spec/ui-redesign/06-app-dark-mode-redesign.md` — Component and page dark mode specs*
