import Image from 'next/image';
import Link from 'next/link';
import { getCohortHref } from '@/src/client/navigation/cohortLinks';

import type { TrendingCourse } from '../../models';

import styles from './TrendingCourseCard.module.css';
import { ProviderBadge } from '@/src/client/components/global/ProviderBadge';

export interface TrendingCourseCardProps {
  item: TrendingCourse;
}

export function TrendingCourseCard({ item }: TrendingCourseCardProps) {
  return (
    <Link
      href={getCohortHref(item.cohortId ?? item.id)}
      className={styles.card}
      draggable={false}
    >
      <Image
        src={item.thumbnail}
        alt=""
        draggable={false}
        className={styles.thumbnail}
       width={400} height={300} style={{ width: "100%", height: "auto", objectFit: "cover" }}/>

      <div className={styles.bottom}>
        <h3 className={styles.title}>{item.title}</h3>

        <div className={styles.footer}>
          <ProviderBadge
            provider={item.provider}
            label="Imported from"
          />

          <div className={styles.statsRight}>
            <div className={styles.avatars}>
              {item.featuredLearners.map((learner) => (
                <Image
                  key={learner.id}
                  src={learner.image}
                  alt=""
                  draggable={false}
                  className={styles.avatar}
                 width={400} height={300} style={{ width: "100%", height: "auto", objectFit: "cover" }}/>
              ))}
            </div>

            <span className={styles.learners}>{item.learnerCount}</span>
          </div>
        </div>
      </div>
    </Link>
  );
}
