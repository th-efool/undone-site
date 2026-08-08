import Image from 'next/image';
import Link from 'next/link';
import { getCohortHref } from '@/src/client/navigation/cohortLinks';
import { GripVertical, PauseCircle, ListOrdered, Shuffle } from 'lucide-react';
import { useState } from 'react';
import { Tooltip } from '@/src/client/components/ui/Tooltip';

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

export function ChartNetwork({ size = 14, className }: { size?: number; className?: string }) {
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
  const [isEditingCustomGoal, setIsEditingCustomGoal] = useState(false);
  const [customGoalVal, setCustomGoalVal] = useState(String(item.dailyGoalMinutes));

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

  const standardGoals = [10, 15, 20, 30, 45, 60];
  const isStandardGoal = standardGoals.includes(item.dailyGoalMinutes);

  const orderStyle = item.orderStyle || 'Sequential';

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
      <Tooltip content="Drag to reorder cohorts" placement="top">
        <div 
          className={styles.handleGroup}
          onMouseEnter={() => setIsDraggable(true)}
          onMouseLeave={() => setIsDraggable(false)}
          aria-label="Drag to reorder cohorts"
          tabIndex={0}
        >
          <GripVertical className={styles.grip} size={16} strokeWidth={2.2} />
          <span className={styles.rank}>{item.rank}</span>
        </div>
      </Tooltip>

      {/* 2. Thumbnail & Course Info */}
      <div className={styles.courseGroup}>
        <Link href={getCohortHref(item.cohortId ?? item.id)} onClick={(e) => e.stopPropagation()}>
          <Image className={styles.thumbnail} src={item.thumbnail} alt=""  width={400} height={300}/>
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

      {/* 3. Pause — First Control Field */}
      <div className={styles.pauseCell}>
        <Tooltip content="Pause cohort" placement="top">
          <button
            type="button"
            className={styles.pauseButton}
            aria-label="Pause cohort"
            onClick={(e) => {
              e.stopPropagation();
              onPause?.(item.id, 7, 'Paused from row');
            }}
          >
            <PauseCircle size={16} strokeWidth={2} />
          </button>
        </Tooltip>
      </div>

      {/* 4. Shows up (Frequency) with Segmented Pills & Vertical Divider */}
      <div className={styles.showsUpCell}>
        <span className={styles.cellLabel}>SHOWS UP</span>
        <div className={styles.frequencySegmented}>
          {['Rarely', 'Sometimes', 'Often'].map((option) => {
            const currentFreq = item.frequency || 'Often';
            const isCurrent = currentFreq.includes(option);
            return (
              <button
                key={option}
                type="button"
                className={`${styles.freqPill} ${isCurrent ? styles.freqPillActive : ''}`}
                onClick={(e) => {
                  e.stopPropagation();
                  onUpdateFrequency?.(item.id, option);
                  onSelect();
                }}
              >
                {option}
              </button>
            );
          })}
        </div>
        <div className={styles.frequencySlider}>
          <input 
            type="range" 
            min="0" 
            max="2" 
            step="1"
            value={
              (item.frequency || 'Often').includes('Rarely') ? 0 :
              (item.frequency || 'Often').includes('Sometimes') ? 1 : 2
            } 
            onClick={(e) => e.stopPropagation()}
            onChange={(e) => {
              const opts = ['Rarely', 'Sometimes', 'Often'];
              const val = parseInt(e.target.value, 10);
              onUpdateFrequency?.(item.id, opts[val]);
              onSelect();
            }}
            className={styles.rangeSlider}
            aria-label="Frequency"
          />
        </div>
      </div>

      {/* 5. Days */}
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

      {/* 6. Daily Goal */}
      <div className={styles.cell}>
        <span className={styles.cellLabel}>Daily goal</span>
        <div className={styles.goalPillWrapper} onClick={(e) => e.stopPropagation()}>
          <div className={styles.clockPieIcon}>
            <svg viewBox="0 0 36 36" className={styles.circularChart}>
              <path
                className={styles.circleBg}
                d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
              />
              <path
                className={styles.circleFill}
                strokeDasharray={`${Math.min(100, Math.round((item.dailyGoalMinutes / 60) * 100))}, 100`}
                d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
              />
            </svg>
          </div>

          {isEditingCustomGoal ? (
            <div className={styles.customGoalGroup}>
              <input
                type="number"
                min="1"
                max="300"
                autoFocus
                className={styles.customGoalInputRow}
                value={customGoalVal}
                onChange={(e) => setCustomGoalVal(e.target.value)}
                onBlur={() => {
                  const num = parseInt(customGoalVal, 10);
                  if (num > 0) onUpdateDailyGoal?.(item.id, num);
                  setIsEditingCustomGoal(false);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    const num = parseInt(customGoalVal, 10);
                    if (num > 0) onUpdateDailyGoal?.(item.id, num);
                    setIsEditingCustomGoal(false);
                  }
                }}
              />
            </div>
          ) : (
            <select
              className={styles.realSelectWithClock}
              value={item.dailyGoalMinutes}
              onChange={(e) => {
                if (e.target.value === 'custom') {
                  setCustomGoalVal(String(item.dailyGoalMinutes));
                  setIsEditingCustomGoal(true);
                } else {
                  onUpdateDailyGoal?.(item.id, Number(e.target.value));
                  onSelect();
                }
              }}
            >
              <option value={10}>10 min</option>
              <option value={15}>15 min</option>
              <option value={20}>20 min</option>
              <option value={30}>30 min</option>
              <option value={45}>45 min</option>
              <option value={60}>60 min</option>
              {!isStandardGoal && <option value={item.dailyGoalMinutes}>{item.dailyGoalMinutes} min</option>}
              <option value="custom">Custom...</option>
            </select>
          )}
        </div>
      </div>

      {/* 7. Order Style — Last Field */}
      <div className={styles.cell}>
        <span className={styles.cellLabel}>Order style</span>
        <Tooltip content={`Order style: ${orderStyle}`} placement="top">
          <div className={styles.orderIconWrapper} onClick={(e) => e.stopPropagation()}>
            <div className={styles.orderLeftIcon}>
              {orderStyle === 'Sequential' && <ListOrdered size={17} className={styles.orderIcon} />}
              {orderStyle === 'Semantic Randomize' && <ChartNetwork size={17} className={styles.orderIcon} />}
              {orderStyle === 'Randomize' && <Shuffle size={17} className={styles.orderIcon} />}
            </div>
            <select
              className={styles.realSelectIconOnly}
              value={orderStyle}
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
        </Tooltip>
      </div>

    </article>
  );
}
