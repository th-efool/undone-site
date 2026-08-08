import { usePathname } from 'next/navigation';
import clsx from 'clsx';
import { getRouteTheme } from '@/src/client/config/routeThemeConfig';
import { SocialLanding } from './components/SocialLanding/SocialLanding';
import { useMessage } from './hooks';
import styles from './Message.module.css';

export function Message() {
  const pathname = usePathname();
  const isDark = getRouteTheme(pathname) === 'dark';
  const message = useMessage();

  return (
    <div className={clsx(styles.message, isDark ? styles.darkTheme : styles.lightTheme)}>
      <SocialLanding message={message} />
    </div>
  );
}
