import Image from 'next/image';
import Link from 'next/link';
import { getCohortHref } from '@/src/client/navigation/cohortLinks';
import styles from './SideQuestCard.module.css';

import type { SideQuest } from '../../models';

export interface SideQuestCardProps {
  item: SideQuest;
}

export function SideQuestCard({ item }: SideQuestCardProps) {
  const subtitleLength = item.subtitle.length;

  const subtitleWidth =
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
  return (
    <Link
      href={getCohortHref(item.cohortId ?? item.id)}
      className={styles.card}
    >
      <Image
        src={item.thumbnail}
        alt=""
        className={styles.thumbnail}
       width={400} height={300}/>

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
                alt=""
                className={styles.avatar}
               width={400} height={300}/>
            ))}
          </div>

          <span className={styles.count}>{item.participantCount}</span>
        </div>
      </div>
    </Link>
  );
}
