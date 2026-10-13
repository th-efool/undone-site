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
import type { CohortWorkspace, CohortAction, CohortLesson } from '@/src/shared/cohort-builder/contracts';
import type { EntityRef } from 'interaction-builder/core';
import styles from './CohortBuilder.module.css';

interface CohortWorkspacePaneProps {
  onSelectLessonForChat: (attached: { entity: EntityRef; label: string }) => void;
}

export function CohortWorkspacePane({ onSelectLessonForChat }: CohortWorkspacePaneProps) {
  const workspace = useWorkspaceView<CohortWorkspace>();
  const dispatchAction = useDispatchAction<CohortAction>();

  // Modals state
  const [editingOverview, setEditingOverview] = useState(false);
  const [overviewForm, setOverviewForm] = useState({
    intent: workspace?.intent ?? '',
    audience: workspace?.audience ?? '',
    dailyMinutes: workspace?.dailyMinutes ?? 20,
  });

  const [editingLesson, setEditingLesson] = useState<CohortLesson | null>(null);
  const [lessonForm, setLessonForm] = useState({ title: '', objective: '' });

  const [addingLesson, setAddingLesson] = useState(false);
  const [newLessonForm, setNewLessonForm] = useState({ title: '', objective: '' });

  if (!workspace) {
    return <div className={styles.rightPane}>Loading workspace state...</div>;
  }

  // --- Handlers ---
  const handleOpenOverview = () => {
    setOverviewForm({
      intent: workspace.intent,
      audience: workspace.audience,
      dailyMinutes: workspace.dailyMinutes,
    });
    setEditingOverview(true);
  };

  const handleSaveOverview = async () => {
    if (overviewForm.intent !== workspace.intent) {
      await dispatchAction({ type: 'set_intent', intent: overviewForm.intent });
    }
    if (overviewForm.audience !== workspace.audience) {
      await dispatchAction({ type: 'set_audience', audience: overviewForm.audience });
    }
    if (overviewForm.dailyMinutes !== workspace.dailyMinutes) {
      await dispatchAction({ type: 'set_daily_minutes', dailyMinutes: overviewForm.dailyMinutes });
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
    await dispatchAction(
      {
        type: 'edit_lesson',
        lessonId: editingLesson.id,
        title: lessonForm.title,
        objective: lessonForm.objective,
      },
      [{ kind: 'lesson', id: editingLesson.id, version: editingLesson.version }]
    );
    setEditingLesson(null);
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
    await dispatchAction({
      type: 'add_lesson',
      title: newLessonForm.title.trim(),
      objective: newLessonForm.objective.trim(),
    });
    setNewLessonForm({ title: '', objective: '' });
    setAddingLesson(false);
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

      {/* Curriculum Outline */}
      <div className={styles.sectionHeader}>
        <h3>Curriculum Outline ({workspace.lessons.length} lessons)</h3>
        <button className={styles.addLessonBtn} onClick={() => setAddingLesson(true)}>
          <Plus size={15} /> Add Lesson
        </button>
      </div>

      <div className={styles.lessonsList}>
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
          <div className={styles.modalCard}>
            <h3>Edit Cohort Overview</h3>

            <div className={styles.formField}>
              <label>Learning Intent</label>
              <textarea
                rows={3}
                value={overviewForm.intent}
                onChange={e => setOverviewForm({ ...overviewForm, intent: e.target.value })}
              />
            </div>

            <div className={styles.formField}>
              <label>Target Audience</label>
              <input
                type="text"
                value={overviewForm.audience}
                onChange={e => setOverviewForm({ ...overviewForm, audience: e.target.value })}
              />
            </div>

            <div className={styles.formField}>
              <label>Daily Minutes</label>
              <input
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
          </div>
        </div>
      )}

      {/* Edit Lesson Modal */}
      {editingLesson && (
        <div className={styles.modalBackdrop}>
          <div className={styles.modalCard}>
            <h3>Edit Lesson</h3>

            <div className={styles.formField}>
              <label>Title {editingLesson.pinned && '(Locked: unpin to edit)'}</label>
              <input
                type="text"
                disabled={editingLesson.pinned}
                value={lessonForm.title}
                onChange={e => setLessonForm({ ...lessonForm, title: e.target.value })}
              />
            </div>

            <div className={styles.formField}>
              <label>Learning Objective</label>
              <textarea
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
          </div>
        </div>
      )}

      {/* Add Lesson Modal */}
      {addingLesson && (
        <div className={styles.modalBackdrop}>
          <div className={styles.modalCard}>
            <h3>Add New Lesson</h3>

            <div className={styles.formField}>
              <label>Title</label>
              <input
                type="text"
                placeholder="e.g. Asynchronous Job Queues"
                value={newLessonForm.title}
                onChange={e => setNewLessonForm({ ...newLessonForm, title: e.target.value })}
              />
            </div>

            <div className={styles.formField}>
              <label>Learning Objective</label>
              <textarea
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
          </div>
        </div>
      )}
    </main>
  );
}
