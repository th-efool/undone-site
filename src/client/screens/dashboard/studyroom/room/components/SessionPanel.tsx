'use client';

import React, { useMemo, useState } from 'react';
import {
  Calendar as CalendarIcon,
  Check,
  ChevronLeft,
  ChevronRight,
  Plus,
  X,
} from 'lucide-react';
import type { useSessionGoal } from '../../hooks/useSessionGoal';
import type { usePersonalTasks } from '../../hooks/usePersonalTasks';
import { useUnifiedTasks, UnifiedTask } from '@/src/client/hooks/useUnifiedTasks';
import { GoalEditor } from './GoalEditor';
import { TaskList } from './TaskList';
import { DemoDataNote } from './DemoDataNote';
import styles from './SessionPanel.module.css';

export interface SessionPanelProps {
  goal: ReturnType<typeof useSessionGoal>;
  tasks: ReturnType<typeof usePersonalTasks>;
  onClose?: () => void;
}

const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

function getOrdinal(n: number): string {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return s[(v - 20) % 10] || s[v] || s[0];
}

export function SessionPanel({ goal, tasks, onClose }: SessionPanelProps) {
  const [year, setYear] = useState<number>(2026);
  const [month, setMonth] = useState<number>(9); // 9 = October
  const [selectedDay, setSelectedDay] = useState<number>(20);
  const [showAddDailyInput, setShowAddDailyInput] = useState<boolean>(false);
  const [newDailyDraft, setNewDailyDraft] = useState<string>('');

  const { getTasksForDate, getDaysWithTasks, addTask: addUnifiedTask } = useUnifiedTasks();

  const handlePrevMonth = () => {
    if (month === 0) {
      setMonth(11);
      setYear((y) => y - 1);
    } else {
      setMonth((m) => m - 1);
    }
  };

  const handleNextMonth = () => {
    if (month === 11) {
      setMonth(0);
      setYear((y) => y + 1);
    } else {
      setMonth((m) => m + 1);
    }
  };

  const calendarDays = useMemo(() => {
    const firstDayOfWeek = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const daysInPrevMonth = new Date(year, month, 0).getDate();

    const prevDays: { day: number; isCurrentMonth: boolean }[] = [];
    for (let i = firstDayOfWeek - 1; i >= 0; i--) {
      prevDays.push({
        day: daysInPrevMonth - i,
        isCurrentMonth: false,
      });
    }

    const currentDays: { day: number; isCurrentMonth: boolean }[] = [];
    for (let d = 1; d <= daysInMonth; d++) {
      currentDays.push({
        day: d,
        isCurrentMonth: true,
      });
    }

    return [...prevDays, ...currentDays];
  }, [year, month]);

  const selectedDateTasks: UnifiedTask[] = useMemo(() => {
    return getTasksForDate(year, month, selectedDay);
  }, [getTasksForDate, year, month, selectedDay]);

  const monthDots = useMemo(() => {
    return getDaysWithTasks(year, month);
  }, [getDaysWithTasks, year, month]);

  const handleAddDailyToSession = (text: string) => {
    tasks.add(text);
  };

  const handleAddNextDaily = () => {
    const unadded = selectedDateTasks.find(
      (dt) => !tasks.tasks.some((t) => t.text.toLowerCase() === dt.title.toLowerCase())
    );
    if (unadded) {
      tasks.add(unadded.title);
    }
  };

  const handleCreateDailyTask = (e: React.FormEvent) => {
    e.preventDefault();
    const cleaned = newDailyDraft.trim();
    if (!cleaned) return;

    addUnifiedTask({
      title: cleaned,
      category: 'General',
      year,
      month,
      day: selectedDay,
      dateStr: `${MONTH_NAMES[month].slice(0, 3)} ${selectedDay}`,
      color: '#3b82f6',
      tone: 'blue',
      status: 'pending',
    });

    setNewDailyDraft('');
    setShowAddDailyInput(false);
  };

  const selectedDateLabel = `${selectedDay}${getOrdinal(selectedDay)} ${MONTH_NAMES[month]}`;

  return (
    <div className={styles.panel}>
      {/* 1. Modal Header */}
      <div className={styles.modalHeader}>
        <div className={styles.headerLeft}>
          <div className={styles.headerIconBox} aria-hidden="true">
            <CalendarIcon size={22} className={styles.headerIcon} />
          </div>
          <div className={styles.headerTitles}>
            <h2 className={styles.headerTitle}>Tasks</h2>
            <p className={styles.headerSubtitle}>
              Add tasks to your session and stay organized.
            </p>
          </div>
        </div>
        {onClose && (
          <button
            type="button"
            className={styles.closeBtn}
            onClick={onClose}
            aria-label="Close"
          >
            <X size={20} aria-hidden="true" />
          </button>
        )}
      </div>

      {/* 2. Session Goal Editor */}
      <GoalEditor goal={goal} />

      {/* 3. Top 2-Column Grid */}
      <div className={styles.topGrid}>
        {/* Left Column: Mini Calendar */}
        <div className={styles.calendarCard}>
          <div className={styles.calendarNav}>
            <button
              type="button"
              className={styles.calendarNavBtn}
              onClick={handlePrevMonth}
              aria-label="Previous month"
            >
              <ChevronLeft size={16} aria-hidden="true" />
            </button>
            <span className={styles.calendarMonthTitle}>
              {MONTH_NAMES[month]} {year}
            </span>
            <button
              type="button"
              className={styles.calendarNavBtn}
              onClick={handleNextMonth}
              aria-label="Next month"
            >
              <ChevronRight size={16} aria-hidden="true" />
            </button>
          </div>

          <div className={styles.calendarWeekdays} aria-hidden="true">
            <span>Sun</span>
            <span>Mon</span>
            <span>Tue</span>
            <span>Wed</span>
            <span>Thu</span>
            <span>Fri</span>
            <span>Sat</span>
          </div>

          <div className={styles.calendarDaysGrid}>
            {calendarDays.map((item, idx) => {
              const isSelected =
                item.isCurrentMonth &&
                item.day === selectedDay;
              const dotColor =
                item.isCurrentMonth
                  ? monthDots[item.day]
                  : null;

              return (
                <button
                  key={idx}
                  type="button"
                  disabled={!item.isCurrentMonth}
                  className={`${styles.calendarDayCell} ${
                    !item.isCurrentMonth ? styles.dayDimmed : ''
                  } ${isSelected ? styles.daySelected : ''}`}
                  onClick={() => item.isCurrentMonth && setSelectedDay(item.day)}
                  aria-label={`${item.day} ${MONTH_NAMES[month]} ${year}${
                    isSelected ? ', selected' : ''
                  }`}
                >
                  <span>{item.day}</span>
                  {dotColor && (
                    <span
                      className={isSelected ? styles.dayDotSelected : styles.dayDot}
                      style={isSelected ? undefined : { backgroundColor: dotColor }}
                      aria-hidden="true"
                    />
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Right Column: Daily Tasks */}
        <div className={styles.dailyTasksCard}>
          <div className={styles.dailyTasksHeader}>
            <h3 className={styles.dailyTasksTitle}>{selectedDateLabel} Tasks</h3>
            <button
              type="button"
              className={styles.dailyAddBtn}
              onClick={() => setShowAddDailyInput((prev) => !prev)}
              aria-label="Add daily task"
            >
              <Plus size={13} aria-hidden="true" />
              <span>Add</span>
            </button>
          </div>

          {showAddDailyInput && (
            <form onSubmit={handleCreateDailyTask} className={styles.dailyInlineAddForm}>
              <input
                type="text"
                className={styles.dailyInlineAddInput}
                placeholder="New daily task..."
                value={newDailyDraft}
                onChange={(e) => setNewDailyDraft(e.target.value)}
                autoFocus
              />
              <button type="submit" className={styles.dailyInlineAddBtn}>
                Add
              </button>
            </form>
          )}

          <div className={styles.dailyTasksList}>
            {selectedDateTasks.length === 0 ? (
              <div className={styles.emptyDailyTasks} style={{ padding: '24px 16px', textAlign: 'center', color: '#64748b', fontSize: '13px' }}>
                No tasks scheduled for {selectedDateLabel}.
              </div>
            ) : (
              selectedDateTasks.map((item) => {
                const isAdded = tasks.tasks.some(
                  (t) => t.text.toLowerCase() === item.title.toLowerCase()
                );

                return (
                  <div key={item.id} className={styles.dailyTaskItem}>
                    <div className={styles.dailyTaskLeft}>
                      <span
                        className={styles.taskColorDot}
                        style={{ backgroundColor: item.color || '#3b82f6' }}
                        aria-hidden="true"
                      />
                      <div className={styles.dailyTaskMeta}>
                        <span className={styles.dailyTaskName} title={item.title}>
                          {item.title}
                        </span>
                        <span className={styles.dailyTaskCategory}>
                          {item.category || item.subtitle || 'General'}
                        </span>
                      </div>
                    </div>
                    <button
                      type="button"
                      className={`${styles.dailyTaskActionBtn} ${
                        isAdded ? styles.dailyTaskActionBtnAdded : ''
                      }`}
                      onClick={() => handleAddDailyToSession(item.title)}
                      aria-label={`Add "${item.title}" to session`}
                      title={isAdded ? 'Already added' : 'Add to session'}
                    >
                      {isAdded ? (
                        <Check size={12} aria-hidden="true" />
                      ) : (
                        <Plus size={13} aria-hidden="true" />
                      )}
                    </button>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* 4. Bottom Section: Session Tasks */}
      <TaskList
        tasks={tasks}
        selectedDateLabel={selectedDateLabel}
        onAddFromDaily={handleAddNextDaily}
      />

      {/* 5. Demo note */}
      <DemoDataNote />
    </div>
  );
}

export default SessionPanel;
