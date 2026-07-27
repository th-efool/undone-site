/* eslint-disable @next/next/no-img-element */
import { Download, FileText, Play } from "lucide-react";
import { ChatAttachment } from "../../../../models";
import styles from "./MessageAttachment.module.css";

interface Props { attachment: ChatAttachment; compact?: boolean; }
export function MessageAttachment({ attachment, compact }: Props) {
    if (attachment.kind === "pdf") return <article className={styles.file}><span><FileText size={28}/></span><div><strong>{attachment.title}</strong><p>{attachment.meta}</p></div><button type="button" aria-label="Download"><Download size={18}/></button></article>;
    return <figure className={`${styles.image} ${compact ? styles.compact : ""}`}><img src={attachment.url} alt={attachment.title}/>{attachment.duration && <em><Play size={14} fill="currentColor"/> {attachment.duration}</em>}{!compact && attachment.caption && <figcaption>{attachment.caption}<span>{attachment.meta}</span></figcaption>}</figure>;
}
