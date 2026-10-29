'use client';
import { useRef, useState } from 'react';
import type { CreationSnapshot } from '@/src/shared/cohort-creation/contracts';
import { MATERIAL_LIMITS } from '@/src/shared/cohort-creation/materials';
import { GENERATED_GUIDE_LIMITATION } from '@/src/shared/cohort-creation/generated-guide';
import styles from './TextMaterial.module.css';

export function GeneratedGuideOption({ snapshot, disabled, onAuthor, onCancel }: {
  snapshot: CreationSnapshot; disabled: boolean; onAuthor: (materialId?: string) => Promise<boolean>; onCancel: () => void;
}) {
  const [confirmed, setConfirmed] = useState(false); const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null); const submitting = useRef(false);
  if (snapshot.startingPoint !== 'have_goal') return null;
  const existing = snapshot.materials.find(source => source.kind === 'generated_guide' && source.input.kind === 'goal' && source.input.intentId === snapshot.result?.intent.id);
  const running = existing?.status === 'acquiring' && snapshot.status === 'running';
  const capacity = (!existing && snapshot.materials.length >= MATERIAL_LIMITS.sources) || snapshot.materials.filter(source => source.id !== existing?.id)
    .reduce((sum, source) => sum + source.selectedUnitIds.length, 0) >= MATERIAL_LIMITS.selectedUnits;
  const busy = disabled || pending || snapshot.status === 'running';
  const author = async () => {
    if (busy || capacity || !confirmed || submitting.current || existing?.status === 'ready') return;
    submitting.current = true; setPending(true); setError(null);
    try { if (!await onAuthor(existing?.id)) setError('Guide request was not acknowledged. Check the saved draft before retrying.'); }
    catch { setError('Guide generation could not be queued. Your goal remains saved. Check the draft before retrying.'); }
    finally { submitting.current = false; setPending(false); }
  };
  return <section aria-label="AI-authored guide option" className={styles.material}>
    <h2>Or create an AI-authored guide</h2>
    <p>{GENERATED_GUIDE_LIMITATION} This is a separate choice from finding real sources; it does not silently replace them.</p>
    <p>A bounded introductory guide will be saved and used as your learning material. You can review and edit the resulting curriculum before activation.</p>
    {existing?.status === 'ready' ? <p role="status">AI-authored guide saved. Continue below to understand the retained guide.</p> : <>
      <label><input type="checkbox" checked={confirmed} disabled={busy} onChange={event => setConfirmed(event.target.checked)} />
        Use AI-authored material for my saved goal</label>
      <button type="button" disabled={busy || capacity || !confirmed} onClick={author}>{existing ? 'Retry AI-authored guide' : 'Create AI-authored guide'}</button>
    </>}
    {capacity && <p role="status">Remove a source or reduce selected units before creating a guide.</p>}
    {pending && <p role="status">Saving your guide request…</p>}
    {running && <div role="status"><p>Authoring and retaining your structured learning guide right now.</p><button type="button" onClick={onCancel}>Cancel guide generation</button></div>}
    {existing?.status === 'failed' && snapshot.error && <p role="alert">{snapshot.error.message}</p>}
    {error && <p role="alert">{error}</p>}
  </section>;
}
