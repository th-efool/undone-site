import Link from 'next/link';
import { getCohortHref } from '@/src/client/navigation/cohortLinks';
import { GripVertical, PauseCircle } from 'lucide-react';
import { useState } from 'react';

import type { ActiveCohort, Weekday } from '../../models';

import styles from './ActiveCohortRow.module.css';

const ALL_WEEKDAYS: Weekday[] = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export interface ActiveCohortRowProps {
  item: ActiveCohort;
  isSelected: boolean;
  onSelect: () => void;
  onReorder(draggedId: string, targetId: string): void;
  onUpdateSchedule?(cohortId: string, days: Weekday[]): void;
  onUpdateDailyGoal?(cohortId: string, minutes: number): void;
  onUpdateOrderStyle?(cohortId: string, style: string): void;
  onUpdateFrequency?(cohortId: string, frequency: string): void;
  onPause?(cohortId: string, days: number, pausedReason?: string): void;
}

const FREQUENCIES = ['Very Rarely', 'Rarely', 'Sometimes', 'Often', 'Very Often'];

export function ActiveCohortRow({
  item,
  isSelected,
  onSelect,
  onReorder,
  onUpdateSchedule,
  onUpdateDailyGoal,
  onUpdateOrderStyle,
  onUpdateFrequency,
  onPause,
}: ActiveCohortRowProps) {
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const [isDraggable, setIsDraggable] = useState(false);

  function toggleDay(day: Weekday) {
    const currentDays = item.schedule.days;
    const nextDays = currentDays.includes(day)
      ? currentDays.filter((d) => d !== day)
      : [...currentDays, day];
    const safeDays = nextDays.length > 0 ? nextDays : [day];
    onUpdateSchedule?.(item.id, safeDays);
    onSelect(); // ensure selection when interacting
  }

  const freqIndex = FREQUENCIES.indexOf(item.frequency || 'Often');
  const safeFreqIndex = freqIndex === -1 ? 3 : freqIndex;

  return (
    <article
      draggable={isDraggable}
      onDragStart={(event) => {
        event.dataTransfer.setData('text/plain', item.id);
        event.dataTransfer.effectAllowed = 'move';
      }}
      className={`${styles.row} ${isSelected ? styles.selected : ''} ${isDraggingOver ? styles.dragOver : ''}`}
      onClick={onSelect}
      onDragOver={(event) => {
        event.preventDefault();
        event.dataTransfer.dropEffect = 'move';
        setIsDraggingOver(true);
      }}
      onDragLeave={() => setIsDraggingOver(false)}
      onDrop={(event) => {
        event.preventDefault();
        setIsDraggingOver(false);
        const draggedId = event.dataTransfer.getData('text/plain');
        if (draggedId && draggedId !== item.id) {
          onReorder(draggedId, item.id);
        }
      }}
      onDragEnd={() => setIsDraggingOver(false)}
      role="button"
      tabIndex={0}
      aria-pressed={isSelected}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onSelect();
        }
      }}
    >
      {/* 1. Drag handle & Rank */}
      <div 
        className={styles.handleGroup}
        onMouseEnter={() => setIsDraggable(true)}
        onMouseLeave={() => setIsDraggable(false)}
      >
        <GripVertical className={styles.grip} size={16} strokeWidth={2.2} />
        <span className={styles.rank}>{item.rank}</span>
      </div>

      {/* 2. Thumbnail & Course Info */}
      <div className={styles.courseGroup}>
        <Link href={getCohortHref(item.cohortId ?? item.id)} onClick={(e) => e.stopPropagation()}>
          <img className={styles.thumbnail} src={item.thumbnail} alt="" />
        </Link>
        <div className={styles.course}>
          <h3 className={styles.title}>
            <Link href={getCohortHref(item.cohortId ?? item.id)} onClick={(e) => e.stopPropagation()}>
              {item.title}
            </Link>
          </h3>
          <p className={styles.provider}>{item.provider}</p>
        </div>
      </div>

      {/* 3. Pause */}
      <div className={styles.pauseCell}>
        <button
          type="button"
          className={styles.pauseButton}
          title="Pause cohort"
          onClick={(e) => {
            e.stopPropagation();
            onPause?.(item.id, 7, 'Paused from row');
          }}
        >
          <PauseCircle size={22} strokeWidth={2} />
        </button>
      </div>

      {/* 4. Shows up (Frequency) */}
      <div className={styles.cell}>
        <span className={styles.cellLabel}>Shows up</span>
        <div className={styles.frequency}>
          <span className={styles.frequencyText}>{item.frequency || 'Often'}</span>
          <div className={styles.frequencySlider}>
            <input 
              type="range" 
              min="0" 
              max="4" 
              step="1"
              value={safeFreqIndex} 
              onClick={(e) => e.stopPropagation()}
              onChange={(e) => {
                const val = parseInt(e.target.value, 10);
                onUpdateFrequency?.(item.id, FREQUENCIES[val]);
                onSelect();
              }}
              className={styles.rangeSlider}
              aria-label="Frequency"
            />
          </div>
        </div>
      </div>

      {/* 4. Days */}
      <div className={styles.cell}>
        <span className={styles.cellLabel}>Days</span>
        <div className={styles.daysGroup}>
          {ALL_WEEKDAYS.map(day => {
            const isActive = item.schedule.days.includes(day);
            return (
              <button 
                key={day} 
                type="button"
                className={`${styles.dayPill} ${isActive ? styles.dayActive : ''}`}
                onClick={(e) => {
                  e.stopPropagation();
                  toggleDay(day);
                }}
              >
                {day.charAt(0)}
              </button>
            );
          })}
        </div>
      </div>

      {/* 5. Daily Goal */}
      <div className={styles.cell}>
        <span className={styles.cellLabel}>Daily goal</span>
        <div className={styles.selectWrapper} onClick={(e) => e.stopPropagation()}>
          <select
            className={styles.realSelect}
            value={item.dailyGoalMinutes}
            onChange={(e) => {
              onUpdateDailyGoal?.(item.id, Number(e.target.value));
              onSelect();
            }}
          >
            <option value={10}>10 min</option>
            <option value={15}>15 min</option>
            <option value={20}>20 min</option>
            <option value={30}>30 min</option>
            <option value={45}>45 min</option>
            <option value={60}>60 min</option>
          </select>
        </div>
      </div>

      {/* 6. Order Style */}
      <div className={styles.cell}>
        <span className={styles.cellLabel}>Order style</span>
        <div className={styles.selectWrapper} onClick={(e) => e.stopPropagation()}>
          <select
            className={styles.realSelect}
            value={item.orderStyle || 'Sequential'}
            onChange={(e) => {
              onUpdateOrderStyle?.(item.id, e.target.value);
              onSelect();
            }}
          >
            <option value="Sequential">Sequential</option>
            <option value="Semantic Randomize">Semantic Rndm</option>
            <option value="Randomize">Randomize</option>
          </select>
        </div>
      </div>


    </article>
  );
}
