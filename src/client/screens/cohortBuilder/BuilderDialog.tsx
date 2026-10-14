'use client';
import { useEffect, useRef, type ReactNode } from 'react';
import styles from './CohortBuilder.module.css';

export function BuilderDialog({ label, onClose, children }: { label: string; onClose: () => void; children: ReactNode }) {
  const dialog = useRef<HTMLDivElement>(null);
  const close = useRef(onClose); close.current = onClose;
  useEffect(() => {
    const invokingControl = document.activeElement as HTMLElement | null;
    const node = dialog.current!;
    const controls = () => [...node.querySelectorAll<HTMLElement>('button:not(:disabled),input:not(:disabled),textarea:not(:disabled),a[href]')];
    (controls()[0] ?? node).focus();
    const keyboard = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.preventDefault(); close.current(); }
      if (event.key !== 'Tab') return;
      const items = controls(); const first = items[0]; const last = items.at(-1);
      if (!first) { event.preventDefault(); node.focus(); }
      else if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    node.addEventListener('keydown', keyboard);
    return () => { node.removeEventListener('keydown', keyboard); if (invokingControl?.isConnected) invokingControl.focus(); };
  }, []);
  return <div className={styles.modalCard} ref={dialog} role="dialog" aria-modal="true" aria-label={label} tabIndex={-1}>{children}</div>;
}
