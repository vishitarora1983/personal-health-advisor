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
 * Toast notification with FedRight dark design system.
 * Elevated surface (--bg-tertiary), left-edge accent border per semantic type.
 * Enters from bottom via .animate-slide-up per spec Section 9.6.
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

  // Each variant maps to a semantic color token and icon.
  // Left border accent is the key differentiator per design spec.
  const variantConfig: Record<
    ToastVariant,
    { borderColor: string; icon: React.ReactNode; textColor: string }
  > = {
    success: {
      borderColor: 'var(--color-success)',
      icon: <CheckCircle className="h-5 w-5 shrink-0" style={{ color: 'var(--color-success)' }} />,
      textColor: 'var(--text-primary)',
    },
    error: {
      borderColor: 'var(--color-error)',
      icon: <AlertCircle className="h-5 w-5 shrink-0" style={{ color: 'var(--color-error)' }} />,
      textColor: 'var(--text-primary)',
    },
    info: {
      borderColor: 'var(--color-info)',
      icon: <Info className="h-5 w-5 shrink-0" style={{ color: 'var(--color-info)' }} />,
      textColor: 'var(--text-primary)',
    },
  };

  const { borderColor, icon, textColor } = variantConfig[variant];

  return (
    <div
      className={cn(
        'flex items-center gap-3 px-4 py-3.5 rounded-[var(--radius-lg)] border max-w-md',
        isVisible ? 'animate-slide-up' : 'opacity-0 transition-opacity duration-300'
      )}
      style={{
        background: 'var(--bg-tertiary)',
        borderColor: 'var(--surface-border)',
        // Left accent border communicates notification type
        borderLeft: `4px solid ${borderColor}`,
        boxShadow: 'var(--shadow-lg)',
        minWidth: '320px',
      }}
    >
      {icon}
      <p className="flex-1 text-sm font-medium" style={{ color: textColor }}>
        {message}
      </p>
      <button
        onClick={() => {
          setIsVisible(false);
          setTimeout(onClose, 300);
        }}
        className="shrink-0 opacity-40 hover:opacity-70 transition-opacity"
        style={{ color: 'var(--text-secondary)' }}
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
      {/* Bottom-right placement, toasts stack vertically */}
      <div className="fixed bottom-4 right-4 z-50 space-y-2">
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
