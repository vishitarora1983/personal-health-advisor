'use client';

// frontend/src/components/auth/GoogleAuthButton.tsx
//
// Thin wrapper around @react-oauth/google GoogleLogin component.
//
// This component is dynamically imported with ssr:false in auth pages to
// prevent prerendering errors. It also guards against missing GOOGLE_CLIENT_ID —
// when the env var is not set, it renders nothing (Google OAuth is optional).
//
// The GoogleLogin component MUST be rendered inside a GoogleOAuthProvider,
// which is provided by AuthProviderWrapper when the client ID is available.

import { GoogleLogin } from '@react-oauth/google';

interface GoogleAuthButtonProps {
  onSuccess: (credentialResponse: { credential?: string }) => void;
  onError?: () => void;
  text?: 'signin_with' | 'signup_with' | 'continue_with' | 'signin';
}

export default function GoogleAuthButton({
  onSuccess,
  onError,
  text = 'continue_with',
}: GoogleAuthButtonProps) {
  // Only render if the Google Client ID is configured.
  // Without it, AuthProviderWrapper skips GoogleOAuthProvider and the
  // GoogleLogin component would throw a context error.
  const googleClientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
  if (!googleClientId) return null;

  return (
    <div className="w-full flex justify-center">
      <GoogleLogin
        onSuccess={onSuccess}
        onError={onError}
        shape="rectangular"
        theme="filled_black"
        size="large"
        width="100%"
        text={text}
      />
    </div>
  );
}
