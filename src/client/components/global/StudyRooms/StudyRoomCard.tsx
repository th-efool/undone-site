'use client';

import React from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { MoreVertical } from 'lucide-react';
import { LiveSession } from '@/src/client/types/dashboard';
import styles from './StudyRoomCard.module.css';

export interface StudyRoomCardProps {
  session: LiveSession;
  variant?: 'standard' | 'compact';
}

export function StudyRoomCard({ session, variant = 'standard' }: StudyRoomCardProps) {
  const isCompact = variant === 'compact';
  const memberCount = session.onlineCount
    ? session.onlineCount * 70 + 84
    : 120 + ((session.title.length * 43) % 300);

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
          sizes="180px"
          className={styles.bgCompact}
          src={session.thumbnail}
          alt={session.title}
          draggable={false}
        />
        <div className={styles.overlayGradientCompact} />

        <button
          type="button"
          className={styles.kebabBtnCompact}
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
          }}
          aria-label={`Options for ${session.title}`}
        >
          <MoreVertical size={14} strokeWidth={2.4} />
        </button>

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
                    src={person.avatar}
                    alt=""
                    draggable={false}
                    className={styles.avatarCompact}
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
        className={styles.bg}
        src={session.thumbnail}
        alt=""
        draggable={false}
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
}
