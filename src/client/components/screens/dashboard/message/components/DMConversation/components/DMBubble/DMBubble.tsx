/* eslint-disable @next/next/no-img-element */
import { useEffect, useRef, useState } from 'react';
import { DMMessage, DMUser } from '../../../../models';
import { MessageReaction } from '../MessageReaction/MessageReaction';
import { MessageStatus } from '../MessageStatus/MessageStatus';
import { MessageAttachment } from '../../../CommunityChat/components/MessageAttachment/MessageAttachment';
import styles from './DMBubble.module.css';
interface Props {
  message: DMMessage;
  user: DMUser;
  /** Batch C: Reply trigger */
  onReply?(messageId: string, senderName: string, previewText: string): void;
}
export function DMBubble({ message, user, onReply }: Props) {
  // Batch C: Tap to reply (long-press for mobile)
  const tapTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const [showReactions, setShowReactions] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [longPress, setLongPress] = useState(false);

  const handlePointerDown = () => {
    tapTimerRef.current = setTimeout(() => {
      setLongPress(true);
    }, 500);
  };

  const handlePointerUp = () => {
    clearTimeout(tapTimerRef.current);
    if (longPress && onReply) {
      const previewText = message.replyTo ?? message.text.slice(0, 80);
      if (previewText) onReply(message.id, user.name, previewText);
      setLongPress(false);
      return;
    }
    // Regular tap: trigger reply
    const previewText = message.replyTo ?? message.text;
    if (onReply && previewText) {
      onReply(message.id, user.name, previewText.slice(0, 80));
    }
  };

  // Quick-reaction emojis
  const quickReactions = ['❤️', '🔥', '👍', '😂', '🎉'];

  useEffect(() => {
    return () => clearTimeout(tapTimerRef.current);
  }, []);

  const outgoing = message.type === 'outgoing';

  // Batch C: Show reactions bar on hover (desktop) or long-press (mobile)
  useEffect(() => {
    setShowReactions(hovered || longPress);
  }, [hovered, longPress]);

  return (
    <article
      className={`${styles.row} ${outgoing ? styles.outgoing : styles.incoming}`}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') handlePointerUp(); }}
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {!outgoing && (
        <span className={styles.avatar}>
          {message.showAvatar && (
            <img
              src={user.avatar}
              alt=""
            />
          )}
        </span>
      )}
      <div className={styles.wrap}>
        <div className={`${styles.bubble} ${message.tail ? styles.tail : ''}`}>
          {message.replyTo && <em className={styles.reply}>Replying to {message.replyTo}</em>}
          {message.text && message.text.split('\n').map((line) => <span key={line}>{line}</span>)}
          {message.attachment && <MessageAttachment attachment={message.attachment} />}
        </div>
        <div className={styles.meta}>
          {message.timestamp}
          <MessageStatus status={message.status} />
        </div>
        <MessageReaction
          reactions={message.reactions}
          outgoing={outgoing}
        />
        {/* Batch C: Quick-reaction bar on hover/long-press */}
        {showReactions && (
          <div className={styles.quickReactions}>
            {quickReactions.map((emoji) => (
              <button
                key={emoji}
                type="button"
                aria-label={`React with ${emoji}`}
                onClick={() => setShowReactions(false)}
              >
                {emoji}
              </button>
            ))}
          </div>
        )}
      </div>
    </article>
  );
}
