import type { CanvasState } from '../../models/canvas.models';
import styles from './NotesSaveStatus.module.css';

interface NotesSaveStatusProps {
  state: CanvasState;
}

function formatSavedAt(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  const diffMs = Date.now() - d.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  if (diffSec < 5) return 'just now';
  if (diffSec < 60) return `${diffSec}s ago`;
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export function NotesSaveStatus({ state }: NotesSaveStatusProps) {
  if (state.status === 'idle') return null;

  return (
    <div className={styles.container}>
      {(state.status === 'saving' || state.isDirty) && (
        <span className={styles.saving}>
          <span className={styles.dot} aria-hidden="true" />
          Unsaved changes
        </span>
      )}
      {state.status === 'saved' && !state.isDirty && (
        <span className={styles.saved}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12" />
          </svg>
          Saved{state.lastSavedAt ? ` · ${formatSavedAt(state.lastSavedAt)}` : ''}
        </span>
      )}
      {state.status === 'error' && (
        <span className={styles.error} title={state.errorMessage || 'Failed to save'}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
          Save failed · backed up locally
        </span>
      )}
    </div>
  );
}

