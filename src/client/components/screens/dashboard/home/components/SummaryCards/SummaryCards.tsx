import type { GoalSummary } from "../../models";

import styles from "./SummaryCards.module.css";

export interface SummaryCardsProps {
    items: GoalSummary[];
}

export function SummaryCards({ items }: SummaryCardsProps) {
    return (
        <section className={styles.grid} aria-label="Learning summary">
            {items.map((item) => (
                <article key={item.id} className={styles.card}>
                    <div className={`${styles.icon} ${styles[item.iconTone]}`}>
                        {item.icon}
                    </div>

                    <div className={styles.content}>
                        <p className={styles.label}>{item.title}</p>
                        <strong className={styles.value}>{item.value}</strong>

                        {item.progress && (
                            <div className={styles.progress}>
                                <div
                                    className={styles.progressFill}
                                    style={{ width: `${item.progress.percent}%` }}
                                />
                            </div>
                        )}

                        {item.trendPath && (
                            <svg className={styles.trend} viewBox="0 0 216 42" aria-hidden="true">
                                <path d={item.trendPath} />
                            </svg>
                        )}

                        {item.helperText && (
                            <span className={`${styles.helper} ${styles[item.helperTone ?? "brand"]}`}>
                                {item.helperText}
                            </span>
                        )}
                    </div>
                </article>
            ))}
        </section>
    );
}
