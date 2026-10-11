'use client';
import { useProcessingAction } from '../hooks/useProcessingAction';
import type { CreationSnapshot } from '@/src/shared/cohort-creation/contracts';
import { ChunkingWorkspace } from './ChunkingWorkspace';

export function ChunkingProgress({ snapshot, disabled, onStart, onCancel, onBack, onAnalyze }: {
  onAnalyze?: () => Promise<boolean>; snapshot: CreationSnapshot; disabled: boolean; onStart: () => Promise<boolean>; onCancel: () => void; onBack: () => Promise<boolean>;
}) {
  const operation = snapshot.processing?.chunking; const checkpoint = operation?.checkpoint; const running = snapshot.status === 'running';
  const { pending, error, run } = useProcessingAction(disabled || running);
  const start = (action = onStart, label = 'Chunking request') => run(action, label);
  return <ChunkingWorkspace snapshot={snapshot}>
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
      {error && <p role="alert">{error}</p>}
      <p>A fresh chunk request reuses understanding and starts chunking again. Automatic worker retries reuse accepted chunks.</p>
      {operation?.complete && onAnalyze && <button disabled={disabled || pending} onClick={() => void start(onAnalyze, 'Analysis request')}>Analyze grounded chunks</button>}
      <button disabled={disabled || pending} onClick={() => void start()}>Start fresh chunking</button>
      <button disabled={disabled || pending} onClick={() => void start(onBack, 'Return to material')}>Back to material</button>
    </>}
  </ChunkingWorkspace>;
}
