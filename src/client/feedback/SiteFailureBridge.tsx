'use client';
import { useContext, useEffect } from 'react';
import { ToastContext } from '@/src/client/components/global/Toast/ToastProvider';
import { subscribeSiteFailures } from './site-failures';
export function SiteFailureBridge() {
  const context = useContext(ToastContext);
  const add = context?.addToast;
  useEffect(() => {
    if (!add) return;
    return subscribeSiteFailures(failure => add({ type: 'error', message: failure.message, duration: 0 }));
  }, [add]);
  return null;
}
