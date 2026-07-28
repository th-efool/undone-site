import styles from "../../HallOfFame.module.css";

export function MetricBadge({ value }: { value: string }) {
    return <span className={styles.metric}>↗ {value}</span>;
}
