'use client';
import { useContext, useEffect, useRef } from 'react';
import { ToastContext } from '@/src/client/components/global/Toast/ToastProvider';
import { devLogger } from '@/src/shared/lib/dev-logger';
/** Error state owns retries; this hook only presents a safe message, once per transition. */
export function useFailureToast(error: string | null | undefined, message: string, component: string) {
  const context = useContext(ToastContext);
  const last = useRef<string | null>(null);
  const add = context?.addToast;
  useEffect(() => {
    if (!error) { last.current = null; return; }
    if (last.current === error || !add) return;
    last.current = error;
    devLogger.error(component, 'operation_failed');
    devLogger.debug(component, 'failure_notification', { category: 'action', recoverable: true });
    add({ type: 'error', message, duration: 0 });
  }, [error, message, component, add]);
}
