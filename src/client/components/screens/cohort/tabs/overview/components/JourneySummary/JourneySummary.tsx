import type { StatItem } from "../../../../models";
import { OverviewIcon } from "../OverviewIcon/OverviewIcon";

import styles from "./JourneySummary.module.css";

interface JourneySummaryProps {
    items: StatItem[];
}

export function JourneySummary({ items }: JourneySummaryProps) {
    return (
        <section className={styles.summary}>
            {items.map((item) => (
                <div key={item.id} className={styles.item}>
                    <OverviewIcon icon={item.icon} className={styles.icon} />
                    <div>
                        <div className={styles.label}>{item.label}</div>
                        <div className={styles.value}>{item.value}</div>
                    </div>
                </div>
            ))}
        </section>
    );
}
