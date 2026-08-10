import Image from 'next/image';
import { Bookmark, MessageCircle } from 'lucide-react';

import type { ArchiveItem } from '../../../../models';
import { ArchiveThumbnail } from '../ArchiveThumbnail/ArchiveThumbnail';
import { ArchiveTypeBadge } from '../ArchiveTypeBadge/ArchiveTypeBadge';
import { ArchiveVoting } from '../ArchiveVoting/ArchiveVoting';

import styles from '../../Archives.module.css';

export function ArchiveCard({ item }: { item: ArchiveItem }) {
  return (
    <article className={styles.card}>
      <ArchiveThumbnail item={item} />
      <div className={styles.body}>
        <h3>
          {item.title} <ArchiveTypeBadge type={item.type} />
        </h3>
        <p>{item.description}</p>
        <div className={styles.author}>
          <Image
            src={item.author.avatarUrl}
            alt=""
            width={24}
            height={24}
          />
          {item.author.name}
          <span>·</span>
          {item.publishedAt}
        </div>
      </div>
      <ArchiveVoting count={item.voteCount} />
      <button className={styles.icon}>
        <Bookmark size={18} />
      </button>
      <button className={styles.comments}>
        <MessageCircle size={18} />
        {item.commentCount}
      </button>
    </article>
  );
}
