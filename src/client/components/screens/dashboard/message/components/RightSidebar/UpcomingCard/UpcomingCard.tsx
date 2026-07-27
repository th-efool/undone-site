import { CalendarDays } from "lucide-react";
import { UpcomingEvent } from "../../../models";
import styles from "./UpcomingCard.module.css";
interface Props{event:UpcomingEvent;}
export function UpcomingCard({event}:Props){return <article className={styles.card}><span className={`${styles.icon} ${styles[event.tone]}`}><CalendarDays size={20}/></span><div><strong>{event.title}</strong><p>{event.subtitle}</p><em>{event.startsIn}</em></div><button type="button">Join</button></article>}
