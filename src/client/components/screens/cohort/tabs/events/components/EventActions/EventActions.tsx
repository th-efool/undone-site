import { Clock, MoreVertical } from "lucide-react";

import type { EventItem } from "../../../../models";
import { EventStatusBadge } from "../EventStatusBadge/EventStatusBadge";
import { RSVPButton } from "../RSVPButton/RSVPButton";

import styles from "../../Events.module.css";

export function EventActions({ item }: { item: EventItem }) {
    return <div className={styles.actions}><div><Clock size={16} /> <strong>{item.time}</strong><span>{item.timezone}</span><EventStatusBadge item={item} /></div><RSVPButton /><button className={styles.more}><MoreVertical size={18} /></button></div>;
}
