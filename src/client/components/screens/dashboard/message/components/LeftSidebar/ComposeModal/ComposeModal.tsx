
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { X, Search } from 'lucide-react';
import type { ConversationPreview } from '../../../models';
import styles from './ComposeModal.module.css';

interface Props {
  dmUsers: ConversationPreview[];
  onSelect(conversationId: string): void;
  onClose(): void;
}

export function ComposeModal({ dmUsers, onSelect, onClose }: Props) {
  const [query, setQuery] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const filtered = useMemo(() => {
    if (!query.trim()) return dmUsers;
    const q = query.toLowerCase();
    return dmUsers.filter((u) => u.name.toLowerCase().includes(q));
  }, [dmUsers, query]);

  const handleSelect = useCallback(
    (id: string) => {
      onSelect(id);
      onClose();
    },
    [onSelect, onClose],
  );

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <h2>New message</h2>
          <button type="button" className={styles.closeBtn} onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>
        </div>

        <div style={{ position: 'relative' }}>
          <Search
            size={16}
            style={{
              position: 'absolute',
              left: 12,
              top: '50%',
              transform: 'translateY(-50%)',
              color: 'var(--color-text-secondary)',
              pointerEvents: 'none' as const,
            }}
          />
          <input
            ref={inputRef}
            className={styles.searchInput}
            type="text"
            placeholder="Search people..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>

        <div className={styles.userList}>
          {filtered.length === 0 ? (
            <div>No people found.</div>
          ) : (
            filtered.map((user: ConversationPreview) => (
              <button key={user.id} type="button" onClick={() => handleSelect(user.id)}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={user.avatar} alt="" />
                <div>
                  <span>{user.name}</span>
                  <span> {user.kind === 'dm' ? 'Direct Message' : 'Community DM'}</span>
                </div>
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
