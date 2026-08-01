/* eslint-disable @next/next/no-img-element */
import { useEffect, useRef, useState } from 'react';
import { Copy, Edit2, MessageCircle, SmilePlus, Trash2 } from 'lucide-react';
import { CommunityMessage } from '../../../../models';
import { ContextMenu } from '../../../shared';
import { MessageAttachment } from '../MessageAttachment/MessageAttachment';
import { ReactionBar } from '../ReactionBar/ReactionBar';
import { ReplyPreview } from '../ReplyPreview/ReplyPreview';
import styles from './MessageBubble.module.css';

const emojis = ['😀', '😂', '😍', '🔥', '🚀', '👏', '🙌', '✅', '💡', '📌', '🙏', '🎉'];

interface Props {
  message: CommunityMessage;
  onReaction(messageId: string, emoji: string): void;
  /** Batch C/D: Reply trigger */
  onReply?(messageId: string, senderName: string, previewText: string): void;
}
export function MessageBubble({ message, onReaction, onReply }: Props) {
  const [pickerOpen, setPickerOpen] = useState(false);

  /** Batch D7: Context menu state */
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);

  // Batch C/D: Tap to reply (desktop + mobile long-press simulation)
  const handleTap = () => {
    if (!onReply || !message.body) return;
    onReply(message.id, message.author.name, message.body.slice(0, 80));
  };

  // Batch D7: Context menu trigger (right-click + long-press)
  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY });
  };

  // Batch C/D: Debounce long-press to avoid accidental triggers
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

  /** Batch D7: Context menu actions */
  const handleCopy = () => {
    if (message.body) navigator.clipboard?.writeText(message.body);
  };

  useEffect(() => {
    // Close context menu on outside click or escape
    const closeMenu = () => setContextMenu(null);
    document.addEventListener('click', closeMenu);
    return () => document.removeEventListener('click', closeMenu);
  }, []);

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
      onContextMenu={handleContextMenu}
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

      {/* Batch D7: Context menu */}
      {contextMenu && (
        <ContextMenu
          items={[
            ...(onReply ? [{ label: 'Reply', icon: <MessageCircle size={16} />, onClick: () => onReply?.(message.id, message.author.name, message.body || '') }] : []),
            ...(message.body ? [{ label: 'Copy', icon: <Copy size={16} />, kbd: '⌘C', onClick: handleCopy }] : []),
            { label: 'React', icon: <SmilePlus size={16} />, onClick: () => setPickerOpen(true) },
          ]}
          x={contextMenu.x}
          y={contextMenu.y}
          onClose={() => setContextMenu(null)}
        />
      )}
    </article>
  );
}
