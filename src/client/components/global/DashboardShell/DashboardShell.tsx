'use client';

import { useEffect } from 'react';
import type { PropsWithChildren } from 'react';
import { usePathname } from 'next/navigation';

import clsx from 'clsx';
import { resolveEffectiveTheme, applyThemeToDocument, getRouteTheme } from '@/src/client/config/routeThemeConfig';
import { useExperience } from '@/src/client/hooks/useExperience';
import { MobileNav } from '@/src/client/mobile/components/navigation/MobileNav/MobileNav';
import { prefetchDefaultFeed } from '@/src/client/screens/dashboard/play/hooks/usePlayback';
import { exploreRepository } from '@/src/client/repositories/exploreRepository';
import { useSession } from 'next-auth/react';
import { Sidebar } from '../Sidebar';
import { NetworkOfflineIndicator } from '../NetworkOfflineIndicator/NetworkOfflineIndicator';
import { RoutePreserver } from './RoutePreserver';
import dynamic from 'next/dynamic';
import { CommandTriggerProvider, useCommandContext } from '../CommandPalette';
import { RealtimeProvider } from '@/src/client/realtime';

const CommandPalette = dynamic(
  () => import('../CommandPalette').then((mod) => mod.CommandPalette),
  { ssr: false }
);

import styles from './DashboardShell.module.css';

function useSafeSession() {
  try {
    return useSession();
  } catch {
    return { data: null, status: 'unauthenticated' as const };
  }
}

function DashboardInner({ children }: PropsWithChildren) {
  const pathname = usePathname();
  const experience = useExperience();
  const isPlayPage = pathname === '/play';
  const effectiveTheme = resolveEffectiveTheme(pathname);
  const isDark = effectiveTheme === 'dark';
  const { open, onOpenChange } = useCommandContext();
  const { data: session } = useSafeSession();
  const userId = session?.user?.id ?? null;

  // Synchronize document.documentElement (<html>) and color-scheme with effective theme
  // Resolves Defect 3.1: ensures body portals and dialogs inherit route theme
  useEffect(() => {
    applyThemeToDocument(effectiveTheme);
  }, [pathname, effectiveTheme]);

  // Warm up feed and explore caches ONCE on initial idle mount (not on every route change)
  useEffect(() => {
    if (typeof window === 'undefined' || process.env.NODE_ENV === 'test') return;
    const runPrefetch = () => {
      void prefetchDefaultFeed(userId);
      void exploreRepository.getExplore().catch(() => {});
    };

    if ('requestIdleCallback' in window) {
      const handle = (window as any).requestIdleCallback(runPrefetch, { timeout: 3000 });
      return () => (window as any).cancelIdleCallback(handle);
    } else {
      const timer = setTimeout(runPrefetch, 1500);
      return () => clearTimeout(timer);
    }
  }, [userId]);

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
    <RealtimeProvider userId={userId}>
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
      {open && <CommandPalette open={open} onOpenChange={onOpenChange} />}
    </RealtimeProvider>
  );
}

export function DashboardShell({ children }: PropsWithChildren) {
  return (
    <CommandTriggerProvider>
      <DashboardInner>{children}</DashboardInner>
    </CommandTriggerProvider>
  );
}
