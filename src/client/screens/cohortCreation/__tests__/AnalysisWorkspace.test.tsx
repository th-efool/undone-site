// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { initialSnapshot } from '@/src/shared/cohort-creation/flow';
import { draftId } from '@/src/shared/cohort-creation/__tests__/fixtures';
import type { GroundedChunk } from '@/src/shared/cohort-creation/chunking';
import type { AnalysisPreview } from '@/src/shared/cohort-creation/analysis-preview';
import { PEDAGOGICAL_DIMENSIONS } from '@/src/shared/curriculum/pedagogicalVector.types';
import { analysisPreviewSchema } from '@/src/shared/cohort-creation/analysis-preview';
import { loadAnalysisPreview } from '../services/analysisApi';
import { AnalysisWorkspace } from '../components/AnalysisWorkspace';
vi.mock('../services/analysisApi', () => ({ loadAnalysisPreview: vi.fn() }));
afterEach(() => { cleanup(); vi.resetAllMocks(); });
function state(revision = 1) {
  return { ...initialSnapshot(draftId), revision, materials: ['first', 'second'].map(id => ({ id, kind: 'web' as const, input: { kind: 'url' as const, url: `https://example.com/${id}` }, status: 'ready' as const, selectedUnitIds: [id] })),
    processing: { requestId: draftId, inputRevision: 0, complete: true, phase: 'analysis' as const, checkpoint: null, chunking: null, building: null,
      analysis: { requestId: draftId, complete: false, checkpoint: { phase: 'analysis' as const, requestId: draftId, inputRevision: 0,
        inputFingerprint: 'a'.repeat(64), chunkingFingerprint: 'b'.repeat(64), total: 2, partitionIds: ['c'.repeat(64), 'd'.repeat(64)], completed: [{ partitionId: 'c'.repeat(64), chunkCount: 2, artifact: { id: draftId, kind: 'artifact' as const, byteLength: 500, checksum: 'e'.repeat(64) } }] } } } };
}
function chunk(materialId: string, title: string): GroundedChunk {
  return { id: title, materialId, unitId: materialId, partitionId: 'c'.repeat(64), extractionVersion: 'a'.repeat(64), artifactRef: draftId, position: 0,
    title: { value: title, origin: 'ai', acceptedRevision: 0 }, summary: { value: 'Retained summary', origin: 'ai', acceptedRevision: 0 },
    sourceRefs: [{ materialId, unitId: materialId, segmentId: 'segment-1', anchor: { kind: 'text', start: 0, end: 100 } }],
    durationSeconds: 120, durationMethod: 'reading_estimate', conceptIndices: [], contentOrigin: 'external', coverage: { scope: 'main article', exhaustive: true, limitations: [] } };
}
function analysis(chunkId: string) { return { chunkId, vector: Object.fromEntries(PEDAGOGICAL_DIMENSIONS.map(key => [key, 0.5])) as Record<typeof PEDAGOGICAL_DIMENSIONS[number], number>, isStrictlyLinear: true, confidence: 0.8, reasoning: 'Retained pedagogical reasoning', modelId: 'fixture', promptVersion: 'v1', inputRevision: 0 }; }
describe('analysis workspace', () => {
  it('selects actual sources and exposes retained boundaries with labelled duration estimates', async () => {
    vi.mocked(loadAnalysisPreview).mockResolvedValue({ revision: 1, chunks: [chunk('first', 'First idea'), chunk('second', 'Second idea')], analyses: [analysis('First idea'), analysis('Second idea')] });
    render(<AnalysisWorkspace snapshot={state()}>Saved controls</AnalysisWorkspace>); await screen.findByText('First idea');
    expect(screen.queryByText('Second idea')).toBeNull();
    fireEvent.click(screen.getAllByRole('radio')[1]); expect(screen.getByText('Second idea')).toBeTruthy(); expect(screen.queryByText('First idea')).toBeNull();
    fireEvent.click(screen.getByText('Second idea')); expect(screen.getByText(/Text offsets 0–100/)).toBeTruthy();
    expect(screen.getByText(/2 min · reading estimate/)).toBeTruthy(); expect(screen.getByRole('progressbar').getAttribute('value')).toBe('1');
  });
  it('shows pending chunks without inventing scores', async () => {
    vi.mocked(loadAnalysisPreview).mockResolvedValue({ revision: 1, chunks: [chunk('first', 'Pending idea')], analyses: [] });
    render(<AnalysisWorkspace snapshot={state()}>Saved controls</AnalysisWorkspace>);
    await screen.findByText('Pending idea');
    expect(screen.getByText('Awaiting accepted analysis')).toBeTruthy();
    expect(document.querySelector('dl')).toBeNull();
    expect(screen.getByText(/No accepted scores yet/)).toBeTruthy();
  });
  it('hides obsolete previews and aborts superseded requests', async () => {
    vi.mocked(loadAnalysisPreview).mockResolvedValueOnce({ revision: 1, chunks: [chunk('first', 'Old chunk')], analyses: [analysis('Old chunk')] });
    let finish!: (value: AnalysisPreview) => void; vi.mocked(loadAnalysisPreview).mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
    const view = render(<AnalysisWorkspace snapshot={state()}>Saved controls</AnalysisWorkspace>); await screen.findByText('Old chunk');
    const signal = vi.mocked(loadAnalysisPreview).mock.calls[0][1]; view.rerender(<AnalysisWorkspace snapshot={state(2)}>Saved controls</AnalysisWorkspace>);
    expect(signal.aborted).toBe(true); expect(screen.queryByText('Old chunk')).toBeNull();
    await act(async () => finish({ revision: 2, chunks: [chunk('first', 'New chunk')], analyses: [analysis('New chunk')] })); expect(screen.getByText('New chunk')).toBeTruthy();
  });
  it('rejects malformed vectors, duplicate analyses and unknown chunk references', () => {
    const preview = { revision: 1, chunks: [chunk('first', 'First idea')], analyses: [analysis('First idea')] };
    expect(analysisPreviewSchema.safeParse(preview).success).toBe(true);
    expect(analysisPreviewSchema.safeParse({ ...preview, analyses: [analysis('unknown')] }).success).toBe(false);
    expect(analysisPreviewSchema.safeParse({ ...preview, analyses: [...preview.analyses, ...preview.analyses] }).success).toBe(false);
    expect(analysisPreviewSchema.safeParse({ ...preview, analyses: [{ ...analysis('First idea'), vector: { cognitive_load: 2 } }] }).success).toBe(false);
  });
  it('offers recovery when retained analysis loading fails', async () => {
    vi.mocked(loadAnalysisPreview).mockRejectedValueOnce(new Error('Saved chunks unavailable'));
    vi.mocked(loadAnalysisPreview).mockResolvedValueOnce({ revision: 1, chunks: [chunk('first', 'Recovered chunk')], analyses: [analysis('Recovered chunk')] });
    render(<AnalysisWorkspace snapshot={state()}>Saved controls</AnalysisWorkspace>); await screen.findByRole('alert');
    fireEvent.click(screen.getByRole('button', { name: 'Reload analysis' })); await screen.findByText('Recovered chunk');
  });
});
