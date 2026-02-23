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
//
// Why 'use client': AuthProviderWrapper and ProfileProvider are context providers
// that use useState/useEffect internally. AuthGate uses useRouter() for redirects.
// These client-only APIs require the 'use client' boundary on this layout.

'use client';

import { AuthProviderWrapper } from '@/components/auth/AuthProviderWrapper';
import AuthGate from '@/components/auth/AuthGate';
import { ProfileProvider } from '@/lib/ProfileContext';
import { Sidebar } from '@/components/layout/Sidebar';

export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AuthProviderWrapper>
      {/*
        AuthGate checks authentication status on mount. If the user is not
        authenticated, it redirects to /login?redirect=[current-path].
        While auth status is loading (initial token validation), it renders
        a full-screen loading spinner to prevent a flash of unauthenticated state.
      */}
      <AuthGate>
        <ProfileProvider>
          {/*
            Root flex container for the authenticated app shell.
            min-h-screen ensures the layout fills the viewport even on short pages.
            bg-[var(--bg-primary)] applies the dark background to the entire shell.
          */}
          <div
            className="flex min-h-screen"
            style={{ backgroundColor: 'var(--bg-primary)' }}
          >
            {/*
              Sidebar: fixed-position on desktop (lg+), slide-in drawer on mobile.
              Width: 256px (w-64) on desktop. On mobile, controlled by hamburger toggle.
            */}
            <Sidebar />

            {/*
              Main content area. Offset by sidebar width on large screens (lg:ml-64).
              On mobile (< lg), no left offset — sidebar overlays content as a drawer.

              overflow-x-hidden prevents horizontal scroll on pages with wide content.
              The inner wrapper preserves the max-width and padding from the original
              root layout to maintain consistent page layouts.
            */}
            <main
              className="flex-1 min-h-screen overflow-x-hidden lg:ml-64"
              style={{ backgroundColor: 'var(--bg-primary)' }}
            >
              <div className="mx-auto px-4 pt-16 pb-8 lg:px-8 lg:pt-8 max-w-7xl">
                {children}
              </div>
            </main>
          </div>
        </ProfileProvider>
      </AuthGate>
    </AuthProviderWrapper>
  );
}
