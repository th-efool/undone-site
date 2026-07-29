import { CalendarDays } from 'lucide-react';
import { CommunityEvent } from '../../../../models';
import styles from './UpcomingEvents.module.css';
interface Props {
  events: CommunityEvent[];
}
export function UpcomingEvents({ events }: Props) {
  return (
    <div className={styles.events}>
      {events.map((event) => (
        <article key={event.id}>
          <span>
            <CalendarDays size={19} />
          </span>
          <div>
            <strong>{event.title}</strong>
            <p>{event.subtitle}</p>
            <em>{event.startsIn}</em>
          </div>
          <button type="button">Join</button>
        </article>
      ))}
    </div>
  );
}
