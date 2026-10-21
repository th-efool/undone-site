'use client';

import React, { useMemo } from 'react';
import type { RoomParticipantView } from '../../types';
import ParticipantRow from './ParticipantRow';
import DemoDataNote from './DemoDataNote';
import styles from './ParticipantPanel.module.css';

export interface ParticipantPanelProps {
  participants: RoomParticipantView[];
  now: number;
  roomSlug?: string;
  canManageParticipants?: boolean;
  onNotify?: (text: string) => void;
  onRosterMutated?: () => void;
}

export function ParticipantPanel({
  participants,
  now,
  roomSlug,
  canManageParticipants = false,
  onNotify,
  onRosterMutated,
}: ParticipantPanelProps) {
  const sortedParticipants = useMemo(() => {
    return [...participants].sort((a, b) => {
      // 1. Current user first
      if (a.isCurrentUser) return -1;
      if (b.isCurrentUser) return 1;

      // 2. Host (admin) second
      if (a.isAdmin) return -1;
      if (b.isAdmin) return 1;

      // 3. Others ordered by joinedAt ascending (longest-present first)
      return a.joinedAt - b.joinedAt;
    });
  }, [participants]);

  const isAlone = participants.length === 1;

  return (
    <div className={styles.panel}>
      <ul className={styles.list} aria-label="Room participants">
        {sortedParticipants.map((participant) => (
          <ParticipantRow
            key={participant.userId}
            participant={participant}
            now={now}
            roomSlug={roomSlug}
            canManageParticipants={canManageParticipants}
            onNotify={onNotify}
            onRosterMutated={onRosterMutated}
          />
        ))}
      </ul>

      {isAlone && (
        <p className={styles.aloneNotice}>
          You&apos;re the only one here right now.
        </p>
      )}

      <DemoDataNote>
        Sample participants for preview. Live presence comes later.
      </DemoDataNote>
    </div>
  );
}

export default ParticipantPanel;
