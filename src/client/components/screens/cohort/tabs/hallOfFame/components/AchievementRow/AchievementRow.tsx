import type { CohortHallOfFame } from "../../../../models";

import styles from "../../HallOfFame.module.css";

export function AchievementRow({ item }: { item: CohortHallOfFame["recentAchievements"][number] }) {
    return <div className={styles.achievementRow}><span>{item.icon}</span><div><strong>{item.title}</strong><p>{item.description}</p></div><em>{item.earnedTime}</em></div>;
}
