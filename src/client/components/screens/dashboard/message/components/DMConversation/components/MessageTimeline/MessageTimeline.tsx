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
  onReply?(messageId: string, senderName: string, previewText: string): void;
  /** Batch E3: Delete message */
  onDeleteMessage?(messageId: string): void;
}

export function MessageTimeline({ conversation, scrollTop, onScrollChange, onReply, onDeleteMessage }: Props) {
  const viewportRef = useRef<HTMLElement>(null);
  const previousCountRef = useRef(0);

  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    viewport.scrollTop = scrollTop;
  }, [scrollTop]);

  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    if (previousCountRef.current && conversation.messages.length > previousCountRef.current) {
      viewport.scrollTo({ top: viewport.scrollHeight, behavior: 'smooth' });
    }
    previousCountRef.current = conversation.messages.length;
  }, [conversation.messages.length]);

  return (
    <section
      ref={viewportRef}
      className={styles.timeline}
      onScroll={(event) => onScrollChange(event.currentTarget.scrollTop)}
    >
      {conversation.messages.length ? (
        conversation.messages.map((message) => (
          <div key={message.id}>
            {message.dateLabel && <DateDivider label={message.dateLabel} />}
            <DMBubble
              message={message}
              user={conversation.user}
              onReply={onReply}
              onDeleteMessage={onDeleteMessage}
            />
          </div>
        ))
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
