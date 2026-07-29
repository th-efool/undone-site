import { EventStatus, type EventItem } from '../../../../models';

import styles from '../../Events.module.css';

export function EventStatusBadge({ item }: { item: EventItem }) {
  return (
    <span className={`${styles.platform} ${styles[item.status]}`}>
      {statusText[item.status]} ({item.platform})
    </span>
  );
}

const statusText = {
  [EventStatus.Upcoming]: 'Online',
  [EventStatus.Live]: 'Live',
  [EventStatus.Completed]: 'Completed',
  [EventStatus.Cancelled]: 'Cancelled',
};
