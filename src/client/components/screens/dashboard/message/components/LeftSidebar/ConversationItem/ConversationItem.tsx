import { ConversationPreview } from "../../../models";
import styles from "./ConversationItem.module.css";

interface Props { conversation: ConversationPreview; }
export function ConversationItem({ conversation }: Props) {return <article className={`${styles.item} ${conversation.selected?styles.selected:""}`}><img src={conversation.avatar} alt=""/><div className={styles.body}><div className={styles.top}><strong>{conversation.name}</strong>{conversation.unreadCount&&<span className={styles.badge}>{conversation.unreadCount}</span>}</div><p><span>{conversation.sender}: </span>{conversation.preview}</p><div className={styles.meta}><span className={styles.online}/><span>{conversation.onlineCount ? `${conversation.onlineCount} online` : "Online"}</span>{conversation.statusLabel&&<em>{conversation.statusLabel}</em>}<time>{conversation.timestamp}</time></div></div></article>}
