'use client';

import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import {
  Calendar as CalendarIcon,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  MoreVertical,
  Plus,
  Check,
  CheckCircle2,
  Clock,
  Sparkles,
  RefreshCw,
  Trash2,
  X,
  ExternalLink,
} from 'lucide-react';
import { UpcomingEvent } from '@/src/client/types/dashboard';
import { useUnifiedTasks } from '@/src/client/hooks/useUnifiedTasks';
import styles from './UpcomingEvents.module.css';

export interface UpcomingEventsProps {
  items?: UpcomingEvent[];
  variant?: 'light' | 'dark';
  showAddTask?: boolean;
  onAddTask?: () => void;
  className?: string;
}

export type CalendarProvider = 'Google Calendar' | 'Outlook' | 'Apple Calendar' | 'Sidequest Native';

export interface CalendarEvent {
  id: string;
  year: number;
  month: number; // 0-indexed (7 = August)
  day: number;
  title: string;
  subtitle: string;
  dateStr: string;
  timeStr: string;
  endTimeStr?: string;
  tone: 'purple' | 'orange' | 'blue';
  completed?: boolean;
}

interface CalendarCell {
  day: number;
  isCurrentMonth: boolean;
}

const INITIAL_EVENTS: CalendarEvent[] = [
  // August 2026
  {
    id: 'e1',
    year: 2026,
    month: 7,
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
    year: 2026,
    month: 7,
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
    year: 2026,
    month: 7,
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
    year: 2026,
    month: 7,
    day: 6,
    title: 'Read: Designing Data-Intensive...',
    subtitle: 'Chapter 3',
    dateStr: 'Today',
    timeStr: '8:00 PM',
    endTimeStr: '8:30 PM',
    tone: 'blue',
  },
  {
    id: 'e5',
    year: 2026,
    month: 7,
    day: 12,
    title: 'Distributed Caching Deep Dive',
    subtitle: 'System Architecture',
    dateStr: 'Aug 12',
    timeStr: '6:30 PM',
    endTimeStr: '7:30 PM',
    tone: 'blue',
  },
  {
    id: 'e6',
    year: 2026,
    month: 7,
    day: 19,
    title: 'Open Source Contribution Hour',
    subtitle: 'Triage & Issue Hunting',
    dateStr: 'Aug 19',
    timeStr: '10:00 AM',
    endTimeStr: '11:00 AM',
    tone: 'blue',
  },
  {
    id: 'e7',
    year: 2026,
    month: 7,
    day: 25,
    title: 'Algorithm Deep Dive',
    subtitle: 'Dynamic Programming Patterns',
    dateStr: 'Aug 25',
    timeStr: '8:00 PM',
    endTimeStr: '9:00 PM',
    tone: 'blue',
  },
  {
    id: 'e8',
    year: 2026,
    month: 7,
    day: 27,
    title: 'Cloud Native Deployment',
    subtitle: 'Kubernetes Workshop',
    dateStr: 'Aug 27',
    timeStr: '2:00 PM',
    endTimeStr: '3:30 PM',
    tone: 'blue',
  },
  {
    id: 'e9',
    year: 2026,
    month: 7,
    day: 28,
    title: 'Hackathon Kickoff',
    subtitle: 'Team Formation',
    dateStr: 'Aug 28',
    timeStr: '9:00 AM',
    endTimeStr: '10:30 AM',
    tone: 'orange',
  },
  {
    id: 'e10',
    year: 2026,
    month: 7,
    day: 29,
    title: 'AI Prompt Engineering',
    subtitle: 'Hands-on Lab',
    dateStr: 'Aug 29',
    timeStr: '11:00 AM',
    endTimeStr: '12:00 PM',
    tone: 'blue',
  },
  // July 2026
  {
    id: 'e-j1',
    year: 2026,
    month: 6,
    day: 15,
    title: 'Mid-Year Engineering Retrospective',
    subtitle: 'Roadmap & Milestones',
    dateStr: 'Jul 15',
    timeStr: '11:00 AM',
    endTimeStr: '12:30 PM',
    tone: 'blue',
  },
  {
    id: 'e-j2',
    year: 2026,
    month: 6,
    day: 22,
    title: 'Rust Concurrency Sprint',
    subtitle: 'Channels & Mutexes',
    dateStr: 'Jul 22',
    timeStr: '3:00 PM',
    endTimeStr: '4:30 PM',
    tone: 'orange',
  },
  // September 2026
  {
    id: 'e-s1',
    year: 2026,
    month: 8,
    day: 4,
    title: 'Autumn Cohort Launch',
    subtitle: 'Orientation & Networking',
    dateStr: 'Sep 4',
    timeStr: '10:00 AM',
    endTimeStr: '11:30 AM',
    tone: 'orange',
  },
  {
    id: 'e-s2',
    year: 2026,
    month: 8,
    day: 16,
    title: 'Distributed Storage Consensus',
    subtitle: 'Raft Paper Walkthrough',
    dateStr: 'Sep 16',
    timeStr: '2:00 PM',
    endTimeStr: '3:30 PM',
    tone: 'blue',
  },
  {
    id: 'e-s3',
    year: 2026,
    month: 8,
    day: 24,
    title: 'Full-Stack Performance Audits',
    subtitle: 'Serverless Latency Triage',
    dateStr: 'Sep 24',
    timeStr: '5:00 PM',
    endTimeStr: '6:00 PM',
    tone: 'purple',
  },
];

const weekDays = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

const PROVIDERS: { id: CalendarProvider; name: string; tag?: string }[] = [
  { id: 'Google Calendar', name: 'Google Calendar' },
  { id: 'Outlook', name: 'Outlook Calendar' },
  { id: 'Apple Calendar', name: 'Apple Calendar' },
  { id: 'Sidequest Native', name: 'Sidequest Native', tag: 'Synced' },
];

interface TimelineItemProps {
  event: CalendarEvent;
  isLast: boolean;
  isActiveMenu: boolean;
  onToggleMenu: (id: string, e: React.MouseEvent) => void;
  onViewDetails: (ev: CalendarEvent) => void;
  onReschedule: (ev: CalendarEvent) => void;
  onToggleComplete: (ev: CalendarEvent) => void;
  onRemoveEvent: (ev: CalendarEvent) => void;
  menuRef?: React.Ref<HTMLDivElement>;
}

const TimelineItem = React.memo(function TimelineItem({
  event: ev,
  isLast,
  isActiveMenu,
  onToggleMenu,
  onViewDetails,
  onReschedule,
  onToggleComplete,
  onRemoveEvent,
  menuRef,
}: TimelineItemProps) {
  return (
    <div
      className={`${styles.timelineItem} ${ev.completed ? styles.timelineItemCompleted : ''}`}
    >
      <div className={styles.timeBlock}>
        <span className={styles.startTime}>{ev.timeStr}</span>
        {ev.endTimeStr ? (
          <span className={styles.endTime}>{ev.endTimeStr}</span>
        ) : ev.dateStr ? (
          <span className={styles.heroDate}>{ev.dateStr}</span>
        ) : null}
      </div>

      <div className={styles.timelineDivider}>
        <div
          className={`${styles.dot} ${styles[ev.tone + 'Bg']} ${ev.completed ? styles.dotCompleted : ''}`}
        />
        {!isLast && <div className={styles.line} />}
      </div>

      <div className={styles.eventContent}>
        <strong className={styles.secondaryTitle}>{ev.title}</strong>
        <span className={styles.secondarySub}>{ev.subtitle}</span>
        {ev.completed && <span className={styles.completedBadge}>Completed</span>}
      </div>

      {/* Event Kebab Action Menu */}
      <div className={styles.kebabWrapper} ref={isActiveMenu ? menuRef : undefined}>
        <button
          type="button"
          className={`${styles.kebabBtn} ${isActiveMenu ? styles.kebabBtnActive : ''}`}
          aria-label={`Options for ${ev.title}`}
          onClick={(e) => onToggleMenu(ev.id || '', e)}
        >
          <MoreVertical size={14} />
        </button>

        {isActiveMenu && (
          <div className={styles.kebabMenu} role="menu">
            <button
              type="button"
              className={styles.kebabMenuItem}
              onClick={() => onViewDetails(ev)}
            >
              <ExternalLink size={13} />
              <span>View details</span>
            </button>

            <button
              type="button"
              className={styles.kebabMenuItem}
              onClick={() => onReschedule(ev)}
            >
              <RefreshCw size={13} />
              <span>Reschedule</span>
            </button>

            <button
              type="button"
              className={styles.kebabMenuItem}
              onClick={() => onToggleComplete(ev)}
            >
              <CheckCircle2 size={13} />
              <span>{ev.completed ? 'Mark upcoming' : 'Mark completed'}</span>
            </button>

            <button
              type="button"
              className={`${styles.kebabMenuItem} ${styles.kebabMenuItemDanger}`}
              onClick={() => onRemoveEvent(ev)}
            >
              <Trash2 size={13} />
              <span>Remove</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
});

export const UpcomingEvents = React.memo(function UpcomingEvents({
  items,
  variant = 'dark',
  showAddTask = false,
  onAddTask,
  className,
}: UpcomingEventsProps) {
  const isLight = variant === 'light';

  // Calendar Date State (August 6, 2026)
  const [activeDate, setActiveDate] = useState(() => new Date(2026, 7, 6));
  const currentDay = 6;
  const isCurrentActiveMonth = activeDate.getFullYear() === 2026 && activeDate.getMonth() === 7;
  const [selectedDay, setSelectedDay] = useState<number>(6);
  const [hoveredDay, setHoveredDay] = useState<number | null>(null);

  // Events List State
  const {
    tasks: unifiedTasks,
    addTask: addUnifiedTask,
    updateTask: updateUnifiedTask,
    toggleTask: toggleUnifiedTask,
    removeTask: removeUnifiedTask,
  } = useUnifiedTasks();

  // Provider State
  const [selectedProvider, setSelectedProvider] = useState<CalendarProvider>('Google Calendar');
  const [isProviderOpen, setIsProviderOpen] = useState(false);
  const providerRef = useRef<HTMLDivElement>(null);

  // Event Action Menu State
  const [activeMenuEventId, setActiveMenuEventId] = useState<string | null>(null);
  const [selectedEventDetails, setSelectedEventDetails] = useState<CalendarEvent | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const timelineMenuRef = useRef<HTMLDivElement>(null);
  const timelineRef = useRef<HTMLDivElement>(null);

  // Dismiss dropdowns on outside click or escape
  useEffect(() => {
    const handleGlobalClick = (e: MouseEvent | TouchEvent) => {
      if (providerRef.current && !providerRef.current.contains(e.target as Node)) {
        setIsProviderOpen(false);
      }
      if (timelineMenuRef.current && !timelineMenuRef.current.contains(e.target as Node)) {
        setActiveMenuEventId(null);
      }
    };
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsProviderOpen(false);
        setActiveMenuEventId(null);
        setSelectedEventDetails(null);
      }
    };
    document.addEventListener('mousedown', handleGlobalClick);
    document.addEventListener('keydown', handleGlobalKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleGlobalClick);
      document.removeEventListener('keydown', handleGlobalKeyDown);
    };
  }, []);

  // Auto-dismiss toast
  useEffect(() => {
    if (!toastMessage) return;
    const timer = setTimeout(() => setToastMessage(null), 2800);
    return () => clearTimeout(timer);
  }, [toastMessage]);

  // Navigate months dynamically
  const handlePrevMonth = () => {
    setActiveDate((prev) => {
      const nextMonth = new Date(prev.getFullYear(), prev.getMonth() - 1, 1);
      setSelectedDay(1);
      return nextMonth;
    });
  };

  const handleNextMonth = () => {
    setActiveDate((prev) => {
      const nextMonth = new Date(prev.getFullYear(), prev.getMonth() + 1, 1);
      setSelectedDay(1);
      return nextMonth;
    });
  };

  const currentYear = activeDate.getFullYear();
  const currentMonth = activeDate.getMonth();
  const monthNameStr = activeDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

  // Recalculate 42-cell dynamic calendar grid (memoized to avoid layout churn on hover)
  const daysGrid = useMemo<CalendarCell[]>(() => {
    const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
    const firstDayIndex = new Date(currentYear, currentMonth, 1).getDay(); // 0=Su .. 6=Sa
    const prevMonthDays = new Date(currentYear, currentMonth, 0).getDate();

    const grid: CalendarCell[] = [];
    for (let i = firstDayIndex - 1; i >= 0; i--) {
      grid.push({ day: prevMonthDays - i, isCurrentMonth: false });
    }
    for (let d = 1; d <= daysInMonth; d++) {
      grid.push({ day: d, isCurrentMonth: true });
    }
    const remaining = 42 - grid.length;
    for (let d = 1; d <= remaining; d++) {
      grid.push({ day: d, isCurrentMonth: false });
    }
    return grid;
  }, [currentYear, currentMonth]);

  const getDayEvents = useCallback(
    (day: number, isCurrentMonth = true): CalendarEvent[] => {
      if (!isCurrentMonth) return [];
      return unifiedTasks
        .filter((ev) => ev.year === currentYear && ev.month === currentMonth && ev.day === day)
        .map((ev) => ({
          id: ev.id,
          year: ev.year,
          month: ev.month,
          day: ev.day,
          title: ev.title,
          subtitle: ev.subtitle || ev.category || 'General',
          dateStr: ev.dateStr || `${activeDate.toLocaleDateString('en-US', { month: 'short' })} ${ev.day}`,
          timeStr: ev.timeStr || '9:00 AM',
          endTimeStr: ev.endTimeStr || '10:00 AM',
          tone: (ev.tone as any) || 'blue',
          completed: ev.status === 'completed',
        }));
    },
    [unifiedTasks, currentYear, currentMonth, activeDate],
  );

  // Filter events for selected day & month (memoized to keep stable reference during day cell hovering)
  const activeEvents = useMemo<CalendarEvent[]>(() => {
    if (isLight) {
      return getDayEvents(selectedDay, true);
    }
    if (items && items.length > 0) {
      return items.map((it, idx) => ({
        id: it.id,
        year: currentYear,
        month: currentMonth,
        day: selectedDay + idx,
        title: it.title,
        subtitle: it.subtitle,
        dateStr: it.startsIn,
        timeStr: it.startsIn,
        tone: it.tone,
      }));
    }
    return getDayEvents(selectedDay, true);
  }, [isLight, items, currentYear, currentMonth, selectedDay, getDayEvents]);

  // Actions
  const handleQuickAddSession = () => {
    const shortMonth = activeDate.toLocaleDateString('en-US', { month: 'short' });
    addUnifiedTask({
      year: currentYear,
      month: currentMonth,
      day: selectedDay,
      title: 'Sprint Focus Session',
      subtitle: 'Cohort Deep Work',
      category: 'Deep Work',
      dateStr: `${shortMonth} ${selectedDay}`,
      timeStr: '3:00 PM',
      endTimeStr: '4:00 PM',
      tone: 'blue',
      color: '#3b82f6',
      status: 'pending',
    });
    setToastMessage(`Scheduled session for ${shortMonth} ${selectedDay}`);
    onAddTask?.();
  };

  const handleToggleMenu = useCallback((id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setActiveMenuEventId((prev) => (prev === id ? null : id));
  }, []);

  const handleViewDetails = useCallback((ev: CalendarEvent) => {
    setSelectedEventDetails(ev);
    setActiveMenuEventId(null);
  }, []);

  const handleToggleComplete = useCallback(
    (ev: CalendarEvent) => {
      toggleUnifiedTask(ev.id);
      setActiveMenuEventId(null);
      setToastMessage(ev.completed ? `Re-opened "${ev.title}"` : `Completed "${ev.title}"! 🚀`);
    },
    [toggleUnifiedTask],
  );

  const handleReschedule = useCallback(
    (ev: CalendarEvent) => {
      const newTime = ev.timeStr === '5:30 PM' ? '7:00 PM' : '5:30 PM';
      const newEndTime = ev.endTimeStr === '6:30 PM' ? '8:00 PM' : '6:30 PM';
      updateUnifiedTask(ev.id, {
        timeStr: newTime,
        endTimeStr: newEndTime,
      });
      setActiveMenuEventId(null);
      setToastMessage(`Rescheduled "${ev.title}" to evening slot`);
    },
    [updateUnifiedTask],
  );

  const handleRemoveEvent = useCallback(
    (ev: CalendarEvent) => {
      removeUnifiedTask(ev.id);
      setActiveMenuEventId(null);
      setToastMessage(`Removed "${ev.title}" from schedule`);
    },
    [removeUnifiedTask],
  );

  const handleSelectProvider = (prov: CalendarProvider) => {
    setSelectedProvider(prov);
    setIsProviderOpen(false);
    setToastMessage(`Active sync: ${prov}`);
  };

  const isSelectedToday = isCurrentActiveMonth && selectedDay === currentDay;

  const formattedSelectedDate = (() => {
    if (isSelectedToday) {
      return 'Thu, Aug 6, 2026';
    }
    const d = new Date(currentYear, currentMonth, selectedDay);
    return d.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  })();

  const renderProviderIcon = (provider: CalendarProvider) => {
    switch (provider) {
      case 'Google Calendar':
        return (
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
        );
      case 'Outlook':
        return <CalendarIcon size={13} className={styles.providerIconOutlook} />;
      case 'Apple Calendar':
        return <CalendarIcon size={13} className={styles.providerIconApple} />;
      case 'Sidequest Native':
        return <Sparkles size={13} className={styles.providerIconSidequest} />;
    }
  };

  return (
    <section
      className={`${styles.panel} ${isLight ? styles.lightVariant : ''} ${className || ''}`.trim()}
      aria-label="Upcoming Schedule"
    >
      {/* Toast Notification */}
      {toastMessage && (
        <div className={styles.toastNotice} role="status">
          <CheckCircle2 size={14} className={styles.toastIcon} />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Header & Calendar Provider Selector */}
      <header className={styles.header}>
        <div className={styles.headerLeft}>
          <h2>Upcoming</h2>
        </div>

        <div className={styles.providerWrapper} ref={providerRef}>
          <button
            type="button"
            className={styles.providerSelector}
            onClick={() => setIsProviderOpen((prev) => !prev)}
            aria-expanded={isProviderOpen}
            aria-haspopup="listbox"
            aria-label="Calendar integration provider"
          >
            {renderProviderIcon(selectedProvider)}
            <span>{selectedProvider}</span>
            <ChevronDown
              size={13}
              className={`${styles.providerChevron} ${isProviderOpen ? styles.chevronOpen : ''}`}
            />
          </button>

          {isProviderOpen && (
            <div
              className={styles.providerDropdown}
              role="listbox"
              aria-label="Select Calendar Provider"
            >
              <div className={styles.providerDropdownHeader}>Calendar Integration</div>
              {PROVIDERS.map((prov) => {
                const isSelected = prov.id === selectedProvider;
                return (
                  <button
                    key={prov.id}
                    type="button"
                    className={`${styles.providerOption} ${isSelected ? styles.providerOptionActive : ''}`}
                    onClick={() => handleSelectProvider(prov.id)}
                    role="option"
                    aria-selected={isSelected}
                  >
                    <div className={styles.providerOptionLeft}>
                      {renderProviderIcon(prov.id)}
                      <span>{prov.name}</span>
                    </div>
                    {isSelected && <Check size={13} className={styles.providerCheck} />}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </header>

      {/* Calendar Grid Section */}
      <div className={styles.calendar}>
        <div className={styles.calendarNavRow}>
          <span className={styles.monthLabel}>{monthNameStr}</span>
          <div className={styles.monthNavButtons}>
            <button
              type="button"
              className={styles.navBtn}
              onClick={handlePrevMonth}
              aria-label="Previous month"
            >
              <ChevronLeft size={14} />
            </button>
            <button
              type="button"
              className={styles.navBtn}
              onClick={handleNextMonth}
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
            const events = getDayEvents(day, isCurrentMonth);
            const hasEvent = events.length > 0;
            const isToday = isCurrentActiveMonth && isCurrentMonth && day === currentDay;
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
                role="button"
                tabIndex={isCurrentMonth ? (isSelected ? 0 : -1) : -1}
                aria-label={`${monthNameStr} ${day}${hasEvent ? `, ${events.length} event${events.length > 1 ? 's' : ''}` : ''}${isToday ? ', today' : ''}`}
                aria-pressed={isSelected}
                onKeyDown={(e) => {
                  if (!isCurrentMonth) return;
                  const maxDays = new Date(currentYear, currentMonth + 1, 0).getDate();
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    setSelectedDay(day);
                  } else if (e.key === 'ArrowRight') {
                    e.preventDefault();
                    setSelectedDay((prev) => Math.min(maxDays, prev + 1));
                  } else if (e.key === 'ArrowLeft') {
                    e.preventDefault();
                    setSelectedDay((prev) => Math.max(1, prev - 1));
                  } else if (e.key === 'ArrowDown') {
                    e.preventDefault();
                    setSelectedDay((prev) => Math.min(maxDays, prev + 7));
                  } else if (e.key === 'ArrowUp') {
                    e.preventDefault();
                    setSelectedDay((prev) => Math.max(1, prev - 7));
                  }
                }}
              >
                <span className={styles.dayNum}>{day}</span>
                {isToday && <span className={styles.todayEventDot} />}
                {hasEvent && isCurrentMonth && !isToday && (
                  <span className={`${styles.eventDot} ${styles[events[0].tone]}`} />
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

      {/* Up Next / Timeline Section */}
      <div className={styles.upNext}>
        <div className={styles.upNextLabel}>
          <span>{isLight ? (isSelectedToday ? 'Today' : 'Schedule') : 'Up Next'}</span>
          {isLight && <span className={styles.upNextSubLabel}>{formattedSelectedDate}</span>}
        </div>

        {activeEvents.length > 0 ? (
          <div className={styles.timeline} ref={timelineRef}>
            {activeEvents.map((ev, i) => (
              <TimelineItem
                key={ev.id || i}
                event={ev}
                isLast={i === activeEvents.length - 1}
                isActiveMenu={activeMenuEventId === ev.id}
                onToggleMenu={handleToggleMenu}
                onViewDetails={handleViewDetails}
                onReschedule={handleReschedule}
                onToggleComplete={handleToggleComplete}
                onRemoveEvent={handleRemoveEvent}
                menuRef={timelineMenuRef}
              />
            ))}
          </div>
        ) : (
          /* Day-specific Feedback & Empty State */
          <div className={styles.emptyDayNotice}>
            <Clock size={20} className={styles.emptyNoticeIcon} />
            <p className={styles.emptyNoticeTitle}>No sessions scheduled</p>
            <p className={styles.emptyNoticeSub}>
              Clear focus time on {formattedSelectedDate}. Ready to learn?
            </p>
            <button
              type="button"
              className={styles.quickAddSessionBtn}
              onClick={handleQuickAddSession}
            >
              <Plus size={14} strokeWidth={2.2} />
              <span>Schedule session</span>
            </button>
          </div>
        )}

        {showAddTask && (
          <button type="button" className={styles.addTaskBtn} onClick={handleQuickAddSession}>
            <Plus size={16} strokeWidth={2.4} />
            <span>Add task</span>
          </button>
        )}
      </div>

      {/* Details Modal */}
      {selectedEventDetails && (
        <div
          className={styles.modalBackdrop}
          onClick={() => setSelectedEventDetails(null)}
          role="dialog"
          aria-modal="true"
        >
          <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <div className={styles.modalHeaderTitleGroup}>
                <span className={styles.modalCategoryBadge}>{selectedEventDetails.tone}</span>
                <h3 className={styles.modalTitle}>{selectedEventDetails.title}</h3>
              </div>
              <button
                type="button"
                className={styles.modalCloseBtn}
                onClick={() => setSelectedEventDetails(null)}
                aria-label="Close details"
              >
                <X size={16} />
              </button>
            </div>

            <p className={styles.modalSubtitle}>{selectedEventDetails.subtitle}</p>

            <div className={styles.modalDetailRow}>
              <CalendarIcon size={15} className={styles.modalDetailIcon} />
              <span>
                {selectedEventDetails.dateStr} &bull; {selectedEventDetails.timeStr}
                {selectedEventDetails.endTimeStr ? ` - ${selectedEventDetails.endTimeStr}` : ''}
              </span>
            </div>

            <div className={styles.modalActions}>
              <button
                type="button"
                className={styles.modalPrimaryBtn}
                onClick={() => {
                  handleToggleComplete(selectedEventDetails);
                  setSelectedEventDetails(null);
                }}
              >
                {selectedEventDetails.completed ? 'Mark as Upcoming' : 'Mark Completed'}
              </button>
              <button
                type="button"
                className={styles.modalSecondaryBtn}
                onClick={() => setSelectedEventDetails(null)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
});
