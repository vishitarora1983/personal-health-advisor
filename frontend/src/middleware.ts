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
import { ROUTES } from '@/lib/routes';

// Cookie key must match the key used in AuthContext.tsx login/setToken function.
// The auth token is stored in both localStorage (for client-side reads) and
// as a cookie (for edge middleware reads, since localStorage is unavailable at the edge).
const AUTH_COOKIE_KEY = 'fedright_token';

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Extract the auth token from cookies
  const token = request.cookies.get(AUTH_COOKIE_KEY)?.value;
  const isAuthenticated = Boolean(token && token.length > 0);

  // ── Guard: /app/* routes require authentication ──────────────────────
  // If user is not authenticated and trying to access /app or any sub-path:
  // Redirect to /login with the intended destination as a query param so
  // the login page can redirect back after successful authentication.
  if (pathname.startsWith('/app') && !isAuthenticated) {
    const loginUrl = new URL(ROUTES.PUBLIC.LOGIN, request.url);
    // Preserve the intended destination for post-login redirect
    loginUrl.searchParams.set('redirect', pathname);
    return NextResponse.redirect(loginUrl);
  }

  // ── Guard: /login and /signup redirect authenticated users ───────────
  // If user is already authenticated and visits /login or /signup,
  // redirect them to the app home. This prevents the "back button after
  // login shows the login form" UX problem.
  if ((pathname === ROUTES.PUBLIC.LOGIN || pathname === ROUTES.PUBLIC.SIGNUP) && isAuthenticated) {
    return NextResponse.redirect(new URL(ROUTES.APP.HOME, request.url));
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
  ],
};
