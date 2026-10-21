'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { MoreVertical, ShieldAlert, UserMinus, Crown, ShieldX } from 'lucide-react';
import type { RoomRole } from '@/src/shared/studyroom/contracts';
import styles from './ParticipantActionsMenu.module.css';

export interface ParticipantActionsMenuProps {
  roomSlug: string;
  targetUserId: string;
  targetName: string;
  targetRole?: RoomRole;
  viewerRole?: RoomRole;
  canManageParticipants: boolean;
  onActionSuccess?: (message: string) => void;
  onActionError?: (error: string) => void;
  onRosterMutated?: () => void;
}

export function ParticipantActionsMenu({
  roomSlug,
  targetUserId,
  targetName,
  targetRole,
  canManageParticipants,
  onActionSuccess,
  onActionError,
  onRosterMutated,
}: ParticipantActionsMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [loadingAction, setLoadingAction] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const isHost = targetRole === 'HOST';

  // Close when clicking outside
  useEffect(() => {
    if (!isOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  const toggleHostRole = useCallback(async () => {
    setLoadingAction('host');
    try {
      if (isHost) {
        const res = await fetch(`/api/studyroom/${roomSlug}/controllers/${targetUserId}`, {
          method: 'DELETE',
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to revoke host role');
        onActionSuccess?.(`Revoked Host role from ${targetName}`);
      } else {
        const res = await fetch(`/api/studyroom/${roomSlug}/controllers/${targetUserId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ role: 'HOST' }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to assign host role');
        onActionSuccess?.(`Promoted ${targetName} to Host`);
      }
      onRosterMutated?.();
    } catch (err: unknown) {
      onActionError?.(err instanceof Error ? err.message : 'Action failed');
    } finally {
      setLoadingAction(null);
      setIsOpen(false);
    }
  }, [roomSlug, targetUserId, targetName, isHost, onActionSuccess, onActionError, onRosterMutated]);

  const removeUser = useCallback(async () => {
    setLoadingAction('remove');
    try {
      const res = await fetch(`/api/studyroom/${roomSlug}/participants/${targetUserId}/remove`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: 'Removed by room manager' }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to remove participant');
      onActionSuccess?.(`Removed ${targetName} from the room`);
      onRosterMutated?.();
    } catch (err: unknown) {
      onActionError?.(err instanceof Error ? err.message : 'Failed to remove user');
    } finally {
      setLoadingAction(null);
      setIsOpen(false);
    }
  }, [roomSlug, targetUserId, targetName, onActionSuccess, onActionError, onRosterMutated]);

  const banUser = useCallback(async () => {
    setLoadingAction('ban');
    try {
      const res = await fetch(`/api/studyroom/${roomSlug}/restrictions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: targetUserId,
          action: 'BAN',
          reason: 'Banned by room manager',
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to ban participant');
      onActionSuccess?.(`Banned ${targetName} from the room`);
      onRosterMutated?.();
    } catch (err: unknown) {
      onActionError?.(err instanceof Error ? err.message : 'Failed to ban user');
    } finally {
      setLoadingAction(null);
      setIsOpen(false);
    }
  }, [roomSlug, targetUserId, targetName, onActionSuccess, onActionError, onRosterMutated]);

  if (!canManageParticipants || targetRole === 'OWNER') {
    return null;
  }

  return (
    <div className={styles.menuContainer} ref={menuRef}>
      <button
        type="button"
        className={styles.triggerBtn}
        aria-label={`Moderation actions for ${targetName}`}
        aria-haspopup="menu"
        aria-expanded={isOpen}
        onClick={() => setIsOpen((prev) => !prev)}
      >
        <MoreVertical size={14} />
      </button>

      {isOpen && (
        <div className={styles.dropdown} role="menu">
          <button
            type="button"
            role="menuitem"
            className={styles.menuItem}
            onClick={() => void toggleHostRole()}
            disabled={Boolean(loadingAction)}
          >
            {isHost ? (
              <>
                <ShieldX size={13} aria-hidden="true" />
                <span>Revoke Host</span>
              </>
            ) : (
              <>
                <Crown size={13} aria-hidden="true" />
                <span>Make Host</span>
              </>
            )}
          </button>

          <button
            type="button"
            role="menuitem"
            className={`${styles.menuItem} ${styles.dangerItem}`}
            onClick={() => void removeUser()}
            disabled={Boolean(loadingAction)}
          >
            <UserMinus size={13} aria-hidden="true" />
            <span>Remove (Kick)</span>
          </button>

          <button
            type="button"
            role="menuitem"
            className={`${styles.menuItem} ${styles.dangerItem}`}
            onClick={() => void banUser()}
            disabled={Boolean(loadingAction)}
          >
            <ShieldAlert size={13} aria-hidden="true" />
            <span>Ban User</span>
          </button>
        </div>
      )}
    </div>
  );
}

export default ParticipantActionsMenu;
