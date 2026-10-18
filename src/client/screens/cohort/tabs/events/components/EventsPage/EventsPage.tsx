'use client';

import { useState } from 'react';
import type { CohortEvents } from '../../../../models';
import { EventList } from '../EventList/EventList';
import { EventsFilters } from '../EventsFilters/EventsFilters';
import { EventsHeader } from '../EventsHeader/EventsHeader';
import { EventsSidebar } from '../EventsSidebar/EventsSidebar';
import { CalendarSync } from '../CalendarSync/CalendarSync';

import styles from '../../Events.module.css';

export function EventsPage({ events }: { events: CohortEvents }) {
  const [showSyncModal, setShowSyncModal] = useState(false);

  return (
    <div className={styles.page}>
      <section className={styles.main}>
        <EventsHeader events={events} />
        <EventsFilters events={events} />
        <EventList items={events.upcomingEvents} />
        <button
          className={styles.load}
          type="button"
          onClick={() => setShowSyncModal(true)}
        >
          View Full Calendar <span>&rarr;</span>
        </button>
      </section>
      <EventsSidebar events={events} />
      {showSyncModal && (
        <CalendarSync
          events={events}
          onClose={() => setShowSyncModal(false)}
        />
      )}
    </div>
  );
}
