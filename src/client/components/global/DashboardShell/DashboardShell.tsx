'use client';

import { useEffect } from 'react';
import type { PropsWithChildren } from 'react';
import { usePathname } from 'next/navigation';

import { Sidebar } from '../Sidebar';
import { NetworkOfflineIndicator } from '../NetworkOfflineIndicator/NetworkOfflineIndicator';
import { CommandPalette, CommandTriggerProvider, useCommandContext } from '../CommandPalette';

import styles from './DashboardShell.module.css';

function DashboardInner({ children }: PropsWithChildren) {
  const pathname = usePathname();
  const isPlayPage = pathname === '/play';
  const isMessagePage = pathname === '/message' || pathname?.startsWith('/message/');
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
      <div
        className={`${styles.shell} ${isPlayPage ? styles.playShell : ''} ${
          isMessagePage ? styles.messageShell : ''
        }`}
      >
        <NetworkOfflineIndicator />
        <Sidebar />
        <main
          className={`${styles.content} ${isPlayPage ? styles.playContent : ''} ${
            isMessagePage ? styles.messageContent : ''
          }`}
        >
          {children}
        </main>
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
