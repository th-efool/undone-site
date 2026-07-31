'use client';

import { useState } from 'react';
import {
  Search,
  Scale,
  RefreshCw,
  RotateCcw,
  Plus,
  Undo,
  Redo,
  CheckCircle,
  Command,
  Sliders,
} from 'lucide-react';
import { useWizardContext } from '../../providers/WizardProvider';
import { CurriculumShortcutsModal } from '../CurriculumShortcutsModal/CurriculumShortcutsModal';

import styles from './CurriculumToolbar.module.css';

export function CurriculumToolbar() {
  const { curriculumState, actions } = useWizardContext();
  const [showShortcuts, setShowShortcuts] = useState(false);

  return (
    <>
      <div className={styles.toolbar}>
        <div className={styles.leftGroup}>
          <div className={styles.searchContainer}>
            <Search size={15} className={styles.searchIcon} />
            <input
              type="text"
              placeholder="Search lessons..."
              value={curriculumState.searchQuery}
              onChange={(e) => actions.setSearchQuery(e.target.value)}
              className={styles.searchInput}
            />
          </div>

          <button
            type="button"
            onClick={actions.undo}
            disabled={!curriculumState.history.canUndo}
            className={styles.actionBtn}
            title="Undo (Cmd+Z)"
          >
            <Undo size={14} />
          </button>

          <button
            type="button"
            onClick={actions.redo}
            disabled={!curriculumState.history.canRedo}
            className={styles.actionBtn}
            title="Redo (Cmd+Shift+Z)"
          >
            <Redo size={14} />
          </button>

          <button
            type="button"
            onClick={actions.autoBalance}
            className={styles.actionBtn}
            title="Auto-balance lessons into 10h seasons"
          >
            <Scale size={14} />
            Auto Balance
          </button>

          <button
            type="button"
            onClick={actions.regenerateChunks}
            className={styles.actionBtn}
            title="Regenerate 5-min learning chunks"
          >
            <RefreshCw size={14} />
            Regenerate Chunks
          </button>

          <button
            type="button"
            onClick={actions.restorePlaylistOrder}
            className={styles.actionBtn}
            title="Restore original playlist order"
          >
            <RotateCcw size={14} />
            Restore Order
          </button>
        </div>

        <div className={styles.rightGroup}>
          <button
            type="button"
            onClick={() => setShowShortcuts(true)}
            className={styles.cmdKBtn}
            title="Open Studio Command Palette (Cmd+K)"
          >
            <Command size={12} style={{ display: 'inline', marginRight: 4 }} />
            Cmd+K
          </button>

          <span className={styles.saveBadge}>
            <CheckCircle size={12} /> Saved
          </span>

          <button
            type="button"
            onClick={() => actions.addSeason()}
            className={styles.primaryBtn}
          >
            <Plus size={15} />
            Add Season
          </button>
        </div>
      </div>

      {showShortcuts && <CurriculumShortcutsModal onClose={() => setShowShortcuts(false)} />}
    </>
  );
}
