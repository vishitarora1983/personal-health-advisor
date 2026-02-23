'use client';

// frontend/src/app/login/page.tsx
//
// PUBLIC LOGIN PAGE (/login)
//
// Dark-themed, split-panel login experience.
// Preserves all existing auth logic: login(), setToken(), googleLogin().
// Reads ?redirect= param to restore the user's intended destination post-login.

import React, { useState, useEffect, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Suspense } from 'react';
import dynamic from 'next/dynamic';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { Eye, EyeOff, XCircle } from 'lucide-react';

import { AuthProviderWrapper } from '@/components/auth/AuthProviderWrapper';
import { AuthPageLayout } from '@/components/auth/AuthPageLayout';
import { useAuth } from '@/lib/AuthContext';
import { login as apiLogin, googleLogin as apiGoogleLogin } from '@/lib/api';
import { useToast } from '@/components/ui/Toast';
import { useAuthFormValidation, type FormErrors } from '@/hooks/useAuthForm';
import { ROUTES } from '@/lib/routes';
import { FieldError } from '@/components/auth/FieldError';
import {
  containerVariants,
  itemVariants,
  errorVariants,
  inputClasses,
  inputStyle,
} from '@/components/auth/authFormConstants';

// Dynamically import the Google OAuth button with ssr:false to prevent
// prerendering errors — GoogleOAuthProvider is not available during SSG.
const GoogleAuthButton = dynamic(
  () => import('@/components/auth/GoogleAuthButton'),
  { ssr: false, loading: () => <div className="h-10" /> }
);

// ── Hero content for the login page ─────────────────────────────────────────
const LOGIN_HERO = {
  heading: (
    <>
      One Kitchen.<br />
      Every Body.<br />
      Perfectly Fed.
    </>
  ),
  subtitle:
    'AI-powered meal planning designed for the Indian household — every member, every need, one plan.',
  quoteText: 'Finally, a meal plan that actually works for our whole family.',
  quoteCite: '— Priya S., Mumbai',
};

// ── Inline Google button wrapper ─────────────────────────────────────────────
// GoogleLogin renders its own iframe-button. We overlay a transparent custom
// button on top to intercept clicks while the real button handles the OAuth flow.
// The GoogleLogin component is rendered at 0-opacity so it still receives clicks.

// ── Login form ───────────────────────────────────────────────────────────────
function LoginForm() {
  const { setToken, isAuthenticated } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const toast = useToast();
  const { validateLogin } = useAuthFormValidation();
  // Respect the OS-level "Reduce Motion" accessibility preference.
  const shouldReduceMotion = useReducedMotion();

  // Only show Google OAuth section if the client ID is configured
  const hasGoogleClientId = !!process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState<FormErrors>({});
  const [generalError, setGeneralError] = useState('');

  const emailRef = useRef<HTMLInputElement>(null);

  // Auto-focus email on mount (small delay to allow animations to complete)
  useEffect(() => {
    const timer = setTimeout(() => emailRef.current?.focus(), 300);
    return () => clearTimeout(timer);
  }, []);

  // Redirect if already authenticated
  useEffect(() => {
    if (isAuthenticated) {
      router.push(ROUTES.APP.HOME);
    }
  }, [isAuthenticated, router]);

  // Resolve redirect destination from query param
  const getRedirectDestination = (): string => {
    const redirectParam = searchParams.get('redirect');
    if (redirectParam) {
      const decoded = decodeURIComponent(redirectParam);
      // Only allow redirects within the app — never to external URLs
      if (decoded.startsWith('/app') && !decoded.includes('://')) {
        return decoded;
      }
    }
    return ROUTES.APP.HOME;
  };

  const handleAuthSuccess = (token: string) => {
    setToken(token);
    router.push(getRedirectDestination());
  };

  const clearFieldError = (field: keyof FormErrors) => {
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: undefined }));
    }
    setGeneralError('');
  };

  // value param removed — validation reads from component state directly,
  // there is no need to pass the current field value through the call site.
  const handleBlur = (field: keyof FormErrors) => {
    const fieldErrors = validateLogin({ email, password });
    if (fieldErrors[field]) {
      setErrors((prev) => ({ ...prev, [field]: fieldErrors[field] }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setGeneralError('');

    const validationErrors = validateLogin({ email, password });
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      // Focus the first errored field
      if (validationErrors.email) {
        document.getElementById('email')?.focus();
      } else if (validationErrors.password) {
        document.getElementById('password')?.focus();
      }
      return;
    }

    setIsLoading(true);
    try {
      const res = await apiLogin({ email, password });
      handleAuthSuccess(res.access_token);
    } catch (err: unknown) {
      const status = (err as { response?: { status?: number } })?.response?.status;
      if (status === 401 || status === 404) {
        setGeneralError('Incorrect email or password. Please try again.');
      } else if (status === 429) {
        toast.error('Too many login attempts. Please wait a few minutes before trying again.');
      } else if (status && status >= 500) {
        toast.error('Something went wrong on our end. Please try again in a moment.');
      } else {
        toast.error('Unable to connect to the server. Please check your connection and try again.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleSuccess = async (credentialResponse: { credential?: string }) => {
    if (!credentialResponse.credential) return;
    setIsLoading(true);
    setGeneralError('');
    try {
      const res = await apiGoogleLogin(credentialResponse.credential);
      handleAuthSuccess(res.access_token);
      toast.success('Signed in with Google');
    } catch {
      toast.error('Google sign-in failed. Please try again or use email.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <motion.div
      variants={containerVariants}
      initial={shouldReduceMotion ? false : 'hidden'}
      animate="visible"
    >
      {/* Heading */}
      <motion.div variants={itemVariants} className="mb-8">
        <h1 className="type-h3 mb-2" style={{ color: 'var(--text-primary)' }}>
          Welcome back
        </h1>
        <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
          Sign in to your account to continue.
        </p>
      </motion.div>

      {/* General error banner */}
      <AnimatePresence>
        {generalError && (
          <motion.div
            variants={errorVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            className="flex items-start gap-3 p-4 mb-5 rounded-xl text-sm"
            style={{
              background: 'var(--color-error-bg)',
              border: '1px solid rgba(229, 83, 75, 0.20)',
              overflow: 'hidden',
            }}
          >
            <XCircle
              className="w-5 h-5 flex-shrink-0 mt-0.5"
              style={{ color: 'var(--color-error)' }}
            />
            <span style={{ color: 'var(--color-error)' }}>{generalError}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Form */}
      <form
        onSubmit={handleSubmit}
        aria-label="Sign in to FedRight"
        noValidate
        className={`flex flex-col gap-5 transition-opacity duration-200 ${
          isLoading ? 'opacity-60 pointer-events-none' : 'opacity-100'
        }`}
      >
        {/* Email */}
        <motion.div variants={itemVariants}>
          <label
            htmlFor="email"
            className="block text-sm font-medium mb-1.5"
            style={{ color: 'var(--text-secondary)' }}
          >
            Email address
          </label>
          <input
            ref={emailRef}
            id="email"
            type="email"
            autoComplete="email"
            placeholder="you@example.com"
            className={inputClasses}
            style={{
              ...inputStyle,
              borderColor: errors.email ? 'var(--color-error)' : undefined,
            }}
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              clearFieldError('email');
            }}
            onBlur={() => handleBlur('email')}
            onFocus={(e) => {
              if (!errors.email) {
                e.target.style.borderColor = 'var(--brand-green)';
                e.target.style.boxShadow = '0 0 0 3px var(--brand-green-glow)';
              }
            }}
            onBlurCapture={(e) => {
              if (!errors.email) {
                e.target.style.borderColor = 'var(--surface-border)';
                e.target.style.boxShadow = 'none';
              }
            }}
            aria-describedby={errors.email ? 'email-error' : undefined}
            aria-invalid={!!errors.email}
          />
          <FieldError message={errors.email || ''} id="email-error" />
        </motion.div>

        {/* Password */}
        <motion.div variants={itemVariants}>
          <div className="flex items-center justify-between mb-1.5">
            <label
              htmlFor="password"
              className="text-sm font-medium"
              style={{ color: 'var(--text-secondary)' }}
            >
              Password
            </label>
            <Link
              href="/forgot-password"
              className="text-sm transition-colors duration-150"
              style={{ color: 'var(--brand-green-light)' }}
              tabIndex={0}
            >
              Forgot password?
            </Link>
          </div>
          <div className="relative">
            <input
              id="password"
              type={showPassword ? 'text' : 'password'}
              autoComplete="current-password"
              placeholder="••••••••"
              className={inputClasses}
              style={{
                ...inputStyle,
                paddingRight: '2.75rem',
                borderColor: errors.password ? 'var(--color-error)' : undefined,
              }}
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                clearFieldError('password');
              }}
              onBlur={() => handleBlur('password')}
              onFocus={(e) => {
                if (!errors.password) {
                  e.target.style.borderColor = 'var(--brand-green)';
                  e.target.style.boxShadow = '0 0 0 3px var(--brand-green-glow)';
                }
              }}
              onBlurCapture={(e) => {
                if (!errors.password) {
                  e.target.style.borderColor = 'var(--surface-border)';
                  e.target.style.boxShadow = 'none';
                }
              }}
              aria-describedby={errors.password ? 'password-error' : undefined}
              aria-invalid={!!errors.password}
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 transition-colors duration-150 p-0.5"
              style={{ color: 'var(--text-muted)' }}
              aria-label={showPassword ? 'Hide password' : 'Show password'}
              onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--text-secondary)')}
              onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-muted)')}
            >
              {showPassword ? (
                <EyeOff className="w-4 h-4" />
              ) : (
                <Eye className="w-4 h-4" />
              )}
            </button>
          </div>
          <FieldError message={errors.password || ''} id="password-error" />
        </motion.div>

        {/* Submit button */}
        <motion.div variants={itemVariants}>
          <motion.button
            type="submit"
            disabled={isLoading}
            className="w-full py-3 px-6 rounded-xl text-sm font-semibold transition-all duration-150 focus-visible:outline-2"
            style={{
              background: isLoading
                ? 'var(--brand-green-dark)'
                : 'var(--brand-green)',
              color: 'var(--text-inverse)',
              boxShadow: isLoading ? 'none' : '0 4px 16px var(--brand-green-glow)',
              cursor: isLoading ? 'not-allowed' : 'pointer',
            }}
            whileHover={!isLoading ? { scale: 1.01 } : {}}
            whileTap={!isLoading ? { scale: 0.98 } : {}}
            transition={{ duration: 0.15, ease: [0.16, 1, 0.3, 1] as const }}
            aria-label={isLoading ? 'Signing in, please wait' : 'Sign in'}
            onMouseEnter={(e) => {
              if (!isLoading) {
                e.currentTarget.style.boxShadow =
                  '0 6px 24px var(--brand-green-glow), 0 0 0 1px var(--brand-green-border)';
              }
            }}
            onMouseLeave={(e) => {
              if (!isLoading) {
                e.currentTarget.style.boxShadow = '0 4px 16px var(--brand-green-glow)';
              }
            }}
          >
            {isLoading ? (
              <span className="flex items-center justify-center gap-2">
                <span
                  className="w-4 h-4 rounded-full border-2 animate-spin"
                  style={{
                    borderColor: 'rgba(255,255,255,0.25)',
                    borderTopColor: 'rgba(255,255,255,0.9)',
                  }}
                />
                Signing in...
              </span>
            ) : (
              'Sign In'
            )}
          </motion.button>
        </motion.div>
      </form>

      {/* Divider + Google OAuth — only shown when Google Client ID is configured */}
      {hasGoogleClientId && (
        <>
          <motion.div variants={itemVariants} className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <div
                className="w-full border-t"
                style={{ borderColor: 'var(--surface-border)' }}
              />
            </div>
            <div className="relative flex justify-center text-xs">
              <span
                className="px-3 text-xs"
                style={{
                  background: 'var(--bg-primary)',
                  color: 'var(--text-muted)',
                }}
              >
                or continue with
              </span>
            </div>
          </motion.div>

          <motion.div variants={itemVariants} className="flex justify-center">
            <GoogleAuthButton
              onSuccess={handleGoogleSuccess}
              text="continue_with"
            />
          </motion.div>
        </>
      )}

      {/* Footer link */}
      <motion.p
        variants={itemVariants}
        className="text-center text-sm mt-6"
        style={{ color: 'var(--text-secondary)' }}
      >
        Don&apos;t have an account?{' '}
        <Link
          href={ROUTES.PUBLIC.SIGNUP}
          className="font-medium transition-colors duration-150"
          style={{ color: 'var(--brand-green-light)' }}
        >
          Sign up for free
        </Link>
      </motion.p>
    </motion.div>
  );
}

// ── Page wrapper — provides auth + Google OAuth context ──────────────────────
function LoginPageInner() {
  return (
    <AuthPageLayout heroContent={LOGIN_HERO}>
      <Suspense fallback={null}>
        <LoginForm />
      </Suspense>
    </AuthPageLayout>
  );
}

export default function LoginRoute() {
  return (
    <AuthProviderWrapper>
      <LoginPageInner />
    </AuthProviderWrapper>
  );
}
