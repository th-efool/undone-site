import { useState, useEffect } from 'react';
import { CalendarDays, Clock, Shuffle, Sparkles, ListOrdered, Signal, X, ChevronDown, PauseCircle } from 'lucide-react';
import type { ActiveCohort, Weekday } from '../../models';

import styles from './InspectorPanel.module.css';

export interface InspectorPanelProps {
  cohort: ActiveCohort;
  onUpdateSchedule(cohortId: string, days: Weekday[]): void;
  onUpdateDailyGoal(cohortId: string, minutes: number): void;
  onUpdateOrderStyle?(cohortId: string, style: string): void;
  onUpdateFrequency?(cohortId: string, frequency: string): void;
  onClose?(): void;
  onPause?(cohortId: string, days: number): void;
}

const FREQUENCIES = ['Very Rarely', 'Rarely', 'Sometimes', 'Often', 'Very Often'];

const weekdays: Weekday[] = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export function InspectorPanel({
  cohort,
  onUpdateSchedule,
  onUpdateDailyGoal,
  onUpdateOrderStyle,
  onUpdateFrequency,
  onClose,
  onPause,
}: InspectorPanelProps) {
  function toggleDay(day: Weekday) {
    const currentDays = cohort.schedule.days;
    const nextDays = currentDays.includes(day)
      ? currentDays.filter((d) => d !== day)
      : [...currentDays, day];
    const safeDays = nextDays.length > 0 ? nextDays : [day];
    onUpdateSchedule(cohort.id, safeDays);
  }

  function handleFrequencyChange(e: React.ChangeEvent<HTMLInputElement>) {
    const val = parseInt(e.target.value, 10);
    onUpdateFrequency?.(cohort.id, FREQUENCIES[val]);
  }
  const freqIndex = FREQUENCIES.indexOf(cohort.frequency || 'Often');
  const safeFreqIndex = freqIndex === -1 ? 3 : freqIndex;

  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({
    frequency: false,
    schedule: false,
    goal: false,
    order: false
  });

  useEffect(() => {
    // Contracted screens -> default closed
    if (window.innerWidth <= 1200) {
      setCollapsed({ frequency: true, schedule: true, goal: true, order: true });
    }
  }, []);

  function toggle(sec: string) {
    setCollapsed(prev => ({ ...prev, [sec]: !prev[sec] }));
  }

  return (
    <aside className={styles.inspector} aria-label={`Inspector for ${cohort.title}`}>
      {onClose && (
        <button className={styles.closeBtn} onClick={onClose} aria-label="Close">
          <X size={16} />
        </button>
      )}
      <div key={cohort.id} className={styles.inspectorContent}>
        
        {/* Frequency Section */}
        <section className={styles.section}>
          <header className={styles.sectionHeader} onClick={() => toggle('frequency')} role="button">
            <div className={styles.headerTitleRow}>
              <Signal size={16} strokeWidth={2.5} className={styles.icon} />
              <div>
                <h3>Shows up <span className={styles.subtitle}>(Frequency)</span></h3>
                <p className={styles.desc}>How often should this appear in your feed?</p>
              </div>
            </div>
            <ChevronDown size={14} className={`${styles.chevron} ${collapsed.frequency ? styles.chevronClosed : ''}`} />
          </header>
          {!collapsed.frequency && (
            <div className={styles.sliderWrapper}>
              <div className={styles.sliderLabels}>
                <span>Less</span>
                <span className={styles.sliderValue}>{cohort.frequency || 'Often'}</span>
                <span>More</span>
              </div>
              <input 
                type="range" 
                min="0" 
                max="4" 
                step="1"
                value={safeFreqIndex} 
                onChange={handleFrequencyChange}
                className={styles.rangeSlider}
                aria-label="Frequency"
              />
            </div>
          )}
        </section>

        {/* Schedule Section */}
        <section className={styles.section}>
          <header className={styles.sectionHeader} onClick={() => toggle('schedule')} role="button">
            <div className={styles.headerTitleRow}>
              <CalendarDays size={16} strokeWidth={2.5} className={styles.icon} />
              <div>
                <h3>Schedule</h3>
                <p className={styles.desc}>Which days should this be prioritized?</p>
              </div>
            </div>
            <ChevronDown size={14} className={`${styles.chevron} ${collapsed.schedule ? styles.chevronClosed : ''}`} />
          </header>
          {!collapsed.schedule && (
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
          )}
        </section>

      {/* Daily Goal Section — always visible, single row */}
      <section className={styles.section}>
        <div className={styles.goalRow}>
          <Clock size={16} strokeWidth={2.5} className={styles.icon} />
          <h3>Daily Goal <span className={styles.subtitle}>(Overall)</span></h3>
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
      </section>

      {/* Order Preference Section */}
      <section className={styles.section}>
        <header className={styles.sectionHeader} onClick={() => toggle('order')} role="button">
          <div className={styles.headerTitleRow}>
            <ListOrdered size={16} strokeWidth={2.5} className={styles.icon} />
            <div>
              <h3>Order Preference <span className={styles.subtitle}>(Default)</span></h3>
              <p className={styles.desc}>How should items be ordered within each cohort?</p>
            </div>
          </div>
          <ChevronDown size={14} className={`${styles.chevron} ${collapsed.order ? styles.chevronClosed : ''}`} />
        </header>
        {!collapsed.order && (
          <div className={styles.orderOptions}>
            <label className={`${styles.orderCard} ${cohort.orderStyle === 'Sequential' ? styles.orderCardActive : ''}`}>
              <input 
                type="radio" 
                name={`order-${cohort.id}`} 
                value="Sequential"
                checked={cohort.orderStyle === 'Sequential'}
                onChange={() => onUpdateOrderStyle?.(cohort.id, 'Sequential')}
                className={styles.srOnly}
              />
              <div className={styles.orderCardIcon}><ListOrdered size={15} /></div>
              <div className={styles.orderCardContent}>
                <h4>Sequential</h4>
                <p>Learn in the original order.</p>
              </div>
              <div className={styles.radioRing} />
            </label>

            <label className={`${styles.orderCard} ${cohort.orderStyle === 'Semantic Randomize' ? styles.orderCardActive : ''}`}>
              <input 
                type="radio" 
                name={`order-${cohort.id}`} 
                value="Semantic Randomize"
                checked={cohort.orderStyle === 'Semantic Randomize'}
                onChange={() => onUpdateOrderStyle?.(cohort.id, 'Semantic Randomize')}
                className={styles.srOnly}
              />
              <div className={styles.orderCardIcon}><Sparkles size={15} /></div>
              <div className={styles.orderCardContent}>
                <h4>Semantic Randomize</h4>
                <p>We group similar ideas, then shuffle.</p>
              </div>
              <div className={styles.radioRing} />
            </label>

            <label className={`${styles.orderCard} ${cohort.orderStyle === 'Randomize' ? styles.orderCardActive : ''}`}>
              <input 
                type="radio" 
                name={`order-${cohort.id}`} 
                value="Randomize"
                checked={cohort.orderStyle === 'Randomize'}
                onChange={() => onUpdateOrderStyle?.(cohort.id, 'Randomize')}
                className={styles.srOnly}
              />
              <div className={styles.orderCardIcon}><Shuffle size={15} /></div>
              <div className={styles.orderCardContent}>
                <h4>Randomize</h4>
                <p>Fully random order.</p>
              </div>
              <div className={styles.radioRing} />
            </label>
          </div>
        )}
      </section>

      </div>

      {onPause && (
        <button className={styles.pauseBtn} onClick={() => onPause(cohort.id, 7)} aria-label="Pause cohort">
          <PauseCircle size={15} />
          <span>Pause</span>
        </button>
      )}
    </aside>
  );
}
