'use client';

import type { CohortAction, CohortWorkspace } from '@/src/shared/cohort-builder/contracts';

const labels = {
  acquisition: 'Reading source material', extraction: 'Preparing source text', understanding: 'Finding key concepts',
  chunking: 'Organizing learning pieces', analysis: 'Analyzing learning pieces', assembly: 'Building lessons',
};

export function processingFailureMessage(code: string): string {
  if (code === 'PROCESSING_CANCELED') return 'Processing was canceled. Your accepted work remains saved.';
  if (code === 'TOO_MANY_CHUNKS') return 'This material produces too many learning pieces. Narrow the source scope and retry.';
  if (code === 'RATE_LIMITED' || code === 'BUDGET_EXHAUSTED') return 'Processing is temporarily unavailable. Your accepted work remains saved; retry when capacity is available.';
  return 'Processing could not finish. Your accepted work remains saved; retry to continue.';
}

/** Normal progress belongs in the checklist; only actionable failures appear here. */
export function ProcessingFailures({ workspace, dispatchAction }: {
  workspace: CohortWorkspace;
  dispatchAction: (action: CohortAction) => Promise<boolean>;
}) {
  const failures = workspace.processing.jobs?.filter(job => job.status === 'failed') ?? [];
  if (!failures.length) return null;
  return <section aria-label="Source processing errors">
    {failures.map(job => <div key={job.id} role="alert">
      <p>{labels[job.stage]} could not finish{job.sourceId ? ` for ${workspace.sources.find(source => source.id === job.sourceId)?.label ?? 'this source'}` : ''}.</p>
      {job.retryable ? <button type="button" onClick={() => void dispatchAction({ type: 'retry_text_job', jobId: job.id })}>
        Retry {job.stage}
      </button> : <p>Retry limit reached. Replace or remove the affected source to continue.</p>}
    </div>)}
  </section>;
}
