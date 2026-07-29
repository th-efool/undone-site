import type { CohortEvents } from '../../../../models';
import { Card } from '../Card/Card';

import styles from '../../Events.module.css';

export function CalendarSync({ events }: { events: CohortEvents }) {
  return (
    <Card
      title="Sync Your Calendar"
      desc="Add events to your personal calendar and get reminders."
    >
      <div className={styles.sync}>
        {events.calendarSync.map((a) => (
          <button key={a.id}>
            <span>{a.icon}</span>
            {a.label}
          </button>
        ))}
      </div>
    </Card>
  );
}
