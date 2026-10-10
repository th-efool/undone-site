'use client';
import Link from 'next/link';
import type { useCreation } from '../hooks/useCreation';

export function PublicationStatus({ creation }: { creation: ReturnType<typeof useCreation> }) {
  const { snapshot } = creation; const publication = snapshot.publication;
  if (!publication) return <p role="alert">Publication state is unavailable. Reload this saved draft.</p>;
  const receipt = publication.receipt;
  if (snapshot.stage === 'published' && receipt) return <section aria-label="Cohort activated">
    <h2>{receipt.mode === 'public_publish' ? 'Your cohort is published' : 'Your private cohort is ready'}</h2>
    <p>{receipt.mode === 'public_publish' ? 'Your cohort can be discovered publicly.' : 'Only you and authorized members can access this cohort.'}</p>
    <Link href={`/cohort/${receipt.cohortId}`}>Open cohort</Link>{' '}
    <Link href={`/play?cohort=${receipt.cohortId}`}>Start learning</Link>
    {receipt.mode === 'private_activation' && <><p>You can publish this same cohort when ready.</p>
      <button disabled={!creation.saved || creation.materialPending} onClick={() => void creation.finalize('public_publish')}>Publish this cohort publicly</button></>}
  </section>;
  const checkpoint = publication.checkpoint;
  return <section aria-label="Finalizing cohort"><h2>Finalizing your cohort</h2>
    <p>Validated learning artifacts are prepared before the cohort becomes available. You can safely return to this draft.</p>
    <p role="status">{checkpoint ? `${checkpoint.completed.length} of ${checkpoint.total} lesson artifacts saved` : 'Validating retained content and reserving cohort identity…'}</p>
    {snapshot.status === 'running' ? <button onClick={creation.cancel}>Cancel finalization</button> : <>
      {snapshot.error && <p role="alert">{snapshot.error.message}</p>}
      {snapshot.status === 'canceled' && <p>Finalization was canceled before commitment.</p>}
      <button disabled={!creation.saved || creation.materialPending} onClick={() => void creation.finalize(publication.mode)}>Retry finalization</button>
    </>}
  </section>;
}
