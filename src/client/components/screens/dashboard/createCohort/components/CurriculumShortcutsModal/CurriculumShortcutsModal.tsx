'use client';

import { useState } from 'react';
import { Search, Scale, RefreshCw, RotateCcw, Plus, Trash2, Undo, Redo, Layers } from 'lucide-react';
import { useWizardContext } from '../../providers/WizardProvider';

import styles from './CurriculumShortcutsModal.module.css';

interface CurriculumShortcutsModalProps {
  onClose: () => void;
}

export function CurriculumShortcutsModal({ onClose }: CurriculumShortcutsModalProps) {
  const { actions } = useWizardContext();
  const [filter, setFilter] = useState('');

  const studioActions = [
    { label: 'Auto Balance Seasons (10h targets)', icon: Scale, action: actions.autoBalance, shortcut: 'Auto' },
    { label: 'Auto Rename Seasons', icon: action: actions.autoRenameSeasons, shortcut: 'Bulk' },
    { label: 'Auto Rename Lessons', icon: action: actions.autoRenameLessons, shortcut: 'Bulk' },
    { label: 'Regenerate 5-min Learning Chunks', icon: RefreshCw, action: actions.regenerateChunks, shortcut: 'Chunk' },
    { label: 'Regenerate Chunk Titles', icon: RefreshCw, action: actions.regenerateChunkTitles, shortcut: 'Chunk' },
    { label: 'Normalize All Durations to 15m min', icon: Scale, action: actions.normalizeDurations, shortcut: 'Fix' },
    { label: 'Merge Empty Seasons', icon: Layers, action: actions.mergeEmptySeasons, shortcut: 'Clean' },
    { label: 'Delete Empty Lessons', icon: Trash2, action: actions.deleteEmptyLessons, shortcut: 'Clean' },
    { label: 'Restore Original Playlist Order', icon: RotateCcw, action: actions.restorePlaylistOrder, shortcut: 'Reset' },
    { label: 'Add New Season', icon: Plus, action: () => actions.addSeason(), shortcut: 'Cmd+N' },
    { label: 'Expand All Seasons', icon: Layers, action: actions.expandAllSeasons, shortcut: 'Cmd+E' },
    { label: 'Collapse All Seasons', icon: Layers, action: actions.collapseAllSeasons, shortcut: 'Cmd+C' },
    { label: 'Undo Last Action', icon: Undo, action: actions.undo, shortcut: 'Cmd+Z' },
    { label: 'Redo Action', icon: Redo, action: actions.redo, shortcut: 'Cmd+Shift+Z' },
  ];

  const filtered = studioActions.filter((a) => a.label.toLowerCase().includes(filter.toLowerCase()));

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.searchHeader}>
          <Search size={18} color="#6366f1" />
          <input
            type="text"
            autoFocus
            placeholder="Type a studio command or search..."
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className={styles.input}
          />
        </div>

        <div className={styles.actionList}>
          {filtered.map((item, idx) => {
            const Icon = item.icon;
            return (
              <button
                key={idx}
                type="button"
                className={styles.actionItem}
                onClick={() => {
                  item.action();
                  onClose();
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                  <Icon size={16} color="#a5b4fc" />
                  <span>{item.label}</span>
                </div>
                <span className={styles.kbd}>{item.shortcut}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
