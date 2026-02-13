'use client';

import React, { createContext, useContext, useEffect, useState, useCallback, useMemo } from 'react';
import { X, CheckCircle, AlertCircle, Info } from 'lucide-react';
import { cn } from '@/lib/utils';

type ToastVariant = 'success' | 'error' | 'info';

interface ToastData {
  id: string;
  message: string;
  variant: ToastVariant;
}

interface ToastContextValue {
  success: (message: string) => void;
  error: (message: string) => void;
  info: (message: string) => void;
}

const ToastContext = createContext<ToastContextValue | undefined>(undefined);

interface ToastProps {
  message: string;
  variant?: ToastVariant;
  duration?: number;
  onClose: () => void;
}

/**
 * Toast notification with botanical luxe styling.
 * Rich backgrounds with emerald/amber/coral accents and glassmorphic surface.
 */
function Toast({ message, variant = 'info', duration = 5000, onClose }: ToastProps) {
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsVisible(false);
      setTimeout(onClose, 300);
    }, duration);

    return () => clearTimeout(timer);
  }, [duration, onClose]);

  const variantConfig: Record<
    ToastVariant,
    { bg: React.CSSProperties; icon: React.ReactNode; accent: string }
  > = {
    success: {
      bg: {
        background: 'linear-gradient(135deg, rgba(45, 90, 63, 0.08), rgba(127, 168, 138, 0.05))',
        borderColor: 'rgba(45, 90, 63, 0.18)',
      },
      icon: <CheckCircle className="h-5 w-5" style={{ color: 'var(--color-emerald)' }} />,
      accent: 'var(--color-emerald-deep)',
    },
    error: {
      bg: {
        background: 'linear-gradient(135deg, rgba(212, 90, 58, 0.08), rgba(232, 121, 96, 0.04))',
        borderColor: 'rgba(212, 90, 58, 0.18)',
      },
      icon: <AlertCircle className="h-5 w-5" style={{ color: 'var(--color-coral)' }} />,
      accent: 'var(--color-coral)',
    },
    info: {
      bg: {
        background: 'linear-gradient(135deg, rgba(212, 148, 10, 0.08), rgba(240, 193, 75, 0.04))',
        borderColor: 'rgba(212, 148, 10, 0.18)',
      },
      icon: <Info className="h-5 w-5" style={{ color: 'var(--color-amber)' }} />,
      accent: 'var(--color-amber)',
    },
  };

  const { bg, icon, accent } = variantConfig[variant];

  return (
    <div
      className={cn(
        'flex items-center gap-3 px-5 py-3.5 rounded-xl border max-w-md',
        isVisible ? 'animate-slide-down' : 'opacity-0 transition-opacity duration-300'
      )}
      style={{
        ...bg,
        backdropFilter: 'blur(20px) saturate(1.6)',
        WebkitBackdropFilter: 'blur(20px) saturate(1.6)',
        boxShadow: 'var(--shadow-lg)',
      }}
    >
      {icon}
      <p className="flex-1 text-sm font-medium" style={{ color: accent }}>
        {message}
      </p>
      <button
        onClick={() => {
          setIsVisible(false);
          setTimeout(onClose, 300);
        }}
        className="shrink-0 opacity-40 hover:opacity-70 transition-opacity"
        style={{ color: accent }}
        aria-label="Close notification"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}

/**
 * Toast provider that manages toast state globally.
 */
export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastData[]>([]);

  const remove = useCallback((id: string) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
  }, []);

  const show = useCallback((message: string, variant: ToastVariant) => {
    const id = `toast-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    setToasts((prev) => [...prev, { id, message, variant }]);
  }, []);

  const value = useMemo(
    () => ({
      success: (message: string) => show(message, 'success'),
      error: (message: string) => show(message, 'error'),
      info: (message: string) => show(message, 'info'),
    }),
    [show]
  );

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="fixed top-4 right-4 z-50 space-y-2">
        {toasts.map((toast) => (
          <Toast
            key={toast.id}
            message={toast.message}
            variant={toast.variant}
            onClose={() => remove(toast.id)}
          />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

/**
 * Hook for accessing toast notifications.
 */
export function useToast(): ToastContextValue {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
}
