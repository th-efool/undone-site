// @vitest-environment jsdom
import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { cohortWorkspaceSchema } from '@/src/shared/cohort-builder/contracts';
import { UnderstandingStageView } from '../stages/UnderstandingStageView';
import { ChunkingStageView } from '../stages/ChunkingStageView';
import { AnalysisStageView } from '../stages/AnalysisStageView';
import { ProcessingFailures } from '../stages/ProcessingFailures';
import { CohortDraftProvider } from '../draft-context';

afterEach(cleanup);
function fixture() {
  const text = 'Quorum intersection prevents conflicting writes. Leader election chooses a coordinator.';
  return cohortWorkspaceSchema.parse({ schemaVersion: 1, title: 'Draft Curriculum', intent: 'i want to learn distributed systems', audience: 'Engineers', dailyMinutes: 25, lessons: [],
    sources: [{ id: 'video', version: 1, label: 'Consensus protocols', text, checksum: null, state: 'processing',
      input: { kind: 'youtube', url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', mode: 'video_observation' },
      locations: [{ start: 0, end: text.length, startMs: 0, endMs: 120_000 }] }],
    chunks: [{ id: 'chunk', sourceId: 'video', sourceVersion: 1, start: 0, end: text.length, text, checksum: 'a'.repeat(64) }],
    understanding: [{ sourceId: 'video', sourceVersion: 1, topics: ['Quorum intersection', 'Leader election'] }, { sourceId: 'removed', sourceVersion: 0, topics: ['Stale topic'] }],
    analyses: [{ chunkId: 'chunk', summary: 'Quorums keep replicated writes consistent.', question: 'When does quorum overlap matter?' }],
    processing: { status: 'processing', stage: 'analysis', generation: 1, sourceFingerprint: null, error: null,
      jobs: [
        { id: 'u', sourceId: 'video', stage: 'understanding', status: 'accepted', attempts: 1, error: null, retryable: false },
        { id: 'c', sourceId: 'video', stage: 'chunking', status: 'accepted', attempts: 1, error: null, retryable: false },
        { id: 'a', sourceId: 'video', stage: 'analysis', status: 'running', attempts: 1, error: null, retryable: false },
      ] },
  });
}

describe('accepted processing details', () => {
  it('shows expandable concepts and source limitations without stale concepts or raw job rows', () => {
    render(<UnderstandingStageView workspace={fixture()} dispatchAction={async () => true} />);
    const concept = screen.getByText('Quorum intersection').closest('details')!;
    fireEvent.click(within(concept).getByText('Quorum intersection'));
    expect(concept.open).toBe(true);
    expect(concept.textContent).toContain('prevents conflicting writes');
    expect(screen.queryByText(/Stale topic/)).toBeNull();
    expect(screen.getByText('Source summaries and limitations (1)')).toBeTruthy();
    expect(screen.queryByLabelText('Source processing jobs')).toBeNull();
  });

  it('shows thumbnails, a readable chunk title and its real source interval', () => {
    const { container } = render(<CohortDraftProvider workspaceId="chunk-fixture" ownerId="owner">
      <ChunkingStageView workspace={fixture()} dispatchAction={async () => true} />
    </CohortDraftProvider>);
    expect(container.querySelectorAll('img[src*="i.ytimg.com"]')).toHaveLength(2);
    expect(screen.getByText('Quorum intersection prevents conflicting writes')).toBeTruthy();
    expect(screen.getByText('estimated source interval')).toBeTruthy();
    expect(screen.queryByText('Chunk 1')).toBeNull();
  });

  it('shows five normalized score rows and all twelve dimensions for accepted analysis', () => {
    render(<CohortDraftProvider workspaceId="analysis-fixture" ownerId="owner">
      <AnalysisStageView workspace={fixture()} dispatchAction={async () => true} />
    </CohortDraftProvider>);
    for (const label of ['Cognitive load', 'Practicality', 'Visual dependence', 'Abstraction depth', 'Interactivity']) {
      expect(screen.getByLabelText(new RegExp(`^${label}: [0-1]\\.\\d{2} out of 1$`))).toBeTruthy();
    }
    expect(screen.getAllByRole('definition', { hidden: true })).toHaveLength(12);
    expect(screen.queryByLabelText('Source processing jobs')).toBeNull();
  });

  it('renders only actionable failed jobs and retries the exact failed job', () => {
    const workspace = fixture();
    workspace.processing.jobs!.push({ id: 'failed', sourceId: 'video', stage: 'chunking', status: 'failed', attempts: 1, error: 'INTERNAL_CODE', retryable: true });
    const dispatch = vi.fn(async () => true);
    render(<ProcessingFailures workspace={workspace} dispatchAction={dispatch} />);
    expect(screen.getAllByRole('alert')).toHaveLength(1);
    expect(screen.queryByText('INTERNAL_CODE')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Retry chunking' }));
    expect(dispatch).toHaveBeenCalledWith({ type: 'retry_text_job', jobId: 'failed' });
  });
});
