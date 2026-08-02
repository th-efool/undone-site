'use client';

import { useContext } from 'react';

import { ToastContext } from '@/src/client/components/global/Toast/ToastProvider';

type ToastType = 'success' | 'error' | 'info';

/**
 * No-op toast implementation used when no provider is available (e.g. SSR).
 */
const noopToast = {
  success: (_msg: string, _dur?: number) => {},
  error: (_msg: string, _dur?: number) => {},
  info: (_msg: string, _dur?: number) => {},
};

export function useToast() {
  const context = useContext(ToastContext);

  if (!context) {
    // Graceful fallback for SSR / missing provider
    return noopToast;
  }

  return {
    ...context,
    success: (message: string, duration?: number) => context.addToast({ type: 'success', message, duration }),
    error: (message: string, duration?: number) => context.addToast({ type: 'error', message, duration }),
    info: (message: string, duration?: number) => context.addToast({ type: 'info', message, duration }),
  };
}
