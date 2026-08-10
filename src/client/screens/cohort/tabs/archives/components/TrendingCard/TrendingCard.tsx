import { TrendingUp } from 'lucide-react';

import type { CohortArchives } from '../../../../models';
import { SideCard } from '../SideCard/SideCard';

import styles from '../../Archives.module.css';

export function TrendingCard({ archives }: { archives: CohortArchives }) {
  return (
    <SideCard
      title="Trending This Week"
      desc="Most active and gaining traction."
    >
      <ol className={styles.trending}>
        {archives.trending.map((t) => (
          <li key={t.id}>
            <TrendingUp size={15} />
            <span>{t.title}</span>
            <strong>{t.score}</strong>
          </li>
        ))}
      </ol>
    </SideCard>
  );
}
