'use client';

import { useEffect, useRef } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import clsx from 'clsx';
import { getRouteTheme } from '@/src/client/config/routeThemeConfig';
import { SIDEBAR_ITEMS } from '@/src/client/components/global/Sidebar/sidebar.data';

import styles from './MobileNav.module.css';

export function MobileNav() {
  const pathname = usePathname();
  const isDarkTheme = getRouteTheme(pathname) === 'dark';
  const navRef = useRef<HTMLElement>(null);

  useEffect(() => {
    let cancelled = false;
    const vv = window.visualViewport;

    const webHandler = () => {
      const keyboardOpen = vv ? vv.height < window.innerHeight * 0.75 : false;
      navRef.current?.classList.toggle(styles.keyboardHidden, keyboardOpen);
    };

    // Watch for global advertMode variable
    // @ts-ignore
    if (typeof window.advertMode === 'undefined') window.advertMode = true;
    const advertInterval = setInterval(() => {
      // @ts-ignore
      if (window.advertMode) {
        navRef.current?.classList.add(styles.keyboardHidden);
      } else {
        // Only remove if keyboard isn't open
        const keyboardOpen = vv ? vv.height < window.innerHeight * 0.75 : false;
        if (!keyboardOpen) navRef.current?.classList.remove(styles.keyboardHidden);
      }
    }, 500);

    if (vv) vv.addEventListener('resize', webHandler);

    void (async () => {
      try {
        const capKeyboard = await import('@capacitor/keyboard');
        const Keyboard = capKeyboard.Keyboard;

        if (!cancelled && Keyboard) {
          await Keyboard.addListener('keyboardWillShow', () => {
            navRef.current?.classList.add(styles.keyboardHidden);
          });
          await Keyboard.addListener('keyboardWillHide', () => {
            navRef.current?.classList.remove(styles.keyboardHidden);
          });
        }
      } catch {
        // Web fallback handled above
      }
    })();

    return () => {
      cancelled = true;
      clearInterval(advertInterval);
      if (vv) vv.removeEventListener('resize', webHandler);
    };
  }, []);

  return (
    <nav
      ref={navRef}
      className={clsx(styles.mobileNav, isDarkTheme && styles.darkNav)}
      aria-label="Mobile Navigation"
    >
      <div className={styles.navigation}>
        {SIDEBAR_ITEMS.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href || (item.href !== '/home' && pathname.startsWith(item.href));

          return (
            <Link
              key={item.href}
              href={item.href}
              className={clsx(styles.navItem, isActive && styles.active)}
            >
              <Icon size={20} />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
