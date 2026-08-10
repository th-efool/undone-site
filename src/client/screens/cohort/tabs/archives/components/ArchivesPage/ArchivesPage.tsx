import type { CohortArchives } from '../../../../models';
import { ArchiveFeed } from '../ArchiveFeed/ArchiveFeed';
import { ArchiveFilters } from '../ArchiveFilters/ArchiveFilters';
import { ArchiveSearch } from '../ArchiveSearch/ArchiveSearch';
import { ArchivesHeader } from '../ArchivesHeader/ArchivesHeader';
import { ArchivesSidebar } from '../ArchivesSidebar/ArchivesSidebar';
import { SortingControls } from '../SortingControls/SortingControls';

import styles from '../../Archives.module.css';

export function ArchivesPage({ archives }: { archives: CohortArchives }) {
  return (
    <div className={styles.page}>
      <section className={styles.main}>
        <ArchivesHeader archives={archives} />
        <ArchiveFilters archives={archives} />
        <div className={styles.tools}>
          <ArchiveSearch />
          <SortingControls archives={archives} />
        </div>
        <ArchiveFeed items={archives.items} />
        <button className={styles.load}>Load More⌄</button>
      </section>
      <ArchivesSidebar archives={archives} />
    </div>
  );
}
