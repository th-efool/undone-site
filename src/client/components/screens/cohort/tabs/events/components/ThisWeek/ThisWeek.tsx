import type { CohortEvents } from "../../../../models";
import { Card } from "../Card/Card";

import styles from "../../Events.module.css";

export function ThisWeek({ events }: { events: CohortEvents }) {
    return <Card title="This Week" desc="See what's happening soon." action="View Calendar"><div className={styles.week}>{events.weeklySchedule.map((e) => <div key={e.id}><span>{e.icon}</span><p>{e.date} · {e.time}</p><strong>{e.title}</strong></div>)}</div><a>View All Upcoming Events →</a></Card>;
}
