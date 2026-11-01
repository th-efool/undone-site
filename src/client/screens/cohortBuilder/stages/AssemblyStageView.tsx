'use client';

import { ProcessingFailures, processingFailureMessage } from './ProcessingFailures';
import React from 'react';
import { ArrowLeft, Square, RotateCcw } from 'lucide-react';
import type { CohortWorkspace, CohortAction } from '@/src/shared/cohort-builder/contracts';
import { BuildingArt } from '@/src/client/screens/cohortCreation/components/BuildingArt';
import {
  isStageComplete,
  getStageProgressDetails,
  getValidChunks,
} from '../stage-selectors';
import shared from '@/src/client/screens/cohortCreation/components/UnderstandingProgress.module.css';
import styles from '@/src/client/screens/cohortCreation/components/ReadyWorkspace.module.css';

interface AssemblyStageViewProps {
  workspace: CohortWorkspace;
  dispatchAction: (action: CohortAction) => Promise<boolean>;
}

export function AssemblyStageView({ workspace, dispatchAction }: AssemblyStageViewProps) {
  const lessonCount = workspace.lessons.length;
  const validChunks = getValidChunks(workspace);
  const chunkCount = validChunks.length;
  const status = workspace.processing.status;

  const stageProgress = getStageProgressDetails(workspace);
  const isComplete = isStageComplete(workspace, 'assembly');
  const isRunning = stageProgress.assembly.status === 'running';
  const isFailed = stageProgress.assembly.status === 'failed';
  const hasFailedJobs = workspace.processing.jobs?.some(job => job.status === 'failed');
  const canRetry = !isRunning && !hasFailedJobs && (isFailed || !isComplete);

  return (
    <div className={styles.workspace}>
      <div className={shared.topActions}>
        <button
          type="button"
          className={shared.iconActionBtn}
          aria-label="Back to material"
          title="Back to material"
          onClick={() => void dispatchAction({ type: 'open_materials' })}
        >
          <ArrowLeft size={16} />
        </button>
        {isRunning ? (
          <button
            type="button"
            className={shared.iconActionBtn}
            aria-label="Cancel processing"
            title="Stop processing"
            onClick={() => void dispatchAction({ type: 'cancel_text_processing' })}
          >
            <Square size={15} />
          </button>
        ) : (
          canRetry && (
            <button
              type="button"
              className={shared.iconActionBtn}
              aria-label="Retry processing"
              title="Retry processing"
              onClick={() => void dispatchAction({ type: 'retry_processing' })}
            >
              <RotateCcw size={16} />
            </button>
          )
        )}
        {isComplete && !isRunning && workspace.journey?.step === 'ready' && (
          <button
            type="button"
            className={shared.nextStageBtn}
            aria-label="Next stage"
            onClick={() => void dispatchAction({ type: 'open_review' })}
          >
            Next →
          </button>
        )}
      </div>

      <div className={styles.layout}>
        <div className={styles.content}>
          <header className={`${styles.heading} ${styles.buildingHeading}`}>
            <p className={styles.eyebrow}>Building your learning experience</p>
            <h1>{isComplete && !isRunning ? 'Your lessons are saved.' : 'Bringing it all together…'}</h1>
            <p>Your accepted analysis and source evidence become meaningful lessons.</p>
          </header>

          <section aria-label="Building material" className={styles.buildControls}>
            <progress
              max={lessonCount > 0 ? lessonCount : 1}
              value={isComplete ? lessonCount : 0}
              aria-label="Lessons built"
            />

            {isRunning ? (
              <div role="status">
                <p>
                  {chunkCount} parts analyzed; {lessonCount} lessons structured.
                </p>
                <p>Assembling your lessons and syllabus in real time.</p>
              </div>
            ) : (
              <div>
                <p role="status">
                  {isComplete
                    ? 'Building complete. Curriculum lessons are saved.'
                    : `Building ${status}.`}
                </p>
                <ProcessingFailures workspace={workspace} dispatchAction={dispatchAction} />

                {isFailed && workspace.processing.error && !workspace.processing.jobs?.some(job => job.status === 'failed') && (
                  <p role="alert">{processingFailureMessage(workspace.processing.error)}</p>
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
