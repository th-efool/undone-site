import type { ReactNode } from 'react';

import styles from '../../Events.module.css';

export function Card({
  title,
  desc,
  action,
  children,
}: {
  title: string;
  desc: string;
  action?: string;
  children: ReactNode;
}) {
  return (
    <section className={styles.sideCard}>
      <div className={styles.sideHead}>
        <div>
          <h3>{title}</h3>
          <p>{desc}</p>
        </div>
        {action ? <button>{action}</button> : null}
      </div>
      {children}
    </section>
  );
}
