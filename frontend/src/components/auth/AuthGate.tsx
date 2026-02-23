'use client';

// frontend/src/components/auth/AuthGate.tsx
//
// AuthGate — React-level authentication guard for the /app/* route layout.
//
// This is the SECOND line of defense after the Next.js edge middleware.
// While middleware handles direct URL access and hard refreshes at the edge,
// AuthGate handles client-side navigation (e.g., a user on a public page
// who uses JS to navigate directly to /app/meal-plan without a full page load).
//
// Behavior:
//   1. Loading state — renders a full-screen spinner while auth check runs.
//      This prevents a flash of either the protected content or a redirect
//      on hard-refresh for authenticated users.
//   2. Not authenticated — clears any stale HttpOnly cookie via the backend
//      logout endpoint, then redirects to /login?redirect=[current-path].
//      The cookie clear is essential: without it, the edge middleware would
//      see the stale cookie, redirect /login back to /app, and create an
//      infinite redirect loop that manifests as a black screen.
//   3. Authenticated — renders children normally.

import { useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/lib/AuthContext';
import { loginWithRedirect } from '@/lib/routes';

interface AuthGateProps {
  children: React.ReactNode;
}

export default function AuthGate({ children }: AuthGateProps) {
  const { isAuthenticated, isLoading } = useAuth();
  const pathname = usePathname();
  // Guard against firing the redirect multiple times (React strict mode
  // double-invokes effects in dev, and the async logout could race).
  const redirectingRef = useRef(false);

  useEffect(() => {
    if (isLoading) return;
    if (isAuthenticated) return;
    if (redirectingRef.current) return;
    redirectingRef.current = true;

    // Clear any stale HttpOnly fedright_token cookie by calling the backend
    // logout endpoint. Without this, the edge middleware sees the cookie and
    // redirects /login → /app, creating an infinite loop.
    const apiBase =
      process.env.NEXT_PUBLIC_API_URL?.replace('/api/v1', '') ||
      'http://localhost:8000';
    fetch(`${apiBase}/api/v1/auth/logout`, {
      method: 'POST',
      credentials: 'include',
    })
      .catch(() => {})
      .finally(() => {
        // Use window.location (full navigation) instead of router.push
        // so the middleware re-evaluates the now-cleared cookie state.
        window.location.href = loginWithRedirect(pathname);
      });
  }, [isAuthenticated, isLoading, pathname]);

  // Show a full-screen loading indicator while auth state is being determined.
  // This renders briefly on hard refresh while the stored token is being validated.
  if (isLoading) {
    return (
      <div
        className="flex items-center justify-center min-h-screen"
        style={{ backgroundColor: 'var(--bg-primary)' }}
      >
        {/* Spinner: brand-green ring, matches spec Section 5.1 */}
        <div
          className="w-10 h-10 rounded-full border-2 animate-spin"
          style={{
            borderColor: 'var(--surface-border)',
            borderTopColor: 'var(--brand-green)',
          }}
        />
      </div>
    );
  }

  // If not authenticated, render nothing while the redirect is in progress.
  // The useEffect above has already initiated the router.push to /login.
  if (!isAuthenticated) {
    return null;
  }

  // Authenticated — render the protected content
  return <>{children}</>;
}

// Named export for backward compatibility with any code that imports { AuthGate }
export { AuthGate };
