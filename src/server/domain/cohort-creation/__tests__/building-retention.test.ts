import { randomUUID } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';
vi.mock('server-only', () => ({}));
import { applyCommand, applyEvent } from '@/src/shared/cohort-creation/flow';
import { PEDAGOGICAL_DIMENSIONS } from '@/src/shared/curriculum/pedagogicalVector.types';
import type { BuildingCheckpoint } from '@/src/shared/cohort-creation/build';
import { chunkingFixture } from './processing.fixture';
import { ChunkingContentService } from '../chunking-content.service';
import { AnalysisContentService } from '../analysis-content.service';
import { AnalysisService } from '../analysis.service';
import type { CreationAnalysis } from '../analysis';
import type { GroundedChunk } from '@/src/shared/cohort-creation/chunking';
import { BuildingService, validateBuildingCheckpoint } from '../building.service';
import { BuildingContentService } from '../building-content.service';
import type { CreationBuilding } from '../build';

async function fixture(text?: string, partitionBytes?: number) {
  const f = await chunkingFixture(text, partitionBytes); const checkpoint = await f.run();
  const state = applyEvent(applyCommand(f.state, { type: 'chunk_material', requestId: f.requestId }),
    { type: 'chunking_received', requestId: f.requestId, result: checkpoint });
  const content = new ChunkingContentService(f.content, f.artifacts); const requestId = randomUUID();
  const ai: CreationAnalysis = { identity: { provider: 'fixture', modelId: 'fixture', adapterVersion: 'analysis-v1' },
    analyze: vi.fn<CreationAnalysis['analyze']>(async (_intent, _partition, chunks: GroundedChunk[]) => ({ analyses: chunks.map((_chunk, chunkIndex) => ({ chunkIndex,
      vector: Object.fromEntries(PEDAGOGICAL_DIMENSIONS.map(key => [key, 0.5])) as Record<typeof PEDAGOGICAL_DIMENSIONS[number], number>,
      isStrictlyLinear: true, confidence: 0.8, reasoning: 'Grounded retained explanation.' })) })) };
  const service = new AnalysisService(content, ai, f.artifacts);
  const analysisCheckpoint = await service.run(f.scope, state, requestId, new AbortController().signal, async () => {});
  const accepted = applyEvent(applyCommand(state, { type: 'analyze_material', requestId }), { type: 'analysis_received', requestId, result: analysisCheckpoint });
  const ownedContent = new AnalysisContentService(content, f.artifacts); const buildingRequestId = randomUUID();
  const buildingAi: CreationBuilding = { identity: { provider: 'fixture', modelId: 'fixture-build', adapterVersion: 'building-v1' },
    build: vi.fn<CreationBuilding['build']>(async (_intent, _partition, chunks) => ({ lessons: [{ title: 'Retained educational section',
      objectives: ['Understand the retained source explanation.'], chunkIndices: chunks.map((_chunk, index) => index) }] })) };
  const building = new BuildingService(ownedContent, buildingAi, f.artifacts);
  const run = (saved?: BuildingCheckpoint, save: (value: BuildingCheckpoint) => Promise<void> = async () => {}) =>
    building.run(f.scope, accepted, buildingRequestId, new AbortController().signal, save, saved);
  return { ...f, state: accepted, content: ownedContent, ai: buildingAi, service: building, requestId: buildingRequestId, run };
}

describe('retained educational building and owned curriculum reads', () => {
  it('resumes accepted work without model credentials and assembles stable source-grounded curriculum', async () => {
    const f = await fixture(); const save = vi.fn(async () => {}); const checkpoint = await f.run(undefined, save);
    expect(checkpoint.completed).toHaveLength(2); expect(save).toHaveBeenCalledTimes(3);
    expect(JSON.stringify(checkpoint)).not.toContain('objectives'); vi.mocked(f.ai.build).mockClear();
    Object.defineProperty(f.ai, 'identity', { get: () => { throw new Error('Missing model credentials'); } });
    expect(await f.run(checkpoint)).toEqual(checkpoint); expect(f.ai.build).not.toHaveBeenCalled();
    const accepted = applyEvent(applyCommand(f.state, { type: 'build_curriculum', requestId: f.requestId }),
      { type: 'building_received', requestId: f.requestId, result: checkpoint });
    const reader = new BuildingContentService(f.content, f.artifacts);
    const loaded = await reader.load(f.scope, accepted, new AbortController().signal);
    expect(loaded.curriculum.seasons).toHaveLength(1); const lessons = loaded.curriculum.seasons[0].lessons;
    expect(lessons).toHaveLength(2); expect(lessons.map(lesson => lesson.order)).toEqual([0, 1]);
    expect(lessons.flatMap(lesson => lesson.chunkIds)).toEqual(loaded.chunks.flat().map(chunk => chunk.id));
    expect(lessons.every(lesson => lesson.type === 'ARTICLE')).toBe(true);
    expect(loaded.partitions).toEqual(f.partitions);
    expect(loaded.partitions.flatMap(partition => partition.segments).map(segment => segment.text).join('')).toBe('a'.repeat(5000));
    expect((await reader.load(f.scope, accepted, new AbortController().signal)).curriculum).toEqual(loaded.curriculum);
  });
  it('stops after denied checkpoint acceptance and only generates unfinished partitions on restart', async () => {
    const f = await fixture(); let saved: BuildingCheckpoint | undefined;
    await expect(f.run(undefined, async checkpoint => { saved = checkpoint; if (checkpoint.completed.length === 1) throw new Error('lease lost'); })).rejects.toThrow('lease lost');
    expect(f.ai.build).toHaveBeenCalledOnce(); vi.mocked(f.ai.build).mockClear();
    expect((await f.run(saved)).completed).toHaveLength(2); expect(f.ai.build).toHaveBeenCalledOnce();
    const denied = await fixture(); await expect(denied.run(undefined, async () => { throw new Error('inventory denied'); })).rejects.toThrow('inventory denied');
    expect(denied.ai.build).not.toHaveBeenCalled();
  });
  it('rejects foreign ownership, stale requests, revisions and replaced analysis references before generation', async () => {
    const f = await fixture(); const checkpoint = await f.run(); vi.mocked(f.ai.build).mockClear();
    await expect(f.service.run({ ...f.scope, ownerId: 'other' }, f.state, f.requestId, new AbortController().signal, async () => {}, checkpoint)).rejects.toMatchObject({ code: 'NOT_FOUND' });
    expect(() => validateBuildingCheckpoint(f.state, randomUUID(), checkpoint)).toThrow();
    expect(() => validateBuildingCheckpoint(f.state, f.requestId, { ...checkpoint, inputRevision: 99 })).toThrow();
    const changed = structuredClone(f.state); changed.processing!.analysis!.checkpoint!.completed[0].artifact.id = randomUUID();
    await expect(f.service.run(f.scope, changed, f.requestId, new AbortController().signal, async () => {}, checkpoint)).rejects.toThrow();
    const sourceChanged = structuredClone(f.state); sourceChanged.extractions[0].version = 'f'.repeat(64);
    await expect(f.service.run(f.scope, sourceChanged, f.requestId, new AbortController().signal, async () => {}, checkpoint)).rejects.toThrow();
    expect(f.ai.build).not.toHaveBeenCalled();
  });
  it('rejects tampered receipts, dependency bindings, retained headers and lesson counts during restart and owned read', async () => {
    const f = await fixture(); const checkpoint = await f.run(); const row = f.rows.get(checkpoint.completed[0].artifact.id)!;
    const original = structuredClone(row.value) as Record<string, unknown>;
    const accepted = applyEvent(applyCommand(f.state, { type: 'build_curriculum', requestId: f.requestId }),
      { type: 'building_received', requestId: f.requestId, result: checkpoint });
    const reader = new BuildingContentService(f.content, f.artifacts);
    for (const patch of [{ requestId: randomUUID() }, { analysis: { inputFingerprint: 'a'.repeat(64), artifact: checkpoint.completed[1].artifact } },
      { source: { ...(original.source as object), artifactId: randomUUID() } }, { proposal: { lessons: [] } }]) {
      row.value = { ...original, ...patch }; await expect(f.run(checkpoint)).rejects.toThrow();
      await expect(reader.load(f.scope, accepted, new AbortController().signal)).rejects.toThrow();
    }
    row.value = original; const bad = structuredClone(checkpoint); bad.completed[0].lessonCount = 2;
    await expect(f.run(bad)).rejects.toThrow(); const badChecksum = structuredClone(checkpoint); badChecksum.completed[0].artifact.checksum = 'f'.repeat(64);
    await expect(f.run(badChecksum)).rejects.toThrow(); row.type = 'wrong'; await expect(f.run(checkpoint)).rejects.toThrow();
  });
  it('does not retain malformed generation and honors cancellation before reads and after model completion', async () => {
    const f = await fixture(); const count = f.rows.size; vi.mocked(f.ai.build).mockResolvedValue({ lessons: [] });
    await expect(f.run()).rejects.toThrow(); expect(f.rows.size).toBe(count);
    const controller = new AbortController(); controller.abort(); f.load.mockClear();
    await expect(f.service.run(f.scope, f.state, f.requestId, controller.signal, async () => {})).rejects.toThrow(); expect(f.load).not.toHaveBeenCalled();
    const other = await fixture(); const canceled = new AbortController(); const build = other.ai.build;
    other.ai.build = async (...args) => { const proposal = await build(...args); canceled.abort(); return proposal; };
    await expect(other.service.run(other.scope, other.state, other.requestId, canceled.signal, async () => {})).rejects.toThrow();
    expect(other.rows.size).toBe(count);
  });
  it('exposes the 100 lesson per unit limit without accepting or silently truncating the 101st lesson', async () => {
    const f = await fixture('# Heading\n'.repeat(101), 10); let saved: BuildingCheckpoint | undefined;
    await expect(f.run(undefined, async checkpoint => { saved = checkpoint; })).rejects.toMatchObject({ code: 'LIMIT_EXCEEDED' });
    expect(saved).toBeUndefined(); expect(f.ai.build).not.toHaveBeenCalled();
    expect([...f.rows.values()].filter(row => row.type === 'creation-building')).toHaveLength(0);
  });
});
