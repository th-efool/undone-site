import Image from 'next/image';
/* eslint-disable @next/next/no-img-element */
import { Copy, Reply, Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { DMMessage, DMUser } from '../../../../models';
import { ContextMenu } from '../../../shared/ContextMenu/ContextMenu';
import { AvatarConnector } from '../../../CommunityChat/components/AvatarConnector/AvatarConnector';
import { InReplyTo } from '../../../CommunityChat/components/InReplyTo/InReplyTo';
import { MessageReaction } from '../MessageReaction/MessageReaction';
import { MessageStatus } from '../MessageStatus/MessageStatus';
import { MessageAttachment } from '../../../CommunityChat/components/MessageAttachment/MessageAttachment';
import styles from './DMBubble.module.css';

interface Props {
  message: DMMessage;
  user: DMUser;
  isAdjacentReply?: boolean;
  hasAdjacentReplyBelow?: boolean;
  /** Batch C / E1: Reply trigger */
  onReply?(messageId: string, senderName: string, previewText: string, senderAvatar?: string): void;
  /** Batch E3: Delete message (outgoing only) */
  onDeleteMessage?(messageId: string): void;
}

export function DMBubble({ message, user, isAdjacentReply = false, hasAdjacentReplyBelow = false, onReply, onDeleteMessage }: Props) {
  const [showReactions, setShowReactions] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [menuPos, setMenuPos] = useState<{ x: number; y: number } | null>(null);
  const [cardHovered, setCardHovered] = useState(false);

  // Context menu items
  const buildMenuItems = () => {
    const items: Parameters<typeof ContextMenu>[0]['items'] = [];

    if (onReply) {
      items.push({
        label: 'Reply',
        icon: <span className={styles.menuIcon}><Reply size={14} /></span>,
        kbd: 'R',
        onClick: () => {
          if (message.text) onReply(message.id, user.name, message.text.slice(0, 80), user.avatar);
          setMenuPos(null);
        },
      });
    }

    if (message.text) {
      items.push({
        label: 'Copy text',
        icon: <span className={styles.menuIcon}><Copy size={14} /></span>,
        onClick: () => {
          navigator.clipboard.writeText(message.text);
          setMenuPos(null);
        },
      });
    }

    items.push({
      label: 'React',
      icon: <span className={styles.menuIcon}>😀</span>,
      kbd: 'E',
      onClick: () => {
        setShowReactions(true);
        setMenuPos(null);
      },
    });

    if (onDeleteMessage && message.type === 'outgoing') {
      items.push({
        label: 'Delete',
        danger: true,
        icon: <span className={styles.menuIcon}><Trash2 size={14} /></span>,
        onClick: () => {
          onDeleteMessage(message.id);
          setMenuPos(null);
        },
      });
    }

    return items;
  };

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    setShowReactions(false);
    setMenuPos({ x: e.clientX, y: e.clientY });
  };

  const outgoing = message.type === 'outgoing';

  useEffect(() => {
    setShowReactions(hovered);
  }, [hovered]);

  return (
    <>
      <article
        id={`msg-${message.id}`}
        className={`${styles.row} ${outgoing ? styles.outgoing : styles.incoming} ${isAdjacentReply ? styles.adjacentReply : ''}`}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        onContextMenu={handleContextMenu}
      >
        {!outgoing && (
          <span className={styles.avatar}>
            {isAdjacentReply && <AvatarConnector type="top" isDM />}
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
            {message.showAvatar && (
              <Image width={400} height={300}
                src={user.avatar}
                alt=""
               />
            )}
            {hasAdjacentReplyBelow && <AvatarConnector type="bottom" isDM />}
          </span>
        )}
        <div className={styles.wrap}>
          {message.replyTo && !isAdjacentReply && (
            <InReplyTo
              messageId={message.replyTo.messageId}
              authorName={message.replyTo.authorName}
              authorAvatar={message.replyTo.authorAvatar}
              previewText={message.replyTo.previewText}
              onHoverChange={setCardHovered}
            />
          )}
          {!outgoing && <span className={styles.senderName}>{user.name}</span>}
          <div className={`${styles.bubble} ${message.tail ? styles.tail : ''}`}>
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
          {showReactions && !menuPos && (
            <div className={styles.quickReactions}>
              {['❤️', '🔥', '👍', '😂', '🎉'].map((emoji) => (
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

      {menuPos && (
        <ContextMenu
          items={buildMenuItems()}
          x={menuPos.x}
          y={menuPos.y}
          onClose={() => setMenuPos(null)}
        />
      )}
    </>
  );
}