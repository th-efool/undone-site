import Image from 'next/image';

import type { CohortArchives } from '../../../../models';
import { SideCard } from '../SideCard/SideCard';

import styles from '../../Archives.module.css';

export function ContributorsCard({ archives }: { archives: CohortArchives }) {
  return (
    <SideCard
      title="Top Contributors"
      desc="Explorers who consistently share valuable knowledge."
    >
      <ol className={styles.contributors}>
        {archives.contributors.map((c) => (
          <li key={c.id}>
            <span>{archives.contributors.indexOf(c) + 1}</span>
            <Image
              src={c.avatarUrl}
              alt=""
              width={24}
              height={24}
            />
            <strong>{c.name}</strong>
            <em>{c.notes} notes</em>
          </li>
        ))}
      </ol>
    </SideCard>
  );
}
