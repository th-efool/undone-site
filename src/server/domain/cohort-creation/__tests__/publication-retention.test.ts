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
import { BuildingService } from '../building.service';
import { BuildingContentService } from '../building-content.service';
import type { CreationBuilding } from '../build';

import { creationSnapshotSchema } from '@/src/shared/cohort-creation/contracts';
import { rebaseReview } from '../review.service';
import { PublicationService, publicationSnapshotHash } from '../publication.service';
import type { PublicationCheckpoint } from '@/src/shared/cohort-creation/publication';
import { reserveCreationPublication, materializeCreationPublication, preservePublication } from '@/src/server/infrastructure/db/postgres/repositories/creationPublication.repo';
import type { Prisma } from '@/generated/prisma/client';

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
  const buildingCheckpoint = await run();
  const built = applyEvent(applyCommand(accepted, { type: 'build_curriculum', requestId: buildingRequestId }), { type: 'building_received', requestId: buildingRequestId, result: buildingCheckpoint });
  const contentReader = new BuildingContentService(ownedContent, f.artifacts);
  const loaded = await contentReader.load(f.scope, built, new AbortController().signal);
  const reviewed = creationSnapshotSchema.parse({ ...built, stage: 'review', review: rebaseReview(loaded.curriculum, null) });
  const publication = new PublicationService(contentReader, f.artifacts); const publicationRequestId = randomUUID(); const cohortId = randomUUID();
  return { ...f, state: reviewed, content: contentReader, service: publication, requestId: publicationRequestId, cohortId,
    run: (saved?: PublicationCheckpoint, save: (checkpoint: PublicationCheckpoint) => Promise<void> = async () => {}) => publication.run(f.scope, reviewed, publicationRequestId, 'private_activation', cohortId, new AbortController().signal, save, saved) };
}

describe('artifacts-first publication preparation and receipts', () => {
  it('preserves accepted user copy without rewriting retained source or educational dependency identities', async () => {
    const f = await fixture(); const lessonId = f.state.review!.lessonIds[0];
    f.state.review!.title = 'My own cohort title'; f.state.review!.description = 'My own description';
    f.state.review!.lessonEdits = [{ lessonId, title: 'My own lesson title', objectives: ['My retained-source objective.'] }];
    f.state.review!.editRevision++;
    const checkpoint = await f.run(); const prepared = await f.service.loadPrepared(f.scope, f.state, checkpoint, new AbortController().signal);
    expect(prepared[0].title).toBe('My own lesson title'); expect(prepared[0].objectives).toEqual(['My retained-source objective.']);
    expect(prepared[0].chunks[0].contentOrigin).toBe('user'); expect(prepared[0].chunks[0].coverage.exhaustive).toBe(true);
    expect(prepared.flatMap(artifact => artifact.chunks).map(chunk => chunk.text).join('')).toBe('a'.repeat(5000));
    expect(prepared.every(artifact => artifact.buildingFingerprint === f.state.review!.buildFingerprint)).toBe(true);
  });
  it('leaves only the accepted prefix when blob storage fails and can recover without replacing prepared artifacts', async () => {
    const f = await fixture(); const originalPut = f.artifacts.putJSON.bind(f.artifacts); let calls = 0; let saved: PublicationCheckpoint | undefined;
    const write = vi.spyOn(f.artifacts, 'putJSON').mockImplementation(async (...args) => {
      calls++; if (calls === 2) throw new Error('Blob store unavailable'); return originalPut(...args);
    });
    await expect(f.run(undefined, async checkpoint => { saved = checkpoint; })).rejects.toThrow('Blob store unavailable');
    expect(saved?.completed).toHaveLength(1); const retainedId = saved!.completed[0].artifact.id;
    write.mockRestore(); const checkpoint = await f.run(saved);
    expect(checkpoint.completed[0].artifact.id).toBe(retainedId); expect(checkpoint.completed).toHaveLength(2);
  });
  it('retains actual source bodies and canonical vectors before SQL materialization and resumes without acquisition', async () => {
    const f = await fixture(); const save = vi.fn(async () => {}); const checkpoint = await f.run(undefined, save);
    expect(checkpoint.completed).toHaveLength(2); expect(save).toHaveBeenCalledTimes(3);
    const prepared = await f.service.loadPrepared(f.scope, f.state, checkpoint, new AbortController().signal);
    expect(prepared.flatMap(artifact => artifact.chunks).map(chunk => chunk.text).join('')).toBe('a'.repeat(5000));
    expect(Object.keys(prepared[0].chunks[0].vector)).toEqual([...PEDAGOGICAL_DIMENSIONS]);
    expect(prepared[0].chunks[0].sourceRefs[0].anchor.kind).toBe('text');
    const read = vi.spyOn(f.content, 'load').mockRejectedValue(new Error('Upstream unavailable'));
    expect(await f.run(checkpoint)).toEqual(checkpoint); expect(read).not.toHaveBeenCalled();
  });
  it('retains only accepted prefixes after failed checkpoint saves and resumes unfinished work', async () => {
    const f = await fixture(); let saved: PublicationCheckpoint | undefined;
    await expect(f.run(undefined, async checkpoint => { saved = checkpoint; if (checkpoint.completed.length === 1) throw new Error('Lease lost'); })).rejects.toThrow('Lease lost');
    expect(saved?.completed).toHaveLength(1); const put = vi.spyOn(f.artifacts, 'putJSON');
    expect((await f.run(saved)).completed).toHaveLength(2); expect(put).toHaveBeenCalledOnce();
    expect(() => preservePublication(saved!, { ...saved!, completed: [] })).toThrow();
  });
  it('rejects stale review, foreign ownership, tampered deliveries and incomplete artifact inventories', async () => {
    const f = await fixture(); const checkpoint = await f.run();
    const changed = structuredClone(f.state); changed.review!.title = 'Changed after reservation';
    await expect(f.service.loadPrepared(f.scope, changed, checkpoint, new AbortController().signal)).rejects.toThrow();
    await expect(f.service.loadPrepared({ ...f.scope, ownerId: 'other' }, f.state, checkpoint, new AbortController().signal)).rejects.toMatchObject({ code: 'NOT_FOUND' });
    await expect(f.service.loadPrepared(f.scope, f.state, { ...checkpoint, completed: checkpoint.completed.slice(0, 1) }, new AbortController().signal)).rejects.toThrow();
    const row = f.rows.get(checkpoint.completed[0].artifact.id)!; const original = row.value as Record<string, unknown>;
    row.value = { ...original, cohortId: randomUUID() }; await expect(f.service.loadPrepared(f.scope, f.state, checkpoint, new AbortController().signal)).rejects.toThrow();
  });
  it('does not persist artifacts after failed inventory acceptance or cancelled preparation', async () => {
    const f = await fixture(); const originalCount = f.rows.size;
    await expect(f.run(undefined, async () => { throw new Error('Inventory rejected'); })).rejects.toThrow(); expect(f.rows.size).toBe(originalCount);
    const controller = new AbortController(); controller.abort();
    await expect(f.service.run(f.scope, f.state, f.requestId, 'private_activation', f.cohortId, controller.signal, async () => {})).rejects.toThrow();
    expect(f.rows.size).toBe(originalCount);
  });
  it('returns the durable receipt after lost response and rejects reused keys with different mode/content', async () => {
    const f = await fixture(); const snapshotHash = publicationSnapshotHash(f.state);
    const receipt = { requestId: f.requestId, mode: 'private_activation', snapshotHash, cohortId: f.cohortId, committedAt: new Date().toISOString() };
    const query = vi.fn().mockResolvedValueOnce([{ id: f.state.draftId }]).mockResolvedValueOnce([{ ...receipt, receipt }]);
    const execute = vi.fn(); const tx = { $queryRaw: query, $executeRaw: execute } as unknown as Prisma.TransactionClient;
    expect((await reserveCreationPublication(tx, f.scope.ownerId, f.state, f.requestId, 'private_activation')).receipt).toEqual(receipt); expect(execute).not.toHaveBeenCalled();
    query.mockResolvedValueOnce([{ id: f.state.draftId }]).mockResolvedValueOnce([{ ...receipt, receipt }]);
    await expect(reserveCreationPublication(tx, f.scope.ownerId, f.state, f.requestId, 'public_publish')).rejects.toThrow('conflicts');
  });
  it('materializes only once, promotes the same cohort identity, and never downgrades public content', async () => {
    const f = await fixture(); const checkpoint = await f.run(); const prepared = await f.service.loadPrepared(f.scope, f.state, checkpoint, new AbortController().signal);
    const operation = { cohortId: f.cohortId, mode: checkpoint.mode, snapshotHash: checkpoint.snapshotHash, receipt: null };
    const query = vi.fn(async () => [operation]); const create = vi.fn(async () => ({})); const update = vi.fn(async () => ({}));
    const findUnique = vi.fn().mockResolvedValue(null); const execute = vi.fn(async () => 1);
    const tx = { $queryRaw: query, $executeRaw: execute, cohort: { findUnique, create, update }, creationStorageObject: { updateMany: vi.fn(async (args: { where: { id: string | { in: string[] } } }) => ({ count: typeof args.where.id === 'string' ? 1 : args.where.id.in.length })) } } as unknown as Prisma.TransactionClient;
    const receipt = await materializeCreationPublication(tx, f.scope.ownerId, f.state, checkpoint, prepared); expect(create).toHaveBeenCalledOnce();
    query.mockResolvedValueOnce([{ ...operation, receipt }] as never);
    expect(await materializeCreationPublication(tx, f.scope.ownerId, f.state, checkpoint, prepared)).toEqual(receipt); expect(create).toHaveBeenCalledOnce();
    const publicCheckpoint = { ...checkpoint, mode: 'public_publish' as const };
    query.mockResolvedValueOnce([{ ...operation, mode: 'public_publish' }] as never);
    findUnique.mockResolvedValueOnce({ id: f.cohortId, creatorId: f.scope.ownerId, visibility: 'PRIVATE', creationSettings: { draftId: f.scope.draftId, snapshotHash: checkpoint.snapshotHash } });
    expect((await materializeCreationPublication(tx, f.scope.ownerId, f.state, publicCheckpoint, prepared)).cohortId).toBe(f.cohortId); expect(update).toHaveBeenCalledOnce(); expect(create).toHaveBeenCalledOnce();
    findUnique.mockResolvedValueOnce({ id: f.cohortId, creatorId: f.scope.ownerId, visibility: 'PUBLIC', creationSettings: { draftId: f.scope.draftId, snapshotHash: checkpoint.snapshotHash } });
    await expect(materializeCreationPublication(tx, f.scope.ownerId, f.state, checkpoint, prepared)).rejects.toThrow('cannot be downgraded');
  });
  it('does not acknowledge SQL materialization or publish source pins when cohort insertion fails', async () => {
    const f = await fixture(); const checkpoint = await f.run(); const prepared = await f.service.loadPrepared(f.scope, f.state, checkpoint, new AbortController().signal);
    const query = vi.fn(async () => [{ cohortId: f.cohortId, mode: checkpoint.mode, snapshotHash: checkpoint.snapshotHash, receipt: null }]);
    const execute = vi.fn(); const pin = vi.fn(async () => ({ count: 1 })); const create = vi.fn(async () => { throw new Error('SQL unavailable'); });
    const tx = { $queryRaw: query, $executeRaw: execute, cohort: { findUnique: vi.fn(async () => null), create }, creationStorageObject: { updateMany: pin } } as unknown as Prisma.TransactionClient;
    await expect(materializeCreationPublication(tx, f.scope.ownerId, f.state, checkpoint, prepared)).rejects.toThrow('SQL unavailable');
    expect(execute).not.toHaveBeenCalled(); expect(pin.mock.calls).toHaveLength(checkpoint.total);
    // These pre-insertion pins are transient referencedAt pins; publishedAt is only assigned after SQL materialization.
    expect(JSON.stringify(pin.mock.calls)).not.toContain('publishedAt');
  });
  it('refuses unavailable source pins before committing a publication receipt', async () => {
    const f = await fixture(); const checkpoint = await f.run(); const prepared = await f.service.loadPrepared(f.scope, f.state, checkpoint, new AbortController().signal);
    const execute = vi.fn(); const updateMany = vi.fn(async (args: { where: { id: string | { in: string[] } } }) => ({ count: typeof args.where.id === 'string' ? 1 : 0 }));
    const tx = { $queryRaw: vi.fn(async () => [{ cohortId: f.cohortId, mode: checkpoint.mode, snapshotHash: checkpoint.snapshotHash, receipt: null }]),
      $executeRaw: execute, cohort: { findUnique: vi.fn(async () => null), create: vi.fn(async () => ({})) }, creationStorageObject: { updateMany } } as unknown as Prisma.TransactionClient;
    await expect(materializeCreationPublication(tx, f.scope.ownerId, f.state, checkpoint, prepared)).rejects.toThrow('source artifacts unavailable');
    expect(execute).not.toHaveBeenCalled();
    // The caller's transaction rolls relational insertion back; this unit test asserts no success receipt escapes the helper.
  });
});
