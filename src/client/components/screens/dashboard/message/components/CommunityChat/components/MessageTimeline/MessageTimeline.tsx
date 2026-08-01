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
  onReply?(messageId: string, senderName: string, previewText: string): void;
}

/** Extract a date label from the timestamp string for fallback grouping. */
function extractDateLabel(msg: CommunityMessage): string {
  if (msg.dateLabel) return msg.dateLabel;
  // Parse "Today at 5:28 PM" → "Today"; otherwise use first word before "at" or first space
  const match = msg.timestamp.match(/^(\w+)\s+at/i);
  return match ? match[1] : msg.timestamp.split(/\s/)[0];
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

  // Batch D1: Group messages by date label for sticky dividers
  const groupedMessages: Array<{ dateLabel: string; messages: CommunityMessage[] }> = [];
  let currentDateLabel = '';
  for (const msg of messages) {
    const label = extractDateLabel(msg);
    if (label !== currentDateLabel) {
      currentDateLabel = label;
      groupedMessages.push({ dateLabel: label, messages: [msg] });
    } else {
      groupedMessages[groupedMessages.length - 1].messages.push(msg);
    }
  }

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
        <>
          {/* Batch D1: Date dividers between date groups */}
          {groupedMessages.map((group, gi) => (
            gi > 0 && <DateDivider key={`div-${gi}`} dateLabel={group.dateLabel} />
          ))}
          {messages.map((message) => (
            <MessageBubble
              key={message.id}
              message={message}
              onReaction={onReaction}
              onReply={onReply}
            />
          ))}
        </>
      ) : (
        /* Batch D2: Empty state for community with no messages */
        <EmptyState
          title="No messages yet"
          message="Start the first SideQuestHQ learning checkpoint here."
        />
      )}
    </section>
  );
}
