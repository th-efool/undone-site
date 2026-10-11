import { creationSnapshotSchema, type CreationSnapshot } from '../../src/shared/cohort-creation/contracts';
import { applyCommand, type CreationCommand } from '../../src/shared/cohort-creation/flow';
import { readyFixture, readyReview } from '../../src/client/screens/cohortCreation/__tests__/ready.fixture';
import { draftId } from '../../src/shared/cohort-creation/__tests__/fixtures';
import { recommendations, reviewResponse } from './fixtures';

/** Explicit mock server responses. No worker, AI, acquisition or database success is implied. */
export function seed() {
  return creationSnapshotSchema.parse({ ...readyFixture(), stage: 'recommendations', query: recommendations.intent.rawQuery,
    result: recommendations, materials: [], extractions: [], processing: null, startingPoint: null });
}
export function command(state: CreationSnapshot, input: CreationCommand) {
  if (input.type === 'open_review') return creationSnapshotSchema.parse({ ...state, revision: state.revision + 1, stage: 'review', review: { ...readyReview, ...reviewResponse.review } });
  return applyCommand(state, input);
}
export function complete(queued: CreationSnapshot) {
  const ready = readyFixture(); const processing = ready.processing!;
  processing.inputRevision = queued.inputRevision;
  for (const checkpoint of [processing.checkpoint, processing.chunking?.checkpoint, processing.analysis?.checkpoint, processing.building?.checkpoint]) {
    if (checkpoint) checkpoint.inputRevision = queued.inputRevision;
  }
  const common = { ...queued, revision: queued.revision + 1, status: 'succeeded', activeRequestId: null, error: null };
  if (queued.stage === 'starting_point') return creationSnapshotSchema.parse({ ...common, materials: ready.materials,
    materialRefs: [{ materialId: draftId, ids: [draftId] }],
    extractions: [{ materialId: draftId, version: 'b'.repeat(64), checksum: 'c'.repeat(64), artifactRef: draftId, extractionKind: 'text', complete: true, segmentCount: 18 }] });
  if (queued.stage === 'processing') {
    const phase = queued.processing!.phase;
    return creationSnapshotSchema.parse({ ...common, stage: phase === 'building' ? 'ready' : 'processing', processing: { ...processing,
      phase, chunking: phase === 'understanding' ? null : processing.chunking,
      analysis: ['understanding', 'chunking'].includes(phase) ? null : processing.analysis,
      building: phase === 'building' ? processing.building : null } });
  }
  if (queued.stage === 'finalizing') {
    const publication = queued.publication!;
    const receipt = { requestId: publication.requestId, mode: publication.mode, snapshotHash: 'a'.repeat(64), cohortId: draftId, committedAt: new Date().toISOString() };
    return creationSnapshotSchema.parse({ ...common, stage: 'published', publication: { ...publication, cohortId: draftId, snapshotHash: receipt.snapshotHash, receipt } });
  }
  return queued;
}
export function review(state: CreationSnapshot) {
  return { ...reviewResponse, revision: state.revision, review: state.review, curriculum: { ...reviewResponse.curriculum, version: state.review!.buildFingerprint } };
}
