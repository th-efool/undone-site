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
} from 'lucide-react';
import { useWorkspaceView, useDispatchAction } from '@/src/client/interaction/hooks';
import { cohortWorkspaceSchema, type CohortWorkspace, type CohortAction, type CohortLesson } from '@/src/shared/cohort-builder/contracts';
import type { EntityRef } from 'interaction-builder/core';
import styles from './CohortBuilder.module.css';
import { BuilderDialog } from './BuilderDialog';
import { ExternalSources, ExternalSourceScope } from './ExternalSources';
import { formatYoutubeTimestamp } from '@/src/shared/cohort-builder/youtube-transcript';

interface CohortWorkspacePaneProps {
  onSelectLessonForChat: (attached: { entity: EntityRef; label: string }) => void;
}

export function CohortWorkspacePane({ onSelectLessonForChat }: CohortWorkspacePaneProps) {
  const rawWorkspace = useWorkspaceView<CohortWorkspace>();
  const workspace = rawWorkspace ? cohortWorkspaceSchema.parse(rawWorkspace) : null;
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

  return (
    <main className={styles.rightPane} aria-label="Cohort Curriculum Workspace">
      {/* Hero / Overview Card */}
      <section className={styles.heroCard}>
        <div className={styles.heroHeader}>
          <div>
            <h1 className={styles.heroTitle}>{workspace.title || 'Cohort Blueprint'}</h1>
          </div>
          <button className={styles.editActionBtn} onClick={handleOpenOverview}>
            <Edit3 size={14} /> Edit details
          </button>
        </div>

        <p className={styles.intentText}>{workspace.intent}</p>

        <div className={styles.metaGrid}>
          <div className={styles.metaItem}>
            <Users size={16} color="#5a50bf" />
            <span>Audience: <strong>{workspace.audience}</strong></span>
          </div>
          <div className={styles.metaItem}>
            <Clock size={16} color="#5a50bf" />
            <span>Pace: <strong>{workspace.dailyMinutes} mins/day</strong></span>
          </div>
        </div>
      </section>

      <section id="builder-sources" className={styles.heroCard} aria-label="Grounded source text">
        <div className={styles.sectionHeader}>
          <h3>Source text</h3>
          <small>{workspace.processing.status}{workspace.processing.status === 'queued' ? ` · ${workspace.processing.stage} waiting for worker` : ''}</small>
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
        {editingSourceId && workspace.sources.find(source => source.id === editingSourceId)?.version !== editingSourceVersion && <div role="alert">
          <p>This source changed or was removed. Your text is retained.</p>
          {workspace.sources.some(source => source.id === editingSourceId) && <><details><summary>Compare current source</summary><p>{workspace.sources.find(source => source.id === editingSourceId)?.text}</p></details>
            <button onClick={() => {
              const current = workspace.sources.find(source => source.id === editingSourceId)!;
              setSourceForm({ label: sourceForm.label === sourceBase.label ? current.label : sourceForm.label,
                text: sourceForm.text === sourceBase.text ? current.text : sourceForm.text });
              setSourceBase({ label: current.label, text: current.text }); setEditingSourceVersion(current.version);
            }}>Use current source version and keep my edit</button></>}
        </div>}
        {workspace.processing.error && <p role="alert">{workspace.processing.error}</p>}
        {workspace.processing.status === 'failed' && !workspace.processing.jobs?.length && <button className={styles.editActionBtn} onClick={() => void dispatchAction({ type: 'retry_processing' })}>Retry processing</button>}
        {workspace.sources.length > 0 && workspace.processing.status === 'ready' && <button className={styles.editActionBtn} onClick={() => void dispatchAction({ type: 'retry_processing' })}>Rebuild from sources</button>}
        {workspace.sources.map(source => <div key={source.id} className={styles.intentText}>{source.label} · {source.input?.kind??'text'} · {source.state} {!source.input && <button className={styles.editActionBtn} onClick={() => { setEditingSourceId(source.id); setEditingSourceVersion(source.version); setSourceForm({ label: source.label, text: source.text }); setSourceBase({ label: source.label, text: source.text }); }}>Edit</button>} <ExternalSourceScope source={source}/> <button className={styles.editActionBtn} onClick={() => void dispatchAction({ type: 'remove_source', sourceId: source.id }, [{ kind: 'source', id: source.id, version: source.version }])}>Remove</button></div>)}
        {workspace.processing.jobs?.length ? <section aria-label="Source processing jobs" aria-live="polite">
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
              {lesson.evidenceStatus === 'orphaned' && <p role="alert" className={styles.intentText}>This retained lesson references changed or removed source text. Review its evidence before relying on it.</p>}
              {lesson.sourceChunkIds.length > 0 && (
                <p className={styles.intentText}>Grounded in {lesson.sourceChunkIds.map(chunkId => {
                  const chunk = workspace.chunks.find(item => item.id === chunkId);
                  return chunk ? `“${chunk.text.slice(0, 160)}”` : 'unavailable retained passage';
                }).join(' ')}</p>
              )}
              {lesson.sourceChunkIds.length > 0 && <details><summary>Inspect evidence</summary>
                {lesson.sourceChunkIds.map(chunkId => {
                  const chunk = workspace.chunks.find(item => item.id === chunkId);
                  const source = workspace.sources.find(item => item.id === chunk?.sourceId);
                  const pages=source?.locations?.filter(location=>location.page && location.start< (chunk?.end??0) && location.end>(chunk?.start??0)).map(location=>location.page);
                  const timeLoc=source?.locations?.filter(location=>location.startMs!==undefined && location.endMs!==undefined && location.start<(chunk?.end??0) && location.end>(chunk?.start??0));
                  const timestamps=timeLoc?.length?` · timestamp ${formatYoutubeTimestamp(Math.min(...timeLoc.map(l=>l.startMs!)))}–${formatYoutubeTimestamp(Math.max(...timeLoc.map(l=>l.endMs!)))}`:'';
                  return <blockquote key={chunkId}>{chunk ? <><cite>{source?.label ?? 'Retained source'} · version {chunk.sourceVersion}{pages?.length?` · physical page ${pages.join(', ')}`:''}{timestamps} · characters {chunk.start}–{chunk.end}{source?.provenance?` · ${source.provenance.scope} · ${source.provenance.parserVersion}`:''}</cite>{source?.provenance?.finalUrl && <p>{source.provenance.finalUrl}</p>}<p>{chunk.text}</p></> : 'Retained passage unavailable; review orphan warning.'}</blockquote>;
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
