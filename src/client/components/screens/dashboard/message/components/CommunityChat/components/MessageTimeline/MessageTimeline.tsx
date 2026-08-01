import { useEffect, useRef } from 'react';

import { CommunityMessage } from '../../../../models';
import { EmptyState } from '../../../shared';
import { MessageBubble } from '../MessageBubble/MessageBubble';
import styles from './MessageTimeline.module.css';

interface Props {
  messages: CommunityMessage[];
  scrollTop: number;
  onScrollChange(scrollTop: number): void;
  onReaction(messageId: string, emoji: string): void;
  /** Batch C: Reply trigger */
  onReply?(messageId: string, senderName: string, previewText: string): void;
}

export function MessageTimeline({ messages, scrollTop, onScrollChange, onReaction, onReply }: Props) {
  const viewportRef = useRef<HTMLElement>(null);
  const previousCountRef = useRef(0);
  const wasNearBottomRef = useRef(true);

  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    viewport.scrollTop = scrollTop;
  }, [scrollTop]);

  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    if (
      previousCountRef.current &&
      messages.length > previousCountRef.current &&
      wasNearBottomRef.current
    ) {
      viewport.scrollTo({ top: viewport.scrollHeight, behavior: 'smooth' });
    }
    previousCountRef.current = messages.length;
  }, [messages.length]);

  return (
    <section
      ref={viewportRef}
      className={styles.timeline}
      onScroll={(event) => {
        const el = event.currentTarget;
        wasNearBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 140;
        onScrollChange(el.scrollTop);
      }}
    >
      {messages.length ? (
        messages.map((message) => (
          <MessageBubble
            key={message.id}
            message={message}
            onReaction={onReaction}
            onReply={onReply}
          />
        ))
      ) : (
        <EmptyState
          title="No messages yet"
          message="Start the first SideQuestHQ learning checkpoint here."
        />
      )}
    </section>
  );
}
