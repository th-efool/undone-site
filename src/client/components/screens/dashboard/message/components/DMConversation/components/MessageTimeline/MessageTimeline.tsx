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
}

export function MessageTimeline({ conversation, scrollTop, onScrollChange }: Props) {
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
            />
          </div>
        ))
      ) : (
        <EmptyState
          title="No DMs yet"
          message="Send a note, resource, or quick checkpoint to begin."
        />
      )}
    </section>
  );
}
