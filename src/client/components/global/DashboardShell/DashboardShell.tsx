'use client';

import type { PropsWithChildren } from 'react';

import { Sidebar } from '../Sidebar';

import styles from './DashboardShell.module.css';

export function DashboardShell({ children }: PropsWithChildren) {
  return (
    <div className={styles.shell}>
      <Sidebar />

      <main className={styles.content}>{children}</main>
    </div>
  );
}
