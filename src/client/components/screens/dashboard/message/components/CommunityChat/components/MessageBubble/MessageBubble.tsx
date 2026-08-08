import Image from 'next/image';
/* eslint-disable @next/next/no-img-element */
import { useEffect, useState } from 'react';
import { Copy, MoreHorizontal, Reply, SmilePlus } from 'lucide-react';
import { CommunityMessage } from '../../../../models';
import { ContextMenu } from '../../../shared';
import { AvatarConnector } from '../AvatarConnector/AvatarConnector';
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
  isAdjacentReply?: boolean;
  hasAdjacentReplyBelow?: boolean;
  onReaction(messageId: string, emoji: string): void;
  onReply?(messageId: string, senderName: string, previewText: string, senderAvatar?: string): void;
}

export function MessageBubble({ message, isAdjacentReply = false, hasAdjacentReplyBelow = false, onReaction, onReply }: Props) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);
  const [cardHovered, setCardHovered] = useState(false);

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    setPickerOpen(false);
    setContextMenu({ x: e.clientX, y: e.clientY });
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

  return (
    <article
      id={`msg-${message.id}`}
      className={`${styles.bubble} ${isAdjacentReply ? styles.adjacentReply : ''}`}
      onContextMenu={handleContextMenu}
    >
      {/* Avatar column with relative positioning for connector lines */}
      <div className={styles.avatarColumn}>
        {isAdjacentReply && <AvatarConnector type="top" />}
        {message.replyTo && !isAdjacentReply && (
          <>
            <Image width={400} height={300}
              className={`${styles.desaturatedAvatar} ${cardHovered ? styles.desaturatedAvatarHover : ''}`}
              src={message.replyTo.authorAvatar}
              alt=""
             />
            <div className={`${styles.threadLine} ${cardHovered ? styles.threadLineHover : ''}`} />
          </>
        )}
        <Image width={400} height={300} className={styles.avatar} src={message.author.avatar} alt=""  />
        {hasAdjacentReplyBelow && <AvatarConnector type="bottom" />}
      </div>

      <div className={styles.content}>
        {/* Non-adjacent reply inline reference row (aligned with top 20px faded avatar) */}
        {message.replyTo && !isAdjacentReply && (
          <InReplyTo
            messageId={message.replyTo.messageId}
            authorName={message.replyTo.authorName}
            authorAvatar={message.replyTo.authorAvatar}
            previewText={message.replyTo.previewText}
            onHoverChange={setCardHovered}
          />
        )}

        <div className={styles.meta}>
          <strong>{message.author.name}</strong>
          {message.badge && <span>{message.badge}</span>}
          <time>{message.timestamp}</time>
        </div>

        {message.body && <p>{message.body}</p>}

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

        {/* Reply Action Button with curved arrow icon */}
        {onReply && (
          <button
            type="button"
            className={styles.actionBtn}
            aria-label="Reply"
            onClick={() => onReply(message.id, message.author.name, message.body || '', message.author.avatar)}
          >
            <Reply size={15} />
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
            ...(onReply ? [{ label: 'Reply', icon: <Reply size={16} />, onClick: () => onReply?.(message.id, message.author.name, message.body || '', message.author.avatar) }] : []),
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
