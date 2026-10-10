import { creationSnapshotSchema } from '@/src/shared/cohort-creation/contracts';
import { initialSnapshot } from '@/src/shared/cohort-creation/flow';
import { reviewWorkspaceSchema } from '@/src/shared/cohort-creation/review';
import { draftId, result } from '@/src/shared/cohort-creation/__tests__/fixtures';

/** Schema-valid UI fixture; artifact hashes are not live storage receipts. */
export function readyFixture() {
  const hash = 'a'.repeat(64); const partitionId = 'b'.repeat(64);
  const artifact = { id: draftId, kind: 'artifact', checksum: hash, byteLength: 100 };
  const checkpoint = { requestId: draftId, inputRevision: 1, inputFingerprint: hash, total: 1, partitionIds: [partitionId], completed: [{ partitionId, artifact }] };
  return creationSnapshotSchema.parse({ ...initialSnapshot(draftId), inputRevision: 1, stage: 'ready', status: 'succeeded', result, query: result.intent.rawQuery,
    materials: [{ id: draftId, kind: 'web', input: { kind: 'url', url: 'https://example.com/retained-material' }, selectedUnitIds: [draftId], status: 'ready' }],
    processing: { requestId: draftId, inputRevision: 1, phase: 'building', complete: true, checkpoint: { ...checkpoint, phase: 'understanding' },
      chunking: { requestId: draftId, complete: true, checkpoint: { ...checkpoint, phase: 'chunking', understandingFingerprint: hash, completed: [{ partitionId, artifact, chunkCount: 4 }] } },
      analysis: { requestId: draftId, complete: true, checkpoint: { ...checkpoint, phase: 'analysis', chunkingFingerprint: hash, completed: [{ partitionId, artifact, chunkCount: 4 }] } },
      building: { requestId: draftId, complete: true, checkpoint: { ...checkpoint, phase: 'building', analysisFingerprint: hash, completed: [{ partitionId, artifact, lessonCount: 3 }] } } } });
}
export const readyReview = reviewWorkspaceSchema.parse({ title: 'Retained curriculum', description: 'Retained lessons', buildFingerprint: 'a'.repeat(64), editRevision: 0,
  lessonIds: [], orphanedLessonIds: [], lessonEdits: [], visibility: 'PRIVATE', chatEnabled: false, eventsEnabled: false, proposal: null });
