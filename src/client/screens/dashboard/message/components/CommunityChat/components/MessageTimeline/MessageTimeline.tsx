import { useEffect, useRef } from 'react';

import { CommunityMessage } from '../../../../models';
import { DateDivider } from '../DateDivider/DateDivider';
import { EmptyState } from '../../../shared';
import { MessageBubble } from '../MessageBubble/MessageBubble';
import styles from './MessageTimeline.module.css';

interface Props {
  messages: CommunityMessage[];
  scrollTop: number;
  onScrollChange(scrollTop: number): void;
  onReaction(messageId: string, emoji: string): void;
  /** Batch C/D: Reply trigger */
  onReply?(messageId: string, senderName: string, previewText: string, senderAvatar?: string): void;
  /** Retry failed message */
  onRetry?(messageId: string): void;
}

/** Extract a date label from the timestamp string for fallback grouping. */
function extractDateLabel(msg: CommunityMessage): string {
  if (msg.dateLabel) return msg.dateLabel;
  const match = msg.timestamp.match(/^(\w+)\s+at/i);
  return match ? match[1] : msg.timestamp.split(/\s/)[0];
}

export function MessageTimeline({ messages, scrollTop, onScrollChange, onReaction, onReply, onRetry }: Props) {
  const viewportRef = useRef<HTMLElement>(null);
  const previousCountRef = useRef(0);
  const wasNearBottomRef = useRef(true);

  // Sync scroll position when conversation/community changes or on initial mount
  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    viewport.scrollTop = scrollTop;
  }, [messages, scrollTop]);

  // Auto-scroll to bottom when new messages arrive or sent
  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    const isLatestMessageFromMe = messages[messages.length - 1]?.author?.id === 'me';
    if (
      previousCountRef.current &&
      messages.length > previousCountRef.current &&
      (wasNearBottomRef.current || isLatestMessageFromMe)
    ) {
      requestAnimationFrame(() => {
        viewport.scrollTo({ top: viewport.scrollHeight, behavior: 'smooth' });
      });
    } else if (!previousCountRef.current && messages.length) {
      viewport.scrollTop = viewport.scrollHeight;
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
        messages.map((message, index) => {
          const previousMessage = index > 0 ? messages[index - 1] : undefined;
          const nextMessage = index < messages.length - 1 ? messages[index + 1] : undefined;

          const currentLabel = extractDateLabel(message);
          const prevLabel = previousMessage ? extractDateLabel(previousMessage) : null;
          const showDateDivider = currentLabel !== prevLabel;

          const isAdjacentReply = Boolean(
            message.replyTo?.messageId &&
            previousMessage &&
            message.replyTo.messageId === previousMessage.id
          );

          const hasAdjacentReplyBelow = Boolean(
            nextMessage?.replyTo?.messageId &&
            nextMessage.replyTo.messageId === message.id
          );

          return (
            <div key={message.id}>
              {showDateDivider && <DateDivider dateLabel={currentLabel} />}
              <MessageBubble
                message={message}
                isAdjacentReply={isAdjacentReply}
                hasAdjacentReplyBelow={hasAdjacentReplyBelow}
                onReaction={onReaction}
                onReply={onReply}
                onRetry={onRetry}
              />
            </div>
          );
        })
      ) : (
        <EmptyState
          title="No messages yet"
          message="Start the first Undone learning checkpoint here."
        />
      )}
    </section>
  );
}
