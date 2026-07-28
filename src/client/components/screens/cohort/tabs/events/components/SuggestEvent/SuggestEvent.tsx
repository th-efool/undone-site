import { Zap } from "lucide-react";

import type { CohortEvents } from "../../../../models";
import { Card } from "../Card/Card";

import styles from "../../Events.module.css";

export function SuggestEvent({ events }: { events: CohortEvents }) {
    return <Card title={events.suggestEvent.title} desc={events.suggestEvent.description}><div className={styles.cta}><button><Zap size={16} />{events.suggestEvent.buttonLabel}</button><span>{events.suggestEvent.illustration}</span></div></Card>;
}
