'use client';

import { useState } from 'react';
import {
  Search,
  Scale,
  Plus,
  Undo,
  Redo,
  Command,
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
            onClick={() => actions.autoBalance()}
            className={styles.actionBtn}
            title="Auto-balance lessons into 10h seasons"
          >
            <Scale size={14} />
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
