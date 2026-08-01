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
        // Prevent closing app if a modal/scrim is open - just go back
        const hasOpenModal = document.querySelector('.modal') || document.querySelector('.scrim');

        if (window.location.pathname.startsWith('/play')) {
          router.push('/home');
          return;
        }

        if (hasOpenModal || canGoBack) {
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

  // Route-based orientation locking & fullscreen & status bar mode:
  // - /play → lock landscape & request fullscreen & hide/dark status bar
  // - all other routes → lock portrait & exit fullscreen & light status bar
  useEffect(() => {
    if (!pathname) return;

    const isPlay = pathname === '/play' || pathname.startsWith('/play');

    // Handle Fullscreen for /play
    if (isPlay) {
      if (document.documentElement.requestFullscreen && !document.fullscreenElement) {
        document.documentElement.requestFullscreen().catch(() => {});
      }
    } else {
      if (document.fullscreenElement && document.exitFullscreen) {
        document.exitFullscreen().catch(() => {});
      }
    }

    if (!isNative) return;

    let cancelled = false;

    void (async () => {
      try {
        const [capOrientation, capStatusBar] = await Promise.all([
          import('@capacitor/screen-orientation').catch(() => null),
          import('@capacitor/status-bar').catch(() => null),
        ]);
        
        const ScreenOrientation = capOrientation?.ScreenOrientation;
        const StatusBar = capStatusBar?.StatusBar;
        const Style = capStatusBar?.Style;

        if (!cancelled) {
          if (isPlay) {
            await ScreenOrientation?.lock({ orientation: 'landscape' }).catch(() => {});
            await StatusBar?.setStyle({ style: Style?.Dark }).catch(() => {});
            await StatusBar?.hide().catch(() => {});
          } else {
            await ScreenOrientation?.lock({ orientation: 'portrait' }).catch(() => {});
            await StatusBar?.setStyle({ style: Style?.Light }).catch(() => {});
            await StatusBar?.show().catch(() => {});
          }
        }
      } catch {
        // Continue if plugins fail
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [isNative, pathname]);

  return null;
}
