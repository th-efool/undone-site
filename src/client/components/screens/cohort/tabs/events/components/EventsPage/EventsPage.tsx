import type { CohortEvents } from '../../../../models';
import { EventList } from '../EventList/EventList';
import { EventsFilters } from '../EventsFilters/EventsFilters';
import { EventsHeader } from '../EventsHeader/EventsHeader';
import { EventsSidebar } from '../EventsSidebar/EventsSidebar';

import styles from '../../Events.module.css';

export function EventsPage({ events }: { events: CohortEvents }) {
  return (
    <div className={styles.page}>
      <section className={styles.main}>
        <EventsHeader events={events} />
        <EventsFilters events={events} />
        <EventList items={events.upcomingEvents} />
        <button className={styles.load}>
          View Full Calendar <span>→</span>
        </button>
      </section>
      <EventsSidebar events={events} />
    </div>
  );
}
