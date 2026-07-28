import Image from "next/image";

import type { EventItem } from "../../../../models";

import styles from "../../Events.module.css";

export function EventAttendance({ item }: { item: EventItem }) {
    return <div className={styles.attendance}>{item.avatars.map((a) => <Image key={a.id} src={a.avatarUrl} alt="" width={24} height={24} />)}<span>{item.attendeeCount}</span></div>;
}
