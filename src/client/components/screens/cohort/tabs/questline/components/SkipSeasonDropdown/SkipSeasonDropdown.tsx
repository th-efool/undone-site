import type { Season } from "../../../../models";
import { QuestlineIcon } from "../QuestlineIcon/QuestlineIcon";

import styles from "./SkipSeasonDropdown.module.css";

interface SkipSeasonDropdownProps {
    label: string;
    seasons: Season[];
}

export function SkipSeasonDropdown({ label, seasons }: SkipSeasonDropdownProps) {
    return (
        <label className={styles.wrapper}>
            <span className={styles.label}>{label}</span>
            <select className={styles.select} defaultValue="">
                <option value="">{label}</option>
                {seasons.map((season) => (
                    <option key={season.id} value={season.id}>{season.badge}</option>
                ))}
            </select>
            <QuestlineIcon icon="chevronDown" size={16} className={styles.icon} />
        </label>
    );
}
