import type { ActiveCohort, HomeSectionContent, PauseOption, Weekday } from "../../models";
import { ActiveCohortRow } from "../ActiveCohortRow/ActiveCohortRow";
import { SectionHeader } from "../SectionHeader/SectionHeader";

import styles from "./ActiveCohorts.module.css";

export interface ActiveCohortsProps {
    heading: HomeSectionContent;
    items: ActiveCohort[];
    pauseOptions: PauseOption[];
    onReorder(draggedId: string, targetId: string): void;
    onUpdateDailyGoal(cohortId: string, minutes: number): void;
    onUpdateSchedule(cohortId: string, days: Weekday[]): void;
    onPause(cohortId: string, days: number, pausedReason?: string): void;
}

export function ActiveCohorts({
                                  heading,
                                  items,
                                  pauseOptions,
                                  onPause,
                                  onReorder,
                                  onUpdateDailyGoal,
                                  onUpdateSchedule,
                              }: ActiveCohortsProps) {
    return (
        <section className={styles.section} aria-labelledby="active-cohorts-heading">
            <SectionHeader title={heading.title} subtitle={heading.subtitle} />

            <div className={styles.table}>
                {items.map((item) => (
                    <ActiveCohortRow
                        key={item.id}
                        item={item}
                        pauseOptions={pauseOptions}
                        onPause={onPause}
                        onReorder={onReorder}
                        onUpdateDailyGoal={onUpdateDailyGoal}
                        onUpdateSchedule={onUpdateSchedule}
                    />
                ))}
            </div>
        </section>
    );
}
