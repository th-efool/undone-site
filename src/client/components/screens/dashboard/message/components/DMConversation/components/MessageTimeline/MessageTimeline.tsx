import { DMConversationModel } from "../../../../models";
import { DateDivider } from "../DateDivider/DateDivider";
import { DMBubble } from "../DMBubble/DMBubble";
import styles from "./MessageTimeline.module.css";
interface Props { conversation: DMConversationModel; }
export function MessageTimeline({ conversation }: Props) {return <section className={styles.timeline}>{conversation.messages.map((message) => <div key={message.id}>{message.dateLabel && <DateDivider label={message.dateLabel}/>}<DMBubble message={message} user={conversation.user}/></div>)}</section>}
