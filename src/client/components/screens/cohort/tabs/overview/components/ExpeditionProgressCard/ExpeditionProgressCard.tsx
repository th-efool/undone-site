import type { StatItem } from "../../../../models";
import { OverviewIcon } from "../OverviewIcon/OverviewIcon";

import styles from "./ExpeditionProgressCard.module.css";

interface ExpeditionProgressCardProps {
    items: StatItem[];
}

export function ExpeditionProgressCard({ items }: ExpeditionProgressCardProps) {
    return (
        <aside className={styles.card}>
            <h2 className={styles.title}>Your Expedition</h2>

            <div className={styles.rows}>
                {items.map((item) => (
                    <div key={item.id} className={styles.row}>
                        <div className={styles.labelGroup}>
                            <OverviewIcon icon={item.icon} className={styles.icon} />
                            <span>{item.label}</span>
                        </div>
                        <strong>{item.value}</strong>
                    </div>
                ))}
            </div>

            <button className={styles.button} type="button">
                View My Activity
            </button>
        </aside>
    );
}
