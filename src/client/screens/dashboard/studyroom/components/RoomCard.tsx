'use client';

import React, { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { ArrowRight, Users, Lock } from 'lucide-react';
import type { MockPeer, RoomDefinition } from '../types';
import type { StudyRoomCardDTO } from '@/src/shared/studyroom/contracts';
import { getBackground } from '../data/backgroundCatalog';
import { ParticipantAvatar } from './ParticipantAvatar';
import styles from './RoomCard.module.css';

export interface RoomCardProps {
  room: RoomDefinition | StudyRoomCardDTO;
  sampleCount?: number;
  previewPeers?: readonly MockPeer[] | MockPeer[];
}

function isStudyRoomCardDTO(room: RoomDefinition | StudyRoomCardDTO): room is StudyRoomCardDTO {
  return 'onlineCount' in room && 'capacity' in room;
}

export const RoomCard = React.memo(function RoomCard({
  room,
  sampleCount,
  previewPeers = [],
}: RoomCardProps) {
  const [imageFailed, setImageFailed] = useState(false);

  const isDTO = isStudyRoomCardDTO(room);

  // Background and cover image resolution
  const backgroundId = isDTO
    ? room.visualPresetId || 'library'
    : room.defaultEnvironment.backgroundId;
  const background = getBackground(backgroundId);

  const previewImage = isDTO
    ? room.thumbnail || background.image
    : room.previewImage;

  const title = room.title;
  const description = isDTO
    ? room.description || 'Focus and quiet company'
    : room.atmosphere;

  const onlineCount = isDTO ? room.onlineCount : sampleCount ?? 0;
  const capacity = isDTO ? room.capacity : null;
  const isFull = isDTO ? room.onlineCount >= room.capacity : false;
  const isClosed = isDTO && room.status === 'CLOSED';
  const isDraft = isDTO && room.status === 'DRAFT';

  const previewPeersSlice = previewPeers.slice(0, 3);

  return (
    <article
      className={styles.card}
      style={{ background: background.gradient }}
      data-testid={`room-card-${room.slug}`}
    >
      {/* Scope and Status Badges */}
      {isDTO && (
        <div className={styles.badgeRow}>
          <span className={styles.scopeBadge}>
            {room.scopeKind === 'COHORT' ? (
              <>
                <Users size={12} aria-hidden="true" />
                <span>{room.cohortTitle || 'Cohort'}</span>
              </>
            ) : (
              <span>Public</span>
            )}
          </span>

          {isClosed ? (
            <span className={styles.statusBadge}>Closed</span>
          ) : isDraft ? (
            <span className={styles.statusBadge} style={{ color: '#fef08a', borderColor: '#fef08a' }}>Draft</span>
          ) : isFull ? (
            <span className={styles.statusBadge} style={{ color: '#fdba74', borderColor: '#fdba74' }}>Full</span>
          ) : room.listing === 'UNLISTED' ? (
            <span className={styles.scopeBadge} style={{ color: '#cbd5e1' }}>
              <Lock size={11} aria-hidden="true" />
              <span>Unlisted</span>
            </span>
          ) : null}
        </div>
      )}

      {/* Background illustration if available and not failed */}
      <div className={styles.imageWrapper}>
        {previewImage && !imageFailed && (
          <Image
            src={previewImage}
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
          <h2 className={styles.roomName}>{title}</h2>
          <p className={styles.atmosphere}>{description}</p>
        </div>

        {isDTO && room.tags && room.tags.length > 0 && (
          <div className={styles.tagRow}>
            {room.tags.slice(0, 3).map((tag) => (
              <span key={tag} className={styles.tagPill}>
                #{tag}
              </span>
            ))}
          </div>
        )}

        <div className={styles.metaRow}>
          <div className={styles.presenceInfo}>
            <span
              className={styles.pulseDot}
              style={{
                background: isClosed ? '#94a3b8' : isFull ? '#f97316' : '#22c55e',
              }}
              aria-hidden="true"
            />
            {isDTO ? (
              <span>
                {onlineCount} / {capacity} studying now
              </span>
            ) : (
              <span>{onlineCount} studying now · demo</span>
            )}
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
            <span>{isClosed ? 'View room' : 'Enter room'}</span>
            <ArrowRight size={16} aria-hidden="true" />
          </Link>
        </div>
      </div>
    </article>
  );
});

export default RoomCard;
