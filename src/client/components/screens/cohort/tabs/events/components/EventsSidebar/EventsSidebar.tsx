import type { CohortEvents } from '../../../../models';
import { CalendarSync } from '../CalendarSync/CalendarSync';
import { SuggestEvent } from '../SuggestEvent/SuggestEvent';
import { ThisWeek } from '../ThisWeek/ThisWeek';

import styles from '../../Events.module.css';

export function EventsSidebar({ events }: { events: CohortEvents }) {
  return (
    <aside className={styles.sidebar}>
      <ThisWeek events={events} />
      <CalendarSync events={events} />
      <SuggestEvent events={events} />
    </aside>
  );
}
