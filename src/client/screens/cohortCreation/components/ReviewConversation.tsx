'use client';
import { CheckCircle2, Circle, Send } from 'lucide-react';
import type { ReviewModel } from '../hooks/useReviewWorkspace';
import styles from './ReviewWorkspace.module.css';

export function ReviewConversation({ model, onCancel }: { model: ReviewModel; onCancel: () => void }) {
  const proposal = model.review.proposal;
  return <div className={styles.conversation} aria-label="Refine curriculum">
    <ol className={styles.checklist}>{['Reading through the material', 'Chunking into meaningful pieces', 'Analyzing each piece', 'Building your learning experience', 'Reviewing and refining'].map((label, index) =>
      <li key={label}>{index < 4 ? <CheckCircle2 size={20} aria-hidden="true" /> : <Circle size={20} aria-hidden="true" />}<span>{label}</span></li>)}</ol>
    {!!model.preview?.conversation.entries.length && <details className={styles.history}><summary>Conversation history</summary>
      <ol>{[...model.preview.conversation.entries].reverse().map(entry => <li key={entry.id}><strong>{entry.role === 'user' ? 'You' : 'Undone'}:</strong> {entry.message}</li>)}</ol>
    </details>}
    {model.preview?.conversation.nextBefore && <button disabled={model.disabled} onClick={() => void model.loadOlder()}>Load older conversation</button>}
    {model.running && <div role="status"><p>Preparing your curriculum refinements right now.</p><button onClick={onCancel}>Cancel refinement</button></div>}
    {proposal && <section aria-label="Refinement proposal" className={styles.proposal}><h3>Suggested changes</h3><p>{proposal.result.message}</p>
      <ul>{proposal.result.changes.map((change, index) => <li key={index}><strong>{change.type.replaceAll('_', ' ')}:</strong> {Array.isArray(change.value) ? change.value.join('; ') : change.value}</li>)}</ul>
      <button disabled={model.disabled || model.dirty || !model.preview || !!model.error || !!model.review.orphanedLessonIds.length || proposal.baseEditRevision !== model.review.editRevision} onClick={() => void model.applyProposal()}>Apply proposal</button>
      <button disabled={model.disabled} onClick={() => void model.discardProposal()}>Discard proposal</button>
    </section>}
    <section className={styles.publishNote} aria-label="Activate cohort"><Send size={26} strokeWidth={1.5} aria-hidden="true" /><div><h3>Ready to publish?</h3>
      <p>Publish for discovery, or activate privately for authorized members.</p>
      <button disabled={!model.canFinalize} onClick={() => void model.finalize('public_publish')}>Publish publicly</button>
      <button className={styles.privateAction} disabled={!model.canFinalize} onClick={() => void model.finalize('private_activation')}>Activate privately</button>
      {model.dirty && <p>Save your edits before finalizing.</p>}
    </div></section>
  </div>;
}
