'use client';
import { useRef, useState } from 'react';
import type { CreationSnapshot } from '@/src/shared/cohort-creation/contracts';

export function BuildingProgress({ snapshot, disabled, onStart, onCancel, onBack }: {
  snapshot: CreationSnapshot; disabled: boolean; onStart: () => Promise<boolean>; onCancel: () => void; onBack: () => Promise<boolean>;
}) {
  const [pending, setPending] = useState(false); const saving = useRef(false);
  const operation = snapshot.processing?.building; const checkpoint = operation?.checkpoint; const running = snapshot.status === 'running';
  const start = async (action = onStart) => {
    if (disabled || saving.current || running) return;
    saving.current = true; setPending(true);
    try { await action(); } finally { saving.current = false; setPending(false); }
  };
  return <section aria-label="Building material">
    <h2>Building</h2>
    <p>Accepted analysis, chunks and source material remain saved.</p>
    {running ? <div role="status">
      <p>{checkpoint ? `${checkpoint.completed.length} of ${checkpoint.total} retained content partitions built; ${checkpoint.completed.reduce((sum, item) => sum + item.lessonCount, 0)} lessons saved.`
        : 'Validating retained analysis; partition total is not known yet.'}</p>
      <p>You can close this page and return while work continues.</p>
      <button onClick={onCancel}>Cancel building</button>
    </div> : <>
      <p role="status">{operation?.complete ? 'Building complete. Curriculum lessons are saved.'
        : `Building ${snapshot.status === 'canceled' ? 'canceled' : 'stopped'}. Accepted lesson receipts remain saved.`}</p>
      {snapshot.error && <p role="alert">{snapshot.error.message}</p>}
      <p>A fresh build request reuses accepted analysis and starts building again. Automatic worker retries reuse accepted building.</p>
      <button disabled={disabled || pending} onClick={() => void start()}>Start fresh building</button>
      <button disabled={disabled || pending} onClick={() => void onBack()}>Back to material</button>
    </>}
  </section>;
}
