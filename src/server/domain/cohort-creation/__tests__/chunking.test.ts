import { randomUUID } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';
vi.mock('server-only', () => ({}));
import { chunkBoundaryProposalSchema, type GroundedChunk } from '@/src/shared/cohort-creation/chunking';
import { partitionProcessingInput, type ProcessingPartition, type ProcessingUnit } from '../processing-input';
import { assembleGroundedChunks, groundChunkBoundaries, validateChunkBoundaries } from '../chunking';

function fixture(count = 4, overrides: Partial<ProcessingUnit> = {}, maxBytes = 24 * 1024) {
  const materialId = randomUUID(); const unitId = randomUUID();
  const unit: ProcessingUnit = { materialId, unitId, extractionVersion: 'a'.repeat(64), artifactId: randomUUID(),
    contentOrigin: 'external', coverage: { scope: 'selected_paths', exhaustive: true, limitations: ['Only selected files.'] },
    segments: Array.from({ length: count }, (_, index) => ({ id: `segment-${index}`, text: 'Light transport.\n',
      location: { materialId, unitId, segmentId: `segment-${index}`, anchor: { kind: 'text' as const, start: index * 17, end: index * 17 + 17 } } })), ...overrides };
  const partitions = partitionProcessingInput([unit], maxBytes); const partition = partitions[0];
  const understanding = { summary: 'Lighting.', concepts: [{ label: 'Light', summary: 'Light transport.', segmentIds: [partition.segments[0].id] }], limitations: [] };
  const proposal = { chunks: [{ title: 'Lighting', summary: 'A lighting introduction.', startSegmentId: partition.segments[0].id,
    endSegmentId: partition.segments.at(-1)!.id, conceptIndices: [0] }] };
  return { unit, partitions, partition, understanding, proposal };
}
describe('grounded chunk boundaries', () => {
  it('projects exact source anchors and preserves scope, revisions and application-derived estimates', () => {
    const f = fixture(); const [chunk] = groundChunkBoundaries(f.proposal, f.partition, f.understanding, 7);
    expect(chunk).toMatchObject({ materialId: f.unit.materialId, unitId: f.unit.unitId, extractionVersion: f.unit.extractionVersion,
      artifactRef: f.unit.artifactId, partitionId: f.partition.id, title: { origin: 'ai', acceptedRevision: 7 },
      durationMethod: 'reading_estimate', durationSeconds: 3, contentOrigin: 'external', coverage: f.unit.coverage });
    expect(chunk.sourceRefs).toEqual(f.partition.segments.map(segment => segment.location));
    expect(assembleGroundedChunks(f.partitions, [[chunk]])).toEqual([chunk]);
  });
  it('keeps IDs stable for copy edits and changes them for source revision or boundary changes', () => {
    const f = fixture(); const original = groundChunkBoundaries(f.proposal, f.partition, f.understanding, 1)[0];
    const edited = groundChunkBoundaries({ chunks: [{ ...f.proposal.chunks[0], title: 'New title' }] }, f.partition, f.understanding, 2)[0];
    expect(edited.id).toBe(original.id);
    const revised = partitionProcessingInput([{ ...f.unit, extractionVersion: 'b'.repeat(64) }])[0];
    expect(groundChunkBoundaries(f.proposal, revised, f.understanding, 1)[0].id).not.toBe(original.id);
    const split = { chunks: [{ ...f.proposal.chunks[0], endSegmentId: 'segment-1' },
      { ...f.proposal.chunks[0], startSegmentId: 'segment-2', conceptIndices: [] }] };
    const chunks = groundChunkBoundaries(split, f.partition, f.understanding, 1);
    expect(chunks).toHaveLength(2); expect(chunks[0].id).not.toBe(original.id);
  });
  it('rejects unknown, skipped, reversed, overlapping or incomplete source boundaries', () => {
    const f = fixture(); const chunk = f.proposal.chunks[0];
    for (const chunks of [[{ ...chunk, startSegmentId: 'invented' }], [{ ...chunk, startSegmentId: 'segment-1' }],
      [{ ...chunk, endSegmentId: 'segment-2' }], [{ ...chunk, endSegmentId: 'segment-1' }, { ...chunk, startSegmentId: 'segment-1' }],
      [{ ...chunk, endSegmentId: 'segment-2' }, { ...chunk, startSegmentId: 'segment-3', endSegmentId: 'segment-1' }]]) {
      expect(() => validateChunkBoundaries({ chunks }, f.partition, f.understanding)).toThrow();
    }
    expect(chunkBoundaryProposalSchema.safeParse({ ...f.proposal, command: 'publish' }).success).toBe(false);
    expect(() => validateChunkBoundaries({ chunks: [chunk, chunk] }, f.partition, f.understanding)).toThrow();
  });
  it('requires distinct known concept indices with evidence inside the selected span', () => {
    const f = fixture(); const chunk = f.proposal.chunks[0];
    for (const conceptIndices of [[1], [0, 0], [-1], [0.5]]) expect(() => validateChunkBoundaries({ chunks: [{ ...chunk, conceptIndices }] }, f.partition, f.understanding)).toThrow();
    expect(() => validateChunkBoundaries({ chunks: [{ ...chunk, endSegmentId: 'segment-1' },
      { ...chunk, startSegmentId: 'segment-2' }] }, f.partition, f.understanding)).toThrow();
    expect(() => validateChunkBoundaries(f.proposal, f.partition, { ...f.understanding, concepts: [{ ...f.understanding.concepts[0], segmentIds: ['foreign'] }] })).toThrow();
  });
  it('preserves video-observation origin, estimated anchors and incomplete coverage', () => {
    const f = fixture(2); const unit: ProcessingUnit = { ...f.unit, contentOrigin: 'ai',
      coverage: { scope: 'video_observation', exhaustive: false, limitations: ['Not a transcript; intervals are estimated.'] },
      segments: f.unit.segments.map((segment, index) => ({ ...segment,
        location: { ...segment.location, anchor: { kind: 'video', startSeconds: index * 10, endSeconds: index * 10 + 5, estimated: true } } })) };
    const partition = partitionProcessingInput([unit])[0]; const chunk = groundChunkBoundaries(f.proposal, partition, f.understanding, 1)[0];
    expect(chunk).toMatchObject({ contentOrigin: 'ai', coverage: unit.coverage, durationMethod: 'model_estimate', durationSeconds: 15 });
    expect(chunk.sourceRefs[0].anchor).toEqual(unit.segments[0].location.anchor);
  });
  it('rejects missing, duplicate, reordered and tampered partition outputs', () => {
    const f = fixture(4, {}, 34); expect(f.partitions).toHaveLength(2);
    const groups = f.partitions.map(partition => groundChunkBoundaries({ chunks: [{ ...f.proposal.chunks[0],
      startSegmentId: partition.segments[0].id, endSegmentId: partition.segments.at(-1)!.id, conceptIndices: [] }] }, partition,
      { ...f.understanding, concepts: [{ ...f.understanding.concepts[0], segmentIds: [partition.segments[0].id] }] }, 1));
    expect(assembleGroundedChunks(f.partitions, groups).map(chunk => chunk.position)).toEqual([0, 1]);
    expect(() => assembleGroundedChunks(f.partitions, groups.slice(0, 1))).toThrow();
    expect(() => assembleGroundedChunks([f.partitions[0], f.partitions[0]], groups)).toThrow();
    expect(() => assembleGroundedChunks([...f.partitions].reverse(), [...groups].reverse())).toThrow();
    for (const patch of [{ id: 'f'.repeat(64) }, { artifactRef: randomUUID() }, { extractionVersion: 'c'.repeat(64) },
      { contentOrigin: 'user' as const }, { sourceRefs: [groups[0][0].sourceRefs[0]] }]) {
      expect(() => assembleGroundedChunks(f.partitions, [[{ ...groups[0][0], ...patch }], groups[1]])).toThrow();
    }
  });
  it('enforces segment-span, per-unit and aggregate chunk bounds without truncation', () => {
    const f = fixture(101); expect(() => validateChunkBoundaries(f.proposal, f.partition, f.understanding)).toThrow();
    const large = fixture(201, {}, 17);
    const groups = large.partitions.map(partition => groundChunkBoundaries({ chunks: [{ ...large.proposal.chunks[0],
      startSegmentId: partition.segments[0].id, endSegmentId: partition.segments[0].id, conceptIndices: [] }] }, partition,
      { ...large.understanding, concepts: [{ ...large.understanding.concepts[0], segmentIds: [partition.segments[0].id] }] }, 1));
    expect(() => assembleGroundedChunks(large.partitions, groups)).toThrow('200 chunks');
    const partitions: ProcessingPartition[] = []; const allGroups: GroundedChunk[][] = [];
    for (let i = 0; i < 13; i++) {
      const source = fixture(200); partitions.push(...source.partitions);
      allGroups.push(...source.partitions.map(partition => groundChunkBoundaries({ chunks: partition.segments.map(segment => ({ ...source.proposal.chunks[0],
        startSegmentId: segment.id, endSegmentId: segment.id, conceptIndices: [] })) }, partition,
        { ...source.understanding, concepts: [{ ...source.understanding.concepts[0], segmentIds: [partition.segments[0].id] }] }, 1)));
    }
    expect(() => assembleGroundedChunks(partitions, allGroups)).toThrow('2,500');
  });
  it('checks cancellation before projecting or assembling and rejects tampered source identity', () => {
    const f = fixture(); const controller = new AbortController(); controller.abort();
    expect(() => groundChunkBoundaries(f.proposal, f.partition, f.understanding, 1, controller.signal)).toThrow();
    expect(() => assembleGroundedChunks(f.partitions, [], controller.signal)).toThrow();
    expect(() => validateChunkBoundaries(f.proposal, { ...f.partition, id: 'f'.repeat(64) }, f.understanding)).toThrow();
  });
});
