'use client';

// frontend/src/app/signup/page.tsx
//
// PUBLIC SIGNUP PAGE (/signup)
//
// Dark-themed, split-panel registration experience.
// Preserves all existing auth logic: signup(), setToken(), googleLogin().
// On success, redirects to /app/profile for onboarding profile creation.

import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Suspense } from 'react';
import dynamic from 'next/dynamic';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { Eye, EyeOff, XCircle } from 'lucide-react';

import { AuthProviderWrapper } from '@/components/auth/AuthProviderWrapper';
import { AuthPageLayout } from '@/components/auth/AuthPageLayout';
import { useAuth } from '@/lib/AuthContext';
import { signup as apiSignup, googleLogin as apiGoogleLogin } from '@/lib/api';
import { useToast } from '@/components/ui/Toast';
import {
  useAuthFormValidation,
  getPasswordStrength,
  type FormErrors,
} from '@/hooks/useAuthForm';
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

// ── Hero content for signup page ─────────────────────────────────────────────
const SIGNUP_HERO = {
  heading: (
    <>
      Start your family&apos;s<br />
      health journey.
    </>
  ),
  subtitle:
    'Join thousands of Indian families eating smarter, together. Set up in minutes — personalized meal plans for every member.',
  quoteText:
    'Set up in 5 minutes. We now have a full week of healthy meals ready every Sunday.',
  quoteCite: '— Anita R., Bangalore',
};


// ── Password strength indicator ───────────────────────────────────────────────
function PasswordStrengthBar({ password }: { password: string }) {
  const strength = getPasswordStrength(password);
  if (!password) return null;

  const getSegmentColor = (level: number): string => {
    if (level > strength.score) return 'var(--surface-border)';
    if (strength.score <= 1) return 'var(--color-error)';
    if (strength.score === 2) return 'var(--brand-amber)';
    return 'var(--color-success)';
  };

  const getLabelColor = (): string => {
    if (strength.score <= 1) return 'var(--color-error)';
    if (strength.score === 2) return 'var(--brand-amber)';
    return 'var(--color-success)';
  };

  return (
    <div className="mt-2 flex items-center gap-2">
      <div className="flex gap-1 flex-1">
        {[1, 2, 3, 4].map((level) => (
          <div
            key={level}
            className="h-1 flex-1 rounded-full transition-colors duration-300"
            style={{ backgroundColor: getSegmentColor(level) }}
          />
        ))}
      </div>
      {strength.label && (
        <span
          className="text-xs font-medium min-w-[40px] text-right transition-colors duration-300"
          style={{ color: getLabelColor() }}
        >
          {strength.label}
        </span>
      )}
    </div>
  );
}

// ── Signup form ───────────────────────────────────────────────────────────────
function SignupForm() {
  const { setToken, isAuthenticated } = useAuth();
  const router = useRouter();
  const toast = useToast();
  const { validateSignup } = useAuthFormValidation();
  // Respect the OS-level "Reduce Motion" accessibility preference.
  const shouldReduceMotion = useReducedMotion();

  // Only show Google OAuth section if the client ID is configured
  const hasGoogleClientId = !!process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState<FormErrors>({});
  const [generalError, setGeneralError] = useState('');

  const nameRef = useRef<HTMLInputElement>(null);

  // Auto-focus name field on mount
  useEffect(() => {
    const timer = setTimeout(() => nameRef.current?.focus(), 300);
    return () => clearTimeout(timer);
  }, []);

  // Redirect if already authenticated
  useEffect(() => {
    if (isAuthenticated) {
      router.push(ROUTES.APP.HOME);
    }
  }, [isAuthenticated, router]);

  const handleSignupSuccess = (token: string) => {
    setToken(token);
    // New users go directly to profile creation — the most important onboarding step
    router.push(ROUTES.APP.PROFILE);
    toast.success('Welcome to FedRight! Let\'s set up your first profile.');
  };

  const clearFieldError = (field: keyof FormErrors) => {
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: undefined }));
    }
    setGeneralError('');
  };

  const handleBlur = (field: keyof FormErrors) => {
    const fieldErrors = validateSignup({ name, email, password, confirmPassword });
    if (fieldErrors[field]) {
      setErrors((prev) => ({ ...prev, [field]: fieldErrors[field] }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setGeneralError('');

    const validationErrors = validateSignup({ name, email, password, confirmPassword });
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      // Focus the first errored field
      if (validationErrors.name) {
        document.getElementById('name')?.focus();
      } else if (validationErrors.email) {
        document.getElementById('email')?.focus();
      } else if (validationErrors.password) {
        document.getElementById('password')?.focus();
      } else if (validationErrors.confirmPassword) {
        document.getElementById('confirmPassword')?.focus();
      }
      return;
    }

    setIsLoading(true);
    try {
      const res = await apiSignup({ email, password, display_name: name });
      handleSignupSuccess(res.access_token);
    } catch (err: unknown) {
      const status = (err as { response?: { status?: number } })?.response?.status;
      if (status === 409) {
        setErrors((prev) => ({
          ...prev,
          email: 'An account with this email already exists.',
        }));
        document.getElementById('email')?.focus();
      } else if (status === 429) {
        toast.error('Too many requests. Please wait a few minutes before trying again.');
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
      handleSignupSuccess(res.access_token);
    } catch {
      toast.error('Google sign-in failed. Please try again or use email.');
    } finally {
      setIsLoading(false);
    }
  };

  // Shared focus/blur handlers for input styling
  const onFocusInput = (e: React.FocusEvent<HTMLInputElement>, fieldKey: keyof FormErrors) => {
    if (!errors[fieldKey]) {
      e.target.style.borderColor = 'var(--brand-green)';
      e.target.style.boxShadow = '0 0 0 3px var(--brand-green-glow)';
    }
  };

  const onBlurInput = (e: React.FocusEvent<HTMLInputElement>, fieldKey: keyof FormErrors) => {
    if (!errors[fieldKey]) {
      e.target.style.borderColor = 'var(--surface-border)';
      e.target.style.boxShadow = 'none';
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
          Create your account
        </h1>
        <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
          Start your family&apos;s health journey today. Free forever.
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
        aria-label="Create a FedRight account"
        noValidate
        className={`flex flex-col gap-5 transition-opacity duration-200 ${
          isLoading ? 'opacity-60 pointer-events-none' : 'opacity-100'
        }`}
      >
        {/* Full Name */}
        <motion.div variants={itemVariants}>
          <label
            htmlFor="name"
            className="block text-sm font-medium mb-1.5"
            style={{ color: 'var(--text-secondary)' }}
          >
            Full Name
          </label>
          <input
            ref={nameRef}
            id="name"
            type="text"
            autoComplete="name"
            placeholder="Priya Sharma"
            className={inputClasses}
            style={{
              ...inputStyle,
              borderColor: errors.name ? 'var(--color-error)' : undefined,
            }}
            value={name}
            onChange={(e) => { setName(e.target.value); clearFieldError('name'); }}
            onBlur={() => handleBlur('name')}
            onFocus={(e) => onFocusInput(e, 'name')}
            onBlurCapture={(e) => onBlurInput(e, 'name')}
            aria-describedby={errors.name ? 'name-error' : undefined}
            aria-invalid={!!errors.name}
          />
          <FieldError message={errors.name || ''} id="name-error" />
        </motion.div>

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
            onChange={(e) => { setEmail(e.target.value); clearFieldError('email'); }}
            onBlur={() => handleBlur('email')}
            onFocus={(e) => onFocusInput(e, 'email')}
            onBlurCapture={(e) => onBlurInput(e, 'email')}
            aria-describedby={errors.email ? 'email-error' : undefined}
            aria-invalid={!!errors.email}
          />
          <FieldError message={errors.email || ''} id="email-error" />
        </motion.div>

        {/* Password */}
        <motion.div variants={itemVariants}>
          <label
            htmlFor="password"
            className="block text-sm font-medium mb-1.5"
            style={{ color: 'var(--text-secondary)' }}
          >
            Password
          </label>
          <div className="relative">
            <input
              id="password"
              type={showPassword ? 'text' : 'password'}
              autoComplete="new-password"
              placeholder="Min. 8 characters"
              className={inputClasses}
              style={{
                ...inputStyle,
                paddingRight: '2.75rem',
                borderColor: errors.password ? 'var(--color-error)' : undefined,
              }}
              value={password}
              onChange={(e) => { setPassword(e.target.value); clearFieldError('password'); }}
              onBlur={() => handleBlur('password')}
              onFocus={(e) => onFocusInput(e, 'password')}
              onBlurCapture={(e) => onBlurInput(e, 'password')}
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
              {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
          <FieldError message={errors.password || ''} id="password-error" />
          {/* Password strength indicator (only on signup) */}
          <PasswordStrengthBar password={password} />
        </motion.div>

        {/* Confirm Password */}
        <motion.div variants={itemVariants}>
          <label
            htmlFor="confirmPassword"
            className="block text-sm font-medium mb-1.5"
            style={{ color: 'var(--text-secondary)' }}
          >
            Confirm Password
          </label>
          <div className="relative">
            <input
              id="confirmPassword"
              type={showConfirmPassword ? 'text' : 'password'}
              autoComplete="new-password"
              placeholder="••••••••"
              className={inputClasses}
              style={{
                ...inputStyle,
                paddingRight: '2.75rem',
                borderColor: errors.confirmPassword ? 'var(--color-error)' : undefined,
              }}
              value={confirmPassword}
              onChange={(e) => { setConfirmPassword(e.target.value); clearFieldError('confirmPassword'); }}
              onBlur={() => handleBlur('confirmPassword')}
              onFocus={(e) => onFocusInput(e, 'confirmPassword')}
              onBlurCapture={(e) => onBlurInput(e, 'confirmPassword')}
              aria-describedby={errors.confirmPassword ? 'confirm-password-error' : undefined}
              aria-invalid={!!errors.confirmPassword}
            />
            <button
              type="button"
              onClick={() => setShowConfirmPassword(!showConfirmPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 transition-colors duration-150 p-0.5"
              style={{ color: 'var(--text-muted)' }}
              aria-label={showConfirmPassword ? 'Hide confirm password' : 'Show confirm password'}
              onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--text-secondary)')}
              onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-muted)')}
            >
              {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
          <FieldError message={errors.confirmPassword || ''} id="confirm-password-error" />
        </motion.div>

        {/* Submit button */}
        <motion.div variants={itemVariants}>
          <motion.button
            type="submit"
            disabled={isLoading}
            className="w-full py-3 px-6 rounded-xl text-sm font-semibold transition-all duration-150"
            style={{
              background: isLoading ? 'var(--brand-green-dark)' : 'var(--brand-green)',
              color: 'var(--text-inverse)',
              boxShadow: isLoading ? 'none' : '0 4px 16px var(--brand-green-glow)',
              cursor: isLoading ? 'not-allowed' : 'pointer',
            }}
            whileHover={!isLoading ? { scale: 1.01 } : {}}
            whileTap={!isLoading ? { scale: 0.98 } : {}}
            transition={{ duration: 0.15, ease: [0.16, 1, 0.3, 1] as const }}
            aria-label={isLoading ? 'Creating account, please wait' : 'Create account'}
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
                Creating account...
              </span>
            ) : (
              'Create Account'
            )}
          </motion.button>

          {/* Terms notice */}
          <p
            className="text-xs text-center mt-3 leading-relaxed"
            style={{ color: 'var(--text-muted)' }}
          >
            By creating an account, you agree to our{' '}
            <a
              href="/terms"
              className="transition-colors duration-150"
              style={{ color: 'var(--brand-green-light)' }}
            >
              Terms of Service
            </a>{' '}
            and{' '}
            <a
              href="/privacy"
              className="transition-colors duration-150"
              style={{ color: 'var(--brand-green-light)' }}
            >
              Privacy Policy
            </a>
            .
          </p>
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
            <div className="relative flex justify-center">
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
        Already have an account?{' '}
        <Link
          href={ROUTES.PUBLIC.LOGIN}
          className="font-medium transition-colors duration-150"
          style={{ color: 'var(--brand-green-light)' }}
        >
          Sign in
        </Link>
      </motion.p>
    </motion.div>
  );
}

// ── Page wrapper — provides auth + Google OAuth context ──────────────────────
function SignupPageInner() {
  return (
    <AuthPageLayout heroContent={SIGNUP_HERO}>
      <Suspense fallback={null}>
        <SignupForm />
      </Suspense>
    </AuthPageLayout>
  );
}

export default function SignupRoute() {
  return (
    <AuthProviderWrapper>
      <SignupPageInner />
    </AuthProviderWrapper>
  );
}
