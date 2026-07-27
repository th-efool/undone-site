/* eslint-disable @next/next/no-img-element */
import { DMMessage, DMUser } from "../../../../models";
import { MessageReaction } from "../MessageReaction/MessageReaction";
import { MessageStatus } from "../MessageStatus/MessageStatus";
import styles from "./DMBubble.module.css";
interface Props { message: DMMessage; user: DMUser; }
export function DMBubble({ message, user }: Props) {const outgoing = message.type === "outgoing"; return <article className={`${styles.row} ${outgoing ? styles.outgoing : styles.incoming}`}>{!outgoing && <span className={styles.avatar}>{message.showAvatar && <img src={user.avatar} alt=""/>}</span>}<div className={styles.wrap}><div className={`${styles.bubble} ${message.tail ? styles.tail : ""}`}>{message.text.split("\n").map((line) => <span key={line}>{line}</span>)}</div><div className={styles.meta}>{message.timestamp}<MessageStatus status={message.status}/></div><MessageReaction reactions={message.reactions} outgoing={outgoing}/></div></article>}
