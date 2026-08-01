'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';

function isCapacitorNative(): boolean {
  return typeof window !== 'undefined' && Boolean((window as Window & { Capacitor?: { isNativePlatform?: () => boolean; getPlatform?: () => string } }).Capacitor?.isNativePlatform?.());
}

function isMobileApp(): boolean {
  if (typeof window === 'undefined') return false;
  // Check for app-specific data attribute or capacitor native platform
  const hasDataAttr = document.documentElement.getAttribute('data-platform') === 'app';
  const isNativeCapacitor = Boolean((window as Window & { Capacitor?: { getPlatform?: () => string } }).Capacitor?.getPlatform?.()?.includes('android'));
  return hasDataAttr || isNativeCapacitor;
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
  const pathname = usePathname();
  const [isNative, setIsNative] = useState(false);

  useEffect(() => {
    const native = isCapacitorNative();
    setIsNative(native);

    if (!native) {
      return;
    }

    // Mark this as an app session for CSS isolation
    document.documentElement.setAttribute('data-platform', 'app');

    let cancelled = false;
    let removeAppUrlOpen: (() => void) | undefined;
    let removeBackButton: (() => void) | undefined;

    void (async () => {
      let App: any;
      try {
        const pkgName = '@capacitor/app';
        const capApp = await import(pkgName);
        App = capApp.App;
      } catch {
        return;
      }

      if (cancelled || !App) {
        return;
      }

      const launch = await App.getLaunchUrl();
      const launchPath = launch?.url ? normalizeDeepLinkPath(launch.url) : null;

      if (launchPath) {
        router.replace(launchPath);
      }

      const appUrlOpenHandle = await App.addListener('appUrlOpen', ({ url }: { url: string }) => {
        const path = normalizeDeepLinkPath(url);
        if (path) {
          router.push(path);
        }
      });

      removeAppUrlOpen = () => {
        void appUrlOpenHandle.remove();
      };

      const backButtonHandle = await App.addListener('backButton', ({ canGoBack }: { canGoBack: boolean }) => {
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
      document.documentElement.removeAttribute('data-platform');
    };
  }, [router]);

  // Route-based orientation locking:
  // - /play → lock landscape (the ONLY page meant for landscape)
  // - all other routes → unlock to natural sensor/orientation
  useEffect(() => {
    if (!isNative || !pathname) return;

    let cancelled = false;

    void (async () => {
      try {
        const ScreenOrientation = await import('@capacitor/screen-orientation');
        if ((ScreenOrientation as any).ScreenOrientation && !cancelled) {
          // Always unlock first to clear any stale lock
          await (ScreenOrientation as any).ScreenOrientation.unlock().catch(() => {});

          if (pathname === '/play') {
            await (ScreenOrientation as any).ScreenOrientation.lock({ orientation: 'landscape' }).catch(() => {});
          }
        }
      } catch {
        // No screen-orientation plugin available — continue without it
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [isNative, pathname]);

  return null;
}
