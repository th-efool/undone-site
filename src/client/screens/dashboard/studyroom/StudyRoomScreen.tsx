'use client';

import React from 'react';
import { ROOM_CATALOG } from './data/roomCatalog';
import { MOCK_ROSTERS } from './data/mockRosters';
import { RoomCard } from './components/RoomCard';
import styles from './StudyRoomScreen.module.css';

export function StudyRoomScreen() {
  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <h1 className={styles.title}>Study Rooms</h1>
        <p className={styles.subtitle}>
          Shared rooms for quiet, focused company. Pick one and settle in.
        </p>
      </header>

      {ROOM_CATALOG.length === 0 ? (
        <p className={styles.emptyState}>No rooms available yet.</p>
      ) : (
        <div className={styles.grid}>
          {ROOM_CATALOG.map((room) => {
            const roster = MOCK_ROSTERS[room.slug] ?? [];
            return (
              <RoomCard
                key={room.slug}
                room={room}
                sampleCount={roster.length}
                previewPeers={roster}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}

export default StudyRoomScreen;
