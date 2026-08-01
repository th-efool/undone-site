'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

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
    let orientationSubscription: any;

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
      
      // Try to lock orientation on app launch (landscape preference)
      try {
        const ScreenOrientation = await import('@capacitor/screen-orientation');
        if ((ScreenOrientation as any).ScreenOrientation) {
          try {
            orientationSubscription = (ScreenOrientation as any).ScreenOrientation.addListener('screenOrientationChange', () => {
              // If user rotates to portrait on mobile screens, force back
              if (window.innerHeight > window.innerWidth) {
                void (ScreenOrientation as any).ScreenOrientation.lock({ orientation: 'landscape' }).catch(() => {});
              }
            });
          } catch (_e) {
            // Orientation plugin may not be installed or configured correctly, continue without it
          }
        }
      } catch {
        // No screen-orientation plugin available
      }
    })();

    return () => {
      cancelled = true;
      removeAppUrlOpen?.();
      removeBackButton?.();
      orientationSubscription?.remove();
      document.documentElement.removeAttribute('data-platform');
    };
  }, [router]);

  return null;
}
