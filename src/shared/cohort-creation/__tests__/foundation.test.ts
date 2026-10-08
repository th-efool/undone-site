import { describe, expect, it } from 'vitest';
import { creationCommandSchema, applyCommand, applyEvent, canEnterStage, initialSnapshot } from '../flow';
import { creationSnapshotSchema, materialSourceSchema, recommendationResultSchema, sourceLocationSchema } from '../contracts';
import { chunkAnalysisSchema } from '../artifacts';
import { invalidatedArtifacts } from '../dependencies';
import { draftId, requestId, nextRequestId, result } from './fixtures';

const running = () => applyCommand(initialSnapshot(draftId), { type: 'request_recommendations', requestId, query: result.intent.rawQuery });
describe('creation contracts and deterministic flow', () => {
  it('rejects navigation/model fields on commands and incomplete publication-like snapshots', () => {
    expect(creationCommandSchema.safeParse({ type: 'create_own', nextRoute: '/publish' }).success).toBe(false);
    expect(creationSnapshotSchema.safeParse({ ...initialSnapshot(draftId), stage: 'published' }).success).toBe(false);
    expect(materialSourceSchema.safeParse({ id: 'x', kind: 'pdf', input: { kind: 'upload', assetId: 'asset' }, selectedUnitIds: [], status: 'pending' }).success).toBe(true);
  });
  it('accepts zero/five recommendations but rejects duplicates, excess and forged ranking', () => {
    expect(recommendationResultSchema.safeParse({ ...result, items: [] }).success).toBe(true);
    const items = Array.from({ length: 5 }, (_, index) => ({ ...result.items[0], cohort: { ...result.items[0].cohort, cohortId: `id${index}` }, rank: index + 1, isBestMatch: index === 0 }));
    expect(recommendationResultSchema.safeParse({ ...result, items }).success).toBe(true);
    expect(recommendationResultSchema.safeParse({ ...result, items: [...items, items[0]] }).success).toBe(false);
    expect(recommendationResultSchema.safeParse({ ...result, items: [result.items[0], result.items[0]] }).success).toBe(false);
    expect(recommendationResultSchema.safeParse({ ...result, items: [{ ...result.items[0], rank: 4 }] }).success).toBe(false);
  });
  it('requires accepted intent and keeps all later stages disabled in 3A', () => {
    expect(() => applyCommand(initialSnapshot(draftId), { type: 'create_own' })).toThrow();
    const accepted = applyEvent(running(), { type: 'recommendations_received', result });
    const own = applyCommand(accepted, { type: 'create_own' });
    expect(own.stage).toBe('starting_point');
    expect(applyCommand(own, { type: 'choose_starting_point', startingPoint: 'have_goal' }).startingPoint).toBe('have_goal');
    expect(canEnterStage(own, 'materials')).toBe(false);
    expect(canEnterStage(own, 'published')).toBe(false);
  });
  it('ignores out-of-order responses and results for the wrong input revision', () => {
    const second = applyCommand(running(), { type: 'request_recommendations', requestId: nextRequestId, query: 'Learn Python' });
    expect(applyEvent(second, { type: 'recommendations_received', result })).toBe(second);
    expect(applyEvent(second, { type: 'recommendations_received', result: { ...result, requestId: nextRequestId } })).toBe(second);
  });
  it('fences a completion after explicit cancellation', () => {
    const cancelled = applyEvent(running(), { type: 'operation_cancelled', requestId });
    expect(cancelled.activeRequestId).toBeNull();
    expect(applyEvent(cancelled, { type: 'recommendations_received', result })).toBe(cancelled);
  });
  it('rejects reversed source anchors and incomplete/nonfinite pedagogical scores', () => {
    expect(sourceLocationSchema.safeParse({ materialId: 'm', unitId: 'u', segmentId: 's', anchor: { kind: 'video', startSeconds: 8, endSeconds: 4, estimated: true } }).success).toBe(false);
    expect(chunkAnalysisSchema.safeParse({ chunkId: 'c', vector: {}, isStrictlyLinear: false, confidence: Infinity, reasoning: 'x', modelId: 'x', promptVersion: '1', inputRevision: 1 }).success).toBe(false);
  });
  it('preserves expensive artifacts for copy edits but invalidates dependent material outputs', () => {
    expect(invalidatedArtifacts('metadata')).toEqual(['preview', 'publication']);
    expect(invalidatedArtifacts('goal')).not.toContain('extraction');
    expect(invalidatedArtifacts('goal')).not.toContain('chunks');
    expect(invalidatedArtifacts('material')).toEqual(expect.arrayContaining(['extraction', 'chunks', 'analysis', 'curriculum']));
    expect(invalidatedArtifacts('visibility')).toEqual(['publication']);
  });
});
