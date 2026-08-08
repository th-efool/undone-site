import Image from 'next/image';
import Link from 'next/link';
import { getCohortHref } from '@/src/client/navigation/cohortLinks';
import { Bookmark, Users } from 'lucide-react';

import type { ArticlePreview } from '../../models';

import styles from './ArticleCard.module.css';

export interface ArticleCardProps {
  item: ArticlePreview;
}

export function ArticleCard({ item }: ArticleCardProps) {
  return (
    <article className={styles.card}>
      <Link
        href={getCohortHref(item.cohortId ?? item.id)}
        className={styles.content}
      >
        <Image
          src={item.thumbnail}
          alt=""
          className={styles.thumbnail}
         width={400} height={300}/>

        <div>
          <div className={styles.top}>
            <div>
              <h3 className={styles.title}>{item.title}</h3>

              <p className={styles.author}>By {item.author}</p>
            </div>

            <span className={styles.bookmark}>
              <Bookmark
                size={17}
                strokeWidth={2}
                fill={item.bookmarked ? 'currentColor' : 'none'}
              />
            </span>
          </div>

          <div className={styles.meta}>
            <span>
              <Users size={13} />

              {item.learnerCount}
            </span>

            <span>•</span>

            <span>{item.publishedLabel}</span>
          </div>
        </div>
      </Link>
    </article>
  );
}
