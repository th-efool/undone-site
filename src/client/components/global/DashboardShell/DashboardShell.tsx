'use client';

import { useEffect } from 'react';
import type { PropsWithChildren } from 'react';

import { Sidebar } from '../Sidebar';
import { NetworkOfflineIndicator } from '../NetworkOfflineIndicator/NetworkOfflineIndicator';
import { CommandPalette, CommandTriggerProvider, useCommandContext } from '../CommandPalette';

import styles from './DashboardShell.module.css';

function DashboardInner({ children }: PropsWithChildren) {
  const { open, onOpenChange } = useCommandContext();

  // ⌘K / Ctrl+K global shortcut
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        onOpenChange((prev: boolean) => !prev);
      }
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onOpenChange]);

  return (
    <>
      <div className={styles.shell}>
        <NetworkOfflineIndicator />
        <Sidebar />
        <main className={styles.content}>{children}</main>
      </div>
      <CommandPalette open={open} onOpenChange={onOpenChange} />
    </>
  );
}

export function DashboardShell({ children }: PropsWithChildren) {
  return (
    <CommandTriggerProvider>
      <DashboardInner>{children}</DashboardInner>
    </CommandTriggerProvider>
  );
}
