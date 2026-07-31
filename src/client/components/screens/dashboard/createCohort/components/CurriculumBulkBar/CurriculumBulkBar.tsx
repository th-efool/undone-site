'use client';

import { useState } from 'react';
import { CheckSquare, Tag, Award, Eye, Trash2, X, Sliders } from 'lucide-react';
import { useWizardContext } from '../../providers/WizardProvider';
import { difficultyOptions } from '../../mock/createCohort.mock';

import styles from './CurriculumBulkBar.module.css';

export function CurriculumBulkBar() {
  const { curriculumState, actions } = useWizardContext();
  const { selectedLessonIds, selectedSeasonIds } = curriculumState.multiSelection;

  const totalSelected = selectedLessonIds.length + selectedSeasonIds.length;
  const [tagInput, setTagInput] = useState('');
  const [showTagPrompt, setShowTagPrompt] = useState(false);

  if (totalSelected === 0) return null;

  return (
    <div className={styles.bulkBar}>
      <div className={styles.countInfo}>
        <CheckSquare size={16} color="#6366f1" />
        {totalSelected} Item{totalSelected === 1 ? '' : 's'} Selected
      </div>

      <div className={styles.actionsGroup}>
        {selectedLessonIds.length > 0 && (
          <>
            <button
              type="button"
              className={styles.bulkBtn}
              onClick={() => setShowTagPrompt(!showTagPrompt)}
            >
              <Tag size={13} />
              Add Tag
            </button>

            <button
              type="button"
              className={styles.bulkBtn}
              onClick={() => actions.bulkDifficulty('Intermediate')}
            >
              <Sliders size={13} />
              Set Difficulty
            </button>

            <button
              type="button"
              className={styles.bulkBtn}
              onClick={() => actions.bulkXP(100)}
            >
              <Award size={13} />
              100 XP
            </button>

            <button
              type="button"
              className={styles.bulkBtn}
              onClick={() => actions.bulkVisibility('Public')}
            >
              <Eye size={13} />
              Set Public
            </button>
          </>
        )}

        <button
          type="button"
          className={`${styles.bulkBtn} ${styles.deleteBtn}`}
          onClick={actions.bulkDeleteSelected}
        >
          <Trash2 size={13} />
          Delete Selected
        </button>
      </div>

      {showTagPrompt && (
        <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
          <input
            type="text"
            placeholder="Enter tag..."
            value={tagInput}
            onChange={(e) => setTagInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && tagInput.trim()) {
                actions.bulkTag(tagInput.trim());
                setTagInput('');
                setShowTagPrompt(false);
              }
            }}
            style={{
              padding: '0.3rem 0.6rem',
              borderRadius: '6px',
              border: '1px solid rgba(255,255,255,0.2)',
              background: '#0f172a',
              color: '#fff',
              fontSize: '0.8125rem',
            }}
          />
        </div>
      )}

      <button type="button" className={styles.clearBtn} onClick={actions.clearMultiSelection}>
        <X size={16} />
      </button>
    </div>
  );
}
