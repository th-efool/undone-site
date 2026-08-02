'use client';

import { createContext, useCallback, useEffect, useMemo, useState } from 'react';

import { Toast } from './Toast';

export interface ToastItem {
  id: string;
  type: 'success' | 'error' | 'info';
  message: string;
  duration?: number;
}

interface ToastContextValue {
  toasts: ToastItem[];
  addToast: (toast: Omit<ToastItem, 'id'>) => void;
}

export const ToastContext = createContext<ToastContextValue | undefined>(undefined);

const MAX_TOASTS = 3;
const DEFAULT_DURATION = 3000;

function generateId(): string {
  return Math.random().toString(36).slice(2, 10);
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const addToast = useCallback((toast: Omit<ToastItem, 'id'>) => {
    setToasts((current) => {
      const newToast: ToastItem = { ...toast, id: generateId(), duration: toast.duration ?? DEFAULT_DURATION };
      // Keep max 3 toasts; oldest is dismissed when a new one arrives
      const queued = current.length >= MAX_TOASTS ? current.slice(1) : current;
      return [...queued, newToast];
    });
  }, []);

  // Auto-dismiss after duration
  useEffect(() => {
    const timers: ReturnType<typeof setTimeout>[] = [];

    toasts.forEach((toast) => {
      timers.push(
        setTimeout(() => {
          setToasts((current) => current.filter((t) => t.id !== toast.id));
        }, toast.duration ?? DEFAULT_DURATION),
      );
    });

    return () => timers.forEach(clearTimeout);
  }, [toasts]);

  const removeToast = useCallback((id: string) => {
    setToasts((current) => current.filter((t) => t.id !== id));
  }, []);

  const value = useMemo(() => ({ toasts, addToast }), [toasts, addToast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="toast-portal" aria-live="polite">
        {toasts.map((toast) => (
          <Toast
            key={toast.id}
            item={toast}
            onClose={() => removeToast(toast.id)}
          />
        ))}
      </div>
    </ToastContext.Provider>
  );
}
