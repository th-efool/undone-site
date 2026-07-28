import { QuestlineIcon } from "../QuestlineIcon/QuestlineIcon";

import styles from "./SeasonSummary.module.css";

interface SeasonSummaryProps {
    label: string;
    lockedMessage?: string;
}

export function SeasonSummary({ label, lockedMessage }: SeasonSummaryProps) {
    return (
        <footer className={styles.footer}>
            {lockedMessage ? (
                <span className={styles.locked}><QuestlineIcon icon="lock" size={16} /> {lockedMessage}</span>
            ) : (
                <button className={styles.button} type="button">
                    {label}
                    <QuestlineIcon icon="chevronDown" size={16} />
                </button>
            )}
        </footer>
    );
}
