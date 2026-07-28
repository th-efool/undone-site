import type { Cohort } from "../../models";
import { ProgressSidebar } from "../ProgressSidebar/ProgressSidebar";

import styles from "./CohortHero.module.css";

interface CohortHeroProps {
    cohort: Cohort;
}

export function CohortHero({ cohort }: CohortHeroProps) {
    return (
        <section className={styles.hero}>
            <div className={styles.cover} style={{ backgroundImage: `url(${cohort.coverImage})` }} />

            <div className={styles.content}>
                <div className={styles.kicker}>{cohort.subtitle}</div>
                <h1 className={styles.title}>{cohort.title}</h1>
                <p className={styles.description}>{cohort.description}</p>

                <div className={styles.meta}>
                    <span>{cohort.difficulty}</span>
                    {cohort.categories.map((category) => (
                        <span key={category.id}>{category.label}</span>
                    ))}
                </div>

                <div className={styles.stats}>
                    <span>{cohort.stats.rating.toFixed(1)} rating</span>
                    <span>{cohort.stats.explorerCount.toLocaleString()} explorers</span>
                    <span>{cohort.stats.completionRate}% completion</span>
                    <span>Created by {cohort.creator.name}</span>
                </div>
            </div>

            <ProgressSidebar progress={cohort.progress} />
        </section>
    );
}
