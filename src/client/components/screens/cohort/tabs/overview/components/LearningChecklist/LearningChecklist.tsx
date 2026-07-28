import type { LearningObjective } from "../../../../models";
import { OverviewIcon } from "../OverviewIcon/OverviewIcon";

import styles from "./LearningChecklist.module.css";

interface LearningChecklistProps {
    items: LearningObjective[];
}

export function LearningChecklist({ items }: LearningChecklistProps) {
    return (
        <section className={styles.section}>
            <h2 className={styles.title}>What You’ll Learn</h2>
            <div className={styles.grid}>
                {items.map((item) => (
                    <div key={item.id} className={styles.item}>
                        <OverviewIcon icon="check" className={styles.icon} />
                        <span>{item.text}</span>
                    </div>
                ))}
            </div>
        </section>
    );
}
