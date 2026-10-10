'use client';
import { useEffect, useState } from 'react';
import type { useCreation } from '../hooks/useCreation';
import { loadReview, type ReviewResponse } from '../services/reviewApi';
import type { GeneratedCurriculum } from '@/src/shared/cohort-creation/artifacts';
import type { ReviewWorkspace as ReviewState } from '@/src/shared/cohort-creation/review';

type Creation = ReturnType<typeof useCreation>;
type Lesson = GeneratedCurriculum['seasons'][number]['lessons'][number];
function MetadataEditor({ review, disabled, save }: { review: ReviewState; disabled: boolean; save: Creation['editReview'] }) {
  type Fields = Pick<ReviewState, 'title' | 'description' | 'visibility' | 'chatEnabled' | 'eventsEnabled'>;
  const [local, setLocal] = useState<Fields | null>(null); const [pending, setPending] = useState(false);
  const fields: Fields = local ?? { title: review.title, description: review.description, visibility: review.visibility,
    chatEnabled: review.chatEnabled, eventsEnabled: review.eventsEnabled };
  const dirty = local !== null;
  const change = (patch: Partial<Fields>) => setLocal({ ...fields, ...patch });
  return <form onSubmit={async event => { event.preventDefault(); if (pending || disabled) return; setPending(true);
    try { if (await save(fields)) setLocal(null); } finally { setPending(false); }
  }}>
    <label>Cohort title<input value={fields.title} onChange={event => change({ title: event.target.value })} required maxLength={300} /></label>
    <label>Description<textarea value={fields.description} onChange={event => change({ description: event.target.value })} required maxLength={2000} /></label>
    <label>Visibility<select value={fields.visibility} onChange={event => change({ visibility: event.target.value === 'PUBLIC' ? 'PUBLIC' : 'PRIVATE' })}><option value="PRIVATE">Private</option><option value="PUBLIC">Public</option></select></label>
    <label><input type="checkbox" checked={fields.chatEnabled} onChange={event => change({ chatEnabled: event.target.checked })} />Enable cohort chat</label>
    <label><input type="checkbox" checked={fields.eventsEnabled} onChange={event => change({ eventsEnabled: event.target.checked })} />Enable cohort events</label>
    <button disabled={disabled || pending || !dirty}>Save cohort details</button>{dirty && <span> Unsaved edits</span>}
  </form>;
}
function LessonEditor({ lesson, disabled, save }: { lesson: Lesson; disabled: boolean; save: (id: string, title: string, objectives: string[]) => Promise<boolean> }) {
  const [local, setLocal] = useState<{ title: string; objectives: string } | null>(null); const [pending, setPending] = useState(false);
  const title = local?.title ?? lesson.title.value; const objectives = local?.objectives ?? lesson.objectives.value.join('\n'); const dirty = local !== null;
  return <form onSubmit={async event => {
    event.preventDefault(); if (pending || disabled) return; setPending(true);
    try { if (await save(lesson.id, title, objectives.split('\n').map(item => item.trim()).filter(Boolean))) setLocal(null); }
    finally { setPending(false); }
  }}>
    <label>Lesson title<input value={title} maxLength={300} required onChange={event => setLocal({ title: event.target.value, objectives })} /></label>
    <label>Learning objectives (one per line)<textarea value={objectives} required onChange={event => setLocal({ title, objectives: event.target.value })} /></label>
    <p>{lesson.type === 'VIDEO' ? 'Video' : 'Reading'} · {lesson.chunkIds.length} retained chunks · {Math.ceil(lesson.durationSeconds / 60)} estimated minutes</p>
    <button disabled={disabled || pending || !dirty}>Save lesson edits</button>{dirty && <span> Unsaved edits</span>}
  </form>;
}

export function ReviewWorkspace({ creation }: { creation: Creation }) {
  const { snapshot } = creation; const review = snapshot.review!;
  const [loaded, setLoaded] = useState<ReviewResponse | null>(null); const [error, setError] = useState<string | null>(null);
  const [reload, setReload] = useState(0); const [prompt, setPrompt] = useState(''); const [pending, setPending] = useState(false);
  const running = snapshot.status === 'running'; const disabled = running || pending || !creation.saved;
  useEffect(() => {
    const controller = new AbortController();
    void loadReview(snapshot.draftId, controller.signal).then(value => { if (!controller.signal.aborted) { setLoaded(value); setError(null); } })
      .catch(reason => { if (!controller.signal.aborted) setError(reason instanceof Error ? reason.message : 'Review unavailable.'); });
    return () => controller.abort();
  }, [snapshot.draftId, snapshot.revision, reload]);
  const act = async (action: () => Promise<boolean>) => { if (pending) return false; setPending(true); try { return await action(); } finally { setPending(false); } };
  return <section aria-label="Review curriculum">
    <h2>Review your cohort</h2>
    <p>Edits are saved to your account. Source content and provenance remain attached to every lesson.</p>
    {error && <p role="alert">{error} <button onClick={() => setReload(value => value + 1)}>Reload review</button></p>}
    <MetadataEditor review={review} disabled={disabled} save={creation.editReview} />
    {!!review.orphanedLessonIds.length && <div role="alert"><p>Some saved lesson edits no longer match this build. They remain saved until you explicitly discard them.</p>
      <button disabled={disabled} onClick={() => void act(() => creation.discardOrphanedEdits(review.orphanedLessonIds))}>Discard unmatched lesson edits</button></div>}
    {!loaded ? <p role="status">Loading retained curriculum…</p> : <>
      {!!loaded.curriculum.warnings.length && <ul>{loaded.curriculum.warnings.map((warning, index) => <li key={index}>{warning}</li>)}</ul>}
      {loaded.curriculum.seasons.map(season => <section key={season.id}><h3>{season.title.value}</h3>
        {season.lessons.map(lesson => <LessonEditor key={lesson.id} lesson={lesson} disabled={disabled}
          save={(lessonId, title, objectives) => act(() => creation.editLesson(lessonId, { title, objectives }))} />)}</section>)}
    </>}
    <aside aria-label="Refine curriculum">
      <h3>Refine with AI</h3><p>Ask for clearer titles or learning objectives. Suggestions require your review before they change the cohort.</p>
      {loaded && <ol>{[...loaded.conversation.entries].reverse().map(entry => <li key={entry.id}><strong>{entry.role === 'user' ? 'You' : 'Assistant'}:</strong> {entry.message}</li>)}</ol>}
      {loaded?.conversation.nextBefore && <button disabled={disabled} onClick={() => void loadReview(snapshot.draftId, undefined, loaded.conversation.nextBefore!).then(page => {
        setLoaded(current => current ? { ...current, conversation: { entries: [...current.conversation.entries, ...page.conversation.entries], nextBefore: page.conversation.nextBefore } } : page);
      }).catch(() => setError('Older conversation could not be loaded.'))}>Load older conversation</button>}
      <form onSubmit={event => { event.preventDefault(); void act(async () => { const sent = await creation.requestRefinement(prompt); if (sent) setPrompt(''); return sent; }); }}>
        <label>Refinement request<textarea value={prompt} onChange={event => setPrompt(event.target.value)} maxLength={2000} required /></label>
        <button disabled={disabled}>Suggest changes</button>
      </form>
      {running && <div role="status"><p>Preparing a bounded refinement proposal. You can return later.</p><button onClick={creation.cancel}>Cancel refinement</button></div>}
      {snapshot.error && <p role="alert">{snapshot.error.message}</p>}
      {review.proposal && <div aria-label="Refinement proposal"><p>{review.proposal.result.message}</p>
        <ul>{review.proposal.result.changes.map((change, index) => <li key={index}>{change.type}: {Array.isArray(change.value) ? change.value.join('; ') : change.value}</li>)}</ul>
        <button disabled={disabled} onClick={() => void act(() => creation.applyRefinement(review.proposal!.requestId))}>Apply proposal</button>
        <button disabled={disabled} onClick={() => void act(() => creation.discardRefinement(review.proposal!.requestId))}>Discard proposal</button>
      </div>}
    </aside>
    <p>Activation and publication will be available after delivery validation is connected.</p>
  </section>;
}
