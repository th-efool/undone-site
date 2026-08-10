import { Bell, ChevronRight } from 'lucide-react';
import { DMNotificationSettings } from '../../../../models';
import styles from './NotificationCard.module.css';
interface Props {
  notifications: DMNotificationSettings;
}
export function NotificationCard({ notifications }: Props) {
  return (
    <section className={styles.card}>
      <Bell size={20} />
      <strong>Notifications</strong>
      <span>{notifications.enabled ? 'On' : 'Off'}</span>
      <ChevronRight size={18} />
    </section>
  );
}
