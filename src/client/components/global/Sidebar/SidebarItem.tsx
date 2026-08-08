'use client';

import { useRef } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { triggerHaptic } from '@/src/client/utils/haptics';
import { Tooltip } from '@/src/client/components/ui/Tooltip';

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
  const lastClickRef = useRef<number>(0);

  const isActive = pathname === href;

  const handleClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
    triggerHaptic('light');

    const now = Date.now();
    if (isActive && now - lastClickRef.current < 350) {
      e.preventDefault();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
    lastClickRef.current = now;
  };

  return (
    <Tooltip content={label} placement="right">
      <Link
        href={href}
        aria-label={label}
        onClick={handleClick}
        className={`${styles.item} ${isActive ? styles.active : ''}`}
      >
        <Icon
          size={22}
          strokeWidth={2}
        />
        <span className={styles.label}>{label}</span>
      </Link>
    </Tooltip>
  );
}

