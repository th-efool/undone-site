import type { ActiveCohort, HomeSectionContent } from "../../models";
import { ActiveCohortRow } from "../ActiveCohortRow/ActiveCohortRow";
import { SectionHeader } from "../SectionHeader/SectionHeader";

import styles from "./ActiveCohorts.module.css";

export interface ActiveCohortsProps {
    heading: HomeSectionContent;
    items: ActiveCohort[];
}

export function ActiveCohorts({ heading, items }: ActiveCohortsProps) {
    return (
        <section className={styles.section} aria-labelledby="active-cohorts-heading">
            <SectionHeader title={heading.title} subtitle={heading.subtitle} />

            <div className={styles.table}>
                {items.map((item) => (
                    <ActiveCohortRow key={item.id} item={item} />
                ))}
            </div>
        </section>
    );
}
