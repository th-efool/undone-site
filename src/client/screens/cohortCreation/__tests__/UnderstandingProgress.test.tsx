// @vitest-environment jsdom
import { randomUUID } from 'node:crypto';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { describe, expect, it, vi } from 'vitest';
import { creationSnapshotSchema } from '@/src/shared/cohort-creation/contracts';
import { draftId, result } from '@/src/shared/cohort-creation/__tests__/fixtures';
import { initialSnapshot } from '@/src/shared/cohort-creation/flow';
import { UnderstandingProgress } from '../components/UnderstandingProgress';

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
function fixture() {
  const requestId = randomUUID(); const materialId = randomUUID(); const artifactRef = randomUUID();
  return creationSnapshotSchema.parse({ ...initialSnapshot(draftId), query: result.intent.rawQuery, result, inputRevision: 2, revision: 5,
    stage: 'processing', status: 'running', activeRequestId: requestId, startingPoint: 'have_material',
    materials: [{ id: materialId, kind: 'markdown', input: { kind: 'upload', assetId: randomUUID() }, selectedUnitIds: [materialId], status: 'ready' }],
    extractions: [{ materialId, version: 'a'.repeat(64), checksum: 'b'.repeat(64), artifactRef, extractionKind: 'text', complete: true, segmentCount: 2 }],
    materialRefs: [{ materialId, ids: [artifactRef] }], processing: { requestId, inputRevision: 2, complete: false, checkpoint: null } });
}
describe('real understanding progress controls', () => {
  it('uses indeterminate progress before inventory and actual accepted counts afterward', async () => {
    const host = document.createElement('div'); const root = createRoot(host); const state = fixture(); const onCancel = vi.fn();
    const props = { disabled: false, onStart: vi.fn(async () => true), onBack: vi.fn(async () => true), onCancel };
    await act(async () => root.render(<UnderstandingProgress snapshot={state} {...props} />));
    expect(host.textContent).toContain('partition total is not known'); expect(host.textContent).not.toContain('%');
    const checkpoint = { phase: 'understanding' as const, requestId: state.activeRequestId!, inputRevision: 2, inputFingerprint: 'a'.repeat(64),
      total: 2, partitionIds: ['a'.repeat(64), 'b'.repeat(64)], completed: [{ partitionId: 'a'.repeat(64), artifact: { id: randomUUID(), kind: 'artifact' as const, checksum: 'c'.repeat(64), byteLength: 500 } }] };
    await act(async () => root.render(<UnderstandingProgress snapshot={{ ...state, processing: { ...state.processing!, checkpoint } }} {...props} />));
    expect(host.textContent).toContain('1 of 2 retained content partitions understood');
    await act(async () => host.querySelector('button')!.click()); expect(onCancel).toHaveBeenCalledOnce(); await act(async () => root.unmount());
  });
  it('guards duplicate starts while awaiting server confirmation', async () => {
    const state = fixture(); let finish!: (value: boolean) => void; const onStart = vi.fn(() => new Promise<boolean>(resolve => { finish = resolve; }));
    const host = document.createElement('div'); const root = createRoot(host);
    await act(async () => root.render(<UnderstandingProgress snapshot={{ ...state, stage: 'starting_point', status: 'succeeded', activeRequestId: null, processing: null }}
      disabled={false} onStart={onStart} onBack={vi.fn()} onCancel={vi.fn()} />));
    await act(async () => { host.querySelector('button')!.click(); host.querySelector('button')!.click(); });
    expect(onStart).toHaveBeenCalledOnce(); await act(async () => finish(true)); await act(async () => root.unmount());
  });
  it('distinguishes understanding completion from curriculum readiness and permits returning to material', async () => {
    const state = fixture(); const host = document.createElement('div'); const root = createRoot(host); const onBack = vi.fn(async () => true);
    const completed = creationSnapshotSchema.parse({ ...state, status: 'succeeded', activeRequestId: null,
      processing: { ...state.processing!, complete: true, checkpoint: { phase: 'understanding', requestId: state.processing!.requestId, inputRevision: 2,
        inputFingerprint: 'a'.repeat(64), total: 1, partitionIds: ['b'.repeat(64)], completed: [{ partitionId: 'b'.repeat(64), artifact: {
          id: randomUUID(), kind: 'artifact', checksum: 'c'.repeat(64), byteLength: 500 } }] } } });
    await act(async () => root.render(<UnderstandingProgress snapshot={completed} disabled={false} onStart={vi.fn()} onCancel={vi.fn()} onBack={onBack} />));
    expect(host.textContent).toContain('Curriculum building is not available yet'); expect(host.textContent).not.toContain('Publish');
    await act(async () => Array.from(host.querySelectorAll('button')).find(button => button.textContent === 'Back to material')!.click());
    expect(onBack).toHaveBeenCalledOnce(); await act(async () => root.unmount());
  });
});
