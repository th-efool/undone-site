import { useState } from 'react';
import type { ActiveCohort, HomeSectionContent, PauseOption, Weekday } from '../../models';
import { ActiveCohortRow } from '../ActiveCohortRow/ActiveCohortRow';
import { SectionHeader } from '../SectionHeader/SectionHeader';
import { InspectorPanel } from './InspectorPanel';

import styles from './ActiveCohorts.module.css';

export interface ActiveCohortsProps {
  heading: HomeSectionContent;
  items: ActiveCohort[];
  pauseOptions: PauseOption[];
  onReorder(draggedId: string, targetId: string): void;
  onUpdateDailyGoal(cohortId: string, minutes: number): void;
  onUpdateSchedule(cohortId: string, days: Weekday[]): void;
  onPause(cohortId: string, days: number, pausedReason?: string): void;
  onUpdateOrderStyle?(cohortId: string, style: string): void;
}

export function ActiveCohorts({
  heading,
  items,
  pauseOptions,
  onPause,
  onReorder,
  onUpdateDailyGoal,
  onUpdateSchedule,
  onUpdateOrderStyle,
}: ActiveCohortsProps) {
  // Default to first item if available
  const [selectedId, setSelectedId] = useState<string>(items[0]?.id || '');
  
  const selectedCohort = items.find(item => item.id === selectedId) || items[0];

  return (
    <section
      className={styles.section}
      aria-labelledby="active-cohorts-heading"
    >
      <div className={styles.headerRow}>
        <SectionHeader
          title={heading.title}
          subtitle={heading.subtitle}
        />
        <span className={styles.dragHint}>Drag to change what appears more often</span>
      </div>

      <div className={styles.layout}>
        {/* Left: Master List */}
        <div className={styles.list}>
          {items.map((item) => (
            <ActiveCohortRow
              key={item.id}
              item={item}
              isSelected={item.id === (selectedCohort?.id || '')}
              onSelect={() => setSelectedId(item.id)}
              onReorder={onReorder}
            />
          ))}
        </div>

        {/* Right: Inspector Panel */}
        {selectedCohort && (
          <div className={styles.inspectorWrapper}>
            <InspectorPanel 
              cohort={selectedCohort}
              onUpdateSchedule={onUpdateSchedule}
              onUpdateDailyGoal={onUpdateDailyGoal}
              onUpdateOrderStyle={onUpdateOrderStyle}
            />
          </div>
        )}
      </div>
    </section>
  );
}
