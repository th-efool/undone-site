'use client';

import { AssignmentsProjectsFeed } from './components/AssignmentsProjectsFeed/AssignmentsProjectsFeed';
import { QuestlineFilters } from './components/QuestlineFilters/QuestlineFilters';
import { SeasonTimeline } from './components/SeasonTimeline/SeasonTimeline';

import styles from './Questline.module.css';
import type { Cohort } from '../../models';

interface QuestlineProps {
  cohortId: string;
  cohort: Cohort;
}

export function Questline({ cohortId, cohort }: QuestlineProps) {
  const { questline } = cohort;

  return (
    <div className={styles.questline}>
      <section className={styles.mainCard}>
        <header className={styles.header}>
          <div>
            <h1 className={styles.title}>{questline.title}</h1>
            <p className={styles.description}>{questline.description}</p>
          </div>
          <QuestlineFilters questline={questline} />
        </header>

        <SeasonTimeline seasons={questline.seasons} />
      </section>

      <AssignmentsProjectsFeed questline={questline} />
    </div>
  );
}
