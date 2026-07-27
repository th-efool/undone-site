import { PartyPopper } from "lucide-react";

import type { CompletedCourse } from "../../models";

import styles from "./CompletedCourseCard.module.css";

export interface CompletedCourseCardProps {
    item: CompletedCourse;
}

export function CompletedCourseCard({ item }: CompletedCourseCardProps) {
    return (
        <article className={styles.card}>
            <img className={styles.thumbnail} src={item.thumbnail} alt="" />

            <div className={styles.content}>
                <h3 className={styles.title}>{item.title}</h3>
                <p className={styles.meta}>{item.completedLabel}</p>
            </div>

            <div className={styles.progressArea}>
                <strong>{item.progressPercent}%</strong>
                <div className={styles.progress}>
                    <div className={styles.progressFill} style={{ width: `${item.progressPercent}%` }} />
                </div>
            </div>

            <button type="button" className={styles.review}>Review</button>

            <button type="button" className={styles.celebrate} aria-label={`Celebrate ${item.title}`}>
                <PartyPopper size={24} strokeWidth={2.3} />
            </button>
        </article>
    );
}
