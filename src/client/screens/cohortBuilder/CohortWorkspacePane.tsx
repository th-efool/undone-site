'use client';

import { useState } from 'react';
import dynamic from 'next/dynamic';
import { Check, AlertCircle, ArrowLeft } from 'lucide-react';
import {
  useWorkspaceView,
  useDispatchAction,
  useInteractionState,
} from '@/src/client/interaction/hooks';
import {
  cohortWorkspaceSchema,
  type CohortWorkspace,
  type CohortAction,
} from '@/src/shared/cohort-builder/contracts';
import {
  STEP_TO_STAGE_MAP,
  deriveCreationViewModel,
  deriveProcessingProgress,
  type ProcessingStep,
  type ProcessingProgress,
} from '@/src/shared/cohort-builder/creation-view';
import type { EntityRef } from 'interaction-builder/core';
import styles from './CohortBuilder.module.css';
import startingStyles from '@/src/client/screens/cohortCreation/components/StartingPoint.module.css';

import { UnderstandingStageView } from './stages/UnderstandingStageView';
import { ChunkingStageView } from './stages/ChunkingStageView';
import { AnalysisStageView } from './stages/AnalysisStageView';
import { AssemblyStageView } from './stages/AssemblyStageView';
import { CurriculumStageView } from './stages/CurriculumStageView';
import { IntakeStageView } from './stages/IntakeStageView';
import { RecommendationsStageView } from './stages/RecommendationsStageView';
import { StartingPointStageView } from './stages/StartingPointStageView';
import { MaterialStageView } from './stages/MaterialStageView';
import { DiscoveryStageView } from './stages/DiscoveryStageView';
import { CohortDraftProvider, useCohortDrafts } from './draft-context';
import {
  getActiveStage,
  getEffectiveStage,
  type BuilderStage,
} from './stage-selectors';

import { ReadyStageView } from './stages/ReadyStageView';

const PublicationStageView = dynamic(
  () =>
    import('./stages/PublicationStageView').then(m => m.PublicationStageView),
  { ssr: false }
);

export type Stage = BuilderStage;
export type { ProcessingStep, ProcessingProgress };
export { getActiveStage, getEffectiveStage };

export function getProcessingProgress(
  workspace: CohortWorkspace
): ProcessingProgress {
  return deriveProcessingProgress(workspace);
}

interface CohortWorkspacePaneProps {
  workspaceId?: string;
  ownerId?: string;
  onSelectLessonForChat: (attached: { entity: EntityRef; label: string }) => void;
  onNavigateToDestination?: (url: string) => void;
}

export function CohortWorkspacePane(props: CohortWorkspacePaneProps) {
  const interactionState = useInteractionState<CohortWorkspace>();
  const workspaceId =
    props.workspaceId ?? interactionState?.workspaceId ?? '';
  return (
    <CohortDraftProvider workspaceId={workspaceId} ownerId={props.ownerId}>
      <InnerCohortWorkspacePane {...props} />
    </CohortDraftProvider>
  );
}

function InnerCohortWorkspacePane({
  workspaceId: propWorkspaceId,
  ownerId: propOwnerId,
  onSelectLessonForChat,
  onNavigateToDestination,
}: CohortWorkspacePaneProps) {
  const drafts = useCohortDrafts();
  const interactionState = useInteractionState<CohortWorkspace>();
  const workspaceId =
    propWorkspaceId ?? interactionState?.workspaceId ?? '';
  const rawWorkspace = useWorkspaceView<CohortWorkspace>();
  const parsed = rawWorkspace
    ? cohortWorkspaceSchema.safeParse(rawWorkspace)
    : null;
  const workspace = parsed?.success
    ? parsed.data
    : (rawWorkspace as CohortWorkspace | null);
  const dispatchAction = useDispatchAction<CohortAction>();

  const [inspectedStage, setInspectedStage] = useState<Stage | null>(null);

  if (!workspace) {
    return <div className={styles.rightPane}>Loading workspace state...</div>;
  }

  const viewModel = deriveCreationViewModel(workspace, inspectedStage, drafts);
  const {
    progress,
    effectiveInspectedStage,
    effectiveStage,
    hideStepper,
  } = viewModel;

  return (
    <main
      className={styles.rightPane}
      aria-label="Cohort Curriculum Workspace"
    >
      {/* Workspace Invariant Discrepancy Banner */}
      {!viewModel.invariants.valid && (
        <div
          data-testid="workspace-invariant-banner"
          className={styles.invariantBanner}
          role="alert"
        >
          <div className={styles.invariantBannerContent}>
            <AlertCircle size={16} aria-hidden="true" />
            <span>
              Workspace state discrepancy: {viewModel.invariants.violations.join(', ')}.
            </span>
          </div>
          <button
            type="button"
            className={styles.resetStageBtn}
            onClick={() => void dispatchAction({ type: 'close_panel' })}
          >
            Return to chat
          </button>
        </div>
      )}
      {/* Stepper Navigation */}
      {!hideStepper && (
        <div className={styles.stepperNav}>
          <ol
            className={styles.creationSteps}
            aria-label="Creation journey progress"
          >
            {progress.steps.map((step, index) => {
              const stepStage = STEP_TO_STAGE_MAP[step.label];
              const isInspected = effectiveInspectedStage === stepStage;
              const isCurrent = effectiveInspectedStage
                ? isInspected
                : step.isCurrent;
              const isAccessible =
                step.isComplete || step.isCurrent || step.isFailed;
              return (
                <li
                  key={step.label}
                  role="button"
                  tabIndex={isAccessible ? 0 : -1}
                  aria-disabled={!isAccessible || undefined}
                  data-disabled={!isAccessible || undefined}
                  aria-current={isCurrent ? 'step' : undefined}
                  data-complete={step.isComplete}
                  data-failed={step.isFailed || undefined}
                  data-inspected={isInspected || undefined}
                  onClick={() => {
                    if (!isAccessible) return;
                    setInspectedStage(current =>
                      current === stepStage ? null : stepStage
                    );
                  }}
                  onKeyDown={e => {
                    if (!isAccessible) return;
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      setInspectedStage(current =>
                        current === stepStage ? null : stepStage
                      );
                    }
                  }}
                  style={{
                    cursor: isAccessible ? 'pointer' : 'not-allowed',
                    opacity: isAccessible ? 1 : 0.45,
                  }}
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
      )}

      {/* Stage Inspection Banner */}
      {!hideStepper && inspectedStage && (
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

      {/* Top starting point tabs for material_input and discovery */}
      {(effectiveStage === 'material_input' ||
        effectiveStage === 'discovery' ||
        effectiveStage === 'goal_setup') && (
        <nav aria-label="Starting point" className={startingStyles.compact}>
          <button
            type="button"
            onClick={() =>
              void dispatchAction({ type: 'back_to_starting_point' })
            }
            aria-label="Back to starting point"
          >
            <ArrowLeft size={16} />
          </button>
          {[
            {
              value: 'have_material' as const,
              label: 'I already have material',
              active: effectiveStage === 'material_input',
            },
            {
              value: 'find_material' as const,
              label: 'Start with a goal',
              active:
                effectiveStage === 'discovery' ||
                effectiveStage === 'goal_setup',
            },
          ].map(choice => (
            <button
              key={choice.value}
              type="button"
              aria-pressed={choice.active}
              onClick={async () => {
                if (choice.active) return;
                const backed = await dispatchAction({
                  type: 'back_to_starting_point',
                });
                if (!backed) return;
                await dispatchAction({
                  type: 'choose_starting_point',
                  choice: choice.value,
                });
              }}
            >
              {choice.label}
            </button>
          ))}
        </nav>
      )}

      {/* Stage Specific Views */}
      {effectiveStage === 'recommendations' && (
        <RecommendationsStageView
          workspace={workspace}
          dispatchAction={dispatchAction}
        />
      )}
      {effectiveStage === 'starting_point' && (
        <StartingPointStageView
          workspace={workspace}
          dispatchAction={dispatchAction}
        />
      )}
      {effectiveStage === 'material_input' && (
        <MaterialStageView
          workspace={workspace}
          dispatchAction={dispatchAction}
        />
      )}
      {effectiveStage === 'discovery' && (
        <DiscoveryStageView
          workspace={workspace}
          dispatchAction={dispatchAction}
        />
      )}
      {effectiveStage === 'goal_setup' && (
        <DiscoveryStageView
          workspace={workspace}
          dispatchAction={dispatchAction}
        />
      )}
      {effectiveStage === 'intake' && (
        <IntakeStageView
          workspace={workspace}
          needsRebuild={progress.needsRebuild}
          dispatchAction={dispatchAction}
        />
      )}
      {effectiveStage === 'understanding' && (
        <UnderstandingStageView
          workspace={workspace}
          dispatchAction={dispatchAction}
        />
      )}
      {effectiveStage === 'chunking' && (
        <ChunkingStageView
          workspace={workspace}
          dispatchAction={dispatchAction}
        />
      )}
      {effectiveStage === 'analysis' && (
        <AnalysisStageView
          workspace={workspace}
          dispatchAction={dispatchAction}
        />
      )}
      {effectiveStage === 'assembly' && (
        <AssemblyStageView
          workspace={workspace}
          dispatchAction={dispatchAction}
        />
      )}
      {effectiveStage === 'ready' && (
        <ReadyStageView
          workspace={workspace}
          dispatchAction={dispatchAction}
        />
      )}
      {(effectiveStage === 'curriculum' || effectiveStage === 'review') && (
        <CurriculumStageView
          workspace={workspace}
          workspaceId={workspaceId}
          revision={interactionState?.revision}
          needsRebuild={progress.needsRebuild}
          dispatchAction={dispatchAction}
          onSelectLessonForChat={onSelectLessonForChat}
          onNavigateToDestination={onNavigateToDestination}
        />
      )}
      {effectiveStage === 'published' && (
        <PublicationStageView
          workspace={workspace}
          dispatchAction={dispatchAction}
          onNavigateToDestination={onNavigateToDestination}
        />
      )}
    </main>
  );
}
