'use client';

import React from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import styles from './LeaveRoomDialog.module.css';

export interface LeaveRoomDialogProps {
  open: boolean;
  onStay: () => void;
  onLeave: () => void;
  onLeaveAll?: () => void;
}

export function LeaveRoomDialog({ open, onStay, onLeave, onLeaveAll }: LeaveRoomDialogProps) {
  return (
    <Dialog.Root open={open} onOpenChange={(isOpen) => { if (!isOpen) onStay(); }}>
      <Dialog.Portal>
        <Dialog.Overlay className={styles.overlay} />
        <Dialog.Content
          className={styles.content}
          onOpenAutoFocus={(event) => {
            // Default focus on Stay button
            event.preventDefault();
            const stayBtn = document.getElementById('leave-dialog-stay-btn');
            stayBtn?.focus();
          }}
        >
          <Dialog.Title className={styles.title}>
            Leave this room?
          </Dialog.Title>
          <Dialog.Description className={styles.description}>
            Your timer, tasks and goal live only in this session and will be cleared.
          </Dialog.Description>

          <div className={styles.actions}>
            <button
              id="leave-dialog-stay-btn"
              type="button"
              onClick={onStay}
              className={styles.stayBtn}
            >
              Stay
            </button>
            <button
              type="button"
              onClick={onLeave}
              className={styles.leaveBtn}
            >
              Leave room
            </button>
            {onLeaveAll && (
              <button
                type="button"
                onClick={onLeaveAll}
                className={styles.leaveAllBtn}
                title="Disconnect all your tabs and devices from this room"
              >
                Leave all devices
              </button>
            )}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

export default LeaveRoomDialog;
