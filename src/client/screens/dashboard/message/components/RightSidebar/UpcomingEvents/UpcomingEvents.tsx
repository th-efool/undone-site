'use client';

import { useState, useRef, useEffect } from 'react';
import { Calendar as CalendarIcon, ChevronDown } from 'lucide-react';
import { UpcomingEvent } from '../../../models';
import styles from './UpcomingEvents.module.css';

interface Props {
  items: UpcomingEvent[];
}

interface CalendarEvent {
  day: number;
  title: string;
  subtitle: string;
  dateStr: string;
  timeStr: string;
  tone: 'purple' | 'orange' | 'blue';
}

const mockCalendarEvents: Record<number, CalendarEvent[]> = {
  6: [
    {
      day: 6,
      title: 'Frontend Architecture Review',
      subtitle: 'Performance & Web Vitals',
      dateStr: 'Today',
      timeStr: '4:00 PM',
      tone: 'purple',
    },
  ],
  12: [
    {
      day: 12,
      title: 'System Design Interview Prep',
      subtitle: 'Distributed Caching',
      dateStr: 'Aug 12',
      timeStr: '6:30 PM',
      tone: 'orange',
    },
  ],
  19: [
    {
      day: 19,
      title: 'Open Source Contribution Hour',
      subtitle: 'Triage & Issue Hunting',
      dateStr: 'Aug 19',
      timeStr: '10:00 AM',
      tone: 'blue',
    },
  ],
  25: [
    {
      day: 25,
      title: 'Algorithm Deep Dive',
      subtitle: 'Dynamic Programming Patterns',
      dateStr: 'Aug 25',
      timeStr: '8:00 PM',
      tone: 'purple',
    },
  ],
  28: [
    {
      day: 28,
      title: 'Hackathon Kickoff',
      subtitle: 'Team Formation',
      dateStr: 'Aug 28',
      timeStr: '9:00 AM',
      tone: 'orange',
    },
  ],
  29: [
    {
      day: 29,
      title: 'Cloud Native Deployment',
      subtitle: 'Kubernetes Workshop',
      dateStr: 'Aug 29',
      timeStr: '2:00 PM',
      tone: 'blue',
    },
  ],
  31: [
    {
      day: 31,
      title: 'Monthly Townhall',
      subtitle: 'Roadmap Updates',
      dateStr: 'Aug 31',
      timeStr: '11:00 AM',
      tone: 'purple',
    },
  ],
};

const allUpcomingEvents = Object.values(mockCalendarEvents).flat().sort((a, b) => a.day - b.day);

const weekDays = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

export function UpcomingEvents({ items }: Props) {
  const [activeDay, setActiveDay] = useState<number | null>(null);

  // August 2026 starts on Saturday (offset 6)
  const totalDays = 31;
  const startOffset = 6;
  const currentDay = 6;

  const daysGrid = Array.from({ length: startOffset + totalDays }, (_, i) => {
    const dayNumber = i - startOffset + 1;
    return dayNumber > 0 ? dayNumber : null;
  });

  const timelineRef = useRef<HTMLDivElement>(null);
  const [visibleCount, setVisibleCount] = useState(allUpcomingEvents.length);

  useEffect(() => {
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const height = entry.contentRect.height;
        const itemHeight = 56; // min-height is 56px per item
        // gap is 0, padding-top is 4px. So total height is roughly 4 + count * 56
        const count = Math.floor((height - 4) / itemHeight);
        setVisibleCount(Math.max(1, Math.min(allUpcomingEvents.length, count)));
      }
    });

    if (timelineRef.current) {
      observer.observe(timelineRef.current);
    }

    return () => observer.disconnect();
  }, []);

  return (
    <section className={styles.panel}>
      <header className={styles.header}>
        <div className={styles.headerLeft}>
          <h2>Upcoming</h2>
          <span className={styles.monthLabel}>August 2026</span>
        </div>
        <button className={styles.providerSelector}>
          <CalendarIcon size={13} className={styles.providerIcon} />
          <span>Google Calendar</span>
          <ChevronDown size={14} className={styles.providerChevron} />
        </button>
      </header>

      <div className={styles.calendar}>
        <div className={styles.weekHeader}>
          {weekDays.map((d) => (
            <span key={d}>{d}</span>
          ))}
        </div>

        <div className={styles.grid}>
          {daysGrid.map((day, idx) => {
            if (!day) return <div key={`empty-${idx}`} className={styles.emptyCell} />;

            const events = mockCalendarEvents[day];
            const hasEvent = Boolean(events && events.length > 0);
            const isToday = day === currentDay;

            return (
              <div
                key={day}
                className={`${styles.dayCell} ${isToday ? styles.today : ''} ${
                  hasEvent ? styles.hasEvent : ''
                }`}
                onMouseEnter={() => hasEvent && setActiveDay(day)}
                onMouseLeave={() => setActiveDay(null)}
              >
                <span className={styles.dayNum}>{day}</span>
                {hasEvent && (
                  <span
                    className={`${styles.eventDot} ${styles[events[0].tone]}`}
                  />
                )}

                {hasEvent && activeDay === day && (
                  <div className={styles.tooltip}>
                    {events.map((ev, i) => (
                      <div key={i} className={styles.tooltipContent}>
                        <div className={`${styles.toneBar} ${styles[ev.tone]}`} />
                        <div>
                          <strong className={styles.eventTitle}>{ev.title}</strong>
                          <p className={styles.eventSub}>{ev.subtitle}</p>
                          <span className={styles.eventTime}>{ev.dateStr} • {ev.timeStr}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div className={styles.upNext}>
        <div className={styles.upNextLabel}>Up Next</div>
        <div className={styles.timeline} ref={timelineRef}>
          {allUpcomingEvents.slice(0, visibleCount).map((ev, i) => (
            <div key={i} className={styles.timelineItem}>
              <div className={styles.timeBlock}>
                <span className={styles.heroTime}>{ev.timeStr}</span>
                <span className={styles.heroDate}>{ev.dateStr}</span>
              </div>
              <div className={styles.timelineDivider}>
                <div className={`${styles.dot} ${styles[ev.tone + 'Bg']}`} />
                {i < visibleCount - 1 && <div className={styles.line} />}
              </div>
              <div className={styles.eventContent}>
                <strong className={styles.secondaryTitle}>{ev.title}</strong>
                <span className={styles.secondarySub}>{ev.subtitle}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
