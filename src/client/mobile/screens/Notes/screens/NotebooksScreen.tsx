'use client';

import { useState } from 'react';
import { Plus, Search, Star, ChevronRight, BookOpen } from 'lucide-react';
import type { UseNotesResult } from '@/src/client/screens/dashboard/notes/hooks/useNotes';
import styles from '../NotesMobile.module.css';

interface NotebooksScreenProps {
  notes: UseNotesResult;
  onSelectNotebook: (notebookId: string) => void;
}

export function NotebooksScreen({ notes, onSelectNotebook }: NotebooksScreenProps) {
  const [query, setQuery] = useState('');

  const notebooks = (notes.data?.notebooks ?? []).filter(
    (nb) => !nb.archived && nb.title.toLowerCase().includes(query.toLowerCase()),
  );

  const handleSelect = (nbId: string) => {
    notes.actions.selectNotebook(nbId);
    onSelectNotebook(nbId);
  };

  const handleCreate = () => {
    notes.actions.createNotebook();
  };

  const AVATAR_COLORS = [
    '#4f46e5', '#0ea5e9', '#10b981', '#f59e0b',
    '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4',
  ];

  return (
    <div className={styles.screen}>
      {/* Top bar */}
      <header className={styles.screenHeader}>
        <h1 className={styles.screenTitle}>Notes</h1>
        <button className={styles.headerAction} onClick={handleCreate} aria-label="New notebook">
          <Plus size={20} />
        </button>
      </header>

      {/* Search */}
      <div className={styles.searchRow}>
        <div className={styles.searchWrap}>
          <Search size={15} className={styles.searchIcon} />
          <input
            className={styles.searchInput}
            placeholder="Filter notebooks…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
      </div>

      {/* List */}
      <div className={styles.listScroll}>
        {notebooks.length === 0 ? (
          <div className={styles.emptyState}>
            <BookOpen size={40} className={styles.emptyIcon} />
            <p className={styles.emptyTitle}>No notebooks yet</p>
            <p className={styles.emptySubtitle}>Tap + to create your first one</p>
          </div>
        ) : (
          notebooks.map((nb, idx) => {
            const noteCount = notes.state?.notes.filter(
              (n) => n.notebookId === nb.id && !n.archived,
            ).length ?? 0;
            const avatarColor = AVATAR_COLORS[idx % AVATAR_COLORS.length];

            return (
              <button
                key={nb.id}
                className={styles.notebookItem}
                onClick={() => handleSelect(nb.id)}
              >
                <div className={styles.notebookAvatar} style={{ background: avatarColor }}>
                  {nb.title.charAt(0).toUpperCase()}
                </div>
                <div className={styles.notebookInfo}>
                  <span className={styles.notebookTitle}>{nb.title}</span>
                  <span className={styles.notebookMeta}>
                    {noteCount} {noteCount === 1 ? 'note' : 'notes'}
                    {nb.favorite && (
                      <Star size={11} fill="#f59e0b" color="#f59e0b" style={{ marginLeft: 6 }} />
                    )}
                  </span>
                </div>
                <ChevronRight size={18} className={styles.chevron} />
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}
