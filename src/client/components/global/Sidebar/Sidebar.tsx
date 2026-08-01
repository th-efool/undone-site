'use client';

import { useMemo, useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';
import clsx from 'clsx';
import { isNativeApp } from '@/src/client/utils/isNative';
import { Logo } from '../Logo';
import { SIDEBAR_ITEMS } from './sidebar.data';
import { SidebarItem } from './SidebarItem';

import styles from './Sidebar.module.css';

export function Sidebar() {
  const pathname = usePathname();
  const isPlayPage = pathname === '/play';
  const sidebarRef = useRef<HTMLElement>(null);

  const items = useMemo(() => {
    if (isNativeApp()) {
      return SIDEBAR_ITEMS.filter((item) => item.href !== '/message');
    }
    return SIDEBAR_ITEMS;
  }, []);

  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    const handler = () => {
      const keyboardOpen = vv.height < window.innerHeight * 0.75;
      sidebarRef.current?.classList.toggle(styles.keyboardHidden, keyboardOpen);
    };
    vv.addEventListener('resize', handler);
    return () => vv.removeEventListener('resize', handler);
  }, []);

  return (
    <aside ref={sidebarRef} className={clsx(styles.sidebar, isPlayPage && styles.hiddenOnMobile)}>
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
