import { SeasonStatus, type Season } from "../../../../models";
import { QuestlineIcon } from "../QuestlineIcon/QuestlineIcon";

import styles from "./SeasonCard.module.css";

interface SeasonCardProps {
    season: Season;
}

export function SeasonCard({ season }: SeasonCardProps) {
    const isLocked = season.status === SeasonStatus.Locked;

    return (
        <aside className={`${styles.card} ${isLocked ? styles.locked : ""}`}>
            <div className={styles.badge}>{season.badge}</div>
            <h3 className={styles.title}>{season.title}</h3>
            <p className={styles.meta}>{season.questCount} quests • {season.estimatedDuration}</p>

            {isLocked ? (
                <div className={styles.lockedState}>
                    <QuestlineIcon icon="lock" size={15} /> Locked
                </div>
            ) : (
                <div className={styles.progressBlock}>
                    <div className={styles.progressLabel}>{season.progress}% complete</div>
                    <progress className={styles.track} value={season.progress} max={100} />
                    <div className={styles.progressValue}>{season.progress}%</div>
                </div>
            )}
        </aside>
    );
}
