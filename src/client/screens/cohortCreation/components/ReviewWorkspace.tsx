'use client';
import { ArrowLeft, ArrowRight, Save } from 'lucide-react';
import type { useCreation } from '../hooks/useCreation';
import { useReviewWorkspace } from '../hooks/useReviewWorkspace';
import { CreationShell } from './CreationShell';
import { ReviewConversation } from './ReviewConversation';
import { ReviewPreview } from './ReviewPreview';
import styles from './ReviewWorkspace.module.css';

export function ReviewWorkspace({ creation }: { creation: ReturnType<typeof useCreation> }) {
  const model = useReviewWorkspace(creation);
  return <CreationShell variant="review" query={model.snapshot.result?.intent.rawQuery ?? model.snapshot.query} saved={creation.saved}
    reply={<><p>Perfect.<br />Your material is processed and your learning experience is built.</p><p>Here’s your draft preview. Refine it in natural language, or publish when you’re ready.</p></>}
    hintTitle="You stay in control" hint="Suggestions can change titles, descriptions and learning objectives. Source material and publication decisions stay under your control."
    conversation={<ReviewConversation model={model} onCancel={creation.cancel} />}
    composerLabel="Refinement request" disabled={!model.canRefine}
    onMessage={async message => { if (!await model.requestRefinement(message)) throw new Error('The refinement was not queued. Save local edits and resolve pending proposals before retrying.'); }}
    suggestions={[
      { label: 'Make the description shorter', action: () => void model.requestRefinement('Make the cohort description shorter while preserving its learning goal.') },
      { label: 'Make the title clearer', action: () => void model.requestRefinement('Suggest a clearer cohort title that matches the retained material.') },
      { label: 'Clarify the learning objectives', action: () => void model.requestRefinement('Make the learning objectives clearer without changing the retained sources.') },
    ]}>
    <section className={styles.workspace} aria-label="Review curriculum">
      <header className={styles.toolbar}><button className={styles.back} aria-label="Back to material" disabled={model.disabled || model.dirty} onClick={() => void model.back()}><ArrowLeft size={22} aria-hidden="true" /></button>
        <div><h2>Draft preview</h2><p>This is your cohort draft. Changes are saved when you confirm them.</p></div>
        <div className={styles.toolbarActions}><button disabled={model.disabled || !model.dirty} onClick={() => void model.saveAll()}><Save size={17} aria-hidden="true" />Save draft</button>
          <button className={styles.primary} aria-label="Publish publicly" disabled={!model.canFinalize} onClick={() => void model.finalize('public_publish')}>Publish cohort<ArrowRight size={21} aria-hidden="true" /></button></div>
      </header>
      {creation.message && <p role="alert" className={styles.alert}>{creation.message}</p>}
      {model.actionError && <p role="alert" className={styles.alert}>{model.actionError}</p>}
      {model.error && <p role="alert" className={styles.alert}>{model.error} <button onClick={model.reload}>Reload review</button></p>}
      {model.snapshot.error && <p role="alert" className={styles.alert}>{model.snapshot.error.message}</p>}
      {!!model.review.orphanedLessonIds.length && <div role="alert" className={styles.alert}><p>Some saved lesson edits no longer match this build. They remain saved until you explicitly discard them.</p>
        <button disabled={model.disabled} onClick={() => void model.discardOrphaned()}>Discard unmatched lesson edits</button></div>}
      {!!model.unmatchedLocalIds.length && <section className={styles.alert} aria-label="Unmatched unsaved lesson edits"><h3>Unsaved edits from an earlier build</h3>{model.unmatchedLocalIds.map(id => <div key={id}><p>{model.lessonEdits[id].title}</p><p>{model.lessonEdits[id].objectives}</p><button disabled={model.disabled} onClick={() => model.discardLocalLesson(id)}>Discard unsaved edits for {model.lessonEdits[id].title}</button></div>)}</section>}
      <ReviewPreview model={model} />
    </section>
  </CreationShell>;
}
