import Link from 'next/link';
import { getCohortHref } from '@/src/client/navigation/cohortLinks';
import { GripVertical, MoreHorizontal } from 'lucide-react';
import { useState } from 'react';

import type { ActiveCohort, Weekday } from '../../models';

import styles from './ActiveCohortRow.module.css';

const ALL_WEEKDAYS: Weekday[] = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export interface ActiveCohortRowProps {
  item: ActiveCohort;
  isSelected: boolean;
  onSelect: () => void;
  onReorder(draggedId: string, targetId: string): void;
}

export function ActiveCohortRow({
  item,
  isSelected,
  onSelect,
  onReorder,
}: ActiveCohortRowProps) {
  const [isDraggingOver, setIsDraggingOver] = useState(false);

  return (
    <article
      draggable={true}
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
      <div className={styles.handleGroup}>
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

      {/* 3. Shows up (Frequency) */}
      <div className={styles.cell}>
        <span className={styles.cellLabel}>Shows up</span>
        <div className={styles.frequency}>
          <span className={styles.frequencyText}>{item.frequency || 'Often'}</span>
          <div className={styles.frequencySlider}>
            <div className={styles.frequencyTrack}>
              <div 
                className={styles.frequencyFill} 
                style={{ 
                  width: item.frequency === 'Very Often' ? '90%' : 
                         item.frequency === 'Often' ? '70%' : 
                         item.frequency === 'Sometimes' ? '50%' : 
                         item.frequency === 'Rarely' ? '30%' : '10%' 
                }} 
              />
              <div 
                className={styles.frequencyThumb}
                style={{ 
                  left: item.frequency === 'Very Often' ? '90%' : 
                         item.frequency === 'Often' ? '70%' : 
                         item.frequency === 'Sometimes' ? '50%' : 
                         item.frequency === 'Rarely' ? '30%' : '10%' 
                }}
              />
            </div>
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
              <span key={day} className={`${styles.dayPill} ${isActive ? styles.dayActive : ''}`}>
                {day.charAt(0)}
              </span>
            );
          })}
        </div>
      </div>

      {/* 5. Daily Goal */}
      <div className={styles.cell}>
        <span className={styles.cellLabel}>Daily goal</span>
        <div className={styles.fauxSelect}>
          {item.dailyGoalMinutes} min
          <span className={styles.chevron}>▾</span>
        </div>
      </div>

      {/* 6. Order Style */}
      <div className={styles.cell}>
        <span className={styles.cellLabel}>Order style</span>
        <div className={styles.fauxSelect}>
          {item.orderStyle || 'Sequential'}
          <span className={styles.chevron}>▾</span>
        </div>
      </div>

      {/* 7. More Menu */}
      <button type="button" className={styles.moreButton} onClick={(e) => e.stopPropagation()}>
        <MoreHorizontal size={20} strokeWidth={2.7} />
      </button>
    </article>
  );
}
