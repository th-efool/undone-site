import { useEffect, useRef } from "react";

import { DMConversationModel } from "../../../../models";
import { DateDivider } from "../DateDivider/DateDivider";
import { DMBubble } from "../DMBubble/DMBubble";
import styles from "./MessageTimeline.module.css";

interface Props {
    conversation: DMConversationModel;
    scrollTop: number;
    onScrollChange(scrollTop: number): void;
}

export function MessageTimeline({ conversation, scrollTop, onScrollChange }: Props) {
    const viewportRef = useRef<HTMLElement>(null);

    useEffect(() => {
        const viewport = viewportRef.current;
        if (!viewport) return;
        viewport.scrollTop = scrollTop;
    }, [scrollTop]);

    return (
        <section
            ref={viewportRef}
            className={styles.timeline}
            onScroll={(event) => onScrollChange(event.currentTarget.scrollTop)}
        >
            {conversation.messages.map((message) => (
                <div key={message.id}>
                    {message.dateLabel && <DateDivider label={message.dateLabel} />}
                    <DMBubble message={message} user={conversation.user} />
                </div>
            ))}
        </section>
    );
}
