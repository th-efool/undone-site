import { UpcomingEvent } from '../../../models';
import { UpcomingCard } from '../UpcomingCard/UpcomingCard';
import styles from './UpcomingEvents.module.css';
interface Props {
  items: UpcomingEvent[];
}
export function UpcomingEvents({ items }: Props) {
  return (
    <section className={styles.panel}>
      <header>
        <h2>Upcoming</h2>
        <button type="button">View all</button>
      </header>
      <div>
        {items.map((item) => (
          <UpcomingCard
            key={item.id}
            event={item}
          />
        ))}
      </div>
    </section>
  );
}
