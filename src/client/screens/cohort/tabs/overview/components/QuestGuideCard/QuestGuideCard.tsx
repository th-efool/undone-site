import Image from 'next/image';
import Link from 'next/link';

import type { Creator } from '../../../../models';

import styles from './QuestGuideCard.module.css';

interface QuestGuideCardProps {
  creator: Creator;
  cohortId?: string;
}

export function QuestGuideCard({ creator, cohortId }: QuestGuideCardProps) {
  return (
    <aside className={styles.card}>
      <h2 className={styles.title}>Quest Guide</h2>

      <div className={styles.profile}>
        <Image
          src={creator.avatarUrl || '/mock/avatars/a.webp'}
          alt=""
          width={64}
          height={64}
          className={styles.avatar}
        />
        <div>
          <h3 className={styles.name}>{creator.name}</h3>
          <p className={styles.role}>{creator.role}</p>
        </div>
      </div>

      <p className={styles.bio}>{creator.bio}</p>

      <Link
        href={cohortId ? `/message?community=${cohortId}` : '/message'}
        className={styles.button}
      >
        {creator.ctaLabel || 'Message Guide'}
      </Link>
    </aside>
  );
}
