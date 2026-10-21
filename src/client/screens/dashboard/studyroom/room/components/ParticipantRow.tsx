'use client';

import React from 'react';
import { Crown, Shield } from 'lucide-react';
import type { RoomParticipantView } from '../../types';
import { ParticipantAvatar } from '../../components/ParticipantAvatar';
import { formatElapsed } from '../../utils/formatTime';
import ParticipantActionsMenu from './ParticipantActionsMenu';
import styles from './ParticipantPanel.module.css';

export interface ParticipantRowProps {
  participant: RoomParticipantView;
  now: number;
  roomSlug?: string;
  canManageParticipants?: boolean;
  onNotify?: (text: string) => void;
  onRosterMutated?: () => void;
}

export function ParticipantRow({
  participant,
  now,
  roomSlug,
  canManageParticipants = false,
  onNotify,
  onRosterMutated,
}: ParticipantRowProps) {
  const displayName = participant.displayName?.trim() || 'Guest';
  const elapsedMs = now - participant.joinedAt;
  const elapsedText = formatElapsed(elapsedMs);

  const isOwner = participant.role === 'OWNER';
  const isMod = participant.role === 'MODERATOR';
  const isHost = participant.role === 'HOST' || (participant.isAdmin && !participant.role && !isOwner);

  return (
    <li
      className={`${styles.row} ${participant.isCurrentUser ? styles.currentUserRow : ''}`}
      data-testid={`participant-row-${participant.userId}`}
    >
      <div className={styles.mainRow}>
        <div className={styles.avatarWrapper}>
          <ParticipantAvatar
            name={displayName}
            src={participant.avatarUrl}
            size={32}
          />
        </div>

        <div className={styles.info}>
          <div className={styles.nameRow}>
            <span className={styles.name} title={displayName}>
              {displayName}
            </span>
            <div className={styles.badges}>
              {participant.isCurrentUser && (
                <span className={styles.youBadge}>You</span>
              )}
              {isOwner && (
                <span className={styles.ownerBadge} title="Room owner">
                  <Crown size={12} aria-hidden="true" />
                  <span>Owner</span>
                </span>
              )}
              {isMod && (
                <span className={styles.modBadge} title="Room moderator">
                  <Shield size={12} aria-hidden="true" />
                  <span>Mod</span>
                </span>
              )}
              {isHost && (
                <span className={styles.hostBadge} title="Room host">
                  <Crown size={12} aria-hidden="true" />
                  <span>Host</span>
                </span>
              )}
            </div>
          </div>
        </div>

        <span className={styles.elapsed}>{elapsedText}</span>

        {canManageParticipants && roomSlug && !participant.isCurrentUser && !isOwner && (
          <ParticipantActionsMenu
            roomSlug={roomSlug}
            targetUserId={participant.userId}
            targetName={displayName}
            targetRole={participant.role}
            canManageParticipants={canManageParticipants}
            onActionSuccess={(msg) => onNotify?.(msg)}
            onActionError={(err) => onNotify?.(`Error: ${err}`)}
            onRosterMutated={onRosterMutated}
          />
        )}
      </div>

      {participant.publicGoal && participant.publicGoal.trim().length > 0 && (
        <p className={styles.publicGoal}>{participant.publicGoal}</p>
      )}
    </li>
  );
}

export default ParticipantRow;
