import { useState } from 'react';
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon } from 'lucide-react';
import styles from './Calendar.module.css';

export interface CalendarEvent {
  day: number;
  tone?: 'purple' | 'orange' | 'blue' | 'green' | 'red';
  title?: string;
}

export interface CalendarProps {
  initialMonth?: number; // 0-11
  initialYear?: number;
  events?: CalendarEvent[];
  onDateSelect?: (date: Date) => void;
}

const WEEKDAYS = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'];
const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

export function Calendar({
  initialMonth = new Date().getMonth(),
  initialYear = new Date().getFullYear(),
  events = [],
  onDateSelect,
}: CalendarProps) {
  const [currentMonth, setCurrentMonth] = useState(initialMonth);
  const [currentYear, setCurrentYear] = useState(initialYear);
  const [selectedDay, setSelectedDay] = useState<number | null>(new Date().getDate());
  
  const today = new Date();
  const isCurrentMonth = today.getMonth() === currentMonth && today.getFullYear() === currentYear;
  const currentDay = isCurrentMonth ? today.getDate() : null;

  const handlePrevious = () => {
    if (currentMonth === 0) {
      setCurrentMonth(11);
      setCurrentYear(currentYear - 1);
    } else {
      setCurrentMonth(currentMonth - 1);
    }
  };

  const handleNext = () => {
    if (currentMonth === 11) {
      setCurrentMonth(0);
      setCurrentYear(currentYear + 1);
    } else {
      setCurrentMonth(currentMonth + 1);
    }
  };

  const handleToday = () => {
    setCurrentMonth(today.getMonth());
    setCurrentYear(today.getFullYear());
    setSelectedDay(today.getDate());
    onDateSelect?.(today);
  };

  const handleDaySelect = (day: number) => {
    setSelectedDay(day);
    onDateSelect?.(new Date(currentYear, currentMonth, day));
  };

  // Date Math
  const getDaysInMonth = (month: number, year: number) => {
    return new Date(year, month + 1, 0).getDate();
  };
  
  // 0 is Sunday in JS, we want Monday to be 0
  const getFirstDayOfMonth = (month: number, year: number) => {
    const day = new Date(year, month, 1).getDay();
    return day === 0 ? 6 : day - 1;
  };

  const daysInMonth = getDaysInMonth(currentMonth, currentYear);
  const startOffset = getFirstDayOfMonth(currentMonth, currentYear);
  const daysInPrevMonth = getDaysInMonth(currentMonth === 0 ? 11 : currentMonth - 1, currentMonth === 0 ? currentYear - 1 : currentYear);

  const gridCells = [];
  
  // Previous month trailing days
  for (let i = 0; i < startOffset; i++) {
    gridCells.push({
      day: daysInPrevMonth - startOffset + i + 1,
      isCurrentMonth: false,
    });
  }
  
  // Current month days
  for (let i = 1; i <= daysInMonth; i++) {
    gridCells.push({
      day: i,
      isCurrentMonth: true,
    });
  }
  
  // Next month leading days (fill to 42 cells - 6 rows)
  const remainingCells = 42 - gridCells.length;
  for (let i = 1; i <= remainingCells; i++) {
    gridCells.push({
      day: i,
      isCurrentMonth: false,
    });
  }

  return (
    <div className={styles.calendarContainer}>
      <header className={styles.header}>
        <div className={styles.headerLeft}>
          <CalendarIcon size={16} className={styles.headerIcon} />
          <h2 className={styles.monthTitle}>
            {MONTHS[currentMonth]} {currentYear}
          </h2>
        </div>
        <div className={styles.headerControls}>
          <button className={styles.todayButton} onClick={handleToday}>
            Today
          </button>
          <div className={styles.navButtons}>
            <button className={styles.navButton} onClick={handlePrevious} aria-label="Previous month">
              <ChevronLeft size={16} />
            </button>
            <button className={styles.navButton} onClick={handleNext} aria-label="Next month">
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      </header>

      <div className={styles.weekdays}>
        {WEEKDAYS.map((day) => (
          <span key={day}>{day}</span>
        ))}
      </div>

      <div className={styles.grid}>
        {gridCells.map((cell, idx) => {
          const isToday = cell.isCurrentMonth && cell.day === currentDay;
          const isSelected = cell.isCurrentMonth && cell.day === selectedDay;
          const dayEvents = cell.isCurrentMonth ? events.filter(e => e.day === cell.day) : [];
          const hasEvent = dayEvents.length > 0;

          return (
            <div
              key={`${idx}-${cell.day}`}
              className={`
                ${styles.cell} 
                ${!cell.isCurrentMonth ? styles.dimmed : ''} 
                ${isToday ? styles.today : ''} 
                ${isSelected ? styles.selected : ''}
              `}
              onClick={() => cell.isCurrentMonth && handleDaySelect(cell.day)}
            >
              <span className={styles.dayNumber}>{cell.day}</span>
              {hasEvent && (
                <div className={styles.eventDots}>
                  {dayEvents.slice(0, 3).map((ev, i) => (
                    <span 
                      key={i} 
                      className={`${styles.eventDot} ${styles[ev.tone || 'purple']}`} 
                    />
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
