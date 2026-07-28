import type { CohortHallOfFame } from "../../../../models";

import styles from "../../HallOfFame.module.css";

export function TimeRangeDropdown({ hall }: { hall: CohortHallOfFame }) {
    const selected = hall.timeRanges.find((item) => item.active) ?? hall.timeRanges[0];

    return <button className={styles.timeRange}>{selected.label}⌄</button>;
}
