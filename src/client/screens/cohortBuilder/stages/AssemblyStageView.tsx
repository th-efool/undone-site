'use client';

import React from 'react';
import type { CohortWorkspace, CohortAction } from '@/src/shared/cohort-builder/contracts';
import { BuildingArt } from '@/src/client/screens/cohortCreation/components/BuildingArt';
import { ProcessingChecklist } from './ProcessingChecklist';
import styles from '@/src/client/screens/cohortCreation/components/ReadyWorkspace.module.css';

interface AssemblyStageViewProps {
  workspace: CohortWorkspace;
  dispatchAction: (action: CohortAction) => Promise<boolean>;
}

export function AssemblyStageView({ workspace, dispatchAction }: AssemblyStageViewProps) {
  const lessonCount = workspace.lessons.length;
  const chunkCount = workspace.chunks.length;
  const status = workspace.processing.status;
  const isRunning = status === 'queued' || status === 'processing' || (status as string) === 'running';
  const isFailed = status === 'failed';
  const isComplete = status === 'ready' || (status === 'idle' && lessonCount > 0);

  return (
    <div className={styles.workspace}>
      <div className={styles.layout}>
        <div className={styles.content}>
          <header className={`${styles.heading} ${styles.buildingHeading}`}>
            <p className={styles.eyebrow}>Building your learning experience</p>
            <h1>{isComplete && !isRunning ? 'Your lessons are saved.' : 'Bringing it all together…'}</h1>
            <p>Your accepted analysis and source evidence become meaningful lessons.</p>
          </header>

          <section aria-label="Building material" className={styles.buildControls}>
            <h2>Building</h2>
            <p>Accepted analysis, chunks and source material remain saved.</p>

            <progress
              max={lessonCount > 0 ? lessonCount : 1}
              value={lessonCount}
              aria-label="Content partitions built"
            />

            <div style={{ marginTop: 16 }}>
              <ProcessingChecklist currentStage="assembly" processingStatus={status} />
            </div>

            {isRunning ? (
              <div role="status">
                <p>
                  {chunkCount} partitions analyzed; {lessonCount} lessons saved.
                </p>
                <p>You can close this page and return while work continues.</p>
                <button type="button" onClick={() => void dispatchAction({ type: 'cancel_text_processing' })}>
                  Cancel building
                </button>
              </div>
            ) : (
              <div>
                <p role="status">
                  {status === 'ready'
                    ? 'Building complete. Curriculum lessons are saved.'
                    : `Building ${status}.`}
                </p>
                {workspace.processing.error && <p role="alert">{workspace.processing.error}</p>}
                {isFailed && (
                  <button type="button" onClick={() => void dispatchAction({ type: 'retry_processing' })}>
                    Retry building
                  </button>
                )}
                {status !== 'ready' && !isFailed && (
                  <button type="button" onClick={() => void dispatchAction({ type: 'retry_processing' })}>
                    Start fresh building
                  </button>
                )}
              </div>
            )}
          </section>
        </div>

        <BuildingArt />
      </div>
    </div>
  );
}
