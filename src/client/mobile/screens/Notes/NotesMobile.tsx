'use client';

import { useCallback, useEffect, useState } from 'react';
import type { UseNotesResult } from '@/src/client/screens/dashboard/notes/hooks/useNotes';
import { MobileStepShell } from './MobileStepShell';
import { NotebooksScreen } from './screens/NotebooksScreen';
import { WorkspaceScreen } from './screens/WorkspaceScreen';
import { CanvasScreen } from './screens/CanvasScreen';
import styles from './NotesMobile.module.css';

type MobileStep = 'notebooks' | 'workspace' | 'canvas';

interface NotesMobileProps {
  model: UseNotesResult;
}

export function NotesMobile({ model: notes }: NotesMobileProps) {
  const [step, setStep] = useState<MobileStep>('notebooks');

  const selected = notes.data?.selectedNote ?? null;

  // Android hardware back button — intercept popstate
  useEffect(() => {
    if (step === 'notebooks') return;

    history.pushState(null, '', window.location.href);
    const handler = () => {
      setStep((s) => {
        if (s === 'canvas') return 'workspace';
        if (s === 'workspace') return 'notebooks';
        return s;
      });
    };
    window.addEventListener('popstate', handler);
    return () => window.removeEventListener('popstate', handler);
  }, [step]);

  const goToWorkspace = useCallback((notebookId: string) => {
    notes.actions.selectNotebook(notebookId);
    setStep('workspace');
  }, [notes.actions]);

  const goToCanvas = useCallback((noteId: string) => {
    notes.actions.selectNote(noteId);
    setStep('canvas');
  }, [notes.actions]);

  const goBack = useCallback(() => {
    setStep((s) => {
      if (s === 'canvas') return 'workspace';
      if (s === 'workspace') return 'notebooks';
      return s;
    });
  }, []);

  if (!notes.state || !notes.data) {
    return <div className={styles.loading}>Loading notes…</div>;
  }

  return (
    <div className={styles.mobileNotes}>
      <MobileStepShell step={step}>
        {step === 'notebooks' && (
          <NotebooksScreen
            notes={notes}
            onSelectNotebook={goToWorkspace}
          />
        )}
        {step === 'workspace' && (
          <WorkspaceScreen
            notes={notes}
            onBack={goBack}
            onSelectNote={goToCanvas}
          />
        )}
        {step === 'canvas' && selected && (
          <CanvasScreen
            notes={notes}
            selected={selected}
            onBack={goBack}
          />
        )}
        {/* Fallback: if we're on canvas step but no note selected, go back */}
        {step === 'canvas' && !selected && (
          <div className={styles.loading} style={{ display: 'none' }} ref={(el) => {
            if (el) setStep('workspace');
          }} />
        )}
      </MobileStepShell>

      {notes.toast && (
        <div className={styles.mobileToast}>
          {notes.toast}
          <button onClick={notes.undo} className={styles.toastUndo}>Undo</button>
        </div>
      )}
    </div>
  );
}
