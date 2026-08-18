import { useState } from 'react';
import { CalendarDays, Clock, Shuffle, ListOrdered, Signal, X, PauseCircle } from 'lucide-react';
import { Slider } from '@/src/client/components/ui/Slider/Slider';
import { motion, AnimatePresence } from 'framer-motion';
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

export function ChartNetwork({ size = 15, className }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <circle cx="12" cy="5" r="2.5" />
      <circle cx="5" cy="18" r="2.5" />
      <circle cx="19" cy="18" r="2.5" />
      <circle cx="12" cy="13" r="2" />
      <line x1="12" y1="7.5" x2="12" y2="11" />
      <line x1="10.3" y1="14.3" x2="6.7" y2="16.7" />
      <line x1="13.7" y1="14.3" x2="17.3" y2="16.7" />
    </svg>
  );
}

const FREQUENCIES = ['Very Rarely', 'Rarely', 'Sometimes', 'Often', 'Very Often'] as const;
const WEEKDAYS: Weekday[] = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const STANDARD_GOALS = [10, 15, 20, 30, 45, 60];

export function InspectorPanel({
  cohort,
  onUpdateSchedule,
  onUpdateDailyGoal,
  onUpdateOrderStyle,
  onUpdateFrequency,
  onClose,
  onPause,
}: InspectorPanelProps) {
  const [isEditingCustomGoal, setIsEditingCustomGoal] = useState(false);
  const [customGoalVal, setCustomGoalVal] = useState(String(cohort.dailyGoalMinutes));

  function toggleDay(day: Weekday) {
    const current = cohort.schedule.days;
    const next = current.includes(day)
      ? current.filter((d) => d !== day)
      : [...current, day];
    onUpdateSchedule(cohort.id, next.length > 0 ? next : [day]);
  }

  const isStandardGoal = STANDARD_GOALS.includes(cohort.dailyGoalMinutes);

  return (
    <aside className={styles.inspector} aria-label={`Inspector for ${cohort.title}`}>
      {onClose && (
        <button className={styles.closeBtn} onClick={onClose} aria-label="Close">
          <X size={15} />
        </button>
      )}

      <AnimatePresence mode="wait">
        <motion.div 
          key={cohort.id} 
          className={styles.inspectorContent}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.12, ease: 'easeOut' }}
        >

        {/* ── Frequency ── */}
        <section className={styles.section}>
          <div className={styles.sectionHeader}>
            <Signal size={14} className={styles.icon} />
            <span className={styles.sectionLabel}>Shows up</span>
          </div>
          <div className={styles.frequencySliderRow}>
            <span 
              className={`${styles.sliderEdgeLabel} ${cohort.frequency === 'Rarely' ? styles.sliderEdgeActive : ''}`}
              onClick={() => onUpdateFrequency?.(cohort.id, 'Rarely')}
            >
              Less
            </span>
            <div className={styles.sliderInputWrapper}>
              <Slider
                min={0}
                max={4}
                step={1}
                value={Math.max(0, FREQUENCIES.indexOf((cohort.frequency || 'Often') as typeof FREQUENCIES[number]))}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  onUpdateFrequency?.(cohort.id, FREQUENCIES[parseInt(e.target.value, 10)])
                }
                className={styles.rangeSlider}
                aria-label="Frequency"
              />
            </div>
            <span 
              className={`${styles.sliderEdgeLabel} ${cohort.frequency === 'Always' ? styles.sliderEdgeActive : ''}`}
              onClick={() => onUpdateFrequency?.(cohort.id, 'Always')}
            >
              More
            </span>
          </div>
        </section>

        {/* ── Schedule ── */}
        <section className={styles.section}>
          <div className={styles.sectionHeader}>
            <CalendarDays size={14} className={styles.icon} />
            <span className={styles.sectionLabel}>Schedule</span>
          </div>
          <div className={styles.dayGrid}>
            {WEEKDAYS.map((day) => {
              const active = cohort.schedule.days.includes(day);
              return (
                <button
                  key={day}
                  type="button"
                  className={`${styles.dayBtn} ${active ? styles.pillActive : styles.pillIdle}`}
                  aria-pressed={active}
                  onClick={() => toggleDay(day)}
                >
                  {day}
                </button>
              );
            })}
          </div>
        </section>

        {/* ── Daily Goal ── */}
        <section className={styles.section}>
          <div className={styles.sectionHeader}>
            <Clock size={14} className={styles.icon} />
            <span className={styles.sectionLabel}>Daily Goal</span>
          </div>

          {isEditingCustomGoal ? (
            <div className={styles.customGoalGroup}>
              <input
                type="number"
                min="1"
                max="300"
                autoFocus
                className={styles.customGoalInput}
                value={customGoalVal}
                onChange={(e) => setCustomGoalVal(e.target.value)}
                onBlur={() => {
                  const num = parseInt(customGoalVal, 10);
                  if (num > 0) onUpdateDailyGoal(cohort.id, num);
                  setIsEditingCustomGoal(false);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    const num = parseInt(customGoalVal, 10);
                    if (num > 0) onUpdateDailyGoal(cohort.id, num);
                    setIsEditingCustomGoal(false);
                  }
                  if (e.key === 'Escape') setIsEditingCustomGoal(false);
                }}
              />
              <span className={styles.unitText}>min</span>
            </div>
          ) : (
            <div className={styles.pills}>
              {STANDARD_GOALS.map((g) => (
                <button
                  key={g}
                  type="button"
                  className={`${styles.pill} ${cohort.dailyGoalMinutes === g ? styles.pillActive : styles.pillIdle}`}
                  onClick={() => onUpdateDailyGoal(cohort.id, g)}
                >
                  {g} min
                </button>
              ))}
              {!isStandardGoal && (
                <button
                  type="button"
                  className={`${styles.pill} ${styles.pillActive}`}
                  onClick={() => {
                    setCustomGoalVal(String(cohort.dailyGoalMinutes));
                    setIsEditingCustomGoal(true);
                  }}
                >
                  {cohort.dailyGoalMinutes} min
                </button>
              )}
              <button
                type="button"
                className={`${styles.pill} ${styles.pillIdle}`}
                onClick={() => {
                  setCustomGoalVal(String(cohort.dailyGoalMinutes));
                  setIsEditingCustomGoal(true);
                }}
              >
                Custom…
              </button>
            </div>
          )}
        </section>

        {/* ── Order Preference ── */}
        <section className={styles.section}>
          <div className={styles.sectionHeader}>
            <ListOrdered size={14} className={styles.icon} />
            <span className={styles.sectionLabel}>Order</span>
          </div>
          <div className={styles.pills}>
            {[
              { value: 'Sequential', Icon: ListOrdered, label: 'Sequential' },
              { value: 'Semantic Randomize', Icon: ChartNetwork, label: 'Semantic Shuffle' },
              { value: 'Randomize', Icon: Shuffle, label: 'Random' },
            ].map(({ value, Icon, label }) => (
              <button
                key={value}
                type="button"
                className={`${styles.pill} ${cohort.orderStyle === value ? styles.pillActive : styles.pillIdle}`}
                onClick={() => onUpdateOrderStyle?.(cohort.id, value)}
              >
                <Icon size={12} />
                {label}
              </button>
            ))}
          </div>
        </section>

        </motion.div>
      </AnimatePresence>
      {onPause && (
        <button
          className={styles.pauseBtn}
          onClick={() => onPause(cohort.id, 7)}
          aria-label="Pause cohort"
        >
          <PauseCircle size={14} />
          <span>Pause</span>
        </button>
      )}
    </aside>
  );
}
