'use client';

import React, { useState } from 'react';
import Image from 'next/image';
import {
  Lock,
  Unlock,
  ArrowUp,
  ArrowDown,
  Trash2,
  Edit3,
  Plus,
  Clock,
  Clock3,
  Users,
  MessageSquare,
  FileText,
  Globe,
  ArrowLeft,
  ArrowRight,
  Save,
  BookOpen,
  List,
  LockKeyhole,
  UserRound,
} from 'lucide-react';
import type { CohortWorkspace, CohortAction, CohortLesson } from '@/src/shared/cohort-builder/contracts';
import type { EntityRef } from 'interaction-builder/core';
import styles from '../CohortBuilder.module.css';
import { BuilderDialog } from '../BuilderDialog';
import { ExternalSources, ExternalSourceScope } from '../ExternalSources';
import { formatYoutubeTimestamp } from '@/src/shared/cohort-builder/youtube-transcript';
import { ReleasePanel } from '../components/ReleasePanel';
import { useCohortDrafts } from '../draft-context';

function YoutubeIcon({ size = 20, ...props }: React.SVGProps<SVGSVGElement> & { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" {...props}>
      <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
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

export interface CurriculumStageViewProps {
  workspace: CohortWorkspace;
  workspaceId?: string;
  revision?: number;
  needsRebuild?: boolean;
  dispatchAction: (action: CohortAction, expected?: EntityRef[]) => Promise<boolean>;
  onSelectLessonForChat: (attached: { entity: EntityRef; label: string }) => void;
  onNavigateToDestination?: (url: string) => void;
}

export function CurriculumStageView({
  workspace,
  workspaceId = '',
  revision,
  needsRebuild = false,
  dispatchAction,
  onSelectLessonForChat,
  onNavigateToDestination,
}: CurriculumStageViewProps) {
  const {
    sourceDraft,
    updateSourceDraft,
    openEditSource,
    clearSourceDraft,
    clearSourceDraftIfUnchanged,

    overviewDraft,
    openOverview,
    updateOverviewDraft,
    closeOverview,
    closeOverviewIfUnchanged,

    lessonDraft,
    openEditLesson,
    updateLessonDraft,
    closeEditLesson,
    closeEditLessonIfUnchanged,

    newLessonDraft,
    openAddLesson,
    updateNewLessonDraft,
    closeAddLesson,
    closeAddLessonIfUnchanged,
  } = useCohortDrafts();

  const [activeTab, setActiveTab] = useState<'overview' | 'lessons' | 'community' | 'creator'>('lessons');

  // --- Handlers ---
  const handleOpenOverview = () => {
    openOverview(workspace, 'curriculum');
  };

  const handleSaveOverview = async () => {
    if (
      overviewDraft.baseIntent !== workspace.intent ||
      overviewDraft.baseAudience !== workspace.audience ||
      overviewDraft.baseDailyMinutes !== workspace.dailyMinutes
    ) {
      return;
    }
    const submittedIntent = overviewDraft.intent;
    const submittedAudience = overviewDraft.audience;
    const submittedDailyMinutes = overviewDraft.dailyMinutes;

    if (submittedIntent !== workspace.intent) {
      if (!(await dispatchAction({ type: 'set_intent', intent: submittedIntent }))) return;
    }
    if (submittedAudience !== workspace.audience) {
      if (!(await dispatchAction({ type: 'set_audience', audience: submittedAudience }))) return;
    }
    if (submittedDailyMinutes !== workspace.dailyMinutes) {
      if (!(await dispatchAction({ type: 'set_daily_minutes', dailyMinutes: submittedDailyMinutes }))) return;
    }
    closeOverviewIfUnchanged({
      intent: submittedIntent,
      audience: submittedAudience,
      dailyMinutes: submittedDailyMinutes,
    });
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
    openEditLesson(lesson, 'curriculum');
  };

  const handleSaveEditLesson = async () => {
    if (!lessonDraft.lessonId) return;
    const currentLesson = workspace.lessons.find(lesson => lesson.id === lessonDraft.lessonId);
    if (!currentLesson) return;
    if (currentLesson.version !== lessonDraft.lessonVersion) return;

    const submittedTitle = lessonDraft.title;
    const submittedObjective = lessonDraft.objective;

    const saved = await dispatchAction(
      {
        type: 'edit_lesson',
        lessonId: lessonDraft.lessonId,
        ...(currentLesson.pinned ? {} : { title: submittedTitle }),
        objective: submittedObjective,
      },
      [{ kind: 'lesson', id: lessonDraft.lessonId, version: lessonDraft.lessonVersion ?? 0 }]
    );
    if (saved) {
      closeEditLessonIfUnchanged({ title: submittedTitle, objective: submittedObjective });
    }
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
    const submittedTitle = newLessonDraft.title.trim();
    const submittedObjective = newLessonDraft.objective.trim();
    if (!submittedTitle || !submittedObjective) return;

    const saved = await dispatchAction({
      type: 'add_lesson',
      title: submittedTitle,
      objective: submittedObjective,
    });
    if (!saved) return;
    closeAddLessonIfUnchanged({ title: submittedTitle, objective: submittedObjective });
  };

  const handleAddSource = async () => {
    const submittedLabel = sourceDraft.label.trim();
    const submittedText = sourceDraft.text;
    if (!submittedLabel || !submittedText.trim()) return;

    const action: CohortAction = sourceDraft.editingSourceId
      ? { type: 'edit_text_source', sourceId: sourceDraft.editingSourceId, label: submittedLabel, text: submittedText }
      : { type: 'add_text_source', label: submittedLabel, text: submittedText };

    const expected = sourceDraft.editingSourceId
      ? [{ kind: 'source', id: sourceDraft.editingSourceId, version: sourceDraft.editingSourceVersion ?? 0 }]
      : [];

    if (await dispatchAction(action, expected)) {
      clearSourceDraftIfUnchanged({ label: submittedLabel, text: submittedText });
    }
  };

  const estimatedMinutes = workspace.lessons.length * (workspace.dailyMinutes || 20);

  return (
    <section className={styles.workspace} aria-label="Review curriculum">
      {/* 1. Review Toolbar matching legacy CreationShell */}
      <header className={styles.reviewToolbar}>
        <div>
          <h2>Draft preview</h2>
          <p>This is your cohort draft. Changes are saved when you confirm them.</p>
        </div>
        <div className={styles.reviewToolbarActions}>
          <button type="button" onClick={() => void dispatchAction({ type: 'retry_processing' })}>
            <Save size={16} aria-hidden="true" /> Save draft
          </button>
          <button
            type="button"
            className={styles.primaryAction}
            aria-label="Publish publicly"
            onClick={() => {
              const release = document.getElementById('release-cohort-section');
              if (release) release.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }}
          >
            Publish cohort <ArrowRight size={18} aria-hidden="true" />
          </button>
        </div>
      </header>

      {/* 2. Cosmic Hero Banner (CohortPreviewHero) */}
      <div className={styles.reviewHero}>
        <Image
          className={styles.reviewHeroArt}
          src="/images/hero-collage/real-galaxy.jpg"
          alt=""
          fill
          sizes="(max-width:820px) 100vw, 75vw"
          priority
        />
        <span className={styles.reviewIllustrationTag}>Draft illustration</span>
        <div className={styles.reviewHeroCopy}>
          <span className={styles.heroEyebrow}>Learning Blueprint</span>
          <div className={styles.reviewTags}>
            <span>{workspace.title || 'Your learning journey'}</span>
            {needsRebuild && <span className={styles.statusPill}>rebuild needed</span>}
          </div>
          <h1>{workspace.title || 'Cohort Blueprint'}</h1>
          <p>{workspace.intent || 'Your learning journey'}</p>
          <div className={styles.reviewCreator}>
            <span>
              <UserRound size={24} aria-hidden="true" />
            </span>
            <div>
              <strong>Created by you</strong>
              <p>Based on {workspace.sources.length} retained {workspace.sources.length === 1 ? 'source' : 'sources'}</p>
            </div>
          </div>
        </div>
        <div className={styles.reviewJoin}>
          <button type="button" disabled>
            Join Cohort <ArrowRight size={20} aria-hidden="true" />
          </button>
          <p>Preview only · available after activation</p>
          <span>
            <LockKeyhole size={16} aria-hidden="true" />
            {workspace.release && workspace.release.status === 'released'
              ? (workspace.release.mode === 'public_publish' ? 'Public cohort' : 'Private cohort')
              : 'Private draft'}
          </span>
        </div>
      </div>

      {/* 3. Navigation Tabs */}
      <nav className={styles.reviewTabs} aria-label="Draft sections">
        <button
          type="button"
          aria-current={activeTab === 'lessons'}
          onClick={() => setActiveTab('lessons')}
        >
          What you’ll see
        </button>
        <button
          type="button"
          aria-current={activeTab === 'overview'}
          onClick={() => setActiveTab('overview')}
        >
          Overview
        </button>
        <button
          type="button"
          aria-current={activeTab === 'community'}
          onClick={() => setActiveTab('community')}
        >
          Community
        </button>
        <button
          type="button"
          aria-current={activeTab === 'creator'}
          onClick={() => setActiveTab('creator')}
        >
          About the creator
        </button>
      </nav>

      {/* 4. Two-Column Preview Grid */}
      <div className={styles.reviewPreviewGrid}>
        <div>
          {/* Overview Panel */}
          {activeTab === 'overview' && (
            <section className={styles.reviewPanel} id="creation-review-overview">
              <h2>About this cohort</h2>
              <p className={styles.reviewCopy}>{workspace.intent}</p>
              <div style={{ marginTop: 14 }}>
                <button type="button" className={styles.editActionBtn} onClick={handleOpenOverview}>
                  <Edit3 size={14} /> Edit details
                </button>
              </div>

              <div style={{ marginTop: 24, paddingTop: 20, borderTop: '1px solid var(--creation-line)' }}>
                <h2>Source material</h2>
                <ExternalSources />

                <div className={styles.formField}>
                  <label htmlFor="cohort-source-title">Source title</label>
                  <input
                    id="cohort-source-title"
                    value={sourceDraft.label}
                    placeholder="e.g. Distributed systems notes"
                    onChange={event => updateSourceDraft({ label: event.target.value }, 'curriculum')}
                  />
                </div>

                <div className={styles.formField}>
                  <label htmlFor="cohort-source-text">Paste text to retain and ground this curriculum</label>
                  <textarea
                    id="cohort-source-text"
                    rows={4}
                    maxLength={200_000}
                    value={sourceDraft.text}
                    onChange={event => updateSourceDraft({ text: event.target.value }, 'curriculum')}
                  />
                </div>

                <div className={styles.modalActions}>
                  <button type="button" className={styles.saveBtn} onClick={() => void handleAddSource()}>
                    {sourceDraft.editingSourceId ? 'Save source changes' : 'Add text source'}
                  </button>
                  {sourceDraft.editingSourceId && (
                    <button
                      type="button"
                      className={styles.editActionBtn}
                      onClick={clearSourceDraft}
                    >
                      Cancel edit
                    </button>
                  )}
                </div>

                {sourceDraft.editingSourceId &&
                  workspace.sources.find(source => source.id === sourceDraft.editingSourceId)?.version !== sourceDraft.editingSourceVersion && (
                    <div role="alert" className={styles.alertBox}>
                      <p>This source changed or was removed. Your text is retained.</p>
                    </div>
                  )}

                {workspace.sources.length > 0 && (
                  <div className={styles.sourceList} style={{ marginTop: 16 }}>
                    {workspace.sources.map(source => (
                      <div key={source.id} className={styles.sourceItem}>
                        <div className={styles.sourceItemLeading}>
                          <div className={styles.sourceItemIcon}>
                            {source.input?.kind === 'youtube' ? (
                              <YoutubeIcon size={20} />
                            ) : source.input?.kind === 'github' ? (
                              <GithubIcon size={20} />
                            ) : (
                              <FileText size={20} />
                            )}
                          </div>
                          <div className={styles.sourceItemMeta}>
                            <div className={styles.sourceItemTitle}>
                              <strong>{source.label}</strong>
                              <span className={styles.sourceKindBadge}>{source.input?.kind ?? 'text'}</span>
                              <span className={styles.sourceStateBadge} data-state={source.state}>
                                {source.state}
                              </span>
                            </div>
                            <ExternalSourceScope source={source} />
                          </div>
                        </div>
                        <div className={styles.sourceItemActions}>
                          {!source.input && (
                            <button
                              type="button"
                              className={styles.editActionBtn}
                              onClick={() => openEditSource(source, 'curriculum')}
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
              </div>
            </section>
          )}

          {/* Lessons / "What you'll see" Panel */}
          {activeTab === 'lessons' && (
            <section className={styles.reviewPanel} id="creation-review-lessons">
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                <h2>What you’ll see ({workspace.lessons.length} lessons)</h2>
                <button type="button" className={styles.addLessonBtn} onClick={() => openAddLesson('curriculum')}>
                  <Plus size={15} /> Add Lesson
                </button>
              </div>

              {/* Source Text Form inside What you'll see as well for instant test accessibility */}
              <div id="builder-sources" style={{ marginBottom: 20, paddingBottom: 16, borderBottom: '1px solid var(--creation-line)' }}>
                <details>
                  <summary style={{ cursor: 'pointer', fontSize: 13, color: 'var(--creation-blue)', fontWeight: 600 }}>
                    Add or edit source text
                  </summary>
                  <div style={{ marginTop: 12 }}>
                    <ExternalSources />
                    <div className={styles.formField}>
                      <label htmlFor="cohort-source-title">Source title</label>
                      <input
                        id="cohort-source-title"
                        value={sourceDraft.label}
                        placeholder="e.g. Distributed systems notes"
                        onChange={event => updateSourceDraft({ label: event.target.value }, 'curriculum')}
                      />
                    </div>
                    <div className={styles.formField}>
                      <label htmlFor="cohort-source-text">Paste text to retain and ground this curriculum</label>
                      <textarea
                        id="cohort-source-text"
                        rows={3}
                        maxLength={200_000}
                        value={sourceDraft.text}
                        onChange={event => updateSourceDraft({ text: event.target.value }, 'curriculum')}
                      />
                    </div>
                    <div className={styles.modalActions}>
                      <button type="button" className={styles.saveBtn} onClick={() => void handleAddSource()}>
                        {sourceDraft.editingSourceId ? 'Save source changes' : 'Add text source'}
                      </button>
                      {sourceDraft.editingSourceId && (
                        <button type="button" className={styles.editActionBtn} onClick={clearSourceDraft}>
                          Cancel edit
                        </button>
                      )}
                    </div>
                    {workspace.sources.length > 0 && (
                      <div className={styles.sourceList} style={{ marginTop: 12 }}>
                        {workspace.sources.map(source => (
                          <div key={source.id} className={styles.sourceItem}>
                            <div className={styles.sourceItemLeading}>
                              <div className={styles.sourceItemMeta}>
                                <strong>{source.label}</strong>
                              </div>
                            </div>
                            <div className={styles.sourceItemActions}>
                              {!source.input && (
                                <button
                                  type="button"
                                  className={styles.editActionBtn}
                                  onClick={() => openEditSource(source, 'curriculum')}
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
                  </div>
                </details>
              </div>

              {workspace.processing.error && <p role="alert" className={styles.alertBox}>{workspace.processing.error}</p>}
              {workspace.processing.status === 'failed' && !workspace.processing.jobs?.length && (
                <button
                  type="button"
                  className={styles.editActionBtn}
                  onClick={() => void dispatchAction({ type: 'retry_processing' })}
                  style={{ marginBottom: 12 }}
                >
                  Retry processing
                </button>
              )}
              {workspace.sources.length > 0 &&
                workspace.sources.every(s => (s.state as string) === 'ready') &&
                (workspace.processing.status === 'ready' || workspace.processing.status === 'idle') && (
                  <button
                    type="button"
                    className={styles.editActionBtn}
                    onClick={() => void dispatchAction({ type: 'retry_processing' })}
                    style={{ marginBottom: 12 }}
                  >
                    Rebuild from sources
                  </button>
                )}

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
                            type="button"
                            className={`${styles.iconBtn} ${lesson.pinned ? styles.iconBtnActive : ''}`}
                            onClick={() => void handleTogglePin(lesson)}
                            title={lesson.pinned ? 'Pinned (Protected from AI)' : 'Pin to lock title'}
                            aria-label={lesson.pinned ? 'Unpin lesson' : 'Pin lesson'}
                          >
                            {lesson.pinned ? <Lock size={14} /> : <Unlock size={14} />}
                          </button>

                          <button
                            type="button"
                            className={styles.iconBtn}
                            onClick={() => void handleMoveLesson(idx, 'up')}
                            disabled={idx === 0}
                            title="Move up"
                            aria-label="Move up"
                          >
                            <ArrowUp size={14} />
                          </button>

                          <button
                            type="button"
                            className={styles.iconBtn}
                            onClick={() => void handleMoveLesson(idx, 'down')}
                            disabled={idx === workspace.lessons.length - 1}
                            title="Move down"
                            aria-label="Move down"
                          >
                            <ArrowDown size={14} />
                          </button>

                          <button
                            type="button"
                            className={styles.iconBtn}
                            onClick={() => handleOpenEditLesson(lesson)}
                            title="Edit lesson"
                            aria-label="Edit lesson"
                          >
                            <Edit3 size={14} />
                          </button>

                          <button
                            type="button"
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
                      {lesson.evidenceStatus === 'orphaned' && (
                        <p role="alert" className={styles.alertBox}>
                          This retained lesson references changed or removed source text. Review its evidence before relying on it.
                        </p>
                      )}
                      {lesson.sourceChunkIds.length > 0 && (
                        <p className={styles.intentText}>
                          Grounded in{' '}
                          {lesson.sourceChunkIds
                            .map(chunkId => {
                              const chunk = workspace.chunks.find(item => item.id === chunkId);
                              return chunk ? `“${chunk.text.slice(0, 160)}”` : 'unavailable retained passage';
                            })
                            .join(' ')}
                        </p>
                      )}
                      {lesson.sourceChunkIds.length > 0 && (
                        <details className={styles.evidenceDrawer}>
                          <summary>Inspect evidence</summary>
                          {lesson.sourceChunkIds.map(chunkId => {
                            const chunk = workspace.chunks.find(item => item.id === chunkId);
                            const source = workspace.sources.find(item => item.id === chunk?.sourceId);
                            const pages = source?.locations
                              ?.filter(location => location.page && location.start < (chunk?.end ?? 0) && location.end > (chunk?.start ?? 0))
                              .map(location => location.page);
                            const timeLoc = source?.locations?.filter(
                              location =>
                                location.startMs !== undefined &&
                                location.endMs !== undefined &&
                                location.start < (chunk?.end ?? 0) &&
                                location.end > (chunk?.start ?? 0)
                            );
                            const timestamps = timeLoc?.length
                              ? ` · timestamp ${formatYoutubeTimestamp(Math.min(...timeLoc.map(l => l.startMs!)))}–${formatYoutubeTimestamp(Math.max(...timeLoc.map(l => l.endMs!)))}`
                              : '';
                            const fileLoc = source?.locations?.filter(
                              location => location.filePath && location.start < (chunk?.end ?? 0) && location.end > (chunk?.start ?? 0)
                            );
                            const fileCitations = fileLoc?.length
                              ? ` · ${Array.from(new Set(fileLoc.map(l => (l.startLine && l.endLine ? `${l.filePath}#L${l.startLine}-L${l.endLine}` : l.filePath)).filter(Boolean))).join(', ')}`
                              : '';
                            const isVideoObservation = source?.input?.kind === 'youtube' && source.input.mode === 'video_observation';
                            const isGeneratedGuide =
                              (source?.input?.kind === 'generated_guide' || source?.provenance?.scope === 'ai_authored_guide') &&
                              !isVideoObservation;
                            const isTranscript = source?.input?.kind === 'youtube' && source.input.mode === 'transcript';

                            return (
                              <blockquote key={chunkId} className={styles.evidenceBlockquote}>
                                {chunk ? (
                                  <>
                                    <cite className={styles.evidenceCite}>
                                      {isVideoObservation
                                        ? `${source?.label ?? 'YouTube Video'} · AI observation`
                                        : isGeneratedGuide
                                        ? 'AI-authored guide'
                                        : isTranscript
                                        ? `${source?.label ?? 'YouTube Video'} · transcript`
                                        : source?.label ?? 'Retained source'} · version {chunk.sourceVersion}
                                      {pages?.length ? ` · physical page ${pages.join(', ')}` : ''}
                                      {timestamps}
                                      {fileCitations} · characters {chunk.start}–{chunk.end}
                                      {source?.provenance ? ` · ${source.provenance.scope} · ${source.provenance.parserVersion}` : ''}
                                    </cite>
                                    {isVideoObservation && (
                                      <p style={{ fontSize: 12, color: 'var(--creation-muted, #59677b)', fontStyle: 'italic', margin: '4px 0' }}>
                                        Retained video observations ready · Coverage is non-exhaustive; timestamps are estimated.
                                      </p>
                                    )}
                                    {isGeneratedGuide && (
                                      <p style={{ fontSize: 12, color: 'var(--creation-muted, #59677b)', fontStyle: 'italic', margin: '4px 0' }}>
                                        AI-authored learning guide, not verified external source material. Check factual claims independently.
                                      </p>
                                    )}
                                    {(source?.provenance?.finalUrl || source?.provenance?.repoUrl) && (
                                      <p>
                                        {source.provenance.finalUrl ??
                                          `${source.provenance.repoUrl}@${
                                            source.provenance.commitSha ? source.provenance.commitSha.slice(0, 7) : (source.provenance.ref ?? '')
                                          }`}
                                      </p>
                                    )}
                                    <p>{chunk.text}</p>
                                  </>
                                ) : (
                                  'Retained passage unavailable; review orphan warning.'
                                )}
                              </blockquote>
                            );
                          })}
                        </details>
                      )}

                      <button
                        type="button"
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
            </section>
          )}

          {/* Community Panel */}
          {activeTab === 'community' && (
            <section className={styles.reviewPanel} id="creation-review-community">
              <h2>Community</h2>
              <p className={styles.reviewCopy}>
                Cohort chat and discussion channels are active for enrolled members upon publication.
              </p>
            </section>
          )}

          {/* Creator Panel */}
          {activeTab === 'creator' && (
            <section className={styles.reviewPanel} id="creation-review-creator">
              <h2>About the creator</h2>
              <p className={styles.reviewCopy}>
                Created by you, from the material and learning goal in this saved draft.
              </p>
            </section>
          )}

          {/* Release Panel */}
          <div id="release-cohort-section">
            <ReleasePanel
              workspace={workspace}
              workspaceId={workspaceId}
              revision={revision}
              onNavigateToDestination={onNavigateToDestination}
            />
          </div>
        </div>

        {/* Right Sidebar matching legacy ReviewPreview */}
        <aside className={styles.reviewSidebar} aria-label="Cohort details">
          <section className={styles.reviewPanel}>
            <h2>Details</h2>
            <ul>
              <li>
                <BookOpen size={20} aria-hidden="true" />
                {workspace.lessons.length} saved lessons
              </li>
              <li>
                <Clock3 size={20} aria-hidden="true" />
                {estimatedMinutes} estimated learning minutes
              </li>
              <li>
                <List size={20} aria-hidden="true" />
                {workspace.sources.length} retained sources
              </li>
              <li>
                <Users size={20} aria-hidden="true" />
                Audience: {workspace.audience || 'General learners'}
              </li>
              <li>
                <Clock size={20} aria-hidden="true" />
                Pace: {workspace.dailyMinutes} mins/day
              </li>
            </ul>
          </section>

          <section className={styles.reviewPanel}>
            <h2>Your learning goals</h2>
            <p className={styles.reviewCopy}>{workspace.intent}</p>
          </section>

          <section className={styles.reviewPanel}>
            <h2>Draft status</h2>
            <p className={styles.reviewCopy}>Your confirmed edits are saved to your account.</p>
            <p className={styles.reviewHelper}>This preview is not a publicly available cohort.</p>
          </section>
        </aside>
      </div>

      {/* Edit Overview Modal */}
      {overviewDraft.isOpen && (
        <div className={styles.modalBackdrop}>
          <BuilderDialog label="Edit Cohort Overview" onClose={closeOverview}>
            <h3>Edit Cohort Overview</h3>
            {(overviewDraft.baseIntent !== workspace.intent ||
              overviewDraft.baseAudience !== workspace.audience ||
              overviewDraft.baseDailyMinutes !== workspace.dailyMinutes) && (
              <div role="alert">
                <p>
                  Overview changed while you were editing. Current: {workspace.intent} · {workspace.audience} · {workspace.dailyMinutes} minutes.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    updateOverviewDraft({
                      intent: overviewDraft.intent === overviewDraft.baseIntent ? workspace.intent : overviewDraft.intent,
                      audience: overviewDraft.audience === overviewDraft.baseAudience ? workspace.audience : overviewDraft.audience,
                      dailyMinutes: overviewDraft.dailyMinutes === overviewDraft.baseDailyMinutes ? workspace.dailyMinutes : overviewDraft.dailyMinutes,
                      baseIntent: workspace.intent,
                      baseAudience: workspace.audience,
                      baseDailyMinutes: workspace.dailyMinutes,
                    });
                  }}
                >
                  Keep my overview edits against current values
                </button>
              </div>
            )}

            <div className={styles.formField}>
              <label>Learning Intent</label>
              <textarea
                aria-label="Learning intent"
                rows={3}
                value={overviewDraft.intent}
                onChange={e => updateOverviewDraft({ intent: e.target.value })}
              />
            </div>

            <div className={styles.formField}>
              <label>Target Audience</label>
              <input
                aria-label="Target audience"
                type="text"
                value={overviewDraft.audience}
                onChange={e => updateOverviewDraft({ audience: e.target.value })}
              />
            </div>

            <div className={styles.formField}>
              <label>Daily Minutes</label>
              <input
                aria-label="Daily minutes"
                type="number"
                min={1}
                max={1440}
                value={overviewDraft.dailyMinutes}
                onChange={e =>
                  updateOverviewDraft({ dailyMinutes: Number(e.target.value) || 20 })
                }
              />
            </div>

            <div className={styles.modalActions}>
              <button type="button" className={styles.cancelBtn} onClick={closeOverview}>
                Cancel
              </button>
              <button type="button" className={styles.saveBtn} onClick={() => void handleSaveOverview()}>
                Save changes
              </button>
            </div>
          </BuilderDialog>
        </div>
      )}

      {/* Edit Lesson Modal */}
      {lessonDraft.isOpen && (() => {
        const targetLesson = workspace.lessons.find(lesson => lesson.id === lessonDraft.lessonId);
        const hasConflict = targetLesson && targetLesson.version !== lessonDraft.lessonVersion;

        return (
          <div className={styles.modalBackdrop}>
            <BuilderDialog label="Edit Lesson" onClose={closeEditLesson}>
              <h3>Edit Lesson</h3>

              {!targetLesson ? (
                <div role="alert">
                  <p>This lesson was removed remotely while you were editing. Your writing is retained.</p>
                  <div className={styles.modalActions}>
                    <button
                      type="button"
                      className={styles.saveBtn}
                      onClick={async () => {
                        const saved = await dispatchAction({
                          type: 'add_lesson',
                          title: lessonDraft.title.trim() || 'Restored Lesson',
                          objective: lessonDraft.objective.trim(),
                        });
                        if (saved) closeEditLesson();
                      }}
                    >
                      Save as new lesson
                    </button>
                    <button type="button" className={styles.cancelBtn} onClick={closeEditLesson}>
                      Discard edit
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  {hasConflict && (
                    <div role="alert">
                      <p>This lesson changed while you were editing. Your writing is retained.</p>
                      <p>Current objective: {targetLesson.objective}</p>
                      <button
                        type="button"
                        onClick={() => {
                          updateLessonDraft({
                            title: lessonDraft.title === lessonDraft.baseTitle ? targetLesson.title : lessonDraft.title,
                            objective: lessonDraft.objective === lessonDraft.baseObjective ? targetLesson.objective : lessonDraft.objective,
                            baseTitle: targetLesson.title,
                            baseObjective: targetLesson.objective,
                            lessonVersion: targetLesson.version,
                            conflictDetected: false,
                          });
                        }}
                      >
                        Use current version and keep my edit
                      </button>
                    </div>
                  )}

                  <div className={styles.formField}>
                    <label>Title {targetLesson.pinned && '(Locked: unpin to edit)'}</label>
                    <input
                      aria-label="Lesson title"
                      type="text"
                      disabled={targetLesson.pinned}
                      value={lessonDraft.title}
                      onChange={e => updateLessonDraft({ title: e.target.value })}
                    />
                  </div>

                  <div className={styles.formField}>
                    <label>Learning Objective</label>
                    <textarea
                      aria-label="Learning objective"
                      rows={4}
                      value={lessonDraft.objective}
                      onChange={e => updateLessonDraft({ objective: e.target.value })}
                    />
                  </div>

                  <div className={styles.modalActions}>
                    <button type="button" className={styles.cancelBtn} onClick={closeEditLesson}>
                      Cancel
                    </button>
                    <button type="button" className={styles.saveBtn} onClick={() => void handleSaveEditLesson()}>
                      Update Lesson
                    </button>
                  </div>
                </>
              )}
            </BuilderDialog>
          </div>
        );
      })()}

      {/* Add Lesson Modal */}
      {newLessonDraft.isOpen && (
        <div className={styles.modalBackdrop}>
          <BuilderDialog label="Add New Lesson" onClose={closeAddLesson}>
            <h3>Add New Lesson</h3>

            <div className={styles.formField}>
              <label>Title</label>
              <input
                aria-label="New lesson title"
                type="text"
                placeholder="e.g. Asynchronous Job Queues"
                value={newLessonDraft.title}
                onChange={e => updateNewLessonDraft({ title: e.target.value })}
              />
            </div>

            <div className={styles.formField}>
              <label>Learning Objective</label>
              <textarea
                aria-label="New lesson objective"
                rows={4}
                placeholder="What will the learner master in this lesson?"
                value={newLessonDraft.objective}
                onChange={e => updateNewLessonDraft({ objective: e.target.value })}
              />
            </div>

            <div className={styles.modalActions}>
              <button type="button" className={styles.cancelBtn} onClick={closeAddLesson}>
                Cancel
              </button>
              <button type="button" className={styles.saveBtn} onClick={() => void handleSaveAddLesson()}>
                Create Lesson
              </button>
            </div>
          </BuilderDialog>
        </div>
      )}
    </section>
  );
}
