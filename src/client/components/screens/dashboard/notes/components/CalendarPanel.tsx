import React from 'react';
import styles from './CalendarPanel.module.css';

export const CalendarPanel = () => {
  const daysOfWeek = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'];
  const daysInMonth = 30;
  const currentDay = 3;

  return (
    <div className={styles.calendarContainer}>
      <div className={styles.header}>
        <div className={styles.monthTitle}>
          <span className={styles.icon}>📅</span> June 2026
        </div>
        <div className={styles.controls}>
          <button className={styles.todayBtn}>Today</button>
          <button className={styles.iconBtn}>&lt;</button>
          <button className={styles.iconBtn}>&gt;</button>
        </div>
      </div>
      
      <div className={styles.grid}>
        {daysOfWeek.map((day) => (
          <div key={day} className={styles.dayOfWeek}>
            {day}
          </div>
        ))}
        
        {Array.from({ length: 42 }).map((_, i) => {
          const dayNumber = i + 1;
          
          let date;
          let isMuted = false;
          let isCurrent = false;

          if (dayNumber <= daysInMonth) {
            date = dayNumber;
            isCurrent = date === currentDay;
          } else {
            date = dayNumber - daysInMonth;
            isMuted = true;
          }

          return (
            <div 
              key={i} 
              className={`${styles.dayCell} ${isMuted ? styles.muted : ''} ${isCurrent ? styles.currentDay : ''}`}
            >
              <span className={styles.dateText}>{date}</span>
              {isCurrent && <div className={styles.activeDot} />}
            </div>
          );
        })}
      </div>
    </div>
  );
};
