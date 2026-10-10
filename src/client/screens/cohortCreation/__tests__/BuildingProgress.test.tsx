// @vitest-environment jsdom
import { randomUUID } from 'node:crypto';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { describe, expect, it, vi } from 'vitest';
import { creationSnapshotSchema } from '@/src/shared/cohort-creation/contracts';
import { draftId, result } from '@/src/shared/cohort-creation/__tests__/fixtures';
import { initialSnapshot } from '@/src/shared/cohort-creation/flow';
import { BuildingProgress } from '../components/BuildingProgress';

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
function fixture() {
  const requestId = randomUUID(); const understandingId = randomUUID(); const materialId = randomUUID(); const artifactRef = randomUUID();
  const chunkId = randomUUID(); const analysisId = randomUUID();
  return creationSnapshotSchema.parse({ ...initialSnapshot(draftId), query: result.intent.rawQuery, result, inputRevision: 2,
    stage: 'processing', status: 'running', activeRequestId: requestId, startingPoint: 'have_material',
    materials: [{ id: materialId, kind: 'markdown', input: { kind: 'upload', assetId: randomUUID() }, selectedUnitIds: [materialId], status: 'ready' }],
    extractions: [{ materialId, version: 'a'.repeat(64), checksum: 'b'.repeat(64), artifactRef, extractionKind: 'text', complete: true, segmentCount: 1 }],
    materialRefs: [{ materialId, ids: [artifactRef] }], processing: { requestId: understandingId, inputRevision: 2, complete: true, phase: 'building',
      checkpoint: { phase: 'understanding', requestId: understandingId, inputRevision: 2, inputFingerprint: 'a'.repeat(64), total: 1,
        partitionIds: ['b'.repeat(64)], completed: [{ partitionId: 'b'.repeat(64), artifact: { id: randomUUID(), kind: 'artifact', checksum: 'c'.repeat(64), byteLength: 200 } }] },
      chunking: { requestId: chunkId, complete: true, checkpoint: { phase: 'chunking', requestId: chunkId, inputRevision: 2,
        inputFingerprint: 'd'.repeat(64), understandingFingerprint: 'a'.repeat(64), total: 1, partitionIds: ['b'.repeat(64)],
        completed: [{ partitionId: 'b'.repeat(64), chunkCount: 3, artifact: { id: randomUUID(), kind: 'artifact', checksum: 'e'.repeat(64), byteLength: 300 } }] } },
      analysis: { requestId: analysisId, complete: true, checkpoint: { phase: 'analysis', requestId: analysisId, inputRevision: 2,
        inputFingerprint: 'f'.repeat(64), chunkingFingerprint: 'd'.repeat(64), total: 1, partitionIds: ['b'.repeat(64)],
        completed: [{ partitionId: 'b'.repeat(64), chunkCount: 3, artifact: { id: randomUUID(), kind: 'artifact', checksum: 'e'.repeat(64), byteLength: 300 } }] } },
      building: { requestId, checkpoint: null, complete: false } } });
}
describe('real building progress controls', () => {
  it('shows unknown totals then actual saved partition/chunk counts and permits cancellation', async () => {
    const host = document.createElement('div'); const root = createRoot(host); const state = fixture(); const onCancel = vi.fn();
    const props = { disabled: false, onStart: vi.fn(async () => true), onBack: vi.fn(async () => true), onCancel };
    await act(async () => root.render(<BuildingProgress snapshot={state} {...props} />));
    expect(host.textContent).toContain('partition total is not known'); expect(host.textContent).not.toContain('%');
    const checkpoint = { phase: 'building' as const, requestId: state.activeRequestId!, inputRevision: 2, inputFingerprint: 'd'.repeat(64),
      analysisFingerprint: 'f'.repeat(64), total: 1, partitionIds: ['b'.repeat(64)], completed: [{ partitionId: 'b'.repeat(64), lessonCount: 3,
        artifact: { id: randomUUID(), kind: 'artifact' as const, checksum: 'e'.repeat(64), byteLength: 300 } }] };
    const progress = creationSnapshotSchema.parse({ ...state, processing: { ...state.processing!, building: { ...state.processing!.building!, checkpoint } } });
    await act(async () => root.render(<BuildingProgress snapshot={progress} {...props} />));
    expect(host.textContent).toContain('1 of 1 retained content partitions built; 3 lessons saved');
    await act(async () => host.querySelector('button')!.click()); expect(onCancel).toHaveBeenCalledOnce(); await act(async () => root.unmount());
  });
  it('guards duplicate fresh requests and keeps accepted understanding visible', async () => {
    const host = document.createElement('div'); const root = createRoot(host); const state = fixture();
    let finish!: (value: boolean) => void; const onStart = vi.fn(() => new Promise<boolean>(resolve => { finish = resolve; }));
    await act(async () => root.render(<BuildingProgress snapshot={{ ...state, status: 'canceled', activeRequestId: null }}
      disabled={false} onStart={onStart} onBack={vi.fn(async () => true)} onCancel={vi.fn()} />));
    expect(host.textContent).toContain('Accepted analysis, chunks and source material remain saved');
    await act(async () => { host.querySelector('button')!.click(); host.querySelector('button')!.click(); });
    expect(onStart).toHaveBeenCalledOnce(); await act(async () => finish(true)); await act(async () => root.unmount());
  });
});
