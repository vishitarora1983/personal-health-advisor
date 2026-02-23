'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { getMe } from '@/lib/api';
import type { AuthUser } from '@/types';

interface AuthContextValue {
  user: AuthUser | null;
  // Retained as 'loading' for backward compatibility with existing consumers.
  // Also exposed as 'isLoading' for the new AuthGate pattern.
  loading: boolean;
  isLoading: boolean;
  isAuthenticated: boolean;
  setToken: (token: string) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

// localStorage key for the auth token.
// Used only for the SPA Authorization header; the authoritative HttpOnly cookie
// (fedright_token) is managed exclusively by the backend.
const TOKEN_KEY = 'auth_token';

/**
 * Cookie name that the Next.js edge middleware reads for route protection.
 * This cookie is now set server-side (HttpOnly) by the backend on every
 * successful login/signup, so client JavaScript cannot write or read it.
 * We keep this constant only as a reference for documentation purposes.
 */
// const COOKIE_NAME = 'fedright_token'; // set server-side — do not touch from JS

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  const logout = useCallback(() => {
    // Clear the localStorage token used for the SPA Authorization header.
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem('activeProfileId');

    // Ask the backend to clear the HttpOnly fedright_token cookie.
    // This is fire-and-forget: we do NOT await it so the local React state
    // reset and navigation are instant. The backend endpoint is idempotent
    // (always returns 200), so a transient network failure is acceptable here.
    const apiBase =
      process.env.NEXT_PUBLIC_API_URL?.replace('/api/v1', '') ||
      'http://localhost:8000';
    fetch(`${apiBase}/api/v1/auth/logout`, {
      method: 'POST',
      credentials: 'include', // send existing cookies so the server can clear them
    }).catch(() => {
      // Intentionally swallow the error — the localStorage token is already
      // removed, so the user is effectively logged out of the SPA.
    });

    setUser(null);

    // Use window.location.href instead of router.push so this works regardless
    // of whether we are inside a React tree (e.g. called from the auth:logout
    // event listener). The full navigation also resets all in-memory React state.
    window.location.href = '/';
  }, []);

  const setToken = useCallback((token: string) => {
    // Persist in localStorage for client-side auth context reads and the
    // axios Authorization header.  The HttpOnly cookie is set by the backend
    // in the login/signup response — we must NOT try to set it from JS.
    localStorage.setItem(TOKEN_KEY, token);

    // Validate token immediately by fetching user info
    getMe()
      .then(setUser)
      .catch(() => {
        localStorage.removeItem(TOKEN_KEY);
        setUser(null);
      });
  }, []);

  // On mount: check for existing token in localStorage and re-validate with the server.
  // This handles the case where the user hard-refreshes the page while authenticated.
  useEffect(() => {
    const token = localStorage.getItem(TOKEN_KEY);
    if (token) {
      // The HttpOnly cookie is maintained by the backend across sessions; we
      // only need to re-validate the token to restore the React user state.
      getMe()
        .then(setUser)
        .catch(() => {
          localStorage.removeItem(TOKEN_KEY);
          setUser(null);
        })
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []);

  // Listen for 401 logout events from the axios interceptor (api.ts).
  // When an API call fails with 401, the interceptor dispatches this event
  // to signal that the stored token is no longer valid.
  useEffect(() => {
    const handler = () => logout();
    window.addEventListener('auth:logout', handler);
    return () => window.removeEventListener('auth:logout', handler);
  }, [logout]);

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        isLoading: loading,
        isAuthenticated: !!user,
        setToken,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
