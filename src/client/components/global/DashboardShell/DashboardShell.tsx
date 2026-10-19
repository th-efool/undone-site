'use client';

import { useEffect } from 'react';
import type { PropsWithChildren } from 'react';
import { usePathname } from 'next/navigation';

import clsx from 'clsx';
import { getRouteTheme } from '@/src/client/config/routeThemeConfig';
import { useExperience } from '@/src/client/hooks/useExperience';
import { MobileNav } from '@/src/client/mobile/components/navigation/MobileNav/MobileNav';
import { prefetchDefaultFeed } from '@/src/client/screens/dashboard/play/hooks/usePlayback';
import { exploreRepository } from '@/src/client/repositories/exploreRepository';
import { Sidebar } from '../Sidebar';
import { NetworkOfflineIndicator } from '../NetworkOfflineIndicator/NetworkOfflineIndicator';
import { CommandPalette, CommandTriggerProvider, useCommandContext } from '../CommandPalette';
import { RoutePreserver } from './RoutePreserver';

import styles from './DashboardShell.module.css';

function DashboardInner({ children }: PropsWithChildren) {
  const pathname = usePathname();
  const experience = useExperience();
  const isPlayPage = pathname === '/play';
  const isDark = getRouteTheme(pathname) === 'dark';
  const { open, onOpenChange } = useCommandContext();

  // Warm up feed and explore caches on idle so clicking /play or /explore renders cached items at 0ms
  useEffect(() => {
    if (typeof window === 'undefined' || process.env.NODE_ENV === 'test') return;
    const timer = window.setTimeout(() => {
      if (pathname !== '/play') {
        void prefetchDefaultFeed();
      }
      if (pathname !== '/explore') {
        void exploreRepository.getExplore().catch(() => {});
      }
    }, 150);
    return () => window.clearTimeout(timer);
  }, [pathname]);

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
        data-theme={isDark ? "dark" : "light"}
        className={clsx(
          styles.shell,
          isPlayPage && styles.playShell,
          isDark && styles.darkShell
        )}
      >
        <NetworkOfflineIndicator />
        {experience === 'mobile' ? <MobileNav /> : <Sidebar />}
        <div
          id="main-content"
          className={clsx(
            styles.content,
            isPlayPage && styles.playContent
          )}
        >
          <RoutePreserver>{children}</RoutePreserver>
        </div>
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

