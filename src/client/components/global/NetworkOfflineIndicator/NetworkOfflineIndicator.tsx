'use client';

import { useEffect, useState } from 'react';
import clsx from 'clsx';
import { isNativeApp } from '@/src/client/utils/isNative';
import styles from './NetworkOfflineIndicator.module.css';

export function NetworkOfflineIndicator() {
  const [isOffline, setIsOffline] = useState(false);

  useEffect(() => {
    if (!isNativeApp()) return;

    let cancelled = false;

    // Use Web Fallback initially
    const handleOffline = () => setIsOffline(true);
    const handleOnline = () => setIsOffline(false);

    window.addEventListener('offline', handleOffline);
    window.addEventListener('online', handleOnline);
    setIsOffline(!window.navigator.onLine);

    // Override with Capacitor Network plugin if available
    void (async () => {
      try {
        const capNetwork = await import('@capacitor/network');
        const Network = capNetwork.Network;
        
        if (!cancelled && Network) {
          const status = await Network.getStatus();
          setIsOffline(!status.connected);

          await Network.addListener('networkStatusChange', (status) => {
            setIsOffline(!status.connected);
          });
        }
      } catch {
        // Fallback to web events
      }
    })();

    return () => {
      cancelled = true;
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('online', handleOnline);
    };
  }, []);

  return (
    <div className={clsx(styles.indicator, isOffline && styles.visible)}>
      <div className={styles.toast}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <line x1="1" y1="1" x2="23" y2="23"></line>
          <path d="M16.72 11.06A10.94 10.94 0 0 1 19 12.55"></path>
          <path d="M5 12.55a10.94 10.94 0 0 1 5.17-2.39"></path>
          <path d="M10.71 5.05A16 16 0 0 1 22.58 9"></path>
          <path d="M1.42 9a15.91 15.91 0 0 1 4.7-2.88"></path>
          <path d="M8.53 16.11a6 6 0 0 1 6.95 0"></path>
          <line x1="12" y1="20" x2="12.01" y2="20"></line>
        </svg>
        <span>You're offline. Some features may be unavailable.</span>
      </div>
    </div>
  );
}
