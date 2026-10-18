'use client';

import React, { useEffect, useRef } from 'react';
import { Keyboard, X } from 'lucide-react';
import styles from './ShortcutsDialog.module.css';

interface ShortcutsDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

interface ShortcutItem {
  action: string;
  keys: string[];
}

const PLAYBACK_SHORTCUTS: ShortcutItem[] = [
  { action: 'Play / Pause', keys: ['Space', 'K'] },
  { action: 'Next lesson / chunk', keys: ['→', 'L'] },
  { action: 'Previous lesson / chunk', keys: ['←', 'J'] },
  { action: 'Toggle Fullscreen', keys: ['F'] },
  { action: 'Toggle Mute', keys: ['M'] },
];

const TIMELINE_SHORTCUTS: ShortcutItem[] = [
  { action: 'Seek backward / forward (10s)', keys: ['←', '→'] },
  { action: 'Seek backward / forward (30s)', keys: ['PgUp', 'PgDn'] },
  { action: 'Seek to start / end', keys: ['Home', 'End'] },
];

const GENERAL_SHORTCUTS: ShortcutItem[] = [
  { action: 'Keyboard shortcuts help', keys: ['?'] },
  { action: 'Close dialogs & menus', keys: ['Esc'] },
];

export function ShortcutsDialog({ isOpen, onClose }: ShortcutsDialogProps) {
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!isOpen) return;

    // Focus the close button when opened
    closeButtonRef.current?.focus();

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className={styles.overlay}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="shortcuts-dialog-title"
    >
      <div className={styles.dialog}>
        <div className={styles.header}>
          <h2 id="shortcuts-dialog-title" className={styles.title}>
            <Keyboard size={20} color="#818CF8" />
            <span>Keyboard Shortcuts</span>
          </h2>
          <button
            type="button"
            className={styles.closeIconBtn}
            onClick={onClose}
            aria-label="Close shortcuts dialog"
          >
            <X size={18} />
          </button>
        </div>

        <section className={styles.section} aria-label="Playback shortcuts">
          <div className={styles.sectionTitle}>Playback</div>
          <div className={styles.shortcutsList}>
            {PLAYBACK_SHORTCUTS.map((item) => (
              <div key={item.action} className={styles.shortcutRow}>
                <span className={styles.actionLabel}>{item.action}</span>
                <div className={styles.keyBadges}>
                  {item.keys.map((k) => (
                    <kbd key={k} className={styles.keyBadge}>
                      {k}
                    </kbd>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className={styles.section} aria-label="Timeline seek shortcuts">
          <div className={styles.sectionTitle}>Timeline Scrubber (When focused)</div>
          <div className={styles.shortcutsList}>
            {TIMELINE_SHORTCUTS.map((item) => (
              <div key={item.action} className={styles.shortcutRow}>
                <span className={styles.actionLabel}>{item.action}</span>
                <div className={styles.keyBadges}>
                  {item.keys.map((k) => (
                    <kbd key={k} className={styles.keyBadge}>
                      {k}
                    </kbd>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className={styles.section} aria-label="General shortcuts">
          <div className={styles.sectionTitle}>General</div>
          <div className={styles.shortcutsList}>
            {GENERAL_SHORTCUTS.map((item) => (
              <div key={item.action} className={styles.shortcutRow}>
                <span className={styles.actionLabel}>{item.action}</span>
                <div className={styles.keyBadges}>
                  {item.keys.map((k) => (
                    <kbd key={k} className={styles.keyBadge}>
                      {k}
                    </kbd>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>

        <div className={styles.footer}>
          <button
            ref={closeButtonRef}
            type="button"
            className={styles.closeButton}
            onClick={onClose}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
