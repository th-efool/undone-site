'use client';

import React, { useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import styles from './PanelShell.module.css';

export interface PanelShellProps {
  id?: string;
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  footer?: React.ReactNode;
}

export function PanelShell({
  id = 'room-panel',
  title,
  onClose,
  children,
  footer,
}: PanelShellProps) {
  const headingRef = useRef<HTMLHeadingElement>(null);

  // Focus heading on mount for accessibility
  useEffect(() => {
    headingRef.current?.focus();
  }, []);

  const headingId = `${id}-title`;

  return (
    <>
      <button
        type="button"
        className={styles.scrim}
        aria-label="Close panel"
        tabIndex={-1}
        onClick={onClose}
      />
      <aside
        id={id}
        role="dialog"
        aria-modal="false"
        aria-labelledby={headingId}
        className={styles.panel}
      >
        <div className={styles.header}>
          <h2
            id={headingId}
            ref={headingRef}
            tabIndex={-1}
            className={styles.title}
          >
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label={`Close ${title}`}
            className={styles.closeBtn}
          >
            <X size={18} aria-hidden="true" />
          </button>
        </div>

        <div className={styles.body}>{children}</div>

        {footer && <div className={styles.footer}>{footer}</div>}
      </aside>
    </>
  );
}

export default PanelShell;
