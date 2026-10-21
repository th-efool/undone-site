'use client';

import Image from 'next/image';
import { useCallback, useEffect, useRef, useState } from 'react';
import { X, Search, Users, User, Check } from 'lucide-react';
import {
  messagesRepository,
  type PersonSearchResult,
} from '@/src/client/repositories/messagesRepository';
import styles from './ComposeModal.module.css';

interface Props {
  onSelect(conversationId: string): void;
  onCreateDirect?(recipientId: string): Promise<string>;
  onCreateGroup?(title: string, participantIds: string[]): Promise<string>;
  onClose(): void;
}

export function ComposeModal({ onSelect, onCreateDirect, onCreateGroup, onClose }: Props) {
  const [mode, setMode] = useState<'direct' | 'group'>('direct');
  const [query, setQuery] = useState('');
  const [groupTitle, setGroupTitle] = useState('');
  const [searchResults, setSearchResults] = useState<PersonSearchResult[]>([]);
  const [selectedUsers, setSelectedUsers] = useState<Map<string, PersonSearchResult>>(new Map());
  const [isSearching, setIsSearching] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const inputRef = useRef<HTMLInputElement>(null);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, [mode]);

  // Debounced search via real API
  useEffect(() => {
    const trimmed = query.trim();
    if (!trimmed) {
      setSearchResults([]);
      setIsSearching(false);
      return;
    }

    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    setIsSearching(true);
    setErrorMessage(null);

    debounceTimerRef.current = setTimeout(async () => {
      try {
        const results = await messagesRepository.searchPeople(trimmed);
        setSearchResults(results);
      } catch (err) {
        console.error('Search failed:', err);
        setSearchResults([]);
      } finally {
        setIsSearching(false);
      }
    }, 250);

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [query]);

  const handleSelectDirectUser = useCallback(
    async (user: PersonSearchResult) => {
      setIsSubmitting(true);
      setErrorMessage(null);
      try {
        let convId: string;
        if (onCreateDirect) {
          convId = await onCreateDirect(user.id);
        } else {
          const res = await messagesRepository.createDirectConversation(user.id);
          convId = res.conversationId;
        }
        onSelect(convId);
        onClose();
      } catch (err: any) {
        console.error('Failed to start direct conversation:', err);
        setErrorMessage(err.message || 'Failed to start conversation');
        setIsSubmitting(false);
      }
    },
    [onCreateDirect, onSelect, onClose]
  );

  const toggleSelectGroupUser = useCallback((user: PersonSearchResult) => {
    setSelectedUsers((prev) => {
      const next = new Map(prev);
      if (next.has(user.id)) {
        next.delete(user.id);
      } else {
        next.set(user.id, user);
      }
      return next;
    });
  }, []);

  const handleCreateGroup = useCallback(async () => {
    const trimmedTitle = groupTitle.trim();
    if (!trimmedTitle) {
      setErrorMessage('Please enter a group title');
      return;
    }

    if (selectedUsers.size === 0) {
      setErrorMessage('Please select at least one person to add to the group');
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const participantIds = Array.from(selectedUsers.keys());
      let convId: string;
      if (onCreateGroup) {
        convId = await onCreateGroup(trimmedTitle, participantIds);
      } else {
        const res = await messagesRepository.createGroupConversation(trimmedTitle, participantIds);
        convId = res.conversationId;
      }
      onSelect(convId);
      onClose();
    } catch (err: any) {
      console.error('Failed to create group conversation:', err);
      setErrorMessage(err.message || 'Failed to create group');
      setIsSubmitting(false);
    }
  }, [groupTitle, selectedUsers, onCreateGroup, onSelect, onClose]);

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <h2>New message</h2>
          <button
            type="button"
            className={styles['close-btn']}
            onClick={onClose}
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        {/* Mode switcher tabs */}
        <div className={styles.modeTabs}>
          <button
            type="button"
            className={`${styles.modeTab} ${mode === 'direct' ? styles.modeTabActive : ''}`}
            onClick={() => {
              setMode('direct');
              setErrorMessage(null);
            }}
          >
            <User size={14} style={{ display: 'inline', marginRight: 6, verticalAlign: 'middle' }} />
            Direct Message
          </button>
          <button
            type="button"
            className={`${styles.modeTab} ${mode === 'group' ? styles.modeTabActive : ''}`}
            onClick={() => {
              setMode('group');
              setErrorMessage(null);
            }}
          >
            <Users size={14} style={{ display: 'inline', marginRight: 6, verticalAlign: 'middle' }} />
            New Group
          </button>
        </div>

        {errorMessage && <div className={styles.errorBanner}>{errorMessage}</div>}

        {mode === 'group' && (
          <div>
            <input
              className={styles['search-input']}
              type="text"
              placeholder="Group name (e.g. Algorithms Study Circle)"
              value={groupTitle}
              maxLength={100}
              onChange={(e) => setGroupTitle(e.target.value)}
            />
          </div>
        )}

        {mode === 'group' && selectedUsers.size > 0 && (
          <div className={styles.chipsContainer}>
            {Array.from(selectedUsers.values()).map((u) => (
              <span key={u.id} className={styles.chip}>
                {u.name || u.username || 'User'}
                <button
                  type="button"
                  className={styles.chipRemove}
                  onClick={() => toggleSelectGroupUser(u)}
                  aria-label="Remove user"
                >
                  <X size={12} />
                </button>
              </span>
            ))}
          </div>
        )}

        <div style={{ position: 'relative' }}>
          <Search
            size={16}
            style={{
              position: 'absolute',
              left: 12,
              top: '50%',
              transform: 'translateY(-50%)',
              color: 'var(--color-text-secondary)',
              pointerEvents: 'none',
            }}
          />
          <input
            ref={inputRef}
            className={styles['search-input']}
            style={{ paddingLeft: 36 }}
            type="text"
            placeholder={mode === 'direct' ? 'Search people by name or username...' : 'Search people to add...'}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>

        <div className={styles['user-list']}>
          {isSearching ? (
            <div className={styles.empty}>Searching...</div>
          ) : query.trim() && searchResults.length === 0 ? (
            <div className={styles.empty}>No people found matching "{query}"</div>
          ) : !query.trim() && searchResults.length === 0 ? (
            <div className={styles.empty}>Type a name or username to search</div>
          ) : (
            searchResults.map((user) => {
              const isSelected = selectedUsers.has(user.id);
              return (
                <button
                  key={user.id}
                  type="button"
                  disabled={isSubmitting}
                  className={styles['user-item']}
                  onClick={() => {
                    if (mode === 'direct') {
                      handleSelectDirectUser(user);
                    } else {
                      toggleSelectGroupUser(user);
                    }
                  }}
                >
                  <Image
                    width={42}
                    height={42}
                    src={user.image || '/undone-logo.svg'}
                    alt={user.name || 'User'}
                    style={{ borderRadius: '50%', objectFit: 'cover' }}
                  />
                  <div className={styles['user-info']} style={{ flex: 1 }}>
                    <span className={styles['user-name']}>{user.name || 'Anonymous User'}</span>
                    <span className={styles['user-role']}>
                      {user.username ? `@${user.username}` : 'Member'}
                    </span>
                  </div>
                  {mode === 'group' && (
                    <div
                      style={{
                        width: 20,
                        height: 20,
                        borderRadius: 4,
                        border: '1px solid var(--message-border-strong, rgba(255,255,255,0.3))',
                        background: isSelected ? 'var(--message-brand, #6366f1)' : 'transparent',
                        display: 'grid',
                        placeItems: 'center',
                      }}
                    >
                      {isSelected && <Check size={14} color="#fff" />}
                    </div>
                  )}
                </button>
              );
            })
          )}
        </div>

        {mode === 'group' && (
          <button
            type="button"
            className={styles.submitBtn}
            disabled={isSubmitting || !groupTitle.trim() || selectedUsers.size === 0}
            onClick={handleCreateGroup}
          >
            {isSubmitting
              ? 'Creating Group...'
              : `Create Group (${selectedUsers.size + 1} members)`}
          </button>
        )}
      </div>
    </div>
  );
}
