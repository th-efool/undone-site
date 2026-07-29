'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

import styles from './SidebarItem.module.css';

type SidebarItemProps = {
  href: string;
  label: string;
  icon: React.ComponentType<{
    size?: number;
    strokeWidth?: number;
  }>;
};

export function SidebarItem({ href, label, icon: Icon }: SidebarItemProps) {
  const pathname = usePathname();

  const isActive = pathname === href;

  return (
    <Link
      href={href}
      aria-label={label}
      className={`${styles.item} ${isActive ? styles.active : ''}`}
    >
      <Icon
        size={22}
        strokeWidth={2}
      />
    </Link>
  );
}
