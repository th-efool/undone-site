import type { CohortQuestline } from "../../../models";
import { SkipSeasonDropdown } from "../SkipSeasonDropdown/SkipSeasonDropdown";

import styles from "./QuestlineFilters.module.css";

interface QuestlineFiltersProps {
    questline: CohortQuestline;
}

export function QuestlineFilters({ questline }: QuestlineFiltersProps) {
    return (
        <div className={styles.controls}>
            <div className={styles.filters}>
                {questline.filters.map((filter, index) => (
                    <button
                        key={filter.id}
                        className={`${styles.filter} ${index === 0 ? styles.active : ""}`}
                        type="button"
                    >
                        {filter.label}
                    </button>
                ))}
            </div>
            <SkipSeasonDropdown label={questline.skipSeasonLabel} seasons={questline.seasons} />
        </div>
    );
}
