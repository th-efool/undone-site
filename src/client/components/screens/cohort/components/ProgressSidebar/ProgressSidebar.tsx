import type { Progress } from "../../models";

import styles from "./ProgressSidebar.module.css";

interface ProgressSidebarProps {
    progress: Progress;
}

export function ProgressSidebar({ progress }: ProgressSidebarProps) {
    return (
        <aside className={styles.sidebar}>
            <div>
                <div className={styles.label}>Journey</div>
                <div className={styles.value}>{progress.journeyProgress}%</div>
            </div>

            <div className={styles.track}>
                <div className={styles.bar} style={{ width: `${progress.journeyProgress}%` }} />
            </div>

            <dl className={styles.list}>
                <div>
                    <dt>Completed quests</dt>
                    <dd>{progress.completedQuests}/{progress.totalQuests}</dd>
                </div>
                <div>
                    <dt>Daily goal</dt>
                    <dd>{progress.dailyGoal}</dd>
                </div>
                <div>
                    <dt>Joined date</dt>
                    <dd>{progress.joinedDate}</dd>
                </div>
            </dl>
        </aside>
    );
}
