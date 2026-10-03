'use client';

import React from 'react';
import clsx from 'clsx';
import styles from './Ikigai.module.css';

export interface IkigaiProps {
  id?: string;
  className?: string;
  children?: React.ReactNode;
}

/**
 * Section 3: Ikigai section of the landing page.
 * Kept clean and empty ready for ikigai curriculum and learning paths.
 */
export function Ikigai({ id = 'ikigai', className, children }: IkigaiProps) {
  return (
    <section id={id} className={clsx(styles.ikigaiSection, className)}>
      <div className={styles.container}>
        {children ?? null}
      </div>
    </section>
  );
}
