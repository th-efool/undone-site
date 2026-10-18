import React from 'react';
import { ChevronRight } from 'lucide-react';
import styles from './SectionHeader.module.css';

export interface SectionHeaderProps {
  title: string;
  subtitle?: string;
  actionLabel?: string;
  onAction?: () => void;
  children?: React.ReactNode;
  className?: string;
}

export function SectionHeader({
  title,
  subtitle,
  actionLabel = 'See all',
  onAction,
  children,
  className,
}: SectionHeaderProps) {
  return (
    <div className={`${styles.header} ${className || ''}`.trim()}>
      <div>
        <h2 className={styles.title}>{title}</h2>
        {subtitle && <p className={styles.subtitle}>{subtitle}</p>}
      </div>

      {children}

      {actionLabel && (
        <button
          type="button"
          className={styles.action}
          onClick={onAction}
        >
          {actionLabel}
          <ChevronRight
            size={18}
            strokeWidth={2.5}
          />
        </button>
      )}
    </div>
  );
}
