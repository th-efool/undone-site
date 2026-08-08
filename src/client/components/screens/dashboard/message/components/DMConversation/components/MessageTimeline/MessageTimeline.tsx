import { useEffect, useRef } from 'react';

import { DMConversationModel } from '../../../../models';
import { EmptyState } from '../../../shared';
import { DateDivider } from '../DateDivider/DateDivider';
import { DMBubble } from '../DMBubble/DMBubble';
import styles from './MessageTimeline.module.css';

interface Props {
  conversation: DMConversationModel;
  scrollTop: number;
  onScrollChange(scrollTop: number): void;
  /** Batch C: Reply trigger */
  onReply?(messageId: string, senderName: string, previewText: string, senderAvatar?: string): void;
  /** Batch E3: Delete message */
  onDeleteMessage?(messageId: string): void;
}

export function MessageTimeline({ conversation, scrollTop, onScrollChange, onReply, onDeleteMessage }: Props) {
  const viewportRef = useRef<HTMLElement>(null);
  const previousCountRef = useRef(0);

  // Sync scroll position when conversation changes or on initial mount
  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    viewport.scrollTop = scrollTop;
  }, [conversation.id]);

  // Auto-scroll to bottom when new messages arrive or sent
  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    if (previousCountRef.current && conversation.messages.length > previousCountRef.current) {
      requestAnimationFrame(() => {
        viewport.scrollTo({ top: viewport.scrollHeight, behavior: 'smooth' });
      });
    } else if (!previousCountRef.current && conversation.messages.length) {
      // Initial render of conversation messages
      viewport.scrollTop = viewport.scrollHeight;
    }
    previousCountRef.current = conversation.messages.length;
  }, [conversation.messages.length, conversation.id]);

  return (
    <section
      ref={viewportRef}
      className={styles.timeline}
      onScroll={(event) => onScrollChange(event.currentTarget.scrollTop)}
    >
      {conversation.messages.length ? (
        conversation.messages.map((message, index) => {
          const previousMessage = index > 0 ? conversation.messages[index - 1] : undefined;
          const nextMessage = index < conversation.messages.length - 1 ? conversation.messages[index + 1] : undefined;

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
              {message.dateLabel && <DateDivider label={message.dateLabel} />}
              <DMBubble
                message={message}
                user={conversation.user}
                isAdjacentReply={isAdjacentReply}
                hasAdjacentReplyBelow={hasAdjacentReplyBelow}
                onReply={onReply}
                onDeleteMessage={onDeleteMessage}
              />
            </div>
          );
        })
      ) : (
        <EmptyState
          title={`Start a conversation with ${conversation.user.name.split(' ')[0]} 👋`}
          message={
            conversation.user.role === 'Group DM'
              ? `Say hello to the team!`
              : `Send a note, resource, or quick checkpoint to begin.`
          }
        />
      )}
    </section>
  );
}
