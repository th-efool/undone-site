import type { HallCategory } from "../../../../models";
import { LeaderboardCard } from "../LeaderboardCard/LeaderboardCard";

import styles from "../../HallOfFame.module.css";

export function LeaderboardGrid({ items }: { items: HallCategory[] }) {
    return <div className={styles.grid}>{items.map((item) => <LeaderboardCard key={item.id} item={item} />)}</div>;
}
