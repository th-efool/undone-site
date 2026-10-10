'use client';
import { useRef, useState } from 'react';
import type { CreationSnapshot } from '@/src/shared/cohort-creation/contracts';
import type { DiscoveryCandidate } from '@/src/shared/cohort-creation/discovery';
import type { GithubSelection } from '@/src/shared/cohort-creation/github';
import { GithubMaterial } from './GithubMaterial';
import styles from '../CreationExperience.module.css';

export function DiscoveryMaterials({ snapshot, disabled, onFind, onAcquire, onGithub, onCancel }: {
  snapshot: CreationSnapshot; disabled: boolean; onFind: () => Promise<boolean>;
  onAcquire: (candidate: DiscoveryCandidate) => Promise<boolean>; onGithub: (selection: GithubSelection) => Promise<boolean>; onCancel: () => void;
}) {
  const [pending, setPending] = useState(false); const saving = useRef(false);
  const [github, setGithub] = useState<DiscoveryCandidate | null>(null); const [error, setError] = useState<string | null>(null);
  const discovery = snapshot.discovery; const result = discovery?.result;
  const running = snapshot.status === 'running' && snapshot.activeRequestId === discovery?.requestId;
  const busy = disabled || pending || snapshot.status === 'running';
  const find = async () => {
    if (busy || saving.current) return; saving.current = true; setPending(true); setError(null); setGithub(null);
    try { await onFind(); } catch { setError('Source search could not be queued. Your goal is still saved.'); }
    finally { saving.current = false; setPending(false); }
  };
  const choose = async (event: React.MouseEvent<HTMLButtonElement>) => {
    if (busy || saving.current) return;
    const candidate = result?.candidates.find(item => item.key === event.currentTarget.dataset.candidate);
    if (!candidate) return;
    if (candidate.kind === 'github') { setGithub(candidate); return; }
    saving.current = true; setPending(true); setError(null);
    try { await onAcquire(candidate); } catch { setError('This source could not be queued. Select it again to retry.'); }
    finally { saving.current = false; setPending(false); }
  };
  return <section aria-label="Discover learning material" className={styles.material}>
    <h2>{snapshot.startingPoint === 'have_goal' ? 'Find sources for your goal' : 'Find learning material'}</h2>
    <p>Search uses your saved learning intent. Review observed sources before acquiring their content.</p>
    <button disabled={busy} onClick={find}>{discovery ? 'Search again' : 'Find sources'}</button>
    {pending && <p role="status">Saving your request…</p>}
    {running && <div role="status">
      <p>{discovery?.checkpoint ? `Observed or accounted for ${discovery.checkpoint.processed} of ${discovery.checkpoint.total} cited resources.` : 'Searching for grounded sources; the citation total is not known yet.'}</p>
      <p>You can return later; this work is saved.</p><button onClick={onCancel}>Cancel discovery</button>
    </div>}
    {snapshot.error && !snapshot.materials.some(source => source.status === 'failed') && <p role="alert">{snapshot.error.message}</p>}
    {error && <p role="alert">{error}</p>}
    {discovery?.checkpoint && <iframe title="Google Search attribution" sandbox="allow-popups" referrerPolicy="no-referrer"
      src={`/api/cohort-creation/drafts/${snapshot.draftId}/discovery-attribution?search=${discovery.checkpoint.searchArtifact.id}`} />}
    {result && <>
      {!result.candidates.length && <p>No usable public sources were observed. Search again or choose “I already have material” to provide your own.</p>}
      <ul>{result.candidates.map((candidate, index) => <li key={candidate.key}>
        <h3>{candidate.title}</h3><p>{candidate.url}</p>
        <p>{result.selection.selected.find(item => item.candidateKey === candidate.key)?.reason ?? 'Public source metadata observed; review before choosing.'}</p>
        <button disabled={busy || snapshot.materials.some(source => source.discoveredFrom?.candidateKey === candidate.key)}
          data-candidate={candidate.key} onClick={choose}>Acquire source {index + 1}</button>
      </li>)}</ul>
      {!!result.failures.length && <div><h3>Sources that could not be inspected</h3><ul>{result.failures.map(failure => <li key={failure.citationId}>{failure.message}</li>)}</ul></div>}
      <p>Discovery checked metadata. A source becomes ready only after actual content acquisition succeeds.</p>
    </>}
    {github && <GithubMaterial key={github.key} disabled={busy} initialUrl={github.url} onAcquire={async selection => {
      const saved = await onGithub(selection); if (saved) setGithub(null); return saved;
    }} />}
  </section>;
}
