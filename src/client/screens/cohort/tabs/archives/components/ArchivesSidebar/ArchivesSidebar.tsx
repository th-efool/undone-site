import type { CohortArchives } from '../../../../models';
import { ContributorsCard } from '../ContributorsCard/ContributorsCard';
import { ShareKnowledgeCard } from '../ShareKnowledgeCard/ShareKnowledgeCard';
import { TrendingCard } from '../TrendingCard/TrendingCard';

import styles from '../../Archives.module.css';

export function ArchivesSidebar({ archives }: { archives: CohortArchives }) {
  return (
    <aside className={styles.sidebar}>
      <ContributorsCard archives={archives} />
      <TrendingCard archives={archives} />
      <ShareKnowledgeCard archives={archives} />
    </aside>
  );
}
