import type { CanvasState } from '../../models/canvas.models';
import styles from './NotesSaveStatus.module.css';

interface NotesSaveStatusProps {
  state: CanvasState;
}

export function NotesSaveStatus({ state }: NotesSaveStatusProps) {
  if (state.status === 'idle') return null;

  return (
    <div className={styles.container}>
      {state.status === 'saving' && (
        <span className={styles.saving}>Saving...</span>
      )}
      {state.status === 'saved' && (
        <span className={styles.saved}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12" />
          </svg>
          Saved
        </span>
      )}
      {state.status === 'error' && (
        <span className={styles.error} title={state.errorMessage || 'Failed to save'}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
          Save failed
        </span>
      )}
    </div>
  );
}
