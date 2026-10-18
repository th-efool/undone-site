'use client';

import type { CohortEvents } from '../../../../models';
import { Card } from '../Card/Card';

import styles from '../../Events.module.css';

interface CalendarSyncProps {
  events: CohortEvents;
  onClose?: () => void;
}

export function CalendarSync({ events, onClose }: CalendarSyncProps) {
  const syncActions =
    events.calendarSync && events.calendarSync.length > 0
      ? events.calendarSync
      : [
          { id: 'google', label: 'Google Calendar', icon: '📅' },
          { id: 'apple', label: 'Apple / iCal', icon: '🍏' },
          { id: 'outlook', label: 'Outlook', icon: '📆' },
        ];

  const handleSync = (actionId: string) => {
    const firstEvent = events.upcomingEvents?.[0];
    if (actionId === 'google') {
      const text = encodeURIComponent(firstEvent?.title || 'Undone Cohort Session');
      const details = encodeURIComponent(firstEvent?.description || 'Cohort live session on Undone');
      window.open(
        `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${text}&details=${details}`,
        '_blank',
      );
    } else {
      const title = firstEvent?.title || 'Cohort Session';
      const description = firstEvent?.description || 'Cohort live session on Undone';
      const ics = `BEGIN:VCALENDAR\nVERSION:2.0\nPRODID:-//Undone//Cohort Events//EN\nBEGIN:VEVENT\nSUMMARY:${title}\nDESCRIPTION:${description}\nEND:VEVENT\nEND:VCALENDAR`;
      const blob = new Blob([ics], { type: 'text/calendar;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'cohort-events.ics';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }
  };

  const content = (
    <Card
      title="Sync Your Calendar"
      desc="Add events to your personal calendar and get reminders."
    >
      <div className={styles.sync}>
        {syncActions.map((a) => (
          <button key={a.id} type="button" onClick={() => handleSync(a.id)}>
            <span>{a.icon}</span>
            {a.label}
          </button>
        ))}
      </div>
    </Card>
  );

  if (onClose) {
    return (
      <div className={styles.modalOverlay} onClick={onClose} role="dialog" aria-modal="true">
        <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
          <div className={styles.modalHeader}>
            <h3>Full Cohort Calendar</h3>
            <button
              type="button"
              className={styles.closeButton}
              onClick={onClose}
              aria-label="Close"
            >
              &times;
            </button>
          </div>
          <div className={styles.modalBody}>
            {content}
          </div>
        </div>
      </div>
    );
  }

  return content;
}
