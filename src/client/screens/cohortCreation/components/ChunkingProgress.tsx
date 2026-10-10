'use client';
import { useRef, useState } from 'react';
import type { CreationSnapshot } from '@/src/shared/cohort-creation/contracts';

export function ChunkingProgress({ snapshot, disabled, onStart, onCancel, onBack, onAnalyze }: {
  onAnalyze?: () => Promise<boolean>; snapshot: CreationSnapshot; disabled: boolean; onStart: () => Promise<boolean>; onCancel: () => void; onBack: () => Promise<boolean>;
}) {
  const [pending, setPending] = useState(false); const saving = useRef(false);
  const operation = snapshot.processing?.chunking; const checkpoint = operation?.checkpoint; const running = snapshot.status === 'running';
  const start = async (action = onStart) => {
    if (disabled || saving.current || running) return;
    saving.current = true; setPending(true);
    try { await action(); } finally { saving.current = false; setPending(false); }
  };
  return <section aria-label="Chunking material">
    <h2>Chunking</h2>
    <p>Accepted understanding and source material remain saved.</p>
    {running ? <div role="status">
      <p>{checkpoint ? `${checkpoint.completed.length} of ${checkpoint.total} retained content partitions chunked; ${checkpoint.completed.reduce((sum, item) => sum + item.chunkCount, 0)} chunks saved.`
        : 'Validating retained understanding; partition total is not known yet.'}</p>
      <p>You can close this page and return while work continues.</p>
      <button onClick={onCancel}>Cancel chunking</button>
    </div> : <>
      <p role="status">{operation?.complete ? 'Chunking complete. Grounded chunks are saved.'
        : `Chunking ${snapshot.status === 'canceled' ? 'canceled' : 'stopped'}. Accepted chunk receipts remain saved.`}</p>
      {snapshot.error && <p role="alert">{snapshot.error.message}</p>}
      <p>A fresh chunk request reuses understanding and starts chunking again. Automatic worker retries reuse accepted chunks.</p>
      {operation?.complete && onAnalyze && <button disabled={disabled || pending} onClick={() => void start(onAnalyze)}>Analyze grounded chunks</button>}
      <button disabled={disabled || pending} onClick={() => void start()}>Start fresh chunking</button>
      <button disabled={disabled || pending} onClick={() => void onBack()}>Back to material</button>
    </>}
  </section>;
}
