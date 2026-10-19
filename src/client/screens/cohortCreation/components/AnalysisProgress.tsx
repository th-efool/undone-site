'use client';
import { useProcessingAction } from '../hooks/useProcessingAction';
import type { CreationSnapshot } from '@/src/shared/cohort-creation/contracts';
import { AnalysisWorkspace } from './AnalysisWorkspace';

export function AnalysisProgress({ snapshot, disabled, onStart, onCancel, onBack, onBuild, onContinue }: {
  onBuild?: () => Promise<boolean>; onContinue?: () => void; snapshot: CreationSnapshot; disabled: boolean; onStart: () => Promise<boolean>; onCancel: () => void; onBack: () => Promise<boolean>;
}) {
  const operation = snapshot.processing?.analysis; const checkpoint = operation?.checkpoint; const running = snapshot.status === 'running';
  const { pending, error, run } = useProcessingAction(disabled || running);
  const start = (action = onStart, label = 'Analysis request') => run(action, label);
  return <AnalysisWorkspace snapshot={snapshot}><section aria-label="Analyzing material">
    <h2>Analyzing</h2>
    <p>Accepted chunks, understanding and source material remain saved.</p>
    {running ? <div role="status">
      <p>{checkpoint ? `${checkpoint.completed.length} of ${checkpoint.total} retained content partitions analyzed; ${checkpoint.completed.reduce((sum, item) => sum + item.chunkCount, 0)} chunk analyses saved.`
        : 'Validating retained chunks; partition total is not known yet.'}</p>
      <p>You can close this page and return while work continues.</p>
      <button onClick={onCancel}>Cancel analysis</button>
    </div> : <>
      <p role="status">{operation?.complete ? 'Analyzing complete. Pedagogical analysis is saved.'
        : `Analyzing ${snapshot.status === 'canceled' ? 'canceled' : 'stopped'}. Accepted analysis receipts remain saved.`}</p>
      {snapshot.error && <p role="alert">{snapshot.error.message}</p>}
      {error && <p role="alert">{error}</p>}
      <p>A fresh analysis request reuses grounded chunks and starts analysis again. Automatic worker retries reuse accepted analysis.</p>
      {operation?.complete && (onBuild || onContinue) && <button disabled={disabled || pending} onClick={() => {
        if (onContinue) onContinue();
        else if (onBuild) void start(onBuild, 'Building request');
      }}>Build curriculum</button>}
      <button disabled={disabled || pending} onClick={() => void start()}>Start fresh analysis</button>
      <button disabled={disabled || pending} onClick={() => void start(onBack, 'Return to material')}>Back to material</button>
    </>}
  </section></AnalysisWorkspace>;
}
