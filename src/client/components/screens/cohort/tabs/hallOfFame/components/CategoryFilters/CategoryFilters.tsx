import type { CohortHallOfFame } from "../../../../models";
import { CategoryFilter } from "../CategoryFilter/CategoryFilter";

import styles from "../../HallOfFame.module.css";

export function CategoryFilters({ hall }: { hall: CohortHallOfFame }) {
    return (
        <div className={styles.filters}>
            {hall.filters.map((item) => <CategoryFilter key={item.id} item={item} />)}
        </div>
    );
}
