import Image from 'next/image';

import type { ArchiveItem } from '../../../../models';

import styles from '../../Archives.module.css';

export function ArchiveThumbnail({ item }: { item: ArchiveItem }) {
  return (
    <Image
      className={styles.thumb}
      src={item.thumbnail}
      alt=""
      width={168}
      height={78}
    />
  );
}
