'use client';

import { useMemo, useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';
import clsx from 'clsx';
import { isNativeApp } from '@/src/client/utils/isNative';
import { getRouteTheme } from '@/src/client/config/routeThemeConfig';
import { Logo } from '../Logo';
import { SIDEBAR_ITEMS } from './sidebar.data';
import { SidebarItem } from './SidebarItem';

import styles from './Sidebar.module.css';

export function Sidebar() {
  const pathname = usePathname();
  const isPlayPage = pathname === '/play';
  const isDarkTheme = getRouteTheme(pathname) === 'dark';
  const sidebarRef = useRef<HTMLElement>(null);

  const items = useMemo(() => {
    if (isNativeApp()) {
      return SIDEBAR_ITEMS.filter((item) => item.href !== '/message');
    }
    return SIDEBAR_ITEMS;
  }, []);

  useEffect(() => {
    let cancelled = false;

    // Use Web Fallback if Capacitor isn't ready
    const vv = window.visualViewport;
    const webHandler = () => {
      const keyboardOpen = vv ? vv.height < window.innerHeight * 0.75 : false;
      sidebarRef.current?.classList.toggle(styles.keyboardHidden, keyboardOpen);
    };

    if (vv) vv.addEventListener('resize', webHandler);

    // Native Capacitor Keyboard hook
    void (async () => {
      try {
        const capKeyboard = await import('@capacitor/keyboard');
        const Keyboard = capKeyboard.Keyboard;
        
        if (!cancelled && Keyboard) {
          await Keyboard.addListener('keyboardWillShow', () => {
            sidebarRef.current?.classList.add(styles.keyboardHidden);
          });
          await Keyboard.addListener('keyboardWillHide', () => {
            sidebarRef.current?.classList.remove(styles.keyboardHidden);
          });
        }
      } catch {
        // Fallback to webHandler
      }
    })();

    return () => {
      cancelled = true;
      if (vv) vv.removeEventListener('resize', webHandler);
    };
  }, []);

  return (
    <aside
      ref={sidebarRef}
      className={clsx(
        styles.sidebar,
        isPlayPage && styles.playSidebar,
        isPlayPage && styles.hiddenOnMobile,
        isDarkTheme && styles.darkSidebar
      )}
    >
      <Logo
        href="/home"
        iconOnly
        priority
        className={styles.logo}
        size={44}
      />
      <nav className={styles.navigation}>
        {items.map((item) => (
          <SidebarItem
            key={item.href}
            {...item}
          />
        ))}
      </nav>
    </aside>
  );
}
