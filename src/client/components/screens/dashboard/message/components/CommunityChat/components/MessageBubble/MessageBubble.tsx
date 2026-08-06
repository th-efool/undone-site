/* eslint-disable @next/next/no-img-element */
import { useEffect, useRef, useState } from 'react';
import { Copy, MessageCircle, MoreHorizontal, SmilePlus } from 'lucide-react';
import { CommunityMessage } from '../../../../models';
import { ContextMenu } from '../../../shared';
import { InReplyTo } from '../InReplyTo/InReplyTo';
import { MessageAttachment } from '../MessageAttachment/MessageAttachment';
import { ReactionBar } from '../ReactionBar/ReactionBar';
import { ReplyPreview } from '../ReplyPreview/ReplyPreview';
import styles from './MessageBubble.module.css';

const quickEmojis = ['❤️', '👍', '🔥'];
const fullEmojiRepository = [
  '😀', '😃', '😄', '😁', '😆', '😅', '😂', '🤣', '🥹', '😊',
  '😇', '🙂', '🙃', '😉', '😌', '😍', '🥰', '😘', '😗', '😙',
  '😋', '😛', '😜', '🤪', '🤨', '🧐', '🤓', '😎', '🤩', '🥳',
  '😏', '😒', '😞', '😔', '😟', '😕', '🙁', '😣', '😖', '😫',
  '😩', '🥺', '😢', '😭', '😤', '😠', '😡', '🤬', '🤯', '😳',
  '😱', '😨', '😰', '😥', '😓', '🤗', '🫡', '🤔', '🤭', '🫢',
  '❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '🤍', '🤎', '💖',
  '💗', '💓', '💞', '💕', '🔥', '✨', '⭐', '🌟', '💥', '💯',
  '👍', '👎', '👏', '🙌', '👐', '🤲', '🤝', '🙏', '✌️', '🤞',
  '🤟', '🤘', '🤙', '🖐️', '✋', '👌', '🎯', '🚀', '🎉', '💡',
];

interface Props {
  message: CommunityMessage;
  onReaction(messageId: string, emoji: string): void;
  onReply?(messageId: string, senderName: string, previewText: string): void;
}

export function MessageBubble({ message, onReaction, onReply }: Props) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);
  const tapTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const [longPress, setLongPress] = useState(false);

  const handleTap = () => {
    if (!onReply || !message.body) return;
    onReply(message.id, message.author.name, message.body.slice(0, 80));
  };

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    setPickerOpen(false);
    setContextMenu({ x: e.clientX, y: e.clientY });
  };

  const handlePointerDown = () => {
    tapTimerRef.current = setTimeout(() => setLongPress(true), 500);
  };

  const handlePointerUp = () => {
    clearTimeout(tapTimerRef.current);
    if (longPress && onReply && message.body) {
      onReply(message.id, message.author.name, message.body.slice(0, 80));
      setLongPress(false);
      return;
    }
    handleTap();
  };

  const react = (emoji: string) => {
    onReaction(message.id, emoji);
    setPickerOpen(false);
  };

  const handleCopy = () => {
    if (message.body) navigator.clipboard?.writeText(message.body);
  };

  useEffect(() => {
    const closeAll = () => { setContextMenu(null); setPickerOpen(false); };
    document.addEventListener('click', closeAll);
    return () => document.removeEventListener('click', closeAll);
  }, []);

  useEffect(() => () => clearTimeout(tapTimerRef.current), []);

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
      <img className={styles.avatar} src={message.author.avatar} alt="" />

      <div className={styles.content}>
        <div className={styles.meta}>
          <strong>{message.author.name}</strong>
          {message.badge && <span>{message.badge}</span>}
          <time>{message.timestamp}</time>
        </div>
        {message.body && (
          <>
            {message.replyTo && (
              <InReplyTo
                authorName={message.replyTo.authorName}
                authorAvatar={message.replyTo.authorAvatar}
                previewText={message.replyTo.previewText}
              />
            )}
            <p>{message.body}</p>
          </>
        )}
        {message.attachment && <MessageAttachment attachment={message.attachment} />}
        {message.reactions && (
          <ReactionBar reactions={message.reactions} onReaction={react} />
        )}
        {message.replies && <ReplyPreview reply={message.replies} />}
      </div>

      {/* ── Discord-style floating action bar – top-right corner of message ── */}
      <div className={styles.actionBar} onClick={(e) => e.stopPropagation()}>
        {quickEmojis.map((emoji) => (
          <button
            key={emoji}
            type="button"
            className={styles.actionBtn}
            aria-label={`React with ${emoji}`}
            onClick={() => react(emoji)}
          >
            {emoji}
          </button>
        ))}

        <span className={styles.actionDivider} />

        {/* Emoji picker */}
        <div className={styles.reactWrap}>
          <button
            type="button"
            className={styles.actionBtn}
            aria-label="More emojis"
            onClick={(e) => { e.stopPropagation(); setPickerOpen((o) => !o); }}
          >
            <SmilePlus size={15} />
          </button>

          {pickerOpen && (
            <div className={styles.emojiPicker}>
              <div className={styles.pickerHeader}>
                <span>Select Reaction</span>
                <button type="button" onClick={() => setPickerOpen(false)}>×</button>
              </div>
              <div className={styles.pickerGrid}>
                {fullEmojiRepository.map((emoji) => (
                  <button
                    key={emoji}
                    type="button"
                    className={styles.pickerBtn}
                    onClick={() => react(emoji)}
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        <span className={styles.actionDivider} />

        {/* Reply */}
        {onReply && (
          <button
            type="button"
            className={styles.actionBtn}
            aria-label="Reply"
            onClick={() => onReply(message.id, message.author.name, message.body || '')}
          >
            <MessageCircle size={15} />
          </button>
        )}

        {/* More */}
        <button
          type="button"
          className={styles.actionBtn}
          aria-label="More actions"
          onClick={(e) => { e.stopPropagation(); setContextMenu({ x: e.clientX, y: e.clientY }); }}
        >
          <MoreHorizontal size={15} />
        </button>
      </div>

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
