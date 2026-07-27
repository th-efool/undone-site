import { CommunityMessage } from "../../../../models";
import { MessageBubble } from "../MessageBubble/MessageBubble";
import styles from "./MessageTimeline.module.css";
interface Props { messages: CommunityMessage[]; }
export function MessageTimeline({ messages }: Props) {return <section className={styles.timeline}>{messages.map((message) => <MessageBubble key={message.id} message={message}/>)}</section>}
