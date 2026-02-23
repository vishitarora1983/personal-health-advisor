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

// Helper: Construct login URL with redirect parameter.
// Used when redirecting unauthenticated users to login while preserving
// their intended destination for post-login redirect.
export const loginWithRedirect = (redirectTo: string): string => {
  return `${ROUTES.PUBLIC.LOGIN}?redirect=${encodeURIComponent(redirectTo)}`;
};
