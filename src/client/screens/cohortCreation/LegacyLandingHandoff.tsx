'use client';
import { useEffect, useState } from 'react';
import type { CohortIntake } from '@/src/shared/cohort-builder/intake';
import { readIntakeDraft, saveIntakeDraft } from '@/src/client/screens/cohortBuilder/intake-draft';
import { CreationExperience } from './CreationExperience';

/** Private browser handoff into the unchanged v1 writer. */
export function LegacyLandingHandoff({ ownerId }: { ownerId: string }) {
  const [draft, setDraft] = useState<CohortIntake | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  useEffect(() => { const saved = readIntakeDraft(ownerId); setDraft(saved); if (saved) saveIntakeDraft(saved, ownerId); }, [ownerId]);
  if (confirmed && draft && !draft.source) return <CreationExperience draftId={draft.requestId} initialQuery={draft.prompt} />;
  return <main style={{ maxWidth:680, margin:'60px auto', padding:24 }}><h1>Continue your learning journey</h1>
    {draft && !draft.source ? <><p>Confirm this learning goal for your signed-in account.</p><blockquote>{draft.prompt}</blockquote>
      <button onClick={() => setConfirmed(true)}>Continue with existing creator</button></>
      : <p>No compatible pending input. <a href="/#explore">Return to landing</a>.</p>}
  </main>;
}
