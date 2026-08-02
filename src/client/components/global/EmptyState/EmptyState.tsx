import Link from 'next/link';
import { Compass, Search } from 'lucide-react';
import clsx from 'clsx';

import styles from './EmptyState.module.css';

export interface EmptyStateProps {
  query?: string;
  icon?: React.ReactNode;
  title: string;
  description?: string;
  ctaLabel?: string;
  ctaHref?: string;
}

const defaultIcons = {
  search: <Search size={32} strokeWidth={1.5} />,
  compass: <Compass size={32} strokeWidth={1.5} />,
};

export function EmptyState({ query, icon, title, description = 'Try adjusting your filters or keywords to find what you\'re looking for.', ctaLabel = 'Browse all cohorts', ctaHref = '/explore' }: EmptyStateProps) {
  return (
    <div className={styles.emptyState}>
      <div className={styles.icon}>{icon ?? defaultIcons.search}</div>
      <h2 className={styles.title}>{title}</h2>
      <p className={styles.description}>{description}</p>
      {ctaLabel && ctaHref && (
        <Link
          href={ctaHref}
          className={styles.ctaButton}
        >
          {ctaLabel} →
        </Link>
      )}
    </div>
  );
}
