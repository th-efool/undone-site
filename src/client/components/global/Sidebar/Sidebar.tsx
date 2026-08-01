'use client';

import { useMemo } from 'react';
import { isNativeApp } from '@/src/client/utils/isNative';
import { Logo } from '../Logo';
import { SIDEBAR_ITEMS } from './sidebar.data';
import { SidebarItem } from './SidebarItem';

import styles from './Sidebar.module.css';

export function Sidebar() {
  const items = useMemo(() => {
    if (isNativeApp()) {
      return SIDEBAR_ITEMS.filter((item) => item.href !== '/message');
    }
    return SIDEBAR_ITEMS;
  }, []);

  return (
    <aside className={styles.sidebar}>
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
