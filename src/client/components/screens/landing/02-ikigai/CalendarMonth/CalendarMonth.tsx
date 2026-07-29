import Image from 'next/image';
import styles from './CalendarMonth.module.css';
import { CalendarMonthProps, DayProgress } from './calendarMonth.types';

const WEEKDAYS = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'];

function renderBars(day: DayProgress) {
  return (
    <div className={styles.bars}>
      <span
        className={styles.youtube}
        style={{ flex: day.youtube ?? 0 }}
      />

      <span
        className={styles.coursera}
        style={{ flex: day.coursera ?? 0 }}
      />

      <span
        className={styles.history}
        style={{ flex: day.history ?? 0 }}
      />
    </div>
  );
}

export function CalendarMonth({
  month,
  year,
  youtubeTotal,
  courseraTotal,
  historyTotal,
  days,
}: CalendarMonthProps) {
  return (
    <div className={styles.card}>
      <h3 className={styles.heading}>
        {month.toUpperCase()} {year}
      </h3>

      <div className={styles.weekdays}>
        {WEEKDAYS.map((weekday) => (
          <span key={weekday}>{weekday}</span>
        ))}
      </div>

      <div className={styles.grid}>
        {days.map((day) => (
          <div
            key={day.day}
            className={styles.day}
          >
            <span className={styles.number}>{day.day}</span>

            {renderBars(day)}
          </div>
        ))}
      </div>

      <div className={styles.footer}>
        <div className={styles.total}>
          <Image
            src="/images/icons/youtube.webp"
            alt=""
            width={18}
            height={18}
          />

          <span>{youtubeTotal}</span>
        </div>

        <div className={styles.total}>
          <Image
            src="/images/icons/coursera.webp"
            alt=""
            width={18}
            height={18}
          />

          <span>{courseraTotal}</span>
        </div>

        <div className={styles.total}>
          <Image
            src="/images/icons/youtube.webp"
            alt=""
            width={18}
            height={18}
          />

          <span>{historyTotal}</span>
        </div>
      </div>
    </div>
  );
}
