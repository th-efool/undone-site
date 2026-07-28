import type { EventItem } from "../../../../models";

import styles from "../../Events.module.css";

export function EventDateCard({ item }: { item: EventItem }) {
    return <div className={styles.date}><span>{item.date.month}</span><strong>{item.date.day}</strong><span>{item.date.weekday}</span></div>;
}
