'use client';

import React from 'react';
import { Crown } from 'lucide-react';
import type { RoomParticipantView } from '../../types';
import { ParticipantAvatar } from '../../components/ParticipantAvatar';
import { formatElapsed } from '../../utils/formatTime';
import styles from './ParticipantPanel.module.css';

export interface ParticipantRowProps {
  participant: RoomParticipantView;
  now: number;
}

export function ParticipantRow({ participant, now }: ParticipantRowProps) {
  const displayName = participant.displayName?.trim() || 'Guest';
  const elapsedMs = now - participant.joinedAt;
  const elapsedText = formatElapsed(elapsedMs);

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
              {participant.isAdmin && (
                <span className={styles.hostBadge} title="Room host">
                  <Crown size={12} aria-hidden="true" />
                  <span>Host</span>
                </span>
              )}
            </div>
          </div>
        </div>

        <span className={styles.elapsed}>{elapsedText}</span>
      </div>

      {participant.publicGoal && participant.publicGoal.trim().length > 0 && (
        <p className={styles.publicGoal}>{participant.publicGoal}</p>
      )}
    </li>
  );
}

export default ParticipantRow;
