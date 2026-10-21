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
  variant?: 'drawer' | 'modal';
}

export function PanelShell({
  id = 'room-panel',
  title,
  onClose,
  children,
  footer,
  variant = 'drawer',
}: PanelShellProps) {
  const headingRef = useRef<HTMLHeadingElement>(null);

  // Focus heading on mount for accessibility
  useEffect(() => {
    headingRef.current?.focus();
  }, []);

  const headingId = `${id}-title`;
  const isModal = variant === 'modal';

  return (
    <>
      <button
        type="button"
        className={isModal ? styles.modalScrim : styles.scrim}
        aria-label="Close panel"
        tabIndex={-1}
        onClick={onClose}
      />
      <aside
        id={id}
        role="dialog"
        aria-modal={isModal ? 'true' : 'false'}
        aria-labelledby={headingId}
        className={isModal ? styles.modalPanel : styles.panel}
      >
        {isModal ? (
          <h2
            id={headingId}
            ref={headingRef}
            tabIndex={-1}
            className={styles.srOnly}
          >
            {title}
          </h2>
        ) : (
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
        )}

        <div className={isModal ? styles.modalBody : styles.body}>
          {children}
        </div>

        {footer && <div className={styles.footer}>{footer}</div>}
      </aside>
    </>
  );
}

export default PanelShell;
