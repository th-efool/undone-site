import Image from 'next/image';
import { CalendarMonth } from './CalendarMonth/CalendarMonth';
import { julyDays, juneDays, mayDays } from './CalendarMonth/calendarData';
import { LearningList } from './learningList';
import styles from './ProgressSection.module.css';

export function ProgressSection() {
  return (
    <div className={styles.progressSection}>
      <LearningList />

      <div className={styles.calendarPanel}>
        <CalendarMonth
          month="May"
          year={2025}
          youtubeTotal="8h 42m"
          courseraTotal="9h 16m"
          historyTotal="7h 48m"
          days={mayDays}
        />
        <CalendarMonth
          month="June"
          year={2025}
          youtubeTotal="9h 10m"
          courseraTotal="9h 24m"
          historyTotal="7h 20m"
          days={juneDays}
        />
        <CalendarMonth
          month="July"
          year={2025}
          youtubeTotal="8h 08m"
          courseraTotal="9h 20m"
          historyTotal="7h 40m"
          days={julyDays}
        />
      </div>

      <aside className={styles.progressCard}>
        <header className={styles.progressHeader}>
          <h3 className={styles.progressTitle}>PROGRESS</h3>
          <p className={styles.progressSubtitle}>Small fun session adds up.!</p>
        </header>

        <div className={`${styles.progressRow} ${styles.youtube}`}>
          <Image
            src="/images/icons/youtube-white.webp"
            alt=""
            className={styles.progressIcon}
           width={400} height={300} style={{ width: "100%", height: "100%", objectFit: "cover" }}/>
          <span className={styles.progressCheck}>✓</span>
          <div className={styles.progressInfo}>
            <strong className={styles.progressHours}>26h</strong>
            <span className={styles.progressMeta}>14 videos</span>
          </div>
        </div>

        <div className={`${styles.progressRow} ${styles.coursera}`}>
          <Image
            src="/images/icons/coursera-white.webp"
            alt=""
            className={styles.progressIcon}
           width={400} height={300} style={{ width: "100%", height: "100%", objectFit: "cover" }}/>
          <span className={styles.progressCheck}>✓</span>
          <div className={styles.progressInfo}>
            <strong className={styles.progressHours}>28h</strong>
            <span className={styles.progressMeta}>17 modules</span>
          </div>
        </div>

        <div className={`${styles.progressRow} ${styles.history}`}>
          <Image
            src="/images/icons/youtube-white.webp"
            alt=""
            className={styles.progressIcon}
           width={400} height={300} style={{ width: "100%", height: "100%", objectFit: "cover" }}/>
          <span className={styles.progressCheck}>✓</span>
          <div className={styles.progressInfo}>
            <strong className={styles.progressHours}>22h</strong>
            <span className={styles.progressMeta}>48 videos</span>
          </div>
        </div>

        <div className={styles.completed}>✓ All cohorts completed</div>
      </aside>
    </div>
  );
}
