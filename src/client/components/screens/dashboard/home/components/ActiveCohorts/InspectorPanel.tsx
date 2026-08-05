import { CalendarDays, Clock, Shuffle, Sparkles, Wand2 } from 'lucide-react';
import type { ActiveCohort, Weekday } from '../../models';

import styles from './InspectorPanel.module.css';

export interface InspectorPanelProps {
  cohort: ActiveCohort;
  onUpdateSchedule(cohortId: string, days: Weekday[]): void;
  onUpdateDailyGoal(cohortId: string, minutes: number): void;
  onUpdateOrderStyle?(cohortId: string, style: string): void;
}

const weekdays: Weekday[] = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export function InspectorPanel({
  cohort,
  onUpdateSchedule,
  onUpdateDailyGoal,
  onUpdateOrderStyle,
}: InspectorPanelProps) {
  function toggleDay(day: Weekday) {
    const currentDays = cohort.schedule.days;
    const nextDays = currentDays.includes(day)
      ? currentDays.filter((d) => d !== day)
      : [...currentDays, day];
    const safeDays = nextDays.length > 0 ? nextDays : [day];
    onUpdateSchedule(cohort.id, safeDays);
  }

  return (
    <aside className={styles.inspector} aria-label={`Inspector for ${cohort.title}`}>
      {/* Schedule Section */}
      <section className={styles.section}>
        <header className={styles.sectionHeader}>
          <CalendarDays size={18} strokeWidth={2.5} className={styles.icon} />
          <div>
            <h3>Schedule</h3>
            <p>On which days should these cohorts be considered?</p>
          </div>
        </header>
        <div className={styles.dayGrid}>
          {weekdays.map((day) => {
            const isActive = cohort.schedule.days.includes(day);
            return (
              <button
                key={day}
                type="button"
                className={`${styles.dayButton} ${isActive ? styles.dayButtonActive : ''}`}
                aria-pressed={isActive}
                onClick={() => toggleDay(day)}
              >
                {day}
              </button>
            );
          })}
        </div>
        <p className={styles.tip}>Tip: You can also set days for each cohort individually.</p>
      </section>

      {/* Daily Goal Section */}
      <section className={styles.section}>
        <header className={styles.sectionHeader}>
          <Clock size={18} strokeWidth={2.5} className={styles.icon} />
          <div>
            <h3>Daily Goal <span className={styles.subtitle}>(Overall)</span></h3>
            <p>How much time do you want to spend learning?</p>
          </div>
        </header>
        <div className={styles.goalWrapper}>
          <select
            className={styles.goalSelect}
            value={cohort.dailyGoalMinutes}
            onChange={(e) => onUpdateDailyGoal(cohort.id, Number(e.target.value))}
          >
            <option value={10}>10 min</option>
            <option value={15}>15 min</option>
            <option value={20}>20 min</option>
            <option value={30}>30 min</option>
            <option value={45}>45 min</option>
            <option value={60}>60 min</option>
          </select>
        </div>
        <p className={styles.tip}>We'll try to fill your day with the right mix.</p>
      </section>

      {/* Order Preference Section */}
      <section className={styles.section}>
        <header className={styles.sectionHeader}>
          <Shuffle size={18} strokeWidth={2.5} className={styles.icon} />
          <div>
            <h3>Order Preference <span className={styles.subtitle}>(Default)</span></h3>
            <p>How should items be ordered within each cohort?</p>
          </div>
        </header>
        <div className={styles.orderOptions}>
          <label className={`${styles.orderCard} ${cohort.orderStyle === 'Sequential' ? styles.orderCardActive : ''}`}>
            <input 
              type="radio" 
              name="orderStyle" 
              value="Sequential"
              checked={cohort.orderStyle === 'Sequential'}
              onChange={() => onUpdateOrderStyle?.(cohort.id, 'Sequential')}
              className={styles.srOnly}
            />
            <div className={styles.orderCardIcon}><Wand2 size={16} /></div>
            <div className={styles.orderCardContent}>
              <h4>Sequential</h4>
              <p>Learn in the original order.</p>
            </div>
            <div className={styles.radioRing} />
          </label>

          <label className={`${styles.orderCard} ${cohort.orderStyle === 'Semantic Randomize' ? styles.orderCardActive : ''}`}>
            <input 
              type="radio" 
              name="orderStyle" 
              value="Semantic Randomize"
              checked={cohort.orderStyle === 'Semantic Randomize'}
              onChange={() => onUpdateOrderStyle?.(cohort.id, 'Semantic Randomize')}
              className={styles.srOnly}
            />
            <div className={styles.orderCardIcon}><Sparkles size={16} /></div>
            <div className={styles.orderCardContent}>
              <h4>Semantic Randomize</h4>
              <p>We group similar ideas, then shuffle within groups.</p>
            </div>
            <div className={styles.radioRing} />
          </label>

          <label className={`${styles.orderCard} ${cohort.orderStyle === 'Randomize' ? styles.orderCardActive : ''}`}>
            <input 
              type="radio" 
              name="orderStyle" 
              value="Randomize"
              checked={cohort.orderStyle === 'Randomize'}
              onChange={() => onUpdateOrderStyle?.(cohort.id, 'Randomize')}
              className={styles.srOnly}
            />
            <div className={styles.orderCardIcon}><Shuffle size={16} /></div>
            <div className={styles.orderCardContent}>
              <h4>Randomize</h4>
              <p>Fully random order.</p>
            </div>
            <div className={styles.radioRing} />
          </label>
        </div>
      </section>

      {/* Helper Card */}
      <div className={styles.helperCard}>
        <div className={styles.helperIcon}>
          <Sparkles size={20} className={styles.iconBrand} />
        </div>
        <div className={styles.helperContent}>
          <h4>These settings shape your feed.</h4>
          <p>You can update them anytime.</p>
        </div>
        <div className={styles.helperArrow}>›</div>
      </div>
    </aside>
  );
}
