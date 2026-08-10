'use client';

import { usePathname } from 'next/navigation';
import clsx from 'clsx';
import { getRouteTheme } from '@/src/client/config/routeThemeConfig';
import { SocialLanding } from './components/SocialLanding/SocialLanding';
import type { UseMessageResult } from './hooks/useMessage';
import styles from './Message.module.css';

interface MessageDesktopProps {
  model: UseMessageResult;
}

export function MessageDesktop({ model: message }: MessageDesktopProps) {
  const pathname = usePathname();
  const isDark = getRouteTheme(pathname) === 'dark';

  return (
    <div className={clsx(styles.message, isDark ? styles.darkTheme : styles.lightTheme)}>
      <SocialLanding message={message} />
    </div>
  );
}
