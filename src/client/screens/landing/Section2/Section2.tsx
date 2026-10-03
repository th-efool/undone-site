'use client';

import React from 'react';
import clsx from 'clsx';
import styles from './Section2.module.css';

export interface Section2Props {
  id?: string;
  className?: string;
  children?: React.ReactNode;
}

/**
 * Section 2 of the landing page.
 * Kept clean and empty for future feature / curriculum / explore content.
 */
export function Section2({ id = 'explore', className, children }: Section2Props) {
  return (
    <section id={id} className={clsx(styles.section2, className)}>
      <div className={styles.container}>
        {children ?? null}
      </div>
    </section>
  );
}
