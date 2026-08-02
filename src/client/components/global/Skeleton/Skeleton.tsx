import clsx from 'clsx';

import styles from './Skeleton.module.css';

export interface SkeletonProps {
  className?: string;
  rows?: number;
}

/**
 * Base skeleton component with shimmer animation.
 * Use `rows` for multi-line placeholders or combine multiple `<Skeleton />` elements.
 */
export function Skeleton({ className, rows }: SkeletonProps) {
  if (rows && rows > 0) {
    return (
      <div className={styles.group}>
        {Array.from({ length: rows }).map((_, i) => (
          <div
            key={i}
            className={clsx(styles.skeleton, className)}
          />
        ))}
      </div>
    );
  }

  return <div className={clsx(styles.skeleton, className)} />;
}
