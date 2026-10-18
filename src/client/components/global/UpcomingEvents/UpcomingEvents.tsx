'use client';

import { useState, useRef, useEffect } from 'react';
import {
  Calendar as CalendarIcon,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  MoreVertical,
  Plus,
} from 'lucide-react';
import { UpcomingEvent } from '@/src/client/types/dashboard';
import styles from './UpcomingEvents.module.css';

export interface UpcomingEventsProps {
  items?: UpcomingEvent[];
  variant?: 'light' | 'dark';
  showAddTask?: boolean;
  onAddTask?: () => void;
  className?: string;
}

interface CalendarEvent {
  id?: string;
  day: number;
  title: string;
  subtitle: string;
  dateStr: string;
  timeStr: string;
  endTimeStr?: string;
  tone: 'purple' | 'orange' | 'blue';
}

interface CalendarCell {
  day: number;
  isCurrentMonth: boolean;
}

const mockCalendarEvents: Record<number, CalendarEvent[]> = {
  6: [
    {
      id: 'e1',
      day: 6,
      title: 'Frontend Architecture Review',
      subtitle: 'Performance & Web Vitals',
      dateStr: 'Today',
      timeStr: '9:00 AM',
      endTimeStr: '10:00 AM',
      tone: 'blue',
    },
    {
      id: 'e2',
      day: 6,
      title: 'System Design Interview Prep',
      subtitle: 'Distributed Caching',
      dateStr: 'Today',
      timeStr: '1:00 PM',
      endTimeStr: '1:30 PM',
      tone: 'orange',
    },
    {
      id: 'e3',
      day: 6,
      title: 'Open Source Contribution Hour',
      subtitle: 'Triage & Issue Hunting',
      dateStr: 'Today',
      timeStr: '4:00 PM',
      endTimeStr: '5:00 PM',
      tone: 'blue',
    },
    {
      id: 'e4',
      day: 6,
      title: 'Read: Designing Data-Intensive...',
      subtitle: 'Chapter 3',
      dateStr: 'Today',
      timeStr: '8:00 PM',
      endTimeStr: '8:30 PM',
      tone: 'blue',
    },
  ],
  12: [
    {
      id: 'e5',
      day: 12,
      title: 'Distributed Caching Deep Dive',
      subtitle: 'System Architecture',
      dateStr: 'Aug 12',
      timeStr: '6:30 PM',
      endTimeStr: '7:30 PM',
      tone: 'blue',
    },
  ],
  19: [
    {
      id: 'e6',
      day: 19,
      title: 'Open Source Contribution Hour',
      subtitle: 'Triage & Issue Hunting',
      dateStr: 'Aug 19',
      timeStr: '10:00 AM',
      endTimeStr: '11:00 AM',
      tone: 'blue',
    },
  ],
  25: [
    {
      id: 'e7',
      day: 25,
      title: 'Algorithm Deep Dive',
      subtitle: 'Dynamic Programming Patterns',
      dateStr: 'Aug 25',
      timeStr: '8:00 PM',
      endTimeStr: '9:00 PM',
      tone: 'blue',
    },
  ],
  27: [
    {
      id: 'e8',
      day: 27,
      title: 'Cloud Native Deployment',
      subtitle: 'Kubernetes Workshop',
      dateStr: 'Aug 27',
      timeStr: '2:00 PM',
      endTimeStr: '3:30 PM',
      tone: 'blue',
    },
  ],
  28: [
    {
      id: 'e9',
      day: 28,
      title: 'Hackathon Kickoff',
      subtitle: 'Team Formation',
      dateStr: 'Aug 28',
      timeStr: '9:00 AM',
      endTimeStr: '10:30 AM',
      tone: 'orange',
    },
  ],
  29: [
    {
      id: 'e10',
      day: 29,
      title: 'AI Prompt Engineering',
      subtitle: 'Hands-on Lab',
      dateStr: 'Aug 29',
      timeStr: '11:00 AM',
      endTimeStr: '12:00 PM',
      tone: 'blue',
    },
  ],
  31: [
    {
      id: 'e11',
      day: 31,
      title: 'Monthly Townhall',
      subtitle: 'Roadmap Updates',
      dateStr: 'Aug 31',
      timeStr: '11:00 AM',
      endTimeStr: '12:00 PM',
      tone: 'purple',
    },
  ],
};

const allUpcomingEvents = Object.values(mockCalendarEvents).flat().sort((a, b) => a.day - b.day);

const weekDays = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

export function UpcomingEvents({
  items,
  variant = 'dark',
  showAddTask = false,
  onAddTask,
  className,
}: UpcomingEventsProps) {
  const isLight = variant === 'light';
  const currentDay = 6;
  const [selectedDay, setSelectedDay] = useState<number>(currentDay);
  const [hoveredDay, setHoveredDay] = useState<number | null>(null);

  // August 2026 starts on Saturday (offset 6)
  // July preceding days: 26, 27, 28, 29, 30, 31 (6 days)
  // August days: 1 .. 31 (31 days)
  // September following days: 1 .. 5 (5 days) -> Total = 42 cells
  const daysGrid: CalendarCell[] = [
    { day: 26, isCurrentMonth: false },
    { day: 27, isCurrentMonth: false },
    { day: 28, isCurrentMonth: false },
    { day: 29, isCurrentMonth: false },
    { day: 30, isCurrentMonth: false },
    { day: 31, isCurrentMonth: false },
    ...Array.from({ length: 31 }, (_, i) => ({ day: i + 1, isCurrentMonth: true })),
    { day: 1, isCurrentMonth: false },
    { day: 2, isCurrentMonth: false },
    { day: 3, isCurrentMonth: false },
    { day: 4, isCurrentMonth: false },
    { day: 5, isCurrentMonth: false },
  ];

  const timelineRef = useRef<HTMLDivElement>(null);

  // Events to render in timeline
  const activeEvents: CalendarEvent[] = isLight
    ? mockCalendarEvents[selectedDay] || mockCalendarEvents[currentDay] || []
    : (items && items.length > 0)
    ? items.map((it, idx) => ({
        id: it.id,
        day: currentDay + idx,
        title: it.title,
        subtitle: it.subtitle,
        dateStr: it.startsIn,
        timeStr: it.startsIn,
        tone: it.tone,
      }))
    : allUpcomingEvents;

  const [visibleCount, setVisibleCount] = useState(activeEvents.length);

  useEffect(() => {
    setVisibleCount(activeEvents.length);
  }, [activeEvents.length]);

  return (
    <section
      className={`${styles.panel} ${isLight ? styles.lightVariant : ''} ${className || ''}`.trim()}
    >
      <header className={styles.header}>
        <div className={styles.headerLeft}>
          <h2>Upcoming</h2>
        </div>
        <button type="button" className={styles.providerSelector}>
          {isLight ? (
            <svg
              width="13"
              height="13"
              viewBox="0 0 24 24"
              fill="none"
              className={styles.googleIcon}
              aria-hidden="true"
            >
              <path
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                fill="#4285F4"
              />
              <path
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                fill="#34A853"
              />
              <path
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                fill="#FBBC05"
              />
              <path
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                fill="#EA4335"
              />
            </svg>
          ) : (
            <CalendarIcon size={13} className={styles.providerIcon} />
          )}
          <span>Google Calendar</span>
          <ChevronDown size={13} className={styles.providerChevron} />
        </button>
      </header>

      <div className={styles.calendar}>
        <div className={styles.calendarNavRow}>
          <span className={styles.monthLabel}>August 2026</span>
          <div className={styles.monthNavButtons}>
            <button
              type="button"
              className={styles.navBtn}
              aria-label="Previous month"
            >
              <ChevronLeft size={14} />
            </button>
            <button
              type="button"
              className={styles.navBtn}
              aria-label="Next month"
            >
              <ChevronRight size={14} />
            </button>
          </div>
        </div>

        <div className={styles.weekHeader}>
          {weekDays.map((d) => (
            <span key={d}>{d}</span>
          ))}
        </div>

        <div className={styles.grid}>
          {daysGrid.map((cell, idx) => {
            const { day, isCurrentMonth } = cell;
            const events = isCurrentMonth ? mockCalendarEvents[day] : undefined;
            const hasEvent = Boolean(events && events.length > 0);
            const isToday = isCurrentMonth && day === currentDay;
            const isSelected = isCurrentMonth && day === selectedDay;

            return (
              <div
                key={`${isCurrentMonth ? 'm' : 'o'}-${day}-${idx}`}
                className={`${styles.dayCell} ${!isCurrentMonth ? styles.outsideDay : ''} ${
                  isToday ? styles.today : ''
                } ${isSelected && !isToday ? styles.selectedDay : ''} ${
                  hasEvent ? styles.hasEvent : ''
                }`}
                onClick={() => {
                  if (isCurrentMonth) {
                    setSelectedDay(day);
                  }
                }}
                onMouseEnter={() => {
                  if (hasEvent) setHoveredDay(day);
                }}
                onMouseLeave={() => setHoveredDay(null)}
              >
                <span className={styles.dayNum}>{day}</span>
                {hasEvent && isCurrentMonth && !isToday && (
                  <span
                    className={`${styles.eventDot} ${styles[events[0].tone]}`}
                  />
                )}

                {hasEvent && hoveredDay === day && (
                  <div className={styles.tooltip}>
                    {events.map((ev, i) => (
                      <div key={i} className={styles.tooltipContent}>
                        <div className={`${styles.toneBar} ${styles[ev.tone]}`} />
                        <div>
                          <strong className={styles.eventTitle}>{ev.title}</strong>
                          <p className={styles.eventSub}>{ev.subtitle}</p>
                          <span className={styles.eventTime}>
                            {ev.dateStr} • {ev.timeStr}
                          </span>
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
        <div className={styles.upNextLabel}>
          <span>{isLight ? 'Today' : 'Up Next'}</span>
          {isLight && (
            <span className={styles.upNextSubLabel}>
              {selectedDay === currentDay
                ? 'Thu, Aug 6, 2026'
                : `Aug ${selectedDay}, 2026`}
            </span>
          )}
        </div>

        <div className={styles.timeline} ref={timelineRef}>
          {activeEvents.slice(0, visibleCount).map((ev, i) => (
            <div key={ev.id || i} className={styles.timelineItem}>
              <div className={styles.timeBlock}>
                <span className={styles.startTime}>{ev.timeStr}</span>
                {ev.endTimeStr ? (
                  <span className={styles.endTime}>{ev.endTimeStr}</span>
                ) : ev.dateStr ? (
                  <span className={styles.heroDate}>{ev.dateStr}</span>
                ) : null}
              </div>

              <div className={styles.timelineDivider}>
                <div className={`${styles.dot} ${styles[ev.tone + 'Bg']}`} />
                {i < activeEvents.length - 1 && <div className={styles.line} />}
              </div>

              <div className={styles.eventContent}>
                <strong className={styles.secondaryTitle}>{ev.title}</strong>
                <span className={styles.secondarySub}>{ev.subtitle}</span>
              </div>

              {isLight && (
                <button
                  type="button"
                  className={styles.kebabBtn}
                  aria-label={`Options for ${ev.title}`}
                >
                  <MoreVertical size={14} />
                </button>
              )}
            </div>
          ))}
        </div>

        {showAddTask && (
          <button type="button" className={styles.addTaskBtn} onClick={onAddTask}>
            <Plus size={16} strokeWidth={2.4} />
            <span>Add task</span>
          </button>
        )}
      </div>
    </section>
  );
}
