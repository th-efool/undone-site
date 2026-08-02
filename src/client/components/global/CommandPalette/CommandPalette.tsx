'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  BookOpen,
  Compass,
  FileText,
  Home,
  Play,
  Search,
} from 'lucide-react';
import * as Dialog from '@radix-ui/react-dialog';

import { cohortRepository } from '@/src/client/repositories/cohortRepository';
import styles from './CommandPalette.module.css';

export interface CommandResult {
  id: string;
  title: string;
  subtitle?: string;
  icon?: React.ReactNode;
  category: 'cohort' | 'note' | 'explore' | 'action';
  action: () => void;
}

const quickActions: CommandResult[] = [
  {
    id: 'go-home',
    title: 'Go to Home',
    subtitle: 'Dashboard overview',
    icon: <Home size={16} />,
    category: 'action',
    action: () => (window.location.href = '/home'),
  },
  {
    id: 'go-play',
    title: 'Continue Learning',
    subtitle: 'Jump to active cohort',
    icon: <Play size={16} />,
    category: 'action',
    action: () => (window.location.href = '/home'),
  },
  {
    id: 'go-explore',
    title: 'Explore SideQuests',
    subtitle: 'Browse new learning paths',
    icon: <Compass size={16} />,
    category: 'action',
    action: () => (window.location.href = '/explore'),
  },
  {
    id: 'go-notes',
    title: 'Open Notes',
    subtitle: 'Your saved thoughts and ideas',
    icon: <FileText size={16} />,
    category: 'action',
    action: () => (window.location.href = '/notes'),
  },
  {
    id: 'create-cohort',
    title: 'Create New Cohort',
    subtitle: 'Start a new learning journey',
    icon: <BookOpen size={16} />,
    category: 'action',
    action: () => (window.location.href = '/create-cohort'),
  },
];

export function CommandPalette({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const [query, setQuery] = useState('');

  const cohorts = useMemo(() => cohortRepository.list(), []);

  const results: CommandResult[] = useMemo(() => {
    const filtered: CommandResult[] = [];
    const q = query.toLowerCase().trim();

    // Quick actions (always shown at top when no filter, or matched by query)
    if (!q) {
      filtered.push(...quickActions.slice(0, 3));
    } else {
      filtered.push(
        ...quickActions.filter((a) => a.title.toLowerCase().includes(q) || a.subtitle?.toLowerCase().includes(q)),
      );
    }

    // Cohorts
    cohorts.forEach((c) => {
      if (!q || c.title.toLowerCase().includes(q) || (c.creator?.name && c.creator.name.toLowerCase().includes(q))) {
        filtered.push({
          id: `cohort-${c.id}`,
          title: c.title,
          subtitle: c.creator?.name || 'SideQuestHQ',
          icon: <BookOpen size={16} />,
          category: 'cohort',
          action: () => (window.location.href = `/cohort/${c.id}`),
        });
      }
    });

    return filtered.slice(0, 20);
  }, [query, cohorts]);

  // Close on escape — let Radix handle it, but also clear query
  useEffect(() => {
    if (!open) setQuery('');
  }, [open]);

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className={styles.overlay} />
        <Dialog.Content className={styles.dialog} role="dialog" aria-label="Command palette">
          {/* Search input */}
          <div className={styles.inputWrapper}>
            <Search size={18} className={styles.searchIcon} />
            <input
              autoFocus
              type="text"
              placeholder="Search cohorts, notes, explore..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className={styles.input}
            />
          </div>

          {/* Results list */}
          <div className={styles.results}>
            {results.length === 0 && (
              <div className={styles.empty}>No results for "{query}"</div>
            )}

            {!query.trim() && quickActions.length > 3 && (
              <>
                <div className={styles.sectionLabel}>Quick Actions</div>
                {quickActions.slice(0, 3).map((item) => (
                  <button
                    key={item.id}
                    className={styles.resultItem}
                    onClick={() => {
                      item.action();
                      onOpenChange(false);
                    }}
                  >
                    {item.icon}
                    <div>
                      <span className={styles.resultTitle}>{item.title}</span>
                      <span className={styles.resultSubtitle}>{item.subtitle}</span>
                    </div>
                  </button>
                ))}
              </>
            )}

            {results.length > 0 && (
              <>
                {(!query.trim() ? results.filter((r) => r.category !== 'action') : results).length > 0 && (
                  <div className={styles.sectionLabel}>Results</div>
                )}
                {results.map((item) => (
                  <button
                    key={item.id}
                    className={styles.resultItem}
                    onClick={() => {
                      item.action();
                      onOpenChange(false);
                    }}
                  >
                    {item.icon || <Search size={16} />}
                    <div>
                      <span className={styles.resultTitle}>{item.title}</span>
                      {item.subtitle && (
                        <span className={styles.resultSubtitle}>{item.subtitle}</span>
                      )}
                    </div>
                  </button>
                ))}
              </>
            )}
          </div>

          {/* Keyboard hints */}
          <div className={styles.hints}>
            <span>↑↓ navigate</span>
            <span>↵ select</span>
            <span>esc close</span>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
