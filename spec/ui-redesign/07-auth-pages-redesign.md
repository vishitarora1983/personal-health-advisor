# FedRight — Authentication Pages Redesign Specification
## Document: `07-auth-pages-redesign.md`
## Version: 1.0 | Date: 2026-02-20
## Status: APPROVED FOR IMPLEMENTATION
## Prerequisites: `01-brand-design-system.md` and `05-route-restructuring.md` must be implemented first

---

## Table of Contents

1. [Overview](#1-overview)
2. [Login Page (`/login`)](#2-login-page-login)
3. [Signup Page (`/signup`)](#3-signup-page-signup)
4. [Auth Flow Diagram](#4-auth-flow-diagram)
5. [AuthGate Changes](#5-authgate-changes)
6. [Form Validation Specification](#6-form-validation-specification)
7. [Google OAuth Integration](#7-google-oauth-integration)
8. [Animation Specification](#8-animation-specification)
9. [AuthContext Updates](#9-authcontext-updates)
10. [Error Handling Scenarios](#10-error-handling-scenarios)
11. [Accessibility Requirements](#11-accessibility-requirements)
12. [Verification Checklist](#12-verification-checklist)

---

## 1. Overview

### 1.1 What We Are Building

Two new public pages that replace the current inline login form embedded inside `AuthGate.tsx`. The current implementation renders a login form directly within whatever authenticated route the user attempted to visit — this is a UX anti-pattern that breaks URL semantics, confuses the browser's back-button behavior, and prevents proper loading state differentiation.

The replacement is:
- **`/login`** — A full-page dark-themed login experience for returning users
- **`/signup`** — A full-page dark-themed registration flow for new users

Both pages are **public** (no authentication required to view them) and share a consistent visual language: a split-panel layout on desktop with a branded hero image on the left and the auth form on the right.

### 1.2 Current State to Remove

After implementing the new auth pages, the following must be cleaned up:

1. `AuthGate.tsx` — Remove the `<LoginPage />` render. Replace with a redirect to `/login` (per Section 5).
2. `LoginPage.tsx` (`frontend/src/components/auth/LoginPage.tsx`) — This component becomes obsolete. It should NOT be deleted immediately — mark it deprecated and remove only after confirming the new `/login` page is fully functional.
3. Any inline login UI rendered within the app layout shell.

### 1.3 Shared Layout Components

Both `/login` and `/signup` use the same split-panel layout structure. Extract the layout into a shared component to avoid duplication:

**`frontend/src/components/auth/AuthPageLayout.tsx`** — Handles the two-column shell, hero image panel, and branding. The form content is passed as children.

---

## 2. Login Page (`/login`)

### 2.1 File Location

`frontend/src/app/login/page.tsx`

### 2.2 Overall Page Layout

```
Page: min-h-screen, bg-[var(--bg-primary)], grid
Mobile (< lg):  Single column — form takes full width, no hero image
Desktop (≥ lg): Two columns — left: hero image panel (50%), right: form panel (50%)
```

```typescript
// Page-level grid container
const pageClasses = `
  min-h-screen
  grid
  grid-cols-1
  lg:grid-cols-2
`;
// Background: bg-[var(--bg-primary)]
```

### 2.3 Left Panel — Hero Image (Desktop Only)

The left panel is purely decorative and hidden on mobile. It reinforces the FedRight brand visually.

```typescript
// Left panel container
const heroPanelClasses = `
  hidden
  lg:block
  relative
  overflow-hidden
`;

// Background image — family/food photography
// File: /public/images/landing/hero-family-dinner.webp (from Phase 3 image generation)
// Fallback: Any available food/family image in /public/brand_assets/
// Applied via Next.js <Image> with fill and object-cover:
// <Image src="/images/landing/hero-family-dinner.webp" alt="" fill style={{ objectFit: 'cover' }} />

// Dark overlay gradient — ensures text on top is readable
// Applied as an absolutely positioned div over the image:
const heroOverlayClasses = `
  absolute
  inset-0
  z-10
`;
// inline style:
// background: 'linear-gradient(135deg, rgba(11, 13, 15, 0.85) 0%, rgba(11, 13, 15, 0.50) 60%, rgba(27, 139, 77, 0.15) 100%)'
// This creates a deep dark overlay at the top-left corner (where text lives)
// that fades to a subtle green tint at the bottom-right

// Content on top of the image (z-20 to be above the overlay)
const heroContentClasses = `
  absolute
  inset-0
  z-20
  flex
  flex-col
  justify-between
  p-10
`;
```

**Hero panel content layout (top to bottom):**

```typescript
// TOP: FedRight logo lockup
// <div className="flex items-center gap-3">
//   <Image src="/fedright-logo-gemini-v2.png" alt="FedRight" width={40} height={40} />
//   <span className="text-[var(--text-primary)] font-bold text-lg">FedRight</span>
// </div>

// MIDDLE: Tagline + decorative quote (vertically centered in the remaining space)
// <div className="flex-1 flex flex-col justify-center">
//   <h1 className="type-h2 text-[var(--text-primary)] mb-4 max-w-xs">
//     One Kitchen.<br />Every Body.<br />Perfectly Fed.
//   </h1>
//   <p className="text-[var(--text-secondary)] text-sm leading-relaxed max-w-xs">
//     AI-powered meal planning designed for the Indian household — every member, every need, one plan.
//   </p>
// </div>

// BOTTOM: Social proof or testimonial quote
// <blockquote className="border-l-2 border-[var(--brand-green)] pl-4">
//   <p className="text-[var(--text-secondary)] text-sm italic leading-relaxed">
//     "Finally, a meal plan that actually works for our whole family."
//   </p>
//   <cite className="text-[var(--text-muted)] text-xs mt-2 block not-italic">
//     — Priya S., Mumbai
//   </cite>
// </blockquote>
```

### 2.4 Right Panel — Login Form

```typescript
// Right panel container — vertically centered form
const formPanelClasses = `
  flex
  flex-col
  items-center
  justify-center
  px-8
  py-12
  lg:py-0
`;
// Background matches page: bg-[var(--bg-primary)]
// On mobile, the form panel IS the entire page

// Form card — max-width constrains the form content
const formCardClasses = `
  w-full
  max-w-md
`;
```

**Form panel structure (top to bottom):**

```typescript
// 1. Logo (mobile only — on desktop the logo is in the hero panel)
// Show only on mobile: <div className="flex items-center gap-2 mb-8 lg:hidden">
//   <Image src="/fedright-logo-gemini-v2.png" alt="FedRight" width={36} height={36} />
//   <span className="text-[var(--text-primary)] font-bold text-base">FedRight</span>
// </div>

// 2. Heading
// <h1 className="type-h3 text-[var(--text-primary)] mb-2">Welcome back</h1>
// <p className="text-[var(--text-secondary)] text-sm mb-8">Sign in to your account to continue.</p>

// 3. Form element (section 2.5 below)

// 4. Divider
// <div className="relative my-6">
//   <div className="absolute inset-0 flex items-center">
//     <div className="w-full border-t border-[var(--surface-border)]" />
//   </div>
//   <div className="relative flex justify-center text-xs">
//     <span className="px-3 bg-[var(--bg-primary)] text-[var(--text-muted)]">or continue with</span>
//   </div>
// </div>

// 5. Google OAuth button (section 2.6 below)

// 6. Footer link
// <p className="text-center text-sm text-[var(--text-secondary)] mt-6">
//   Don't have an account?{' '}
//   <Link href="/signup" className="text-[var(--brand-green-light)] font-medium hover:text-[var(--brand-green)] transition-colors duration-150">
//     Sign up for free
//   </Link>
// </p>
```

### 2.5 Login Form Fields

```typescript
// Form element
// <form onSubmit={handleSubmit} className="flex flex-col gap-5" noValidate>

// --- Email Field ---
// <div>
//   <label htmlFor="email" className="block text-[var(--text-secondary)] text-sm font-medium mb-1.5">
//     Email address
//   </label>
//   <input
//     id="email"
//     type="email"
//     autoComplete="email"
//     placeholder="you@example.com"
//     className="[...Input dark classes from 06-app-dark-mode-redesign.md Section 2.3...]"
//     value={email}
//     onChange={(e) => setEmail(e.target.value)}
//     aria-describedby={emailError ? "email-error" : undefined}
//     aria-invalid={!!emailError}
//   />
//   {emailError && (
//     <p id="email-error" className="text-[var(--color-error)] text-xs mt-1 flex items-center gap-1">
//       <AlertCircle className="w-3 h-3 flex-shrink-0" />
//       {emailError}
//     </p>
//   )}
// </div>

// --- Password Field ---
// <div>
//   <div className="flex items-center justify-between mb-1.5">
//     <label htmlFor="password" className="text-[var(--text-secondary)] text-sm font-medium">
//       Password
//     </label>
//     <Link
//       href="/forgot-password"
//       className="text-[var(--brand-green-light)] text-sm hover:text-[var(--brand-green)] transition-colors duration-150"
//     >
//       Forgot password?
//     </Link>
//   </div>
//   <div className="relative">
//     <input
//       id="password"
//       type={showPassword ? 'text' : 'password'}
//       autoComplete="current-password"
//       placeholder="••••••••"
//       className="[...Input dark classes...] pr-11"
//       value={password}
//       onChange={(e) => setPassword(e.target.value)}
//       aria-describedby={passwordError ? "password-error" : undefined}
//       aria-invalid={!!passwordError}
//     />
//     <button
//       type="button"
//       onClick={() => setShowPassword(!showPassword)}
//       className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)] hover:text-[var(--text-secondary)] transition-colors duration-150"
//       aria-label={showPassword ? 'Hide password' : 'Show password'}
//     >
//       {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
//     </button>
//   </div>
//   {passwordError && (
//     <p id="password-error" className="text-[var(--color-error)] text-xs mt-1 flex items-center gap-1">
//       <AlertCircle className="w-3 h-3 flex-shrink-0" />
//       {passwordError}
//     </p>
//   )}
// </div>

// --- Submit Button ---
// <button
//   type="submit"
//   disabled={isLoading}
//   className="w-full [primary Button classes from 06-app-dark-mode-redesign.md Section 2.1] py-3 text-base"
// >
//   {isLoading ? (
//     <span className="flex items-center justify-center gap-2">
//       <span className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
//       Signing in...
//     </span>
//   ) : (
//     'Sign In'
//   )}
// </button>
```

### 2.6 Google OAuth Button (Login)

```typescript
// Custom-styled Google OAuth button
// The @react-oauth/google GoogleLogin component renders its own button,
// which cannot be fully styled. Use useGoogleLogin hook instead to trigger
// the OAuth flow and render a completely custom button.

// Custom Google button styling
const googleButtonClasses = `
  w-full
  flex
  items-center
  justify-center
  gap-3
  px-4
  py-3
  rounded-[var(--radius-md)]
  bg-transparent
  border
  border-[rgba(255,255,255,0.10)]
  text-[var(--text-primary)]
  text-sm
  font-medium
  transition-all
  duration-150
  hover:bg-[rgba(255,255,255,0.05)]
  hover:border-[rgba(255,255,255,0.18)]
  active:bg-[rgba(255,255,255,0.03)]
  focus-visible:outline-2
  focus-visible:outline-[var(--brand-green)]
  focus-visible:outline-offset-2
`;

// Google logo SVG icon (inline, 20×20)
// The Google G logo uses 4 specific colors and must be the official Google SVG.
// Use the SVG from: https://developers.google.com/identity/branding-guidelines
// className="w-5 h-5 flex-shrink-0"

// Button text: "Continue with Google"
```

**useGoogleLogin hook integration:**

```typescript
import { useGoogleLogin } from '@react-oauth/google';

const handleGoogleLogin = useGoogleLogin({
  onSuccess: async (tokenResponse) => {
    try {
      setIsLoading(true);
      // Exchange the Google OAuth access token for a FedRight JWT
      // The backend /api/auth/google endpoint accepts the Google access token
      // and returns a FedRight-signed JWT
      const response = await api.googleLogin(tokenResponse.access_token);
      handleAuthSuccess(response.data.token);
    } catch (error) {
      showToast({ type: 'error', title: 'Sign in failed', message: 'Google sign in failed. Please try again.' });
    } finally {
      setIsLoading(false);
    }
  },
  onError: () => {
    showToast({ type: 'error', title: 'Sign in failed', message: 'Google sign in was cancelled or failed.' });
  },
});
```

### 2.7 Complete Login Page State

```typescript
// State variables for the login page
const [email, setEmail] = useState('');
const [password, setPassword] = useState('');
const [showPassword, setShowPassword] = useState(false);
const [isLoading, setIsLoading] = useState(false);
const [emailError, setEmailError] = useState('');
const [passwordError, setPasswordError] = useState('');

// After successful login (both email/password and Google OAuth):
const handleAuthSuccess = (token: string) => {
  // 1. Persist token (see 05-route-restructuring.md Section 9.3 for dual storage)
  localStorage.setItem('fedright_token', token);
  document.cookie = `fedright_token=${token}; path=/; SameSite=Strict; Max-Age=${30 * 24 * 60 * 60}`;

  // 2. Notify auth context
  login(token);  // updates AuthContext state

  // 3. Redirect to intended destination (or /app as default)
  const redirectParam = searchParams.get('redirect');
  const isValidRedirect = (url: string) => url.startsWith('/app') && !url.includes('://');
  const destination = redirectParam && isValidRedirect(decodeURIComponent(redirectParam))
    ? decodeURIComponent(redirectParam)
    : '/app';
  router.push(destination);
};
```

---

## 3. Signup Page (`/signup`)

### 3.1 File Location

`frontend/src/app/signup/page.tsx`

### 3.2 Layout

Identical split-panel layout to the login page. Reuse `AuthPageLayout` component.

**Hero panel difference:** The left panel tagline changes to an onboarding-focused message:

```typescript
// Hero content for signup page (replaces login hero content)
// Heading: "Start your family's health journey."
// Subtitle: "Join thousands of Indian families eating smarter, together."
// Bottom quote: Different testimonial — e.g., "Set up in minutes. Meal plans for the whole week."
```

### 3.3 Signup Form Fields

The signup form has 4 fields vs login's 2. The form is slightly taller — on mobile, ensure the page scrolls comfortably.

```typescript
// Form: <form onSubmit={handleSubmit} className="flex flex-col gap-5" noValidate>

// --- Full Name ---
// <div>
//   <label htmlFor="name">Full Name</label>
//   <input
//     id="name"
//     type="text"
//     autoComplete="name"
//     placeholder="Priya Sharma"
//     ...
//   />
//   {nameError && <error message>}
// </div>

// --- Email ---
// Same as login page email field

// --- Password ---
// Same as login page password field
// Remove the "Forgot password?" link (not relevant on signup)
// Add password strength indicator below the input (see Section 3.4)

// --- Confirm Password ---
// <div>
//   <label htmlFor="confirmPassword">Confirm Password</label>
//   <div className="relative">
//     <input
//       id="confirmPassword"
//       type={showConfirmPassword ? 'text' : 'password'}
//       autoComplete="new-password"
//       placeholder="••••••••"
//       ...
//     />
//     <button type="button" onClick={() => setShowConfirmPassword(...)}>
//       <Eye /> / <EyeOff />
//     </button>
//   </div>
//   {confirmPasswordError && <error message>}
// </div>

// --- Submit Button ---
// <button type="submit" disabled={isLoading} className="w-full primary ...">
//   {isLoading ? (
//     <span>...<LoadingSpinner />Creating account...</span>
//   ) : (
//     'Create Account'
//   )}
// </button>
```

### 3.4 Password Strength Indicator

A visual indicator below the password field on the signup page only (not on login).

```typescript
// Password strength is calculated as score 0-4 based on:
// +1 for length >= 8
// +1 for uppercase letters
// +1 for numbers
// +1 for special characters

const getPasswordStrength = (password: string): { score: number; label: string } => {
  if (!password) return { score: 0, label: '' };
  let score = 0;
  if (password.length >= 8) score++;
  if (/[A-Z]/.test(password)) score++;
  if (/[0-9]/.test(password)) score++;
  if (/[^A-Za-z0-9]/.test(password)) score++;
  const labels = ['', 'Weak', 'Fair', 'Good', 'Strong'];
  return { score, label: labels[score] };
};

// Strength bar — 4 segments, fill color changes by strength
// Rendered below the password field, only when password.length > 0:
// <div className="mt-2 flex gap-1">
//   {[1, 2, 3, 4].map((level) => (
//     <div
//       key={level}
//       className={`h-1 flex-1 rounded-full transition-colors duration-300 ${
//         level <= strength.score
//           ? strength.score <= 1 ? 'bg-[var(--color-error)]'
//           : strength.score === 2 ? 'bg-[var(--brand-amber)]'
//           : 'bg-[var(--color-success)]'
//           : 'bg-[var(--surface-border)]'
//       }`}
//     />
//   ))}
//   <span className="text-[var(--text-muted)] text-xs ml-2 min-w-[40px]">
//     {strength.label}
//   </span>
// </div>
```

### 3.5 Terms and Privacy Notice

A brief text line below the submit button acknowledging ToS. Not a checkbox — just an informational notice.

```typescript
// <p className="text-[var(--text-muted)] text-xs text-center mt-2 leading-relaxed">
//   By creating an account, you agree to our{' '}
//   <a href="/terms" className="text-[var(--brand-green-light)] hover:text-[var(--brand-green)] transition-colors">
//     Terms of Service
//   </a>{' '}
//   and{' '}
//   <a href="/privacy" className="text-[var(--brand-green-light)] hover:text-[var(--brand-green)] transition-colors">
//     Privacy Policy
//   </a>
//   .
// </p>
```

### 3.6 Post-Signup Redirect

After successful account creation:

```typescript
// Signup success handler
const handleSignupSuccess = (token: string) => {
  // Store token (same dual-storage as login)
  localStorage.setItem('fedright_token', token);
  document.cookie = `fedright_token=${token}; path=/; SameSite=Strict; Max-Age=${30 * 24 * 60 * 60}`;

  // Notify auth context
  login(token);

  // New users go to /app/profile (not /app home) to create their first profile.
  // This is the most important step in onboarding — without a profile, no meal
  // plans can be generated.
  router.push(ROUTES.APP.PROFILE);

  // Show a welcoming toast (will be visible on the profile page after redirect)
  // Toast is queued here; it renders after navigation completes
  showToast({
    type: 'success',
    title: 'Welcome to FedRight!',
    message: 'Let\'s set up your first profile to get personalized meal plans.',
  });
};
```

### 3.7 Footer Link (Signup → Login)

```typescript
// <p className="text-center text-sm text-[var(--text-secondary)] mt-6">
//   Already have an account?{' '}
//   <Link href="/login" className="text-[var(--brand-green-light)] font-medium hover:text-[var(--brand-green)] transition-colors duration-150">
//     Sign in
//   </Link>
// </p>
```

---

## 4. Auth Flow Diagram

### 4.1 Complete User Journey Map

```
UNAUTHENTICATED VISITOR
│
├─── Visits "/"  ──────────────────────────────────► Public Landing Page
│        │
│        ├── Clicks "Get Started Free" ──────────── ► /signup
│        └── Clicks "Log In" ───────────────────── ► /login
│
├─── Visits "/login" directly ──────────────────── ► /login page
│        │
│        └── Already authenticated? ──── Yes ─────► redirect to /app
│
├─── Visits "/signup" directly ─────────────────── ► /signup page
│        │
│        └── Already authenticated? ──── Yes ─────► redirect to /app
│
└─── Visits "/app/meal-plan" (or any /app/* path)
         │
         ├── Middleware check: has fedright_token cookie?
         │       │
         │       ├── No token ────────────────────► redirect to /login?redirect=/app/meal-plan
         │       │                                      │
         │       │                                      └── After login → redirect back to /app/meal-plan
         │       │
         │       └── Token present ──────────────► Allow request through
         │                                              │
         │                                              └── AuthGate (React-level):
         │                                                    - isLoading? → Show spinner
         │                                                    - isAuthenticated? → Render page
         │                                                    - Not authenticated? → redirect /login
         │
         └── Authenticated page renders normally

AUTHENTICATED USER
│
├─── Visits "/login" ───────────────────────────── ► Middleware: redirect to /app
├─── Visits "/signup" ──────────────────────────── ► Middleware: redirect to /app
├─── Visits "/app" ─────────────────────────────── ► App Home renders
└─── Logs Out:
         1. Clear localStorage 'fedright_token'
         2. Clear cookie 'fedright_token'
         3. Call auth context logout()
         4. router.push('/') (landing page, not /login)
```

### 4.2 Logout Destination

After logout, redirect to `/` (the landing page), NOT `/login`. Redirecting to `/login` after logout creates a confusing loop where the user immediately sees a login prompt. Redirecting to the landing page gives users a "fresh start" feeling and also serves as marketing reinforcement.

---

## 5. AuthGate Changes

### 5.1 What Changes and Why

**Current behavior (TO BE REMOVED):**

```typescript
// OLD AuthGate — DO NOT KEEP THIS
export default function AuthGate({ children }) {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) return <LoadingSpinner />;

  // PROBLEM: This renders the login form at whatever URL the user is on
  // e.g., the form appears at /app/meal-plan, which makes no sense
  if (!isAuthenticated) return <LoginPage />;

  return <>{children}</>;
}
```

**New behavior (per `05-route-restructuring.md` Section 8):**

```typescript
// NEW AuthGate — REDIRECT INSTEAD OF RENDER
'use client';

import { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuth } from '@/lib/AuthContext';

export default function AuthGate({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (isLoading) return;
    if (!isAuthenticated) {
      router.push(`/login?redirect=${encodeURIComponent(pathname)}`);
    }
  }, [isAuthenticated, isLoading, pathname, router]);

  // Full-screen dark spinner while auth state loads
  if (isLoading) {
    return (
      <div
        className="flex items-center justify-center min-h-screen"
        style={{ backgroundColor: 'var(--bg-primary)' }}
      >
        {/* Spinner: 40px, border-[var(--surface-border)], border-t-[var(--brand-green)], animate-spin */}
        <div className="w-10 h-10 rounded-full border-2 border-[var(--surface-border)] border-t-[var(--brand-green)] animate-spin" />
      </div>
    );
  }

  if (!isAuthenticated) return null;

  return <>{children}</>;
}
```

### 5.2 Transition: Deprecating LoginPage.tsx

1. Mark `frontend/src/components/auth/LoginPage.tsx` as deprecated with a JSDoc comment
2. Remove the import from `AuthGate.tsx`
3. After confirming `/login` page works end-to-end: delete `LoginPage.tsx`
4. The new login logic lives exclusively in `frontend/src/app/login/page.tsx`

---

## 6. Form Validation Specification

### 6.1 Validation Rules

| Field | Rule | Error Message |
|-------|------|---------------|
| **Name** (signup) | Required, min 2 chars, max 80 chars | "Name is required" / "Name must be at least 2 characters" |
| **Email** | Required, valid email format (RFC 5322 simplified) | "Email address is required" / "Please enter a valid email address" |
| **Password** | Required, min 8 chars | "Password is required" / "Password must be at least 8 characters" |
| **Confirm Password** (signup) | Required, must match password | "Please confirm your password" / "Passwords do not match" |

### 6.2 Validation Timing

**When to validate:**

| Event | Action |
|-------|--------|
| Field `onBlur` | Validate that single field, show error if invalid |
| Form `onSubmit` | Validate all fields simultaneously, prevent submit if any error |
| Field `onChange` | ONLY clear the error for that field if it was previously showing an error (do not re-validate eagerly while typing — this is aggressive and annoying) |

**Rationale for onBlur vs onChange validation:**
- Validating on every keystroke (onChange) shows red errors while the user is still typing their email address — this is poor UX
- Validating only on submit means errors appear all at once, which can be jarring for forms with 4+ fields
- The onBlur approach is the industry standard: validate when the user leaves a field (indicating they think they're done with it)

### 6.3 Email Validation Function

```typescript
// Simplified RFC 5322 validation — covers 99.9% of real email addresses.
// Deliberately does not reject unusual-but-valid formats (e.g., user+tag@example.com).
// The backend will perform authoritative validation; this is just UX feedback.
const isValidEmail = (email: string): boolean => {
  // Must have: local part @ domain.tld
  // Local part: alphanumeric + . _ + - % symbols
  // Domain: alphanumeric + - (hyphens)
  // TLD: 2-6 alpha characters
  const emailRegex = /^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,6}$/;
  return emailRegex.test(email.trim());
};
```

### 6.4 Validation Hook

Extract validation logic into a reusable hook to keep the page components clean:

```typescript
// frontend/src/hooks/useAuthForm.ts

interface LoginFormState {
  email: string;
  password: string;
}

interface SignupFormState extends LoginFormState {
  name: string;
  confirmPassword: string;
}

interface FormErrors {
  name?: string;
  email?: string;
  password?: string;
  confirmPassword?: string;
}

// Returns validate function and clearFieldError function
export const useAuthFormValidation = () => {
  const validateLogin = (values: LoginFormState): FormErrors => {
    const errors: FormErrors = {};
    if (!values.email.trim()) {
      errors.email = 'Email address is required';
    } else if (!isValidEmail(values.email)) {
      errors.email = 'Please enter a valid email address';
    }
    if (!values.password) {
      errors.password = 'Password is required';
    } else if (values.password.length < 8) {
      errors.password = 'Password must be at least 8 characters';
    }
    return errors;
  };

  const validateSignup = (values: SignupFormState): FormErrors => {
    const errors: FormErrors = validateLogin(values);
    if (!values.name.trim()) {
      errors.name = 'Name is required';
    } else if (values.name.trim().length < 2) {
      errors.name = 'Name must be at least 2 characters';
    }
    if (!values.confirmPassword) {
      errors.confirmPassword = 'Please confirm your password';
    } else if (values.confirmPassword !== values.password) {
      errors.confirmPassword = 'Passwords do not match';
    }
    return errors;
  };

  return { validateLogin, validateSignup };
};
```

### 6.5 Error Message Rendering

```typescript
// Error message component — inline below the field
// Only rendered when errorMessage is non-empty
const FieldError = ({ message, id }: { message: string; id: string }) => (
  <p
    id={id}
    role="alert"
    className="flex items-center gap-1 text-[var(--color-error)] text-xs mt-1"
  >
    <AlertCircle className="w-3 h-3 flex-shrink-0" aria-hidden="true" />
    {message}
  </p>
);
```

**Error message animation (if framer-motion is available):**

```typescript
// Animated error message — height + opacity transition on mount
// <AnimatePresence>
//   {errorMessage && (
//     <motion.div
//       initial={{ opacity: 0, height: 0 }}
//       animate={{ opacity: 1, height: 'auto' }}
//       exit={{ opacity: 0, height: 0 }}
//       transition={{ duration: 0.15, ease: [0.16, 1, 0.3, 1] }}
//     >
//       <FieldError message={errorMessage} id={`${fieldId}-error`} />
//     </motion.div>
//   )}
// </AnimatePresence>
```

---

## 7. Google OAuth Integration

### 7.1 Existing Package

`@react-oauth/google` is already installed in `frontend/package.json`. No new package installation is required.

### 7.2 GoogleOAuthProvider Setup

The `GoogleOAuthProvider` must wrap the entire app so the Google OAuth context is available on both `/login` and `/signup` pages. Add it to the root `layout.tsx`:

```typescript
// frontend/src/app/layout.tsx — UPDATE (minor addition)
import { GoogleOAuthProvider } from '@react-oauth/google';

// Wrap ToastProvider (and children) with GoogleOAuthProvider:
// The GOOGLE_CLIENT_ID must be in .env.local as NEXT_PUBLIC_GOOGLE_CLIENT_ID
// NEXT_PUBLIC_ prefix makes it available in client-side code.
export default function RootLayout({ children }) {
  return (
    <html lang="en" className={inter.variable}>
      <body className="antialiased">
        <GoogleOAuthProvider clientId={process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID!}>
          <ToastProvider>
            {children}
          </ToastProvider>
        </GoogleOAuthProvider>
      </body>
    </html>
  );
}
```

**Environment variable note:** `NEXT_PUBLIC_GOOGLE_CLIENT_ID` must be set in `frontend/.env.local`. This is the OAuth 2.0 Client ID from Google Cloud Console (not the Client Secret — that lives on the backend only).

### 7.3 useGoogleLogin Hook Usage

```typescript
// Use the credential flow (ID token) rather than the token flow (access token)
// when the backend can validate Google ID tokens directly.
// Use the token flow if the backend exchanges the access token.
// Current FedRight backend implementation determines which to use.

// Option A: useGoogleLogin with token flow (access_token)
import { useGoogleLogin } from '@react-oauth/google';

const login = useGoogleLogin({
  onSuccess: (tokenResponse) => {
    // tokenResponse.access_token is the Google OAuth access token
    // Send to backend: POST /api/auth/google { access_token: tokenResponse.access_token }
    handleGoogleOAuthToken(tokenResponse.access_token);
  },
  onError: () => {
    showToast({ type: 'error', title: 'Google sign-in failed', message: 'Please try again or use email.' });
  },
});

// Call login() when the custom Google button is clicked:
// <button onClick={() => login()}>Continue with Google</button>
```

### 7.4 Backend Endpoint Contract

The backend must implement (or already implements via `backend/routers/auth.py`):

```
POST /api/auth/google
Content-Type: application/json

Request body:
{ "access_token": "<Google OAuth access token>" }

Success response (200):
{ "token": "<FedRight JWT>", "user": { "id": ..., "email": ..., "name": ... } }

Error responses:
401: Invalid or expired Google token
400: Missing access_token
500: Internal server error during Google token validation
```

**Verify this endpoint exists in `backend/routers/auth.py` before implementing the frontend Google OAuth flow.**

---

## 8. Animation Specification

### 8.1 Page Entry Animation

On mount, the right-side form panel content fades and slides up. This creates an elegant page entry that signals the form is interactive and ready.

**Without framer-motion (CSS approach):**

```typescript
// Apply .animate-slide-up and stagger classes to form sections on mount
// The .animate-slide-up class is defined in globals.css and plays once on element insert

// Structure:
// <div className="animate-fade-in">
//   <div className="animate-slide-up stagger-1">  {/* logo / heading */}
//   <div className="animate-slide-up stagger-2">  {/* email field */}
//   <div className="animate-slide-up stagger-3">  {/* password field */}
//   <div className="animate-slide-up stagger-4">  {/* submit button */}
//   <div className="animate-slide-up stagger-5">  {/* divider + google button */}
//   <div className="animate-slide-up stagger-6">  {/* footer link */}
```

**With framer-motion:**

```typescript
// Form stagger animation
const containerVariants = {
  hidden: {},
  visible: {
    transition: {
      staggerChildren: 0.06,
      delayChildren: 0.1,
    },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 16 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.4,
      ease: [0.16, 1, 0.3, 1],  // ease-out-expo
    },
  },
};

// Usage:
// <motion.div variants={containerVariants} initial="hidden" animate="visible">
//   <motion.div variants={itemVariants}><Heading /></motion.div>
//   <motion.div variants={itemVariants}><EmailField /></motion.div>
//   ...
// </motion.div>
```

### 8.2 Submit Button Hover/Tap Animation

```typescript
// framer-motion button wrapper
// <motion.button
//   type="submit"
//   whileHover={{ scale: 1.01 }}
//   whileTap={{ scale: 0.98 }}
//   transition={{ duration: 0.15, ease: [0.16, 1, 0.3, 1] }}
// >
//   Sign In
// </motion.button>

// Note: Keep scale changes very subtle (1.01 / 0.98).
// Larger scale changes (1.05 / 0.95) look exaggerated on full-width buttons.
```

### 8.3 Error Message Animation

See Section 6.5 for the AnimatePresence + height+opacity animation pattern.

**Visual requirements for error animation:**
- Duration: 150ms (--duration-fast)
- Easing: ease-out-expo
- Animate: height from 0 to auto, opacity from 0 to 1
- Exit: reverse (height to 0, opacity to 0) — the field error disappears smoothly when corrected

### 8.4 Loading State — Form Dimming

When `isLoading` is true (form is submitting):

```typescript
// Dim the entire form while the API call is in progress
// Applied to the <form> element wrapper:
// className={`transition-opacity duration-200 ${isLoading ? 'opacity-60 pointer-events-none' : 'opacity-100'}`}

// The submit button itself shows a spinner (see Section 2.5)
// The form dimming provides an additional visual cue that all interactions are disabled
```

### 8.5 Hero Panel Entrance (Desktop Only)

On desktop, the hero image panel animates in from the left on page load:

```typescript
// framer-motion:
// <motion.div
//   initial={{ opacity: 0, x: -20 }}
//   animate={{ opacity: 1, x: 0 }}
//   transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
// >
//   {/* Hero image + overlay + content */}
// </motion.div>

// CSS fallback (no framer-motion):
// <div className="animate-fade-in">
```

---

## 9. AuthContext Updates

### 9.1 Required AuthContext Changes

The `AuthContext` (`frontend/src/lib/AuthContext.tsx`) needs updates to support the new auth flow:

```typescript
// frontend/src/lib/AuthContext.tsx — UPDATES REQUIRED

// 1. The login() function must accept a token and update state
// 2. The logout() function must clear BOTH localStorage AND the cookie
// 3. The initial auth check on mount must handle missing cookie gracefully

interface AuthContextValue {
  isAuthenticated: boolean;
  isLoading: boolean;
  user: User | null;
  login: (token: string) => void;    // Called after successful login/signup
  logout: () => void;                 // Called on explicit logout
}

// Updated login() function
const login = useCallback((token: string) => {
  // Store in localStorage for client-side reads
  localStorage.setItem('fedright_token', token);

  // Store in cookie for middleware reads
  // Max-Age = 30 days in seconds
  const maxAge = 30 * 24 * 60 * 60;
  const secureFlag = process.env.NODE_ENV === 'production' ? '; Secure' : '';
  document.cookie = `fedright_token=${token}; path=/; SameSite=Strict; Max-Age=${maxAge}${secureFlag}`;

  // Decode the JWT to extract user info (client-side — no signature verification needed)
  // The backend API will reject invalid tokens; we just need the display data
  const userInfo = decodeJWTPayload(token);
  setUser(userInfo);
  setIsAuthenticated(true);
}, []);

// Updated logout() function
const logout = useCallback(() => {
  // Clear localStorage
  localStorage.removeItem('fedright_token');

  // Expire the cookie immediately
  document.cookie = 'fedright_token=; path=/; Max-Age=0; SameSite=Strict';

  // Reset state
  setUser(null);
  setIsAuthenticated(false);
}, []);

// JWT payload decoder (no signature verification — client-side only)
const decodeJWTPayload = (token: string): User | null => {
  try {
    const base64Payload = token.split('.')[1];
    const payload = JSON.parse(atob(base64Payload));
    return {
      id: payload.sub,
      email: payload.email,
      name: payload.name,
    };
  } catch {
    return null;
  }
};
```

### 9.2 Initial Auth Check on Mount

```typescript
// In AuthContext, the useEffect that checks initial auth state:
useEffect(() => {
  const token = localStorage.getItem('fedright_token');

  if (!token) {
    setIsLoading(false);
    return;
  }

  // Optional: Validate the token with the backend to ensure it hasn't expired.
  // If skipped, expired tokens will fail on the first API call, which triggers
  // the 401 handler in api.ts that redirects to /login.
  // For better UX (show fresh data on load), validate here:
  api.validateToken(token)
    .then((response) => {
      setUser(response.data.user);
      setIsAuthenticated(true);
    })
    .catch(() => {
      // Token is invalid or expired — clear it
      localStorage.removeItem('fedright_token');
      document.cookie = 'fedright_token=; path=/; Max-Age=0';
    })
    .finally(() => {
      setIsLoading(false);
    });
}, []);
```

---

## 10. Error Handling Scenarios

### 10.1 Network/API Errors

| Scenario | User-Facing Response |
|----------|---------------------|
| Backend is down (connection refused) | Error toast: "Unable to connect to the server. Please check your internet connection and try again." |
| Invalid credentials (401 from backend) | Inline: Show a general error below the submit button — NOT individual field errors (avoid confirming which field is wrong for security). Message: "Incorrect email or password. Please try again." |
| Account not found (404 from backend) | Same as invalid credentials (do not confirm the email doesn't exist — prevents account enumeration) |
| Rate limited (429 from backend) | Error toast: "Too many login attempts. Please wait a few minutes before trying again." |
| Server error (500 from backend) | Error toast: "Something went wrong on our end. Please try again in a moment." |
| Email already registered (409, signup) | Inline error below email field: "An account with this email already exists. Sign in instead?" — include a link to `/login` |
| Google OAuth popup blocked | Info toast: "Please allow pop-ups for this site to use Google sign in." |
| Google OAuth cancelled by user | Silent — no toast (user deliberately cancelled, no need to inform them) |

### 10.2 General Error Display Pattern

```typescript
// For general (non-field-specific) errors from the API:
// Render a dismissible error banner ABOVE the form, not inside field error areas.

const generalErrorClasses = `
  flex
  items-start
  gap-3
  p-4
  mb-5
  rounded-[var(--radius-md)]
  bg-[var(--color-error-bg)]
  border
  border-[rgba(229,83,75,0.20)]
  text-sm
`;
// Icon: XCircle className="w-5 h-5 text-[var(--color-error)] flex-shrink-0 mt-0.5"
// Message: text-[var(--color-error)]
// Dismiss button (optional): X icon button, absolute top-right

// Display condition: <AnimatePresence> with slide-down animation when generalError is set
```

---

## 11. Accessibility Requirements

### 11.1 ARIA Labels and Roles

```typescript
// Form element: aria-label
// <form aria-label="Sign in to FedRight">

// Each input: id + matching htmlFor on label (already specified in field examples above)

// Error messages: aria-describedby + aria-invalid
// <input aria-describedby="email-error" aria-invalid={!!emailError} />
// <p id="email-error" role="alert">{emailError}</p>
// role="alert" causes screen readers to announce the error immediately on appearance

// Submit button: descriptive aria-label when loading
// <button aria-label={isLoading ? 'Signing in, please wait' : 'Sign in'}>

// Show/hide password toggle: aria-label
// <button aria-label={showPassword ? 'Hide password' : 'Show password'}>

// Google button: aria-label
// <button aria-label="Continue with Google">
```

### 11.2 Keyboard Navigation

- All interactive elements must be reachable via Tab key
- Tab order: Logo → Email → Password → Show/Hide toggle → Forgot Password → Submit → Google OAuth → Footer link
- Enter key submits the form when focus is on any form field
- Escape key does NOT close the login page (it's a full page, not a modal)

### 11.3 Focus Management

After a failed form submission, focus must move to the first field with an error:

```typescript
// After validateAndSubmit finds errors, focus the first errored field:
if (errors.email) {
  document.getElementById('email')?.focus();
} else if (errors.password) {
  document.getElementById('password')?.focus();
}
```

After page load (on mount), focus the email input for immediate keyboard entry:

```typescript
// Auto-focus the email field on mount — improves keyboard and mobile UX
useEffect(() => {
  const emailInput = document.getElementById('email');
  // Small delay to allow page animations to complete before focusing
  const timer = setTimeout(() => emailInput?.focus(), 300);
  return () => clearTimeout(timer);
}, []);
```

---

## 12. Verification Checklist

After implementing both `/login` and `/signup` pages, verify the following:

### 12.1 Visual Verification

- [ ] Desktop: Two-column layout with hero image on left, form on right
- [ ] Mobile: Single-column layout, form takes full width, hero image hidden
- [ ] Hero panel: Dark overlay creates readable contrast over the background image
- [ ] FedRight v2 logo appears in hero panel (desktop) and above form (mobile)
- [ ] All form fields use dark Input styling (bg-[var(--bg-input)])
- [ ] Error messages appear in red (var(--color-error)) below the relevant field
- [ ] Submit button uses primary green styling
- [ ] Google OAuth button uses dark border style (not the default Google blue button)
- [ ] Loading state: button shows spinner, form is dimmed and non-interactive
- [ ] Password show/hide toggle is visible and functional

### 12.2 Functional Verification

- [ ] Successful login redirects to `/app` (or the `?redirect` param destination)
- [ ] Successful signup redirects to `/app/profile` with a welcome toast
- [ ] Invalid credentials show the general error message (not a toast, not an alert dialog)
- [ ] Email validation triggers on blur (not on keystroke)
- [ ] Password strength indicator updates in real-time as password is typed (signup only)
- [ ] "Forgot password?" link navigates to `/forgot-password` (page can be a stub)
- [ ] "Sign up for free" link on login navigates to `/signup`
- [ ] "Sign in" link on signup navigates to `/login`
- [ ] Google OAuth flow opens the Google consent screen
- [ ] After Google OAuth success, user is logged in and redirected to `/app`
- [ ] Pressing Enter while focus is in a form field submits the form
- [ ] Tab order is correct across all interactive elements

### 12.3 Auth Flow Verification

- [ ] Authenticated user visiting `/login` is immediately redirected to `/app`
- [ ] Unauthenticated user visiting `/app/meal-plan` is redirected to `/login?redirect=%2Fapp%2Fmeal-plan`
- [ ] After logging in from that `/login` URL, user is redirected to `/app/meal-plan`
- [ ] Logout clears the token cookie and localStorage, then redirects to `/`
- [ ] After logout, revisiting `/app` redirects back to `/login`
- [ ] Hard refresh on `/app/profile` while authenticated keeps the user on that page (no redirect loop)

### 12.4 Accessibility Verification

- [ ] Tab through entire login form using keyboard only — all elements reachable in logical order
- [ ] Error messages are announced by screen reader (use browser accessibility inspector)
- [ ] Submit button label changes to "Signing in, please wait" during loading (for screen readers)
- [ ] Password show/hide button has descriptive aria-label
- [ ] Email auto-focuses on page load

---

*End of Document — `spec/ui-redesign/07-auth-pages-redesign.md`*
*Previous: `spec/ui-redesign/06-app-dark-mode-redesign.md`*
*See also: `spec/ui-redesign/05-route-restructuring.md` for middleware and AuthGate implementation details*
