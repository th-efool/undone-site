/* eslint-disable @next/next/no-img-element */
import { useState } from 'react';
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
}
export function MessageBubble({ message, onReaction }: Props) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const react = (emoji: string) => {
    onReaction(message.id, emoji);
    setPickerOpen(false);
  };
  return (
    <article className={styles.bubble}>
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
