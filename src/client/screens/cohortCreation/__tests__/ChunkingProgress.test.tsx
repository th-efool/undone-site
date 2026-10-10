// @vitest-environment jsdom
import { randomUUID } from 'node:crypto';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { describe, expect, it, vi } from 'vitest';
import { creationSnapshotSchema } from '@/src/shared/cohort-creation/contracts';
import { draftId, result } from '@/src/shared/cohort-creation/__tests__/fixtures';
import { initialSnapshot } from '@/src/shared/cohort-creation/flow';
import { ChunkingProgress } from '../components/ChunkingProgress';

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
function fixture() {
  const requestId = randomUUID(); const understandingId = randomUUID(); const materialId = randomUUID(); const artifactRef = randomUUID();
  return creationSnapshotSchema.parse({ ...initialSnapshot(draftId), query: result.intent.rawQuery, result, inputRevision: 2,
    stage: 'processing', status: 'running', activeRequestId: requestId, startingPoint: 'have_material',
    materials: [{ id: materialId, kind: 'markdown', input: { kind: 'upload', assetId: randomUUID() }, selectedUnitIds: [materialId], status: 'ready' }],
    extractions: [{ materialId, version: 'a'.repeat(64), checksum: 'b'.repeat(64), artifactRef, extractionKind: 'text', complete: true, segmentCount: 1 }],
    materialRefs: [{ materialId, ids: [artifactRef] }], processing: { requestId: understandingId, inputRevision: 2, complete: true, phase: 'chunking',
      checkpoint: { phase: 'understanding', requestId: understandingId, inputRevision: 2, inputFingerprint: 'a'.repeat(64), total: 1,
        partitionIds: ['b'.repeat(64)], completed: [{ partitionId: 'b'.repeat(64), artifact: { id: randomUUID(), kind: 'artifact', checksum: 'c'.repeat(64), byteLength: 200 } }] },
      chunking: { requestId, checkpoint: null, complete: false } } });
}
describe('real chunking progress controls', () => {
  it('shows unknown totals then actual saved partition/chunk counts and permits cancellation', async () => {
    const host = document.createElement('div'); const root = createRoot(host); const state = fixture(); const onCancel = vi.fn();
    const props = { disabled: false, onStart: vi.fn(async () => true), onBack: vi.fn(async () => true), onCancel };
    await act(async () => root.render(<ChunkingProgress snapshot={state} {...props} />));
    expect(host.textContent).toContain('partition total is not known'); expect(host.textContent).not.toContain('%');
    const checkpoint = { phase: 'chunking' as const, requestId: state.activeRequestId!, inputRevision: 2, inputFingerprint: 'd'.repeat(64),
      understandingFingerprint: 'a'.repeat(64), total: 1, partitionIds: ['b'.repeat(64)], completed: [{ partitionId: 'b'.repeat(64), chunkCount: 3,
        artifact: { id: randomUUID(), kind: 'artifact' as const, checksum: 'e'.repeat(64), byteLength: 300 } }] };
    const progress = creationSnapshotSchema.parse({ ...state, processing: { ...state.processing!, chunking: { ...state.processing!.chunking!, checkpoint } } });
    await act(async () => root.render(<ChunkingProgress snapshot={progress} {...props} />));
    expect(host.textContent).toContain('1 of 1 retained content partitions chunked; 3 chunks saved');
    await act(async () => host.querySelector('button')!.click()); expect(onCancel).toHaveBeenCalledOnce(); await act(async () => root.unmount());
  });
  it('guards duplicate fresh requests and keeps accepted understanding visible', async () => {
    const host = document.createElement('div'); const root = createRoot(host); const state = fixture();
    let finish!: (value: boolean) => void; const onStart = vi.fn(() => new Promise<boolean>(resolve => { finish = resolve; }));
    await act(async () => root.render(<ChunkingProgress snapshot={{ ...state, status: 'canceled', activeRequestId: null }}
      disabled={false} onStart={onStart} onBack={vi.fn(async () => true)} onCancel={vi.fn()} />));
    expect(host.textContent).toContain('Accepted understanding and source material remain saved');
    await act(async () => { host.querySelector('button')!.click(); host.querySelector('button')!.click(); });
    expect(onStart).toHaveBeenCalledOnce(); await act(async () => finish(true)); await act(async () => root.unmount());
  });
  it('does not present chunk completion as ready curriculum and allows returning to material', async () => {
    const host = document.createElement('div'); const root = createRoot(host); const state = fixture(); const onBack = vi.fn(async () => true);
    const complete = creationSnapshotSchema.parse({ ...state, status: 'succeeded', activeRequestId: null, processing: { ...state.processing!,
      chunking: { ...state.processing!.chunking!, complete: true, checkpoint: { phase: 'chunking', requestId: state.activeRequestId, inputRevision: 2,
        inputFingerprint: 'd'.repeat(64), understandingFingerprint: 'a'.repeat(64), total: 1, partitionIds: ['b'.repeat(64)],
        completed: [{ partitionId: 'b'.repeat(64), chunkCount: 1, artifact: { id: randomUUID(), kind: 'artifact', checksum: 'e'.repeat(64), byteLength: 300 } }] } } } });
    await act(async () => root.render(<ChunkingProgress snapshot={complete} disabled={false} onStart={vi.fn(async () => true)} onCancel={vi.fn()} onBack={onBack} />));
    expect(host.textContent).toContain('Analysis and curriculum building are not available yet');
    await act(async () => Array.from(host.querySelectorAll('button')).find(button => button.textContent === 'Back to material')!.click());
    expect(onBack).toHaveBeenCalledOnce(); await act(async () => root.unmount());
  });
});
