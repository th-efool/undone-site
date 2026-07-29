import Image from 'next/image';

import type { LegendEntry } from '../../../../models';

import styles from '../../HallOfFame.module.css';

export function LegendsRow({ item }: { item: LegendEntry }) {
  return (
    <article className={styles.legendRow}>
      <span>{item.rank}</span>
      <Image
        src={item.avatarUrl}
        alt=""
        width={36}
        height={36}
      />
      <div>
        <strong>{item.name}</strong>
        <p>{item.achievementTitle}</p>
      </div>
      <b>{item.primaryMetric}</b>
    </article>
  );
}
