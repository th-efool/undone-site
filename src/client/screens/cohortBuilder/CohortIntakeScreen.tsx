'use client';
import { useEffect, useState } from 'react';
import type { CohortIntake } from '@/src/shared/cohort-builder/intake';
import { clearIntakeDraft, readIntakeDraft, saveIntakeDraft } from './intake-draft';

export function CohortIntakeScreen({ ownerId, enabled }: { ownerId: string; enabled: boolean }) {
  const [draft, setDraft] = useState<CohortIntake | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => { const saved = readIntakeDraft(ownerId); setDraft(saved);
    if (saved) saveIntakeDraft(saved, ownerId); }, [ownerId]);
  async function submit() {
    if (!draft || busy) return;
    setBusy(true); setError('');
    try {
      const response = await fetch('/api/cohort-builder/intake', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...draft, expectedOwnerId: ownerId }) });
      const body = await response.json();
      if (!response.ok) throw new Error(body.code);
      // Keep acknowledged identity until navigation succeeds: retry returns the same workspace.
      window.location.assign(`/quest/build/${body.workspaceId}`);
    } catch (error) { setError(error instanceof Error ? error.message : 'INTAKE_UNAVAILABLE'); setBusy(false); }
  }
  return <main style={{ maxWidth: 680, margin: '60px auto', padding: 24 }}>
    <h1>Start your cohort</h1>
    {!enabled ? <div>
      <p role="status">New builder intake is unavailable. Existing workspaces remain accessible.</p>
      {draft && !draft.source && <p><a href="/quest/new?handoff=1">Continue with existing creator</a></p>}
    </div> : draft ? <>
      <p>Confirm this learning goal for your signed-in account.</p><blockquote>{draft.prompt}</blockquote>
      {draft.source && <p>Retained text: {draft.source.label} ({draft.source.text.length} characters)</p>}
      <button disabled={busy} onClick={() => void submit()}>{busy ? 'Saving…' : 'Create cohort'}</button>
      <button disabled={busy} onClick={() => { clearIntakeDraft(); setDraft(null); }}>Discard</button>
    </> : <p>No pending input. <a href="/#explore">Return to landing</a>.</p>}
    {error && <div role="alert">
      <p>Could not save: {error}. Your input is retained; retry when available.</p>
      {draft && !draft.source && <p><a href="/quest/new?handoff=1">Or continue with existing creator</a></p>}
    </div>}
  </main>;
}
