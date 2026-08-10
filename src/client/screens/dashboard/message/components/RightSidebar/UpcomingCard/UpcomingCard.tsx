import { CalendarDays } from 'lucide-react';
import { UpcomingEvent } from '../../../models';
import styles from './UpcomingCard.module.css';
interface Props {
  event: UpcomingEvent;
}
export function UpcomingCard({ event }: Props) {
  return (
    <article className={styles.card}>
      <span className={`${styles.icon} ${styles[event.tone]}`}>
        <CalendarDays size={16} />
      </span>
      <div className={styles.details}>
        <strong className={styles.title}>{event.title}</strong>
        <span className={styles.time}>{event.startsIn}</span>
      </div>
    </article>
  );
}
