/* eslint-disable @next/next/no-img-element */
import { useEffect, useRef, useState } from 'react';
import { SmilePlus } from 'lucide-react';
import { CommunityMessage } from '../../../../models';
import { MessageAttachment } from '../MessageAttachment/MessageAttachment';
import { ReactionBar } from '../ReactionBar/ReactionBar';
import { ReplyPreview } from '../ReplyPreview/ReplyPreview';
import styles from './MessageBubble.module.css';

const emojis = ['😀', '😂', '😍', '🔥', '🚀', '👏', '🙌', '✅', '💡', '📌', '🙏', '🎉'];

interface Props {
  message: CommunityMessage;
  onReaction(messageId: string, emoji: string): void;
  /** Batch C: Reply trigger */
  onReply?(messageId: string, senderName: string, previewText: string): void;
}
export function MessageBubble({ message, onReaction, onReply }: Props) {
  const [pickerOpen, setPickerOpen] = useState(false);

  // Batch C: Tap to reply (desktop + mobile long-press simulation)
  const handleTap = () => {
    if (!onReply || !message.body) return;
    onReply(message.id, message.author.name, message.body.slice(0, 80));
  };
  // Batch C: Debounce long-press to avoid accidental triggers
  const tapTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const [longPress, setLongPress] = useState(false);

  const handlePointerDown = () => {
    tapTimerRef.current = setTimeout(() => {
      setLongPress(true);
    }, 500); // 500ms long-press threshold
  };

  const handlePointerUp = () => {
    clearTimeout(tapTimerRef.current);
    if (longPress && onReply && message.body) {
      onReply(message.id, message.author.name, message.body.slice(0, 80));
      setLongPress(false);
      return;
    }
    // Regular tap: trigger reply
    handleTap();
  };

  const react = (emoji: string) => {
    onReaction(message.id, emoji);
    setPickerOpen(false);
  };

  useEffect(() => {
    return () => clearTimeout(tapTimerRef.current);
  }, []);

  return (
    <article
      className={styles.bubble}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') handleTap(); }}
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
    >
      <img
        className={styles.avatar}
        src={message.author.avatar}
        alt=""
      />
      <div className={styles.content}>
        <div className={styles.meta}>
          <strong>{message.author.name}</strong>
          {message.badge && <span>{message.badge}</span>}
          <time>{message.timestamp}</time>
        </div>
        {message.body && <p>{message.body}</p>}
        {message.attachment && <MessageAttachment attachment={message.attachment} />}
        <div className={styles.reactionLine}>
          <ReactionBar
            reactions={message.reactions}
            onReaction={react}
          />
          <div className={styles.reactWrap}>
            <button
              type="button"
              className={styles.addReaction}
              aria-label="Add reaction"
              onClick={() => setPickerOpen((open) => !open)}
            >
              <SmilePlus size={15} /> Add Reaction
            </button>
            {pickerOpen && (
              <div className={styles.emojiPicker}>
                {emojis.map((emoji) => (
                  <button
                    key={emoji}
                    type="button"
                    onClick={() => react(emoji)}
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
        {message.replies && <ReplyPreview reply={message.replies} />}
      </div>
    </article>
  );
}
