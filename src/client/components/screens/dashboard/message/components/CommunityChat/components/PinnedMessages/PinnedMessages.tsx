import Image from 'next/image';
/* eslint-disable @next/next/no-img-element */
import { PinnedMessage } from '../../../../models';
import styles from './PinnedMessages.module.css';

interface Props {
  items: PinnedMessage[];
}

export function PinnedMessages({ items }: Props) {
  return (
    <div className={styles.list}>
      {items.map((item) => (
        <article key={item.id} className={styles.card}>
          <Image
            width={28}
            height={28}
            src={item.author.avatar}
            alt={item.author.name}
            className={styles.avatar}
          />
          <div className={styles.content}>
            <span className={styles.author}>{item.author.name}</span>
            <p className={styles.preview}>{item.preview}</p>
            <time className={styles.timestamp}>{item.timestamp}</time>
          </div>
        </article>
      ))}
    </div>
  );
}
