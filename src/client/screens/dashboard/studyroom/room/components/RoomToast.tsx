'use client';

import React, { useEffect } from 'react';
import { X } from 'lucide-react';
import styles from './RoomToast.module.css';

export interface RoomToastMessage {
  id: number;
  text: string;
}

export interface RoomToastProps {
  message: RoomToastMessage | null;
  onDismiss: () => void;
}

export function RoomToast({ message, onDismiss }: RoomToastProps) {
  const messageId = message?.id;

  useEffect(() => {
    if (messageId === undefined) return;

    const timer = setTimeout(() => {
      onDismiss();
    }, 4000);

    return () => {
      clearTimeout(timer);
    };
  }, [messageId, onDismiss]);

  if (!message) return null;

  return (
    <div
      className={styles.toastContainer}
      role="status"
      aria-live="polite"
    >
      <div className={styles.toast}>
        <span className={styles.text}>{message.text}</span>
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Dismiss notification"
          className={styles.dismissBtn}
        >
          <X size={15} aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}

export default RoomToast;
