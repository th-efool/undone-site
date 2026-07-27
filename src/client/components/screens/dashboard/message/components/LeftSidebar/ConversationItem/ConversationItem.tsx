/* eslint-disable @next/next/no-img-element */
import { KeyboardEvent } from "react";

import { ConversationPreview } from "../../../models";
import styles from "./ConversationItem.module.css";

interface Props {
    conversation: ConversationPreview;
    onSelect(conversation: ConversationPreview): void;
}

export function ConversationItem({ conversation, onSelect }: Props) {
    const select = () => onSelect(conversation);
    const onKeyDown = (event: KeyboardEvent<HTMLElement>) => {
        if (event.key !== "Enter" && event.key !== " ") return;
        event.preventDefault();
        select();
    };

    return (
        <article
            className={`${styles.item} ${conversation.selected ? styles.selected : ""}`}
            onClick={select}
            onKeyDown={onKeyDown}
            role="button"
            tabIndex={0}
            aria-current={conversation.selected ? "true" : undefined}
        >
            <img src={conversation.avatar} alt="" />
            <div className={styles.body}>
                <div className={styles.top}>
                    <strong>{conversation.name}</strong>
                    {conversation.unreadCount && <span className={styles.badge}>{conversation.unreadCount}</span>}
                </div>
                <p><span>{conversation.sender ? `${conversation.sender}: ` : ""}</span>{conversation.preview}</p>
                <div className={styles.meta}>
                    <span className={styles.online} />
                    <span>{conversation.onlineCount ? `${conversation.onlineCount} online` : "Online"}</span>
                    {conversation.statusLabel && <em>{conversation.statusLabel}</em>}
                    <time>{conversation.timestamp}</time>
                </div>
            </div>
        </article>
    );
}
