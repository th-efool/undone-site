'use client';

import { useState } from 'react';
import {
  Lock,
  Unlock,
  ArrowUp,
  ArrowDown,
  Trash2,
  Edit3,
  Plus,
  Clock,
  Users,
  MessageSquare,
  Check,
  AlertCircle,
  FileText,
  Globe,
} from 'lucide-react';
import { useWorkspaceView, useDispatchAction, useInteractionState } from '@/src/client/interaction/hooks';
import { cohortWorkspaceSchema, type CohortWorkspace, type CohortAction, type CohortLesson } from '@/src/shared/cohort-builder/contracts';
import type { EntityRef } from 'interaction-builder/core';
import styles from './CohortBuilder.module.css';
import { BuilderDialog } from './BuilderDialog';
import { ExternalSources, ExternalSourceScope } from './ExternalSources';
import { formatYoutubeTimestamp } from '@/src/shared/cohort-builder/youtube-transcript';
import { ReleasePanel } from './components/ReleasePanel';
import {
  type BuilderStage,
  getActiveStage,
  getEffectiveStage,
} from './stage-selectors';

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

function YoutubeIcon({ size = 20, ...props }: React.SVGProps<SVGSVGElement> & { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" {...props}>
      <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
    </svg>
  );
}

function GithubIcon({ size = 20, ...props }: React.SVGProps<SVGSVGElement> & { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" {...props}>
      <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12z"/>
    </svg>
  );
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

  // Modals state
  const [editingOverview, setEditingOverview] = useState(false);
  const [overviewForm, setOverviewForm] = useState({
    intent: workspace?.intent ?? '',
    audience: workspace?.audience ?? '',
    dailyMinutes: workspace?.dailyMinutes ?? 20,
  });
  const [overviewBase, setOverviewBase] = useState(overviewForm);

  const [editingLesson, setEditingLesson] = useState<CohortLesson | null>(null);
  const [lessonForm, setLessonForm] = useState({ title: '', objective: '' });

  const [addingLesson, setAddingLesson] = useState(false);
  const [newLessonForm, setNewLessonForm] = useState({ title: '', objective: '' });
  const [sourceForm, setSourceForm] = useState({ label: '', text: '' });
  const [editingSourceId, setEditingSourceId] = useState<string | null>(null);
  const [editingSourceVersion, setEditingSourceVersion] = useState<number | null>(null);
  const [sourceBase, setSourceBase] = useState(sourceForm);
  const [inspectedStage, setInspectedStage] = useState<BuilderStage | null>(null);

  if (!workspace) {
    return <div className={styles.rightPane}>Loading workspace state...</div>;
  }

  // --- Handlers ---
  const handleOpenOverview = () => {
    const fields = {
      intent: workspace.intent,
      audience: workspace.audience,
      dailyMinutes: workspace.dailyMinutes,
    };
    setOverviewForm(fields); setOverviewBase(fields);
    setEditingOverview(true);
  };

  const handleSaveOverview = async () => {
    if (overviewBase.intent !== workspace.intent || overviewBase.audience !== workspace.audience || overviewBase.dailyMinutes !== workspace.dailyMinutes) return;
    if (overviewForm.intent !== workspace.intent) {
      if (!await dispatchAction({ type: 'set_intent', intent: overviewForm.intent })) return;
    }
    if (overviewForm.audience !== workspace.audience) {
      if (!await dispatchAction({ type: 'set_audience', audience: overviewForm.audience })) return;
    }
    if (overviewForm.dailyMinutes !== workspace.dailyMinutes) {
      if (!await dispatchAction({ type: 'set_daily_minutes', dailyMinutes: overviewForm.dailyMinutes })) return;
    }
    setEditingOverview(false);
  };

  const handleTogglePin = async (lesson: CohortLesson) => {
    await dispatchAction(
      { type: 'set_lesson_pin', lessonId: lesson.id, pinned: !lesson.pinned },
      [{ kind: 'lesson', id: lesson.id, version: lesson.version }]
    );
  };

  const handleMoveLesson = async (index: number, direction: 'up' | 'down') => {
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= workspace.lessons.length) return;

    const newOrder = [...workspace.lessons.map(l => l.id)];
    const temp = newOrder[index];
    newOrder[index] = newOrder[targetIndex];
    newOrder[targetIndex] = temp;

    await dispatchAction({ type: 'reorder_lessons', lessonIds: newOrder });
  };

  const handleOpenEditLesson = (lesson: CohortLesson) => {
    setEditingLesson(lesson);
    setLessonForm({ title: lesson.title, objective: lesson.objective });
  };

  const handleSaveEditLesson = async () => {
    if (!editingLesson) return;
    const saved = await dispatchAction(
      {
        type: 'edit_lesson',
        lessonId: editingLesson.id,
        ...(editingLesson.pinned ? {} : { title: lessonForm.title }),
        objective: lessonForm.objective,
      },
      [{ kind: 'lesson', id: editingLesson.id, version: editingLesson.version }]
    );
    if (saved) setEditingLesson(null);
  };

  const handleDeleteLesson = async (lesson: CohortLesson) => {
    if (lesson.pinned) {
      alert('This lesson is pinned. Unpin it first if you wish to delete it.');
      return;
    }
    if (confirm(`Remove lesson "${lesson.title}"?`)) {
      await dispatchAction(
        { type: 'remove_lesson', lessonId: lesson.id },
        [{ kind: 'lesson', id: lesson.id, version: lesson.version }]
      );
    }
  };

  const handleSaveAddLesson = async () => {
    if (!newLessonForm.title.trim() || !newLessonForm.objective.trim()) return;
    const saved = await dispatchAction({
      type: 'add_lesson',
      title: newLessonForm.title.trim(),
      objective: newLessonForm.objective.trim(),
    });
    if (!saved) return;
    setNewLessonForm({ title: '', objective: '' });
    setAddingLesson(false);
  };

  const handleAddSource = async () => {
    if (!sourceForm.label.trim() || !sourceForm.text.trim()) return;
    const action: CohortAction = editingSourceId
      ? { type: 'edit_text_source', sourceId: editingSourceId, label: sourceForm.label.trim(), text: sourceForm.text }
      : { type: 'add_text_source', label: sourceForm.label.trim(), text: sourceForm.text };
    if (await dispatchAction(action, editingSourceId ? [{ kind: 'source', id: editingSourceId, version: editingSourceVersion ?? 0 }] : [])) {
      setSourceForm({ label: '', text: '' });
      setEditingSourceId(null);
    }
  };

  const progress = getProcessingProgress(workspace);
  const activeStage = getActiveStage(workspace);
  const effectiveStage = getEffectiveStage(workspace, inspectedStage);

  const stepToStageMap: Record<ProcessingStep['label'], BuilderStage> = {
    Understanding: 'understanding',
    Chunking: 'chunking',
    Analyzing: 'analysis',
    Building: 'assembly',
  };

  return (
    <main className={styles.rightPane} aria-label="Cohort Curriculum Workspace">
      {/* Creation Journey Progress Steps */}
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

      {inspectedStage && (
        <div
          data-testid="stage-inspection-banner"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '6px 12px',
            margin: '0 0 16px',
            background: 'var(--creation-surface)',
            border: '1px dashed var(--creation-blue)',
            borderRadius: '8px',
            fontSize: '12px',
          }}
        >
          <span>
            Inspecting stage: <strong>{inspectedStage}</strong> (presentation preview)
          </span>
          <button
            type="button"
            className={styles.editActionBtn}
            onClick={() => setInspectedStage(null)}
            style={{ padding: '2px 8px', fontSize: '11px' }}
          >
            Reset to active stage
          </button>
        </div>
      )}

      {/* Hero / Overview Card */}
      <section className={styles.heroCard}>
        <div className={styles.heroHeader}>
          <div>
            <span className={styles.heroEyebrow}>Learning Blueprint</span>
            <h1 className={styles.heroTitle}>{workspace.title || 'Cohort Blueprint'}</h1>
          </div>
          <button className={styles.editActionBtn} onClick={handleOpenOverview}>
            <Edit3 size={14} /> Edit details
          </button>
        </div>

        <p className={styles.intentText}>{workspace.intent}</p>

        <div className={styles.metaGrid}>
          <div className={styles.metaItem}>
            <Users size={16} color="var(--creation-blue)" />
            <span>Audience: <strong>{workspace.audience}</strong></span>
          </div>
          <div className={styles.metaItem}>
            <Clock size={16} color="var(--creation-blue)" />
            <span>Pace: <strong>{workspace.dailyMinutes} mins/day</strong></span>
          </div>
        </div>
      </section>

      <section id="builder-sources" className={styles.heroCard} aria-label="Grounded source text">
        <div className={styles.sectionHeader}>
          <h3>Source text</h3>
          <small className={styles.statusPill} data-status={workspace.processing.status}>
            {workspace.processing.status}{workspace.processing.status === 'queued' ? ` · ${workspace.processing.stage} waiting for worker` : ''}
            {progress.needsRebuild && workspace.processing.status === 'idle' ? ' · rebuild needed' : ''}
          </small>
        </div>
        <ExternalSources/>
        <div className={styles.formField}>
          <label htmlFor="cohort-source-title">Source title</label>
          <input id="cohort-source-title" value={sourceForm.label} placeholder="e.g. Distributed systems notes" onChange={event => setSourceForm({ ...sourceForm, label: event.target.value })} />
        </div>
        <div className={styles.formField}>
          <label htmlFor="cohort-source-text">Paste text to retain and ground this curriculum</label>
          <textarea id="cohort-source-text" rows={6} maxLength={200_000} value={sourceForm.text} onChange={event => setSourceForm({ ...sourceForm, text: event.target.value })} />
        </div>
        <div className={styles.modalActions}>
          <button className={styles.saveBtn} onClick={() => void handleAddSource()}>{editingSourceId ? 'Save source changes' : 'Add text source'}</button>
          {editingSourceId && <button className={styles.editActionBtn} onClick={() => { setEditingSourceId(null); setSourceForm({ label: '', text: '' }); }}>Cancel edit</button>}
        </div>
        {editingSourceId && workspace.sources.find(source => source.id === editingSourceId)?.version !== editingSourceVersion && <div role="alert" className={styles.alertBox}>
          <p>This source changed or was removed. Your text is retained.</p>
          {workspace.sources.some(source => source.id === editingSourceId) && <><details><summary>Compare current source</summary><p>{workspace.sources.find(source => source.id === editingSourceId)?.text}</p></details>
            <button onClick={() => {
              const current = workspace.sources.find(source => source.id === editingSourceId)!;
              setSourceForm({ label: sourceForm.label === sourceBase.label ? current.label : sourceForm.label,
                text: sourceForm.text === sourceBase.text ? current.text : sourceForm.text });
              setSourceBase({ label: current.label, text: current.text }); setEditingSourceVersion(current.version);
            }}>Use current source version and keep my edit</button></>}
        </div>}
        {workspace.processing.error && <p role="alert" className={styles.alertBox}>{workspace.processing.error}</p>}
        {workspace.processing.status === 'failed' && !workspace.processing.jobs?.length && <button className={styles.editActionBtn} onClick={() => void dispatchAction({ type: 'retry_processing' })}>Retry processing</button>}
        {workspace.sources.length > 0 && workspace.sources.every(s => (s.state as string) === 'ready') && (workspace.processing.status === 'ready' || workspace.processing.status === 'idle') && (
          <button className={styles.editActionBtn} onClick={() => void dispatchAction({ type: 'retry_processing' })}>Rebuild from sources</button>
        )}
        
        {workspace.sources.length > 0 && (
          <div className={styles.sourceList}>
            {workspace.sources.map(source => (
              <div key={source.id} className={styles.sourceItem}>
                <div className={styles.sourceItemLeading}>
                  <div className={styles.sourceItemIcon}>
                    {source.input?.kind === 'youtube' ? <YoutubeIcon size={20} /> :
                     source.input?.kind === 'github' ? <GithubIcon size={20} /> :
                     source.input?.kind === 'pdf' ? <FileText size={20} /> :
                     source.input?.kind === 'web' ? <Globe size={20} /> :
                     <FileText size={20} />}
                  </div>
                  <div className={styles.sourceItemMeta}>
                    <div className={styles.sourceItemTitle}>
                      <strong>{source.label}</strong>
                      <span className={styles.sourceKindBadge}>{source.input?.kind ?? 'text'}</span>
                      <span className={styles.sourceStateBadge} data-state={source.state}>{source.state}</span>
                    </div>
                    <ExternalSourceScope source={source}/>
                  </div>
                </div>
                <div className={styles.sourceItemActions}>
                  {!source.input && (
                    <button
                      type="button"
                      className={styles.editActionBtn}
                      onClick={() => {
                        setEditingSourceId(source.id);
                        setEditingSourceVersion(source.version);
                        setSourceForm({ label: source.label, text: source.text });
                        setSourceBase({ label: source.label, text: source.text });
                      }}
                    >
                      Edit
                    </button>
                  )}
                  <button
                    type="button"
                    className={styles.editActionBtn}
                    onClick={() =>
                      void dispatchAction(
                        { type: 'remove_source', sourceId: source.id },
                        [{ kind: 'source', id: source.id, version: source.version }]
                      )
                    }
                  >
                    Remove
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {workspace.processing.jobs?.length ? <section className={styles.processingJobs} aria-label="Source processing jobs" aria-live="polite">
          {workspace.processing.jobs.map(job => <p key={job.id}>
            {workspace.sources.find(source => source.id === job.sourceId)?.label ?? 'Curriculum'} · {job.stage} · {job.status}
            {job.error && <span> · {job.error}</span>}
            {job.status === 'failed' && (job.retryable
              ? <button onClick={() => void dispatchAction({ type: 'retry_text_job', jobId: job.id })}>Retry {job.stage}</button>
              : <span> · Retry limit reached; edit or remove affected source.</span>)}
          </p>)}
          {workspace.processing.jobs.some(job => job.status === 'queued' || job.status === 'running') &&
            <button onClick={() => void dispatchAction({ type: 'cancel_text_processing' })}>Stop source processing</button>}
        </section> : null}
      </section>

      {/* Curriculum Outline */}
      <div className={styles.sectionHeader}>
        <h3>Curriculum Outline ({workspace.lessons.length} lessons)</h3>
        <button className={styles.addLessonBtn} onClick={() => setAddingLesson(true)}>
          <Plus size={15} /> Add Lesson
        </button>
      </div>

      <div id="builder-outline" className={styles.lessonsList}>
        {workspace.lessons.map((lesson, idx) => (
          <article
            key={lesson.id}
            id={`lesson-${lesson.id}`}
            tabIndex={-1}
            className={`${styles.lessonCard} ${lesson.pinned ? styles.lessonCardPinned : ''}`}
          >
            <div className={styles.lessonNumber}>{idx + 1}</div>

            <div className={styles.lessonBody}>
              <div className={styles.lessonHeadRow}>
                <h4 className={styles.lessonTitle}>{lesson.title}</h4>
                <div className={styles.lessonActions}>
                  <button
                    className={`${styles.iconBtn} ${lesson.pinned ? styles.iconBtnActive : ''}`}
                    onClick={() => void handleTogglePin(lesson)}
                    title={lesson.pinned ? 'Pinned (Protected from AI)' : 'Pin to lock title'}
                    aria-label={lesson.pinned ? 'Unpin lesson' : 'Pin lesson'}
                  >
                    {lesson.pinned ? <Lock size={14} /> : <Unlock size={14} />}
                  </button>

                  <button
                    className={styles.iconBtn}
                    onClick={() => void handleMoveLesson(idx, 'up')}
                    disabled={idx === 0}
                    title="Move up"
                    aria-label="Move up"
                  >
                    <ArrowUp size={14} />
                  </button>

                  <button
                    className={styles.iconBtn}
                    onClick={() => void handleMoveLesson(idx, 'down')}
                    disabled={idx === workspace.lessons.length - 1}
                    title="Move down"
                    aria-label="Move down"
                  >
                    <ArrowDown size={14} />
                  </button>

                  <button
                    className={styles.iconBtn}
                    onClick={() => handleOpenEditLesson(lesson)}
                    title="Edit lesson"
                    aria-label="Edit lesson"
                  >
                    <Edit3 size={14} />
                  </button>

                  <button
                    className={styles.iconBtn}
                    onClick={() => void handleDeleteLesson(lesson)}
                    disabled={lesson.pinned}
                    title={lesson.pinned ? 'Cannot delete pinned lesson' : 'Delete lesson'}
                    aria-label="Delete lesson"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>

              <p className={styles.lessonObjective}>{lesson.objective}</p>
              {lesson.evidenceStatus === 'orphaned' && <p role="alert" className={styles.alertBox}>This retained lesson references changed or removed source text. Review its evidence before relying on it.</p>}
              {lesson.sourceChunkIds.length > 0 && (
                <p className={styles.intentText}>Grounded in {lesson.sourceChunkIds.map(chunkId => {
                  const chunk = workspace.chunks.find(item => item.id === chunkId);
                  return chunk ? `“${chunk.text.slice(0, 160)}”` : 'unavailable retained passage';
                }).join(' ')}</p>
              )}
              {lesson.sourceChunkIds.length > 0 && <details className={styles.evidenceDrawer}><summary>Inspect evidence</summary>
                {lesson.sourceChunkIds.map(chunkId => {
                  const chunk = workspace.chunks.find(item => item.id === chunkId);
                  const source = workspace.sources.find(item => item.id === chunk?.sourceId);
                  const pages=source?.locations?.filter(location=>location.page && location.start< (chunk?.end??0) && location.end>(chunk?.start??0)).map(location=>location.page);
                  const timeLoc=source?.locations?.filter(location=>location.startMs!==undefined && location.endMs!==undefined && location.start<(chunk?.end??0) && location.end>(chunk?.start??0));
                  const timestamps=timeLoc?.length?` · timestamp ${formatYoutubeTimestamp(Math.min(...timeLoc.map(l=>l.startMs!)))}–${formatYoutubeTimestamp(Math.max(...timeLoc.map(l=>l.endMs!)))}`:'';
                  const fileLoc=source?.locations?.filter(location=>location.filePath && location.start<(chunk?.end??0) && location.end>(chunk?.start??0));
                  const fileCitations=fileLoc?.length?` · ${Array.from(new Set(fileLoc.map(l=>l.startLine && l.endLine ? `${l.filePath}#L${l.startLine}-L${l.endLine}` : l.filePath).filter(Boolean))).join(', ')}`:'';
                  return <blockquote key={chunkId} className={styles.evidenceBlockquote}>{chunk ? <><cite className={styles.evidenceCite}>{source?.label ?? 'Retained source'} · version {chunk.sourceVersion}{pages?.length?` · physical page ${pages.join(', ')}`:''}{timestamps}{fileCitations} · characters {chunk.start}–{chunk.end}{source?.provenance?` · ${source.provenance.scope} · ${source.provenance.parserVersion}`:''}</cite>{(source?.provenance?.finalUrl || source?.provenance?.repoUrl) && <p>{source.provenance.finalUrl ?? `${source.provenance.repoUrl}@${source.provenance.commitSha ? source.provenance.commitSha.slice(0, 7) : (source.provenance.ref ?? '')}`}</p>}<p>{chunk.text}</p></> : 'Retained passage unavailable; review orphan warning.'}</blockquote>;
                })}
              </details>}

              <button
                className={styles.chatRefBtn}
                onClick={() =>
                  onSelectLessonForChat({
                    entity: { kind: 'lesson', id: lesson.id, version: lesson.version },
                    label: lesson.title,
                  })
                }
              >
                <MessageSquare size={12} /> Discuss in chat
              </button>
            </div>
          </article>
        ))}
      </div>

      <ReleasePanel
        workspace={workspace}
        workspaceId={workspaceId}
        onNavigateToDestination={onNavigateToDestination}
      />

      {/* Edit Overview Modal */}
      {editingOverview && (
        <div className={styles.modalBackdrop}>
          <BuilderDialog label="Edit Cohort Overview" onClose={() => setEditingOverview(false)}>
            <h3>Edit Cohort Overview</h3>
            {(overviewBase.intent !== workspace.intent || overviewBase.audience !== workspace.audience || overviewBase.dailyMinutes !== workspace.dailyMinutes) && <div role="alert">
              <p>Overview changed while you were editing. Current: {workspace.intent} · {workspace.audience} · {workspace.dailyMinutes} minutes.</p>
              <button onClick={() => {
                setOverviewForm({ intent: overviewForm.intent === overviewBase.intent ? workspace.intent : overviewForm.intent,
                  audience: overviewForm.audience === overviewBase.audience ? workspace.audience : overviewForm.audience,
                  dailyMinutes: overviewForm.dailyMinutes === overviewBase.dailyMinutes ? workspace.dailyMinutes : overviewForm.dailyMinutes });
                setOverviewBase({ intent: workspace.intent, audience: workspace.audience, dailyMinutes: workspace.dailyMinutes });
              }}>Keep my overview edits against current values</button>
            </div>}

            <div className={styles.formField}>
              <label>Learning Intent</label>
              <textarea
                aria-label="Learning intent"
                rows={3}
                value={overviewForm.intent}
                onChange={e => setOverviewForm({ ...overviewForm, intent: e.target.value })}
              />
            </div>

            <div className={styles.formField}>
              <label>Target Audience</label>
              <input
                aria-label="Target audience"
                type="text"
                value={overviewForm.audience}
                onChange={e => setOverviewForm({ ...overviewForm, audience: e.target.value })}
              />
            </div>

            <div className={styles.formField}>
              <label>Daily Minutes</label>
              <input
                aria-label="Daily minutes"
                type="number"
                min={1}
                max={1440}
                value={overviewForm.dailyMinutes}
                onChange={e =>
                  setOverviewForm({ ...overviewForm, dailyMinutes: Number(e.target.value) || 20 })
                }
              />
            </div>

            <div className={styles.modalActions}>
              <button className={styles.cancelBtn} onClick={() => setEditingOverview(false)}>
                Cancel
              </button>
              <button className={styles.saveBtn} onClick={() => void handleSaveOverview()}>
                Save changes
              </button>
            </div>
          </BuilderDialog>
        </div>
      )}

      {/* Edit Lesson Modal */}
      {editingLesson && (
        <div className={styles.modalBackdrop}>
          <BuilderDialog label="Edit Lesson" onClose={() => setEditingLesson(null)}>
            <h3>Edit Lesson</h3>
            {workspace.lessons.find(lesson => lesson.id === editingLesson.id)?.version !== editingLesson.version && <div role="alert">
              <p>This lesson changed while you were editing. Your writing is retained.</p>
              <p>Current objective: {workspace.lessons.find(lesson => lesson.id === editingLesson.id)?.objective ?? 'Lesson removed'}</p>
              {workspace.lessons.some(lesson => lesson.id === editingLesson.id) && <button onClick={() => {
                const current = workspace.lessons.find(lesson => lesson.id === editingLesson.id)!;
                setLessonForm({ title: lessonForm.title === editingLesson.title ? current.title : lessonForm.title,
                  objective: lessonForm.objective === editingLesson.objective ? current.objective : lessonForm.objective });
                setEditingLesson(current);
              }}>Use current version and keep my edit</button>}
            </div>}

            <div className={styles.formField}>
              <label>Title {editingLesson.pinned && '(Locked: unpin to edit)'}</label>
              <input
                aria-label="Lesson title"
                type="text"
                disabled={editingLesson.pinned}
                value={lessonForm.title}
                onChange={e => setLessonForm({ ...lessonForm, title: e.target.value })}
              />
            </div>

            <div className={styles.formField}>
              <label>Learning Objective</label>
              <textarea
                aria-label="Learning objective"
                rows={4}
                value={lessonForm.objective}
                onChange={e => setLessonForm({ ...lessonForm, objective: e.target.value })}
              />
            </div>

            <div className={styles.modalActions}>
              <button className={styles.cancelBtn} onClick={() => setEditingLesson(null)}>
                Cancel
              </button>
              <button className={styles.saveBtn} onClick={() => void handleSaveEditLesson()}>
                Update Lesson
              </button>
            </div>
          </BuilderDialog>
        </div>
      )}

      {/* Add Lesson Modal */}
      {addingLesson && (
        <div className={styles.modalBackdrop}>
          <BuilderDialog label="Add New Lesson" onClose={() => setAddingLesson(false)}>
            <h3>Add New Lesson</h3>

            <div className={styles.formField}>
              <label>Title</label>
              <input
                aria-label="New lesson title"
                type="text"
                placeholder="e.g. Asynchronous Job Queues"
                value={newLessonForm.title}
                onChange={e => setNewLessonForm({ ...newLessonForm, title: e.target.value })}
              />
            </div>

            <div className={styles.formField}>
              <label>Learning Objective</label>
              <textarea
                aria-label="New lesson objective"
                rows={4}
                placeholder="What will the learner master in this lesson?"
                value={newLessonForm.objective}
                onChange={e => setNewLessonForm({ ...newLessonForm, objective: e.target.value })}
              />
            </div>

            <div className={styles.modalActions}>
              <button className={styles.cancelBtn} onClick={() => setAddingLesson(false)}>
                Cancel
              </button>
              <button className={styles.saveBtn} onClick={() => void handleSaveAddLesson()}>
                Create Lesson
              </button>
            </div>
          </BuilderDialog>
        </div>
      )}
    </main>
  );
}
