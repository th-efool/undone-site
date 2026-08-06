/* eslint-disable @next/next/no-img-element */
import { Copy, Trash2 } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { DMMessage, DMUser } from '../../../../models';
import { ContextMenu } from '../../../shared/ContextMenu/ContextMenu';
import { InReplyTo } from '../../../CommunityChat/components/InReplyTo/InReplyTo';
import { MessageReaction } from '../MessageReaction/MessageReaction';
import { MessageStatus } from '../MessageStatus/MessageStatus';
import { MessageAttachment } from '../../../CommunityChat/components/MessageAttachment/MessageAttachment';
import styles from './DMBubble.module.css';

interface Props {
  message: DMMessage;
  user: DMUser;
  /** Batch C / E1: Reply trigger */
  onReply?(messageId: string, senderName: string, previewText: string): void;
  /** Batch E3: Delete message (outgoing only) */
  onDeleteMessage?(messageId: string): void;
}

export function DMBubble({ message, user, onReply, onDeleteMessage }: Props) {
  const tapTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const [showReactions, setShowReactions] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [longPress, setLongPress] = useState(false);

  // Batch E3: Context menu state
  const [menuPos, setMenuPos] = useState<{ x: number; y: number } | null>(null);

  const handlePointerDown = () => {
    tapTimerRef.current = setTimeout(() => {
      setLongPress(true);
    }, 500);
  };

  const handlePointerUp = () => {
    clearTimeout(tapTimerRef.current);
    if (longPress) return;
    // Regular tap: trigger reply with message text as preview
    if (onReply && message.text) {
      onReply(message.id, user.name, message.text.slice(0, 80));
    }
  };

  // Batch E3: Context menu items
  const buildMenuItems = () => {
    const items: Parameters<typeof ContextMenu>[0]['items'] = [];

    if (onReply) {
      items.push({
        label: 'Reply',
        icon: <span className={styles.menuIcon}>↩</span>,
        kbd: 'R',
        onClick: () => {
          if (message.text) onReply(message.id, user.name, message.text.slice(0, 80));
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

  // Batch E3: Right-click → context menu (desktop)
  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    setShowReactions(false);
    setMenuPos({ x: e.clientX, y: e.clientY });
  };

  useEffect(() => {
    return () => clearTimeout(tapTimerRef.current);
  }, []);

  const outgoing = message.type === 'outgoing';

  // Batch C / E3: Show reactions bar on hover (desktop) or long-press (mobile)
  useEffect(() => {
    setShowReactions(hovered || longPress);
  }, [hovered, longPress]);

  return (
    <>
      <article
        className={`${styles.row} ${outgoing ? styles.outgoing : styles.incoming}`}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') handlePointerUp(); }}
        onPointerDown={handlePointerDown}
        onPointerUp={handlePointerUp}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        onContextMenu={handleContextMenu}
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
          {!outgoing && <span className={styles.senderName}>{user.name}</span>}
          <div className={`${styles.bubble} ${message.tail ? styles.tail : ''}`}>
            {message.replyTo && (
              <InReplyTo
                authorName={message.replyTo.authorName}
                authorAvatar={message.replyTo.authorAvatar}
                previewText={message.replyTo.previewText}
              />
            )}
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

      {/* Batch E3: Context menu overlay */}
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