'use client';

import React, { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { LiveSession } from '@/src/client/types/dashboard';
import styles from './StudyRoomCard.module.css';

export interface StudyRoomCardProps {
  session: LiveSession;
  variant?: 'standard' | 'compact';
}

const ROOM_MEMBER_COUNTS: Record<string, number> = {
  fireplace: 324,
  library: 412,
  seaside: 298,
  shrine: 176,
  canal: 253,
  ruins: 198,
};

const FALLBACK_THUMBNAIL = 'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?w=800&auto=format&fit=crop&q=80';

export const StudyRoomCard = React.memo(function StudyRoomCard({ session, variant = 'standard' }: StudyRoomCardProps) {
  const isCompact = variant === 'compact';
  const memberCount =
    ROOM_MEMBER_COUNTS[session.id.toLowerCase()] ||
    ROOM_MEMBER_COUNTS[session.title.toLowerCase()] ||
    (session.onlineCount ? session.onlineCount * 70 + 84 : 250);

  const [thumbSrc, setThumbSrc] = useState(session.thumbnail || FALLBACK_THUMBNAIL);
  if (isCompact) {
    return (
      <Link
        href="/message"
        className={styles.cardCompact}
        onDragStart={(e) => e.preventDefault()}
        draggable={false}
        aria-label={`${session.title} study room, ${session.status}, ${memberCount} members`}
      >
        <Image
          fill
          sizes="(max-width: 640px) 260px, (max-width: 1200px) 33vw, 180px"
          className={styles.bgCompact}
          src={thumbSrc}
          alt={session.title}
          draggable={false}
          onError={() => setThumbSrc(FALLBACK_THUMBNAIL)}
        />
        <div className={styles.overlayGradientCompact} />

        <div className={styles.overlayBarCompact}>
          <h3 className={styles.roomNameCompact}>{session.title}</h3>
          <div className={styles.bottomRowCompact}>
            <p className={styles.subtextCompact}>{session.status}</p>
            <div className={styles.avatarsCompact}>
              {session.avatars.slice(0, 2).map((person, i) => (
                <span
                  key={person.id}
                  className={styles.avatarWrapperCompact}
                  style={{ zIndex: 2 - i }}
                >
                  <Image
                    width={18}
                    height={18}
                    sizes="18px"
                    loading="lazy"
                    src={person.avatar}
                    alt=""
                    draggable={false}
                    className={styles.avatarCompact}
                    onError={(e) => {
                      (e.currentTarget as HTMLImageElement).style.visibility = 'hidden';
                    }}
                  />
                </span>
              ))}
              <span className={styles.memberCountBadgeCompact}>+{memberCount}</span>
            </div>
          </div>
        </div>
      </Link>
    );
  }

  return (
    <Link
      href="/message"
      className={styles.card}
      onDragStart={(e) => e.preventDefault()}
      draggable={false}
    >
      <Image
        width={800}
        height={600}
        sizes="(max-width: 768px) 100vw, 368px"
        className={styles.bg}
        src={thumbSrc}
        alt=""
        draggable={false}
        onError={() => setThumbSrc(FALLBACK_THUMBNAIL)}
      />

      <div className={styles.overlayBar}>
        <div className={styles.textStack}>
          <h3 className={styles.roomName}>{session.title}</h3>
          <p className={styles.subtext}>{session.status}</p>
        </div>
        <div className={styles.avatars}>
          {session.avatars.slice(0, 3).map((person) => (
            <span key={person.id} className={styles.avatarWrapper}>
              <Image
                width={27}
                height={27}
                sizes="27px"
                loading="lazy"
                src={person.avatar}
                alt=""
                draggable={false}
                className={styles.avatar}
              />
            </span>
          ))}
        </div>
      </div>
    </Link>
  );
});
