'use client';

import { useState } from 'react';
import { Check, AlertCircle } from 'lucide-react';
import { useWorkspaceView, useDispatchAction, useInteractionState } from '@/src/client/interaction/hooks';
import { cohortWorkspaceSchema, type CohortWorkspace, type CohortAction } from '@/src/shared/cohort-builder/contracts';
import type { EntityRef } from 'interaction-builder/core';
import styles from './CohortBuilder.module.css';

import { UnderstandingStageView } from './stages/UnderstandingStageView';
import { ChunkingStageView } from './stages/ChunkingStageView';
import { AnalysisStageView } from './stages/AnalysisStageView';
import { AssemblyStageView } from './stages/AssemblyStageView';
import { CurriculumStageView } from './stages/CurriculumStageView';
import { IntakeStageView } from './stages/IntakeStageView';

export type Stage =
  | 'intake'
  | 'understanding'
  | 'chunking'
  | 'analysis'
  | 'assembly'
  | 'curriculum'
  | 'review';

export interface ProcessingStep {
  label: 'Understanding' | 'Chunking' | 'Analyzing' | 'Building';
  isComplete: boolean;
  isCurrent: boolean;
  isFailed: boolean;
}

export interface ProcessingProgress {
  currentStepIndex: number;
  steps: ProcessingStep[];
  needsRebuild: boolean;
}

export function getActiveStage(workspace: CohortWorkspace): Stage {
  const sources = workspace.sources ?? [];
  const lessons = workspace.lessons ?? [];
  const processing = workspace.processing;

  // 1. If no sources and no lessons, initial intake is active
  if (sources.length === 0 && lessons.length === 0) {
    return 'intake';
  }

  // 2. If processing is ready
  if (processing.status === 'ready') {
    if (workspace.release && workspace.release.status !== 'draft') {
      return 'review';
    }
    return 'curriculum';
  }

  // 3. If processing is processing, queued, or failed
  const jobs = processing.jobs ?? [];
  if (jobs.length > 0) {
    const failedJob = jobs.find(j => j.status === 'failed');
    if (failedJob) {
      if (['acquisition', 'extraction', 'understanding'].includes(failedJob.stage)) return 'understanding';
      if (failedJob.stage === 'chunking') return 'chunking';
      if (failedJob.stage === 'analysis') return 'analysis';
      if (failedJob.stage === 'assembly') return 'assembly';
    }
    const activeJob = jobs.find(j => j.status === 'running' || j.status === 'queued');
    if (activeJob) {
      if (['acquisition', 'extraction', 'understanding'].includes(activeJob.stage)) return 'understanding';
      if (activeJob.stage === 'chunking') return 'chunking';
      if (activeJob.stage === 'analysis') return 'analysis';
      if (activeJob.stage === 'assembly') return 'assembly';
    }
  }

  switch (processing.stage as string) {
    case 'acquisition':
    case 'extraction':
    case 'understanding':
      return 'understanding';
    case 'chunking':
      return 'chunking';
    case 'analysis':
      return 'analysis';
    case 'assembly':
    case 'building':
      return 'assembly';
    case 'done':
      return 'curriculum';
    default:
      return lessons.length > 0 ? 'curriculum' : 'intake';
  }
}

export function getEffectiveStage(
  workspace: CohortWorkspace,
  inspectedStage?: Stage | null
): Stage {
  return inspectedStage ?? getActiveStage(workspace);
}

export function getProcessingProgress(workspace: CohortWorkspace): ProcessingProgress {
  const stepLabels: Array<ProcessingStep['label']> = ['Understanding', 'Chunking', 'Analyzing', 'Building'];

  const status = workspace.processing.status as string;
  const stage = workspace.processing.stage as string;
  const error = workspace.processing.error;
  const sources = workspace.sources ?? [];
  const jobs = workspace.processing.jobs ?? [];
  const isCanceled = error === 'PROCESSING_CANCELED' || jobs.some(j => j.status === 'canceled');

  // 1. Fresh empty workspace (sources.length === 0 or idle with no sourceFingerprint and no jobs)
  if (sources.length === 0 || (status === 'idle' && workspace.processing.sourceFingerprint === null && jobs.length === 0)) {
    return {
      currentStepIndex: -1,
      steps: stepLabels.map(label => ({
        label,
        isComplete: false,
        isCurrent: false,
        isFailed: false,
      })),
      needsRebuild: false,
    };
  }

  // 2. Canonical Job-driven evaluation when jobs array is present
  if (jobs.length > 0) {
    const isSourceStageAccepted = (sourceId: string, stageName: 'understanding' | 'chunking' | 'analysis') => {
      return jobs.some(j => j.sourceId === sourceId && j.stage === stageName && j.status === 'accepted');
    };

    const isSourceStageFailed = (sourceId: string, stageName: 'understanding' | 'chunking' | 'analysis') => {
      if (stageName === 'understanding') {
        return jobs.some(
          j => j.sourceId === sourceId && ['acquisition', 'extraction', 'understanding'].includes(j.stage) && j.status === 'failed'
        );
      }
      return jobs.some(j => j.sourceId === sourceId && j.stage === stageName && j.status === 'failed');
    };

    const isSourceStageActive = (sourceId: string, stageName: 'understanding' | 'chunking' | 'analysis') => {
      if (stageName === 'understanding') {
        return jobs.some(
          j =>
            j.sourceId === sourceId &&
            ['acquisition', 'extraction', 'understanding'].includes(j.stage) &&
            (j.status === 'running' || j.status === 'queued')
        );
      }
      return jobs.some(j => j.sourceId === sourceId && j.stage === stageName && (j.status === 'running' || j.status === 'queued'));
    };

    const assemblyJob = jobs.find(j => j.stage === 'assembly' || j.sourceId === null);
    const assemblyAccepted = assemblyJob?.status === 'accepted';
    const assemblyFailed = assemblyJob?.status === 'failed';
    const assemblyActive = assemblyJob?.status === 'running' || assemblyJob?.status === 'queued';

    // Step 0: Understanding - requires ALL sources to have accepted understanding
    const step0Complete = sources.length > 0 && sources.every(s => isSourceStageAccepted(s.id, 'understanding'));
    const step0Failed = sources.some(s => isSourceStageFailed(s.id, 'understanding'));
    const step0Active = !step0Complete && !step0Failed && sources.some(s => isSourceStageActive(s.id, 'understanding'));

    // Step 1: Chunking - requires Step 0 complete AND ALL sources accepted chunking
    const step1Complete = step0Complete && sources.every(s => isSourceStageAccepted(s.id, 'chunking'));
    const step1Failed = step0Complete && sources.some(s => isSourceStageFailed(s.id, 'chunking'));
    const step1Active = step0Complete && !step1Complete && !step1Failed && sources.some(s => isSourceStageActive(s.id, 'chunking'));

    // Step 2: Analyzing - requires Step 1 complete AND ALL sources accepted analysis
    const step2Complete = step1Complete && sources.every(s => isSourceStageAccepted(s.id, 'analysis'));
    const step2Failed = step1Complete && sources.some(s => isSourceStageFailed(s.id, 'analysis'));
    const step2Active = step1Complete && !step2Complete && !step2Failed && sources.some(s => isSourceStageActive(s.id, 'analysis'));

    // Step 3: Building (Assembly) - requires Step 2 complete AND assembly job accepted
    const step3Complete = step2Complete && assemblyAccepted;
    const step3Failed = step2Complete && assemblyFailed;
    const step3Active = step2Complete && !step3Complete && !step3Failed && assemblyActive;

    const anySourcePending = sources.some(s => (s.state as string) === 'pending');
    const needsRebuild = anySourcePending || isCanceled || Boolean(step0Failed || step1Failed || step2Failed || step3Failed);

    let currentStepIndex = -1;
    if (!isCanceled && !step0Failed && !step1Failed && !step2Failed && !step3Failed) {
      if (step0Active) currentStepIndex = 0;
      else if (step1Active) currentStepIndex = 1;
      else if (step2Active) currentStepIndex = 2;
      else if (step3Active) currentStepIndex = 3;
    }

    return {
      currentStepIndex,
      steps: [
        { label: 'Understanding', isComplete: step0Complete, isCurrent: !isCanceled && currentStepIndex === 0, isFailed: Boolean(step0Failed) },
        { label: 'Chunking', isComplete: step1Complete, isCurrent: !isCanceled && currentStepIndex === 1, isFailed: Boolean(step1Failed) },
        { label: 'Analyzing', isComplete: step2Complete, isCurrent: !isCanceled && currentStepIndex === 2, isFailed: Boolean(step2Failed) },
        { label: 'Building', isComplete: Boolean(step3Complete), isCurrent: !isCanceled && currentStepIndex === 3, isFailed: Boolean(step3Failed) },
      ],
      needsRebuild,
    };
  }

  // 3. Conservative Fallback when jobs are omitted (legacy snapshots or initial mock workspaces)
  const stageToIndex = (st: string): number => {
    switch (st) {
      case 'acquisition':
      case 'extraction':
      case 'understanding':
        return 0;
      case 'chunking':
        return 1;
      case 'analysis':
        return 2;
      case 'assembly':
      case 'building':
      case 'done':
        return 3;
      default:
        return 0;
    }
  };

  if (isCanceled) {
    return {
      currentStepIndex: -1,
      steps: stepLabels.map(label => ({
        label,
        isComplete: false,
        isCurrent: false,
        isFailed: false,
      })),
      needsRebuild: true,
    };
  }

  if (status === 'failed') {
    const failingIndex = stageToIndex(stage);
    return {
      currentStepIndex: -1,
      steps: stepLabels.map((label, index) => ({
        label,
        isComplete: index < failingIndex,
        isCurrent: false,
        isFailed: index === failingIndex,
      })),
      needsRebuild: true,
    };
  }

  if (status === 'running' || status === 'queued' || status === 'processing') {
    const activeIndex = stageToIndex(stage);
    return {
      currentStepIndex: activeIndex,
      steps: stepLabels.map((label, index) => ({
        label,
        isComplete: index < activeIndex,
        isCurrent: index === activeIndex,
        isFailed: false,
      })),
      needsRebuild: false,
    };
  }

  const anySourceNotReady = sources.some(s => (s.state as string) === 'pending' || s.state !== 'ready');
  if (anySourceNotReady || (status === 'idle' && sources.length > 0)) {
    return {
      currentStepIndex: -1,
      steps: stepLabels.map(label => ({
        label,
        isComplete: false,
        isCurrent: false,
        isFailed: false,
      })),
      needsRebuild: true,
    };
  }

  if (status === 'ready' && sources.length > 0 && sources.every(s => (s.state as string) === 'ready')) {
    return {
      currentStepIndex: -1,
      steps: stepLabels.map(label => ({
        label,
        isComplete: true,
        isCurrent: false,
        isFailed: false,
      })),
      needsRebuild: false,
    };
  }

  return {
    currentStepIndex: -1,
    steps: stepLabels.map(label => ({
      label,
      isComplete: false,
      isCurrent: false,
      isFailed: false,
    })),
    needsRebuild: sources.length > 0,
  };
}

interface CohortWorkspacePaneProps {
  workspaceId?: string;
  onSelectLessonForChat: (attached: { entity: EntityRef; label: string }) => void;
  onNavigateToDestination?: (url: string) => void;
}

export function CohortWorkspacePane({
  workspaceId: propWorkspaceId,
  onSelectLessonForChat,
  onNavigateToDestination,
}: CohortWorkspacePaneProps) {
  const interactionState = useInteractionState<CohortWorkspace>();
  const workspaceId = propWorkspaceId ?? interactionState?.workspaceId ?? '';
  const rawWorkspace = useWorkspaceView<CohortWorkspace>();
  const parsed = rawWorkspace ? cohortWorkspaceSchema.safeParse(rawWorkspace) : null;
  const workspace = parsed?.success ? parsed.data : (rawWorkspace as CohortWorkspace | null);
  const dispatchAction = useDispatchAction<CohortAction>();

  const [inspectedStage, setInspectedStage] = useState<Stage | null>(null);

  if (!workspace) {
    return <div className={styles.rightPane}>Loading workspace state...</div>;
  }

  const progress = getProcessingProgress(workspace);
  const activeStage = getActiveStage(workspace);
  const effectiveStage = getEffectiveStage(workspace, inspectedStage);

  const stepToStageMap: Record<ProcessingStep['label'], Stage> = {
    Understanding: 'understanding',
    Chunking: 'chunking',
    Analyzing: 'analysis',
    Building: 'assembly',
  };

  return (
    <main className={styles.rightPane} aria-label="Cohort Curriculum Workspace">
      {/* Stepper Navigation */}
      <div className={styles.stepperNav}>
        <ol className={styles.creationSteps} aria-label="Creation journey progress">
          {progress.steps.map((step, index) => {
            const stepStage = stepToStageMap[step.label];
            const isInspected = inspectedStage === stepStage;
            const isCurrent = inspectedStage ? isInspected : step.isCurrent;
            return (
              <li
                key={step.label}
                role="button"
                tabIndex={0}
                aria-current={isCurrent ? 'step' : undefined}
                data-complete={step.isComplete}
                data-failed={step.isFailed || undefined}
                data-inspected={isInspected || undefined}
                onClick={() => {
                  // Pure presentation state: sets inspectedStage, no actions dispatched, no store re-creation
                  setInspectedStage(current => (current === stepStage ? null : stepStage));
                }}
                onKeyDown={e => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    setInspectedStage(current => (current === stepStage ? null : stepStage));
                  }
                }}
                style={{ cursor: 'pointer' }}
              >
                <span>
                  {step.isComplete ? (
                    <Check size={13} aria-label="Complete" />
                  ) : step.isFailed ? (
                    <AlertCircle size={13} aria-label="Failed" />
                  ) : (
                    index + 1
                  )}
                </span>
                {step.label}
              </li>
            );
          })}
        </ol>
      </div>

      {/* Stage Inspection Banner */}
      {inspectedStage && (
        <div
          data-testid="stage-inspection-banner"
          className={styles.inspectingBanner}
          role="status"
        >
          <span>
            Inspecting <strong>{inspectedStage}</strong> stage.
          </span>
          <button
            type="button"
            className={styles.resetStageBtn}
            aria-label="Reset to active stage"
            onClick={() => setInspectedStage(null)}
          >
            Return to active stage
          </button>
        </div>
      )}

      {/* Stage Specific Views */}
      {effectiveStage === 'intake' && (
        <IntakeStageView workspace={workspace} needsRebuild={progress.needsRebuild} dispatchAction={dispatchAction} />
      )}
      {effectiveStage === 'understanding' && (
        <UnderstandingStageView workspace={workspace} dispatchAction={dispatchAction} />
      )}
      {effectiveStage === 'chunking' && (
        <ChunkingStageView workspace={workspace} dispatchAction={dispatchAction} />
      )}
      {effectiveStage === 'analysis' && (
        <AnalysisStageView workspace={workspace} dispatchAction={dispatchAction} />
      )}
      {effectiveStage === 'assembly' && (
        <AssemblyStageView workspace={workspace} dispatchAction={dispatchAction} />
      )}
      {(effectiveStage === 'curriculum' || effectiveStage === 'review') && (
        <CurriculumStageView
          workspace={workspace}
          workspaceId={workspaceId}
          needsRebuild={progress.needsRebuild}
          dispatchAction={dispatchAction}
          onSelectLessonForChat={onSelectLessonForChat}
          onNavigateToDestination={onNavigateToDestination}
        />
      )}
    </main>
  );
}
