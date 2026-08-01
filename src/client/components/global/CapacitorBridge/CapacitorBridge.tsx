'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

function isCapacitorNative(): boolean {
  return typeof window !== 'undefined' && Boolean((window as Window & { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor?.isNativePlatform?.());
}

function normalizeDeepLinkPath(url: string): string | null {
  try {
    const parsed = new URL(url);

    if (parsed.protocol === 'sidequesthq:') {
      const path = parsed.pathname || parsed.host;
      return path.startsWith('/') ? path : `/${path}`;
    }

    const allowedHosts = new Set(['sidequesthq.com', 'www.sidequesthq.com']);

    if (allowedHosts.has(parsed.hostname)) {
      return `${parsed.pathname}${parsed.search}${parsed.hash}` || '/';
    }
  } catch {
    return null;
  }

  return null;
}

export function CapacitorBridge() {
  const router = useRouter();

  useEffect(() => {
    if (!isCapacitorNative()) {
      return;
    }

    let cancelled = false;
    let removeAppUrlOpen: (() => void) | undefined;
    let removeBackButton: (() => void) | undefined;

    void (async () => {
      const { App } = await import('@capacitor/app');

      if (cancelled) {
        return;
      }

      const launch = await App.getLaunchUrl();
      const launchPath = launch?.url ? normalizeDeepLinkPath(launch.url) : null;

      if (launchPath) {
        router.replace(launchPath);
      }

      const appUrlOpenHandle = await App.addListener('appUrlOpen', ({ url }) => {
        const path = normalizeDeepLinkPath(url);
        if (path) {
          router.push(path);
        }
      });

      removeAppUrlOpen = () => {
        void appUrlOpenHandle.remove();
      };

      const backButtonHandle = await App.addListener('backButton', ({ canGoBack }) => {
        if (canGoBack) {
          window.history.back();
          return;
        }

        void App.exitApp();
      });

      removeBackButton = () => {
        void backButtonHandle.remove();
      };
    })();

    return () => {
      cancelled = true;
      removeAppUrlOpen?.();
      removeBackButton?.();
    };
  }, [router]);

  return null;
}
