import Image from "next/image";

import type { HallCategory } from "../../../../models";
import { AchievementBadge } from "../AchievementBadge/AchievementBadge";
import { MedalIcon } from "../MedalIcon/MedalIcon";
import { MetricBadge } from "../MetricBadge/MetricBadge";

import styles from "../../HallOfFame.module.css";

export function LeaderboardCard({ item }: { item: HallCategory }) {
    return (
        <article className={`${styles.leaderCard} ${styles[item.accent]}`}>
            <h3>{item.title}</h3>
            <p>{item.subtitle}</p>
            <MedalIcon rank={item.rank} accent={item.accent} />
            <Image className={styles.avatar} src={item.winner.avatarUrl} alt="" width={58} height={58} />
            <strong>{item.winner.name}</strong>
            <b>{item.primaryMetric}</b>
            <MetricBadge value={item.growthMetric} />
            <AchievementBadge label={item.badge} accent={item.accent} />
        </article>
    );
}
