import { Clock3, GripVertical, MoreHorizontal, Pause, Sparkles } from "lucide-react";

import type { ActiveCohort } from "../../models";

import styles from "./ActiveCohortRow.module.css";

export interface ActiveCohortRowProps {
    item: ActiveCohort;
}

export function ActiveCohortRow({ item }: ActiveCohortRowProps) {
    return (
        <article className={styles.row}>
            <GripVertical className={styles.grip} size={18} strokeWidth={2.2} />

            <span className={styles.rank}>{item.rank}</span>

            <img className={styles.thumbnail} src={item.thumbnail} alt="" />

            <div className={styles.course}>
                <h3 className={styles.title}>
                    {item.title}
                    {item.featured && <Sparkles size={15} strokeWidth={2.5} className={styles.sparkle} />}
                </h3>
                <p className={styles.provider}>{item.provider}</p>
                <p className={styles.today}>{item.minutesToday} min today</p>
            </div>

            <div className={styles.schedule}>
                <Clock3 size={14} strokeWidth={2.2} />
                {item.schedule.label}
            </div>

            <div className={styles.dailyGoal}>
                <span>Daily Goal</span>
                <strong>{item.dailyGoalMinutes} <small>min</small></strong>
            </div>

            <div className={styles.progressCell}>
                <span>Progress</span>
                <div className={styles.progressRow}>
                    <div className={styles.progress}>
                        <div className={styles.progressFill} style={{ width: `${item.progressPercent}%` }} />
                    </div>
                    <strong>{item.progressPercent}%</strong>
                </div>
            </div>

            <button type="button" className={styles.pauseButton}>
                <Pause size={14} fill="currentColor" />
                Pause
            </button>

            <button type="button" className={styles.moreButton} aria-label={`More actions for ${item.title}`}>
                <MoreHorizontal size={20} strokeWidth={2.7} />
            </button>
        </article>
    );
}
