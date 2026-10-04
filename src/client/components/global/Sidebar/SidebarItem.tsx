'use client';

import { useRef } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { triggerHaptic } from '@/src/client/utils/haptics';
import { Tooltip } from '@/src/client/components/ui/Tooltip';

import clsx from 'clsx';
import styles from './SidebarItem.module.css';

type SidebarItemProps = {
  href: string;
  label: string;
  icon: React.ComponentType<{
    size?: number;
    strokeWidth?: number;
  }>;
  disabled?: boolean;
};

export function SidebarItem({ href, label, icon: Icon, disabled = false }: SidebarItemProps) {
  const pathname = usePathname();
  const lastClickRef = useRef<number>(0);

  const isActive = pathname === href;

  const handleClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
    if (disabled) {
      e.preventDefault();
      return;
    }

    triggerHaptic('light');

    const now = Date.now();
    if (isActive && now - lastClickRef.current < 350) {
      e.preventDefault();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
    lastClickRef.current = now;
  };

  return (
    <Tooltip content={disabled ? `${label} (Disabled)` : label} placement="right">
      <Link
        href={disabled ? '#' : href}
        aria-label={label}
        aria-disabled={disabled}
        onClick={handleClick}
        tabIndex={disabled ? -1 : undefined}
        className={clsx(
          styles.item,
          isActive && styles.active,
          disabled && styles.disabled
        )}
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

