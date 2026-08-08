'use client';

import { useEffect } from 'react';
import type { PropsWithChildren } from 'react';
import { usePathname } from 'next/navigation';

import clsx from 'clsx';
import { getRouteTheme } from '@/src/client/config/routeThemeConfig';
import { Sidebar } from '../Sidebar';
import { NetworkOfflineIndicator } from '../NetworkOfflineIndicator/NetworkOfflineIndicator';
import { CommandPalette, CommandTriggerProvider, useCommandContext } from '../CommandPalette';

import styles from './DashboardShell.module.css';

function DashboardInner({ children }: PropsWithChildren) {
  const pathname = usePathname();
  const isPlayPage = pathname === '/play';
  const isDark = getRouteTheme(pathname) === 'dark';
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
        className={clsx(
          styles.shell,
          isPlayPage && styles.playShell,
          isDark && styles.darkShell
        )}
      >
        <NetworkOfflineIndicator />
        <Sidebar />
        <main
          className={clsx(
            styles.content,
            isPlayPage && styles.playContent
          )}
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
