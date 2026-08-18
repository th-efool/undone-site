import Image from 'next/image';
import Link from 'next/link';
import { getCohortHref } from '@/src/client/navigation/cohortLinks';
import { GripVertical, PauseCircle, ListOrdered, Shuffle } from 'lucide-react';
import { useState } from 'react';
import { Slider } from '@/src/client/components/ui/Slider/Slider';
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
      <div className={styles.leftSection}>
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

        <div className={styles.courseGroup}>
          <Link href={getCohortHref(item.cohortId ?? item.id)} onClick={(e) => e.stopPropagation()}>
            <Image className={styles.thumbnail} src={item.thumbnail} alt="" width={40} height={30} />
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
      </div>

      <div className={styles.rightSection}>
        <span className={styles.statusText}>
          {item.dailyGoalMinutes}m/day • {item.frequency || 'Often'} • {item.schedule.days.map(d => d.charAt(0)).join(' ')}
        </span>
      </div>
    </article>
  );
}
