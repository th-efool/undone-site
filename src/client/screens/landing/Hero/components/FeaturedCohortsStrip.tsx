'use client';

import React from 'react';
import { CohortCard, type CohortCardItem } from '@/src/client/components/global/CohortCard';
import { getAvatar } from '@/src/client/mock/avatars';
import styles from '../Hero.module.css';

const FEATURED_COHORTS: CohortCardItem[] = [
  {
    id: 'deep-work',
    title: 'Deep Work Month',
    subtitle: 'Stay off. Do what\nmatters.',
    dailyGoal: '20 min/day',
    thumbnail: '/mock/thumbnails/deep-work.webp',
    participantCount: '874 participants',
    featuredParticipants: [
      { id: 'dw-1', image: getAvatar('dw-1'), alt: 'dw-1' },
      { id: 'dw-2', image: getAvatar('dw-2'), alt: 'dw-2' },
      { id: 'dw-3', image: getAvatar('dw-3'), alt: 'dw-3' },
    ],
    href: '/cohort/deep-work',
  },
  {
    id: 'reader',
    title: 'Become a Reader Again',
    subtitle: 'Rebuild the habit. Read\nwith intention.',
    dailyGoal: '15 min/day',
    thumbnail: '/mock/thumbnails/reader.webp',
    participantCount: '1,243 participants',
    featuredParticipants: [
      { id: 'read-1', image: getAvatar('read-1'), alt: 'read-1' },
      { id: 'read-2', image: getAvatar('read-2'), alt: 'read-2' },
      { id: 'read-3', image: getAvatar('read-3'), alt: 'read-3' },
    ],
    href: '/cohort/reader',
  },
  {
    id: 'body-double',
    title: 'Body Doubling Room',
    subtitle: 'Focus better\ntogether.',
    thumbnail: '/mock/thumbnails/doubling.webp',
    participantCount: '482 participants',
    featuredParticipants: [
      { id: 'bd-1', image: getAvatar('bd-1'), alt: 'bd-1' },
      { id: 'bd-2', image: getAvatar('bd-2'), alt: 'bd-2' },
      { id: 'bd-3', image: getAvatar('bd-3'), alt: 'bd-3' },
    ],
    href: '/cohort/body-double',
  },
  {
    id: 'content-bottle',
    title: 'Your Content in a Bottle',
    subtitle: 'Consumption detox. Curate\nwhat you actually want.',
    thumbnail: '/mock/thumbnails/content-bottle.webp',
    participantCount: '1,102 participants',
    featuredParticipants: [
      { id: 'cb-1', image: getAvatar('cb-1'), alt: 'cb-1' },
      { id: 'cb-2', image: getAvatar('cb-2'), alt: 'cb-2' },
      { id: 'cb-3', image: getAvatar('cb-3'), alt: 'cb-3' },
    ],
    href: '/cohort/content-bottle',
  },
  {
    id: '100-days',
    title: '100 Days of Code',
    subtitle: 'Code daily. Stay\naccountable.',
    dailyGoal: '30 min/day',
    thumbnail: '/mock/thumbnails/100dcode.jpg',
    participantCount: '2,016 participants',
    featuredParticipants: [
      { id: '100d-1', image: getAvatar('100d-1'), alt: '100d-1' },
      { id: '100d-2', image: getAvatar('100d-2'), alt: '100d-2' },
      { id: '100d-3', image: getAvatar('100d-3'), alt: '100d-3' },
    ],
    href: '/cohort/100-days',
  },
  {
    id: 'journaling',
    title: 'Daily Reflection',
    subtitle: 'Think clearly. Write\nconsistently.',
    dailyGoal: '10 min/day',
    thumbnail: '/mock/thumbnails/reflections.jpeg',
    participantCount: '691 participants',
    featuredParticipants: [
      { id: 'jrn-1', image: getAvatar('jrn-1'), alt: 'jrn-1' },
      { id: 'jrn-2', image: getAvatar('jrn-2'), alt: 'jrn-2' },
      { id: 'jrn-3', image: getAvatar('jrn-3'), alt: 'jrn-3' },
    ],
    href: '/cohort/journaling',
  },
];

export function FeaturedCohortsStrip() {
  // Duplicate for seamless infinite marquee loop
  const marqueeItems = [...FEATURED_COHORTS, ...FEATURED_COHORTS];

  return (
    <div className={styles.cohortsStripContainer} aria-label="Featured Cohorts">
      <div className={styles.cohortsMarqueeTrack}>
        {marqueeItems.map((cohort, index) => (
          <CohortCard
            key={`${cohort.id}-${index}`}
            item={cohort}
            size="compact"
            priority={index < 4}
          />
        ))}
      </div>
    </div>
  );
}
