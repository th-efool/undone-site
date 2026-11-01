'use client';
import { createContext, useCallback, useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { Toast } from './Toast';
import styles from './Toast.module.css';
export interface ToastItem { id: string; type: 'success' | 'error' | 'info'; message: string; duration?: number; expiresAt?: number }
interface ToastContextValue { toasts: ToastItem[]; addToast: (toast: Omit<ToastItem, 'id'>) => void }
export const ToastContext = createContext<ToastContextValue | undefined>(undefined);
export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [mounted, setMounted] = useState(false);
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  useEffect(() => setMounted(true), []);
  const addToast = useCallback((toast: Omit<ToastItem, 'id'>) => {
    const duration = toast.duration ?? (toast.type === 'error' ? 0 : 5000);
    const item = { ...toast, duration, id: crypto.randomUUID(), expiresAt: duration > 0 ? Date.now() + duration : undefined };
    setToasts(current => [...current.filter(t => t.type !== item.type || t.message !== item.message), item].slice(-3));
  }, []);
  const remove = useCallback((id: string) => setToasts(current => current.filter(t => t.id !== id)), []);
  useEffect(() => {
    const timers = toasts.filter(t => t.expiresAt !== undefined).map(t => setTimeout(() => remove(t.id), Math.max(0, t.expiresAt! - Date.now())));
    return () => timers.forEach(clearTimeout);
  }, [toasts, remove]);
  const value = useMemo(() => ({ toasts, addToast }), [toasts, addToast]);
  return <ToastContext.Provider value={value}>{children}{mounted && createPortal(
    <aside className={styles.portal} aria-label="Notifications">{toasts.map(item => <Toast key={item.id} item={item} onClose={() => remove(item.id)} />)}</aside>, document.body
  )}</ToastContext.Provider>;
}
