'use client';

import React from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { getCohortHref } from '@/src/client/navigation/cohortLinks';
import styles from './CohortCard.module.css';

export interface CohortParticipantPreview {
  id: string;
  image: string;
  alt?: string;
}

export interface CohortCardItem {
  id: string;
  cohortId?: string;
  title: string;
  subtitle: string;
  dailyGoal?: string;
  thumbnail: string;
  featuredParticipants: CohortParticipantPreview[];
  participantCount: string;
  href?: string;
}

export interface CohortCardProps {
  item: CohortCardItem;
  size?: 'standard' | 'compact';
  className?: string;
  priority?: boolean;
}

export function CohortCard({
  item,
  size = 'standard',
  className,
  priority = false,
}: CohortCardProps) {
  const subtitleLength = item.subtitle.length;

  const rawSubtitleWidth =
    subtitleLength <= 10
      ? 58
      : subtitleLength <= 14
        ? 68
        : subtitleLength <= 18
          ? 78
          : subtitleLength <= 22
            ? 88
            : subtitleLength <= 26
              ? 118
              : subtitleLength <= 30
                ? 132
                : subtitleLength <= 34
                  ? 150
                  : subtitleLength <= 38
                    ? 168
                    : subtitleLength <= 42
                      ? 184
                      : subtitleLength <= 46
                        ? 198
                        : subtitleLength <= 52
                          ? 200
                          : 228;

  const subtitleWidth = size === 'compact' ? Math.round(rawSubtitleWidth * 0.8) : rawSubtitleWidth;

  const cardClasses = [
    styles.card,
    size === 'compact' ? styles.cardCompact : styles.cardStandard,
    className,
  ]
    .filter(Boolean)
    .join(' ');

  const href = item.href || getCohortHref(item.cohortId ?? item.id);

  return (
    <Link
      href={href}
      className={cardClasses}
      aria-label={`${item.title}${item.dailyGoal ? ` - ${item.dailyGoal}` : ''}`}
    >
      <Image
        src={item.thumbnail}
        alt=""
        fill
        sizes="(max-width: 768px) 280px, 360px"
        className={styles.thumbnail}
        priority={priority}
        loading={priority ? undefined : 'lazy'}
      />

      <div className={styles.overlay} />

      <div className={styles.content}>
        <div className={styles.header}>
          <h3 className={styles.title}>{item.title}</h3>
          {item.dailyGoal && <span className={styles.goal}>{item.dailyGoal}</span>}
        </div>

        <p
          className={styles.subtitle}
          style={{
            maxWidth: subtitleWidth,
          }}
        >
          {item.subtitle}
        </p>

        <div className={styles.footer}>
          <div className={styles.avatars}>
            {item.featuredParticipants.map((participant) => (
              <Image
                key={participant.id}
                src={participant.image}
                alt={participant.alt || ''}
                width={27}
                height={27}
                className={styles.avatar}
              />
            ))}
          </div>

          <span className={styles.count}>{item.participantCount}</span>
        </div>
      </div>
    </Link>
  );
}
