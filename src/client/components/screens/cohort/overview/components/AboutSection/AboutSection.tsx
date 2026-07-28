import type { CohortOverview } from "../../../models";
import { LearningPillars } from "../LearningPillars/LearningPillars";

import styles from "./AboutSection.module.css";

interface AboutSectionProps {
    overview: CohortOverview;
}

export function AboutSection({ overview }: AboutSectionProps) {
    return (
        <section className={styles.section}>
            <h2 className={styles.title}>About This Cohort</h2>
            <p className={styles.description}>{overview.description}</p>
            <LearningPillars items={overview.pillars} />
        </section>
    );
}
