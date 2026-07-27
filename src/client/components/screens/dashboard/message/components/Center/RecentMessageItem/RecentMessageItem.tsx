import { FileText } from "lucide-react";
import { RecentMessage } from "../../../models";
import styles from "./RecentMessageItem.module.css";
interface Props{message:RecentMessage;}
export function RecentMessageItem({message}:Props){return <article className={styles.row}><span className={styles.avatar}><img src={message.sender.avatar} alt=""/>{message.sender.online&&<i/>}</span><div className={styles.body}><div className={styles.top}><strong>{message.sender.name}</strong><span>{message.community}</span>{message.live&&<em>LIVE</em>}</div>{message.attachment?<div className={styles.file}><FileText size={16}/>{message.attachment}</div>:<p>{message.message}</p>}</div><div className={styles.meta}>{message.timestamp&&<time>{message.timestamp}</time>}{message.unreadCount&&<b>{message.unreadCount}</b>}</div></article>}
