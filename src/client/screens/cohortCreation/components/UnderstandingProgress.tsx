'use client';
import { useRef, useState } from 'react';
import type { CreationSnapshot } from '@/src/shared/cohort-creation/contracts';

export function UnderstandingProgress({ snapshot, disabled, onStart, onCancel, onBack, onChunk }: {
  snapshot: CreationSnapshot; disabled: boolean; onStart: () => Promise<boolean>; onCancel: () => void; onBack: () => Promise<boolean>;
  onChunk?: () => Promise<boolean>;
}) {
  const [pending, setPending] = useState(false); const saving = useRef(false);
  const checkpoint = snapshot.processing?.checkpoint; const running = snapshot.stage === 'processing' && snapshot.status === 'running';
  const start = async () => {
    if (disabled || pending || saving.current || running) return;
    saving.current = true; setPending(true);
    try { await onStart(); } finally { saving.current = false; setPending(false); }
  };
  const ready = !!snapshot.materials.length && snapshot.materials.every(source => source.status === 'ready') && snapshot.extractions.length === snapshot.materials.length;
  return <section aria-label="Understanding material">
    <h2>Understanding</h2>
    {running ? <div role="status">
      <p>{checkpoint ? `${checkpoint.completed.length} of ${checkpoint.total} retained content partitions understood.` : 'Validating retained content; partition total is not known yet.'}</p>
      <p>Work is saved to your account. You can close this page and return.</p>
      <button onClick={onCancel}>Cancel understanding</button>
    </div> : <>
      {snapshot.processing?.complete ? <p role="status">Understanding complete. Retained summaries and concept evidence are saved. Curriculum building is not available yet.</p>
        : snapshot.stage === 'processing' && <p role="status">Understanding {snapshot.status === 'canceled' ? 'canceled' : 'stopped'}. Accepted partitions remain saved.</p>}
      {snapshot.error && snapshot.stage === 'processing' && <p role="alert">{snapshot.error.message}</p>}
      {snapshot.processing && !snapshot.processing.complete && <p>A fresh request starts understanding again. Automatic worker retries reuse saved partitions.</p>}
      <button disabled={disabled || pending || !ready} onClick={start}>{snapshot.processing ? 'Start fresh understanding' : 'Understand selected material'}</button>
      {snapshot.processing?.complete && onChunk && <button disabled={disabled || pending} onClick={() => void onChunk()}>Chunk selected material</button>}
      {!ready && <p>Acquire all selected sources before continuing.</p>}
      {snapshot.stage === 'processing' && <button disabled={disabled || pending} onClick={() => void onBack()}>Back to material</button>}
    </>}
  </section>;
}
