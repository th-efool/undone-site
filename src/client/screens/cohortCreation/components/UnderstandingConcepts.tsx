'use client';
import { useEffect, useState } from 'react';
import { Brain, Lightbulb } from 'lucide-react';
import type { CreationSnapshot } from '@/src/shared/cohort-creation/contracts';
import type { UnderstandingPreview } from '@/src/shared/cohort-creation/processing';
import { loadUnderstandingPreview } from '../services/understandingApi';
import styles from './UnderstandingProgress.module.css';

export function UnderstandingConcepts({ snapshot }: { snapshot: CreationSnapshot }) {
  const [loaded, setLoaded] = useState<UnderstandingPreview | null>(null);
  const [error, setError] = useState<{ revision: number; message: string } | null>(null); const [retry, setRetry] = useState(0);
  const count = snapshot.processing?.checkpoint?.completed.length ?? 0;
  useEffect(() => {
    if (!count) return;
    const controller = new AbortController();
    void loadUnderstandingPreview(snapshot.draftId, controller.signal).then(value => {
      if (!controller.signal.aborted) { setLoaded(value); setError(null); }
    }).catch(reason => { if (!controller.signal.aborted) setError({ revision: snapshot.revision, message: reason instanceof Error ? reason.message : 'Concepts unavailable.' }); });
    return () => controller.abort();
  }, [snapshot.draftId, snapshot.revision, count, retry]);
  const partitions = loaded?.revision === snapshot.revision ? loaded.partitions : [];
  const concepts = partitions.flatMap(partition => partition.proposal.concepts.map((concept, index) => ({ ...concept,
    key: `${partition.partitionId}:${index}`, materialId: partition.materialId })));
  return <aside id="creation-accepted-concepts" className={styles.concepts} aria-label="Accepted concepts">
    <header><Brain size={46} strokeWidth={1.5} aria-hidden="true" /><div><h2>Finding key ideas…</h2><p>Identifying the main topics, concepts,<br />and how they appear throughout the material.</p></div></header>
    <span className={styles.paperNote} aria-hidden="true">Important ideas,<br />grounded in<br />your material.</span>
    {error?.revision === snapshot.revision ? <p role="alert">{error.message} <button onClick={() => setRetry(value => value + 1)}>Reload concepts</button></p> : !concepts.length ?
      <p className={styles.empty} role="status">{count ? 'Loading accepted concepts…' : 'Concepts appear after a retained content partition is understood.'}</p> :
      <ul className={styles.conceptCloud}>{concepts.map(concept => <li key={concept.key}><details><summary>{concept.label}</summary>
        <p>{concept.summary}</p><small>Source {snapshot.materials.findIndex(source => source.id === concept.materialId) + 1} · {concept.segmentIds.length} cited segments</small>
      </details></li>)}</ul>}
    {!!partitions.length && <details className={styles.limitations}><summary>Source summaries and limitations</summary>
      {partitions.map(partition => <div key={partition.partitionId}><p>{partition.proposal.summary}</p><ul>{partition.proposal.limitations.map((item, index) => <li key={index}>{item}</li>)}</ul></div>)}
    </details>}
    <div className={styles.insight}><Lightbulb size={28} aria-hidden="true" /><p><strong>{loaded?.revision === snapshot.revision ? `${concepts.length} accepted concept ${concepts.length === 1 ? 'entry' : 'entries'} loaded.` : 'Waiting for accepted concept preview.'}</strong><span>Entries retain source evidence; repeated ideas may appear across partitions.</span></p></div>
  </aside>;
}
