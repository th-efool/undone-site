import type { CohortHallOfFame } from "../../../../models";

import styles from "../../HallOfFame.module.css";

export function CategoryFilter({ item }: { item: CohortHallOfFame["filters"][number] }) {
    return <button className={item.active ? styles.activeFilter : ""}>{item.label}</button>;
}
