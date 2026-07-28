import { Medal, Star } from "lucide-react";

import type { HallAccent } from "../../../../models";

import styles from "../../HallOfFame.module.css";

export function MedalIcon({ rank, accent }: { rank: number; accent: HallAccent }) {
    if (rank === 0) return <div className={`${styles.medal} ${styles[accent]}`}><Star size={22} /></div>;

    return <div className={`${styles.medal} ${styles[accent]}`}><Medal size={26} /><span>{rank}</span></div>;
}
