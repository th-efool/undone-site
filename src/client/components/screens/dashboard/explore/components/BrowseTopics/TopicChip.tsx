import styles from "./TopicChip.module.css";

import type { Topic } from "../../models";

export interface TopicChipProps {
    item: Topic;
}

export function TopicChip({
                              item,
                          }: TopicChipProps) {
    return (
        <button
            type="button"
            className={styles.chip}
        >
            <div
                className={styles.icon}
                style={{
                    color: item.color,
                }}
            >
                {item.icon}
            </div>

            <span className={styles.label}>
                {item.name}
            </span>
        </button>
    );
}