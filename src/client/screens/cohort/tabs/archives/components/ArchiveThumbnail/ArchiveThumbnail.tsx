import Image from 'next/image';

import type { ArchiveItem } from '../../../../models';

import styles from '../../Archives.module.css';

export function ArchiveThumbnail({ item }: { item: ArchiveItem }) {
  const src = item.thumbnail || '/mock/covers/cohort-cover.webp';
  return (
    <Image
      className={styles.thumb}
      src={src}
      alt=""
      width={168}
      height={78}
    />
  );
}
