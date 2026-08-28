'use client';

import { usePathname } from 'next/navigation';
import clsx from 'clsx';
import { getRouteTheme } from '@/src/client/config/routeThemeConfig';
import { Logo } from '../Logo';
import { SIDEBAR_ITEMS } from './sidebar.data';
import { SidebarItem } from './SidebarItem';
import { ProfilePill } from './ProfilePill';

import styles from './Sidebar.module.css';

export function Sidebar() {
  const pathname = usePathname();
  const isPlayPage = pathname === '/play';
  const isDarkTheme = getRouteTheme(pathname) === 'dark';

  return (
    <aside
      className={clsx(
        styles.sidebar,
        isPlayPage && styles.playSidebar,
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
        {SIDEBAR_ITEMS.map((item) => (
          <SidebarItem
            key={item.href}
            {...item}
          />
        ))}
      </nav>
      <ProfilePill />
    </aside>
  );
}
