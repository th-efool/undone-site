import { KeyboardEvent, useCallback, useRef, useState } from 'react';
import type { ConversationPreview } from '../../../models';
import { ContextMenu, type ContextMenuItem } from '../../shared';
import styles from './ConversationItem.module.css';

interface Props {
  conversation: ConversationPreview;
  onSelect(conversation: ConversationPreview): void;
}

export function ConversationItem({ conversation, onSelect }: Props) {
  const select = () => onSelect(conversation);
  const onKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    event.preventDefault();
    select();
  };

  // Context menu state
  const [menu, setMenu] = useState<{ x: number; y: number } | null>(null);
  const itemRef = useRef<HTMLDivElement>(null);
  const touchTimer = useRef<ReturnType<typeof setTimeout>>(undefined as never);

  const items: ContextMenuItem[] = [
    {
      label: conversation.pinned ? 'Unpin' : 'Pin',
      icon: <span>📌</span>,
      onClick: () => {}, // callback passed from parent via data attribute or context
    },
    {
      label: conversation.mutedUntil ? 'Unmute' : 'Mute notifications',
      icon: <span>{conversation.mutedUntil ? '🔊' : '🤫'}</span>,
      onClick: () => {},
    },
  ];

  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setMenu({ x: e.clientX, y: e.clientY });
  }, []);

  // Mobile long-press handler
  const handleTouchStart = () => {
    touchTimer.current = setTimeout(() => {
      if (itemRef.current) {
        const rect = itemRef.current.getBoundingClientRect();
        setMenu({ x: rect.left + rect.width / 2, y: rect.top });
      }
    }, 500);
  };

  const handleTouchEnd = () => {
    if (touchTimer.current) clearTimeout(touchTimer.current);
  };

  return (
    <article
      ref={itemRef}
      className={`${styles.item} ${conversation.kind === 'community' ? styles.communityItem : styles.dmItem}${conversation.unreadCount ? ' ' + styles.unread : ''}${conversation.selected ? ' ' + styles.selected : ''}`}
      onClick={select}
      onKeyDown={onKeyDown}
      onContextMenu={handleContextMenu}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      role="button"
      tabIndex={0}
      aria-current={conversation.selected ? 'true' : undefined}
    >
      <div className={styles.iconWrapper}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={conversation.avatar}
          alt={conversation.name}
          className={conversation.kind === 'community' ? styles.communityImg : styles.dmImg}
        />
        {conversation.unreadCount ? (
          <span className={styles.badge}>{conversation.unreadCount}</span>
        ) : null}
      </div>
      
      {/* Hover tooltip for name */}
      <div className={styles.tooltip}>{conversation.name}</div>

      {menu && (
        <ContextMenu
          items={[
            ...items,
            { label: 'Mark as read', icon: <span>✓</span>, onClick: () => {} },
          ]}
          x={menu.x}
          y={menu.y}
          onClose={() => setMenu(null)}
        />
      )}
    </article>
  );
}
