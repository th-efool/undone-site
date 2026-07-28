import type { EventItem } from "../../../../models";
import { EventCard } from "../EventCard/EventCard";

import styles from "../../Events.module.css";

export function EventList({ items }: { items: EventItem[] }) {
    return <div className={styles.list}>{items.map((item) => <EventCard key={item.id} item={item} />)}</div>;
}
