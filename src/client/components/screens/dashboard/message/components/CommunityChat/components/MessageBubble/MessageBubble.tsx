import { CommunityMessage } from "../../../../models";
import { MessageAttachment } from "../MessageAttachment/MessageAttachment";
import { ReactionBar } from "../ReactionBar/ReactionBar";
import { ReplyPreview } from "../ReplyPreview/ReplyPreview";
import styles from "./MessageBubble.module.css";

interface Props { message: CommunityMessage; }
export function MessageBubble({ message }: Props) {return <article className={styles.bubble}><img className={styles.avatar} src={message.author.avatar} alt=""/><div className={styles.content}><div className={styles.meta}><strong>{message.author.name}</strong>{message.badge && <span>{message.badge}</span>}<time>{message.timestamp}</time></div>{message.body && <p>{message.body}</p>}{message.attachment && <MessageAttachment attachment={message.attachment}/>}<ReactionBar reactions={message.reactions}/>{message.replies && <ReplyPreview reply={message.replies}/>}</div></article>}
