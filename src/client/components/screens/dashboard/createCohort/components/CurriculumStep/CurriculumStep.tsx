'use client';

import { useState } from 'react';
import { RefreshCw, AlertCircle } from 'lucide-react';
import { Stack } from '@/src/client/components/global/layout/Stack';
import { Cluster } from '@/src/client/components/global/layout/Cluster';
import { useWizardContext } from '../../providers/WizardProvider';
import { CurriculumToolbar } from '../CurriculumToolbar/CurriculumToolbar';
import { CurriculumStats } from '../CurriculumStats/CurriculumStats';
import { CurriculumWarnings } from '../CurriculumWarnings/CurriculumWarnings';
import { CurriculumBoard } from '../CurriculumBoard/CurriculumBoard';
import { CurriculumInspector } from '../CurriculumInspector/CurriculumInspector';
import { CurriculumQuality } from '../CurriculumQuality/CurriculumQuality';
import { CurriculumChecklist } from '../CurriculumChecklist/CurriculumChecklist';
import { CurriculumBulkBar } from '../CurriculumBulkBar/CurriculumBulkBar';
import { CurriculumShortcutsModal } from '../CurriculumShortcutsModal/CurriculumShortcutsModal';
import { useKeyboardShortcuts } from '../../hooks/useKeyboardShortcuts';

import styles from './CurriculumStep.module.css';

export function CurriculumStep() {
  const { curriculumState, actions } = useWizardContext();
  const [showPalette, setShowPalette] = useState(false);

  // Bind studio keyboard shortcuts
  useKeyboardShortcuts({
    onSearchPalette: () => setShowPalette(true),
    onUndo: actions.undo,
    onRedo: actions.redo,
    onDuplicate: () => {
      if (curriculumState.selectedLessonId) {
        actions.duplicateLesson(curriculumState.selectedLessonId);
      } else if (curriculumState.selectedSeasonId) {
        actions.duplicateSeason(curriculumState.selectedSeasonId);
      }
    },
    onDelete: () => {
      if (curriculumState.multiSelection.selectedLessonIds.length > 0 || curriculumState.multiSelection.selectedSeasonIds.length > 0) {
        actions.bulkDeleteSelected();
      } else if (curriculumState.selectedLessonId) {
        actions.deleteLesson(curriculumState.selectedLessonId);
      } else if (curriculumState.selectedSeasonId) {
        actions.deleteSeason(curriculumState.selectedSeasonId);
      }
    },
    onEscape: () => {
      setShowPalette(false);
      actions.clearMultiSelection();
    },
    onExpandAll: actions.expandAllSeasons,
    onCollapseAll: actions.collapseAllSeasons,
  });

  if (curriculumState.status === 'generating') {
    return (
      <div className={styles.loadingContainer}>
        <div className={styles.spinner} />
        <div>
          <h3 className={styles.loadingText}>Building Cohort Curriculum Studio...</h3>
          <p className={styles.loadingSubtext}>
            Structuring 10-hour balanced seasons, chunking lessons, and evaluating studio quality score.
          </p>
        </div>
      </div>
    );
  }

  if (curriculumState.status === 'failed') {
    return (
      <div className={styles.errorContainer}>
        <AlertCircle size={32} color="var(--color-error)" />
        <div>
          <h3 className={styles.errorTitle}>
            {curriculumState.error?.title || 'Curriculum Generation Failed'}
          </h3>
          <p className={styles.errorMessage}>
            {curriculumState.error?.message || 'An unexpected error occurred while generating the curriculum.'}
          </p>
        </div>
        <button type="button" onClick={actions.generateCurriculum} className={styles.retryBtn}>
          <RefreshCw size={16} />
          Retry Generation
        </button>
      </div>
    );
  }

  return (
    <Stack gap="5" className={styles.root}>
      <Cluster align="center" justify="between" gap="4">
        <div style={{ flex: 1 }}>
          <CurriculumToolbar />
        </div>
        <CurriculumQuality />
      </Cluster>

      <CurriculumChecklist />
      <CurriculumStats />
      <CurriculumWarnings />

      <div className={styles.mainArea}>
        <div className={styles.boardContainer}>
          <CurriculumBoard />
        </div>
        <CurriculumInspector />
      </div>

      <CurriculumBulkBar />

      {showPalette && <CurriculumShortcutsModal onClose={() => setShowPalette(false)} />}
    </Stack>
  );
}
