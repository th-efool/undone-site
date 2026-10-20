'use client';

import React, { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import type { MockPeer, RoomDefinition } from '../types';
import { getBackground } from '../data/backgroundCatalog';
import { ParticipantAvatar } from './ParticipantAvatar';
import styles from './RoomCard.module.css';

export interface RoomCardProps {
  room: RoomDefinition;
  sampleCount: number;
  previewPeers: readonly MockPeer[] | MockPeer[];
}

export const RoomCard = React.memo(function RoomCard({
  room,
  sampleCount,
  previewPeers,
}: RoomCardProps) {
  const [imageFailed, setImageFailed] = useState(false);
  const background = getBackground(room.defaultEnvironment.backgroundId);
  const previewPeersSlice = previewPeers.slice(0, 3);

  return (
    <article
      className={styles.card}
      style={{ background: background.gradient }}
      data-testid={`room-card-${room.slug}`}
    >
      {/* Background illustration if available and not failed */}
      <div className={styles.imageWrapper}>
        {room.previewImage && !imageFailed && (
          <Image
            src={room.previewImage}
            alt=""
            fill
            sizes="(max-width: 768px) 100vw, 360px"
            onError={() => setImageFailed(true)}
            className={styles.image}
          />
        )}
      </div>

      {/* Scrim for text readability */}
      <div className={styles.scrim} aria-hidden="true" />

      {/* Text and meta content */}
      <div className={styles.content}>
        <div>
          <h2 className={styles.roomName}>{room.title}</h2>
          <p className={styles.atmosphere}>{room.atmosphere}</p>
        </div>

        <div className={styles.metaRow}>
          <div className={styles.presenceInfo}>
            <span className={styles.pulseDot} aria-hidden="true" />
            <span>{sampleCount} studying now · demo</span>
          </div>

          {previewPeersSlice.length > 0 && (
            <div
              className={styles.avatarStack}
              aria-label={`${previewPeers.length} sample peers`}
            >
              {previewPeersSlice.map((peer) => (
                <div key={peer.userId} className={styles.avatarItem}>
                  <ParticipantAvatar name={peer.displayName} size={24} />
                </div>
              ))}
            </div>
          )}
        </div>

        <div className={styles.actionRow}>
          <Link
            href={`/studyroom/${room.slug}`}
            prefetch={false}
            className={styles.enterLink}
          >
            <span>Enter room</span>
            <ArrowRight size={16} aria-hidden="true" />
          </Link>
        </div>
      </div>
    </article>
  );
});

export default RoomCard;
