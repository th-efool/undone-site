import { ChevronRight } from 'lucide-react';

import styles from './SectionHeader.module.css';

export interface SectionHeaderProps {
  title: string;
  subtitle?: string;
  actionLabel?: string;
}

export function SectionHeader({ title, subtitle, actionLabel = 'See all' }: SectionHeaderProps) {
  return (
    <div className={styles.header}>
      <h2 className={styles.title}>{title}</h2>

      {subtitle && <p className={styles.subtitle}>{subtitle}</p>}

      <button
        type="button"
        className={styles.action}
      >
        {actionLabel}
        <ChevronRight
          size={18}
          strokeWidth={2.5}
        />
      </button>
    </div>
  );
}
