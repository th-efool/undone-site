import { useState } from 'react';
import { ChevronRight } from 'lucide-react';
import type { ActiveCohort, HomeSectionContent, PauseOption, Weekday } from '../../models';
import { ActiveCohortRow } from '../ActiveCohortRow/ActiveCohortRow';
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
  onUpdateFrequency?(cohortId: string, frequency: string): void;
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
  onUpdateFrequency,
}: ActiveCohortsProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isOpen, setIsOpen] = useState(true);
  
  const selectedCohort = isOpen 
    ? (items.find(item => item.id === selectedId) || items[0]) 
    : null;

  return (
    <section
      className={styles.section}
      aria-labelledby="active-cohorts-heading"
    >
      <div className={styles.layout} style={{ gridTemplateColumns: selectedCohort ? '1fr 340px' : '1fr' }}>
        {/* Left: Master List */}
        <div className={`${styles.list} ${selectedCohort ? styles.listWithInspector : ''}`}>
          <div className={styles.listHeader}>
            <div className={styles.headerBar}>
              {/* Left Browser Tab Trapezium for Feed Policy */}
              <div className={styles.tabTrapezium}>
                <h2 className={styles.tabTitle}>{heading.title}</h2>
              </div>

              {/* Right Dark Indigo Bar for See All & Drag Hint */}
              <div className={styles.indigoBar}>
                <button type="button" className={styles.seeAllBtn}>
                  See all
                  <ChevronRight size={15} strokeWidth={2.5} />
                </button>
                <span className={styles.dragHintText}>
                  Drag to change what appears more often
                </span>
              </div>
            </div>
          </div>

          <div className={styles.itemsWrapper}>
            {items.map((item) => (
            <ActiveCohortRow
              key={item.id}
              item={item}
              isSelected={item.id === (selectedCohort?.id || '')}
              onSelect={() => {
                setSelectedId(item.id);
                setIsOpen(true);
              }}
              onReorder={onReorder}
              onUpdateSchedule={onUpdateSchedule}
              onUpdateDailyGoal={onUpdateDailyGoal}
              onUpdateOrderStyle={onUpdateOrderStyle}
              onUpdateFrequency={onUpdateFrequency}
              onPause={onPause}
            />
          ))}
          </div>
        </div>

        {/* Right: Inspector Panel */}
        {selectedCohort && (
          <div className={styles.inspectorWrapper}>
            <InspectorPanel 
              cohort={selectedCohort}
              onUpdateSchedule={onUpdateSchedule}
              onUpdateDailyGoal={onUpdateDailyGoal}
              onUpdateOrderStyle={onUpdateOrderStyle}
              onUpdateFrequency={onUpdateFrequency}
              onClose={() => setIsOpen(false)}
              onPause={onPause}
            />
          </div>
        )}
      </div>
    </section>
  );
}
