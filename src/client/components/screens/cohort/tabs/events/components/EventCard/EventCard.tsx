import { Users } from 'lucide-react';

import type { EventItem } from '../../../../models';
import { EventActions } from '../EventActions/EventActions';
import { EventAttendance } from '../EventAttendance/EventAttendance';
import { EventDateCard } from '../EventDateCard/EventDateCard';

import styles from '../../Events.module.css';

export function EventCard({ item }: { item: EventItem }) {
  return (
    <article className={styles.eventCard}>
      <EventDateCard item={item} />
      <div className={styles.eventIcon}>
        <Users size={20} />
      </div>
      <div className={styles.eventBody}>
        <h3>{item.title}</h3>
        <p>{item.description}</p>
        <EventAttendance item={item} />
      </div>
      <EventActions item={item} />
    </article>
  );
}
