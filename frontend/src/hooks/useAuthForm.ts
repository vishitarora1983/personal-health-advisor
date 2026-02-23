// frontend/src/hooks/useAuthForm.ts
//
// Reusable auth form validation hook.
// Keeps page components clean by extracting all validation logic here.

// ── Email validation ────────────────────────────────────────────────────────
// Simplified RFC 5322 validation — covers 99.9% of real email addresses.
// Deliberately does not reject unusual-but-valid formats (user+tag@example.com).
// The backend performs authoritative validation; this is just UX feedback.
const isValidEmail = (email: string): boolean => {
  const emailRegex = /^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,6}$/;
  return emailRegex.test(email.trim());
};

// ── Types ────────────────────────────────────────────────────────────────────

export interface LoginFormValues {
  email: string;
  password: string;
}

export interface SignupFormValues extends LoginFormValues {
  name: string;
  confirmPassword: string;
}

export interface FormErrors {
  name?: string;
  email?: string;
  password?: string;
  confirmPassword?: string;
}

// ── Password strength ────────────────────────────────────────────────────────

export interface PasswordStrength {
  score: number; // 0-4
  label: string; // '', 'Weak', 'Fair', 'Good', 'Strong'
}

export function getPasswordStrength(password: string): PasswordStrength {
  if (!password) return { score: 0, label: '' };
  let score = 0;
  if (password.length >= 8) score++;
  if (/[A-Z]/.test(password)) score++;
  if (/[0-9]/.test(password)) score++;
  if (/[^A-Za-z0-9]/.test(password)) score++;
  const labels = ['', 'Weak', 'Fair', 'Good', 'Strong'] as const;
  return { score, label: labels[score] };
}

// ── Validation hook ──────────────────────────────────────────────────────────

export function useAuthFormValidation() {
  const validateLogin = (values: LoginFormValues): FormErrors => {
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

  const validateSignup = (values: SignupFormValues): FormErrors => {
    // Run all login validations first
    const errors: FormErrors = validateLogin(values);

    if (!values.name.trim()) {
      errors.name = 'Name is required';
    } else if (values.name.trim().length < 2) {
      errors.name = 'Name must be at least 2 characters';
    } else if (values.name.trim().length > 80) {
      errors.name = 'Name must be 80 characters or fewer';
    }

    if (!values.confirmPassword) {
      errors.confirmPassword = 'Please confirm your password';
    } else if (values.confirmPassword !== values.password) {
      errors.confirmPassword = 'Passwords do not match';
    }

    return errors;
  };

  return { validateLogin, validateSignup };
}
