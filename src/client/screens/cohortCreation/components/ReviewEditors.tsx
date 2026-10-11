'use client';
import type { ReviewLesson, ReviewModel } from '../hooks/useReviewWorkspace';
import styles from './ReviewWorkspace.module.css';

export function MetadataEditor({ model }: { model: ReviewModel }) {
  const fields = model.fields;
  return <form className={styles.editor} onSubmit={event => { event.preventDefault(); void model.saveMetadata(); }}>
    <fieldset disabled={model.disabled}><legend>Edit cohort details</legend>
      <label>Cohort title<input value={fields.title} onChange={event => model.changeMetadata({ title: event.target.value })} required maxLength={300} /></label>
      <label>Description<textarea value={fields.description} onChange={event => model.changeMetadata({ description: event.target.value })} required maxLength={2000} rows={3} /></label>
      <label>Visibility<select value={fields.visibility} onChange={event => model.changeMetadata({ visibility: event.target.value === 'PUBLIC' ? 'PUBLIC' : 'PRIVATE' })}><option value="PRIVATE">Private</option><option value="PUBLIC">Public</option></select></label>
      <p>Visibility is saved as a draft preference. Public publishing remains an explicit action.</p>
      <label className={styles.check}><input type="checkbox" checked={fields.chatEnabled} onChange={event => model.changeMetadata({ chatEnabled: event.target.checked })} />Enable cohort chat</label>
      <label className={styles.check}><input type="checkbox" checked={fields.eventsEnabled} onChange={event => model.changeMetadata({ eventsEnabled: event.target.checked })} />Enable cohort events</label>
      <button disabled={!model.metadataDirty}>Save cohort details</button>{model.metadataDirty && <span className={styles.unsaved}> Unsaved edits</span>}
    </fieldset>
  </form>;
}

export function LessonEditor({ lesson, model }: { lesson: ReviewLesson; model: ReviewModel }) {
  const local = model.lessonEdits[lesson.id]; const title = local?.title ?? lesson.title.value;
  const objectives = local?.objectives ?? lesson.objectives.value.join('\n');
  return <form className={styles.editor} onSubmit={event => { event.preventDefault(); void model.saveLesson(lesson.id); }}>
    <fieldset disabled={model.disabled}><legend className={styles.srOnly}>Edit {lesson.title.value}</legend>
      <label>Lesson title<input value={title} maxLength={300} required onChange={event => model.changeLesson(lesson.id, { title: event.target.value, objectives })} /></label>
      <label>Learning objectives (one per line)<textarea value={objectives} required rows={3} onChange={event => model.changeLesson(lesson.id, { title, objectives: event.target.value })} /></label>
      <p>{lesson.type === 'VIDEO' ? 'Video' : lesson.type === 'ASSIGNMENT' ? 'Assignment' : 'Reading'} · {lesson.chunkIds.length} retained chunks · {Math.ceil(lesson.durationSeconds / 60)} estimated minutes</p>
      <button disabled={!local}>Save lesson edits</button>{local && <span className={styles.unsaved}> Unsaved edits</span>}
    </fieldset>
  </form>;
}
