'use client';

import React from 'react';
import { GoogleOAuthProvider } from '@react-oauth/google';
import { AuthProvider } from '@/lib/AuthContext';

export function AuthProviderWrapper({ children }: { children: React.ReactNode }) {
  const googleClientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;

  const inner = <AuthProvider>{children}</AuthProvider>;

  if (googleClientId) {
    return (
      <GoogleOAuthProvider clientId={googleClientId}>
        {inner}
      </GoogleOAuthProvider>
    );
  }

  return inner;
}
