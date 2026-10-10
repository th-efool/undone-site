// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { initialSnapshot } from '@/src/shared/cohort-creation/flow';
import { draftId } from '@/src/shared/cohort-creation/__tests__/fixtures';
import type { ChunkingPreview, GroundedChunk } from '@/src/shared/cohort-creation/chunking';
import { loadChunkingPreview } from '../services/chunkingApi';
import { ChunkingWorkspace } from '../components/ChunkingWorkspace';
vi.mock('../services/chunkingApi', () => ({ loadChunkingPreview: vi.fn() }));
afterEach(() => { cleanup(); vi.resetAllMocks(); });
function state(revision = 1) {
  return { ...initialSnapshot(draftId), revision, materials: ['first', 'second'].map(id => ({ id, kind: 'web' as const, input: { kind: 'url' as const, url: `https://example.com/${id}` }, status: 'ready' as const, selectedUnitIds: [id] })),
    processing: { requestId: draftId, inputRevision: 0, complete: true, phase: 'chunking' as const, checkpoint: null, analysis: null, building: null,
      chunking: { requestId: draftId, complete: false, checkpoint: { phase: 'chunking' as const, requestId: draftId, inputRevision: 0,
        inputFingerprint: 'a'.repeat(64), understandingFingerprint: 'b'.repeat(64), total: 2, partitionIds: ['c'.repeat(64), 'd'.repeat(64)], completed: [{ partitionId: 'c'.repeat(64), chunkCount: 2, artifact: { id: draftId, kind: 'artifact' as const, byteLength: 500, checksum: 'e'.repeat(64) } }] } } } };
}
function chunk(materialId: string, title: string): GroundedChunk {
  return { id: title, materialId, unitId: materialId, partitionId: 'c'.repeat(64), extractionVersion: 'a'.repeat(64), artifactRef: draftId, position: 0,
    title: { value: title, origin: 'ai', acceptedRevision: 0 }, summary: { value: 'Retained summary', origin: 'ai', acceptedRevision: 0 },
    sourceRefs: [{ materialId, unitId: materialId, segmentId: 'segment-1', anchor: { kind: 'text', start: 0, end: 100 } }],
    durationSeconds: 120, durationMethod: 'reading_estimate', conceptIndices: [], contentOrigin: 'external', coverage: { scope: 'main article', exhaustive: true, limitations: [] } };
}
describe('chunking workspace', () => {
  it('selects actual sources and exposes retained boundaries with labelled duration estimates', async () => {
    vi.mocked(loadChunkingPreview).mockResolvedValue({ revision: 1, chunks: [chunk('first', 'First idea'), chunk('second', 'Second idea')] });
    render(<ChunkingWorkspace snapshot={state()}>Saved controls</ChunkingWorkspace>); await screen.findByText('First idea');
    expect(screen.queryByText('Second idea')).toBeNull();
    fireEvent.click(screen.getAllByRole('radio')[1]); expect(screen.getByText('Second idea')).toBeTruthy(); expect(screen.queryByText('First idea')).toBeNull();
    fireEvent.click(screen.getByText('Second idea')); expect(screen.getByText(/Text offsets 0–100/)).toBeTruthy();
    expect(screen.getByText(/2 min · reading estimate/)).toBeTruthy(); expect(screen.getByRole('progressbar').getAttribute('value')).toBe('1');
  });
  it('hides obsolete previews and aborts superseded requests', async () => {
    vi.mocked(loadChunkingPreview).mockResolvedValueOnce({ revision: 1, chunks: [chunk('first', 'Old chunk')] });
    let finish!: (value: ChunkingPreview) => void; vi.mocked(loadChunkingPreview).mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
    const view = render(<ChunkingWorkspace snapshot={state()}>Saved controls</ChunkingWorkspace>); await screen.findByText('Old chunk');
    const signal = vi.mocked(loadChunkingPreview).mock.calls[0][1]; view.rerender(<ChunkingWorkspace snapshot={state(2)}>Saved controls</ChunkingWorkspace>);
    expect(signal.aborted).toBe(true); expect(screen.queryByText('Old chunk')).toBeNull();
    await act(async () => finish({ revision: 2, chunks: [chunk('first', 'New chunk')] })); expect(screen.getByText('New chunk')).toBeTruthy();
  });
  it('offers recovery when retained chunk loading fails', async () => {
    vi.mocked(loadChunkingPreview).mockRejectedValueOnce(new Error('Saved chunks unavailable'));
    vi.mocked(loadChunkingPreview).mockResolvedValueOnce({ revision: 1, chunks: [chunk('first', 'Recovered chunk')] });
    render(<ChunkingWorkspace snapshot={state()}>Saved controls</ChunkingWorkspace>); await screen.findByRole('alert');
    fireEvent.click(screen.getByRole('button', { name: 'Reload chunks' })); await screen.findByText('Recovered chunk');
  });
});
