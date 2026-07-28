import type { CohortEvents } from "../../../../models";

import styles from "../../Events.module.css";

export function EventsFilters({ events }: { events: CohortEvents }) {
    return <div className={styles.filters}>{events.filters.map((f) => <button key={f.id} className={f.active ? styles.active : ""}>{f.label}{f.id === "filter" ? "⌄" : ""}</button>)}</div>;
}
