import { describe, expect, it } from 'vitest';
import { MemoryInteractionRepository } from 'interaction-builder/runtime';
import { cohortWorkspaceSchema, planCohortAction, type CohortWorkspace } from '@/src/shared/cohort-builder/contracts';
import { advanceTextWorkspace } from '../text-worker';
import { computeTextStage, planTextStage } from '../text-pipeline';

const ownerId = 'owner-1';
const workspaceId = '3a85ba93-5f1e-488d-8464-717982f34973';
const initial = () => cohortWorkspaceSchema.parse({
  schemaVersion: 1, title: 'Systems', intent: 'Learn reliable distributed systems',
  audience: 'Engineers', dailyMinutes: 25, lessons: [],
});

async function setup() {
  const repo = new MemoryInteractionRepository();
  await repo.createWorkspace({ id: workspaceId, ownerId, domainId: 'cohort', domainVersion: 1, initialSnapshot: initial() });
  return repo;
}

async function userAction(repo: MemoryInteractionRepository, action: unknown) {
  const ws = (await repo.loadWorkspace<CohortWorkspace>({ workspaceId, ownerId }))!;
  return repo.commitAction<CohortWorkspace>({ ownerId, workspaceId, expectedRevision: ws.revision,
    envelope: { actionId: crypto.randomUUID(), workspaceId, expectedRevision: ws.revision, entityVersions: [], action },
    plan: planCohortAction,
  });
}

describe('owned pasted-text processing checkpoints', () => {
  it('resumes after each persisted stage and produces verified anchored lessons', async () => {
    const repo = await setup();
    await userAction(repo, { type: 'add_text_source', sourceId: 'source-1', label: 'Notes', text: 'Consensus orders replicated writes. Quorums tolerate failures.' });
    for (let stage = 0; stage < 5; stage += 1) {
      expect(await advanceTextWorkspace(repo, ownerId, workspaceId)).toBe(true);
      // Each call reloads persisted state, as a replacement worker would.
    }
    const ws = (await repo.loadWorkspace<CohortWorkspace>({ workspaceId, ownerId }))!.snapshot;
    expect(ws.processing).toMatchObject({ status: 'ready', stage: 'done' });
    expect(ws.sources[0].checksum).toMatch(/^[a-f0-9]{64}$/);
    expect(ws.understanding).toHaveLength(1);
    expect(ws.analyses).toHaveLength(ws.chunks.length);
    expect(ws.lessons.length).toBeGreaterThan(0);
    for (const lesson of ws.lessons) for (const id of lesson.sourceChunkIds) {
      const chunk = ws.chunks.find(item => item.id === id)!;
      expect(ws.sources[0].text.slice(chunk.start, chunk.end)).toBe(chunk.text);
    }
    expect(await advanceTextWorkspace(repo, ownerId, workspaceId)).toBe(false);
  });

  it('rejects fabricated anchors and a removed source result', async () => {
    const repo = await setup();
    await userAction(repo, { type: 'add_text_source', sourceId: 'source-1', label: 'Notes', text: 'Reliable queues retain work.' });
    await advanceTextWorkspace(repo, ownerId, workspaceId);
    await advanceTextWorkspace(repo, ownerId, workspaceId);
    const ws = (await repo.loadWorkspace<CohortWorkspace>({ workspaceId, ownerId }))!;
    const action = computeTextStage(ws.snapshot);
    const fake = { ...action, result: [{ ...(action.result as any[])[0], text: 'Invented passage' }] };
    expect(() => planTextStage(ws.snapshot, fake, { expectedRevision: ws.revision, currentRevision: ws.revision })).toThrow('FABRICATED_SOURCE_ANCHOR');
    const foreign = { ...action, result: [{ ...(action.result as any[])[0], sourceId: 'foreign-workspace-source' }] };
    expect(() => planTextStage(ws.snapshot, foreign, { expectedRevision: ws.revision, currentRevision: ws.revision })).toThrow('FOREIGN_OR_STALE_SOURCE_ANCHOR');
    await userAction(repo, { type: 'remove_source', sourceId: 'source-1' });
    const removed = (await repo.loadWorkspace<CohortWorkspace>({ workspaceId, ownerId }))!;
    expect(() => planTextStage(removed.snapshot, action, { expectedRevision: removed.revision, currentRevision: removed.revision })).toThrow('STALE_SOURCE_RESULT');
  });

  it('keeps a pinned manual lesson while regenerating after another source', async () => {
    const repo = await setup();
    await userAction(repo, { type: 'add_lesson', lessonId: 'manual-1', title: 'My lesson', objective: 'Keep my outcome' });
    await userAction(repo, { type: 'set_lesson_pin', lessonId: 'manual-1', pinned: true });
    await userAction(repo, { type: 'add_text_source', sourceId: 'source-1', label: 'Notes', text: 'Replication copies data across nodes.' });
    for (let stage = 0; stage < 5; stage += 1) await advanceTextWorkspace(repo, ownerId, workspaceId);
    const ws = (await repo.loadWorkspace<CohortWorkspace>({ workspaceId, ownerId }))!.snapshot;
    expect(ws.lessons[0]).toMatchObject({ id: 'manual-1', pinned: true, title: 'My lesson' });
    expect(ws.lessons.some(item => item.sourceChunkIds.length > 0)).toBe(true);
  });

  it('reuses unchanged source artifacts and preserves an edited generated lesson', async () => {
    const repo = await setup();
    await userAction(repo, { type: 'add_text_source', sourceId: 'source-1', label: 'First', text: 'Retries repeat work safely.' });
    for (let stage = 0; stage < 5; stage += 1) await advanceTextWorkspace(repo, ownerId, workspaceId);
    const first = (await repo.loadWorkspace<CohortWorkspace>({ workspaceId, ownerId }))!.snapshot;
    const editedId = first.lessons[0].id;
    await userAction(repo, { type: 'edit_lesson', lessonId: editedId, objective: 'My retained explanation' });
    await userAction(repo, { type: 'add_text_source', sourceId: 'source-2', label: 'Second', text: 'A quorum accepts a majority.' });
    for (let stage = 0; stage < 5; stage += 1) await advanceTextWorkspace(repo, ownerId, workspaceId);
    const second = (await repo.loadWorkspace<CohortWorkspace>({ workspaceId, ownerId }))!.snapshot;
    expect(second.chunks.find(item => item.sourceId === 'source-1')).toEqual(first.chunks[0]);
    expect(second.analyses.find(item => item.chunkId === first.chunks[0].id)).toEqual(first.analyses[0]);
    expect(second.lessons.find(item => item.id === editedId)?.objective).toBe('My retained explanation');
    expect(second.lessons.some(item => item.sourceChunkIds.some(id => id.startsWith('source-2:')))).toBe(true);
  });

  it('editing one source invalidates its evidence but retains unaffected source artifacts', async () => {
    const repo = await setup();
    await userAction(repo, { type: 'add_text_source', sourceId: 'source-1', label: 'First', text: 'Queues retain messages.' });
    await userAction(repo, { type: 'add_text_source', sourceId: 'source-2', label: 'Second', text: 'A quorum needs overlap.' });
    for (let stage = 0; stage < 5; stage += 1) await advanceTextWorkspace(repo, ownerId, workspaceId);
    const before = (await repo.loadWorkspace<CohortWorkspace>({ workspaceId, ownerId }))!.snapshot;
    const staleAction = computeTextStage({ ...before, processing: { ...before.processing, status: 'queued', stage: 'assembly' } });
    await userAction(repo, { type: 'edit_lesson', lessonId: before.lessons[0].id, objective: 'My own interpretation' });
    await userAction(repo, { type: 'edit_text_source', sourceId: 'source-1', label: 'First revised', text: 'Queues retain messages and replay them.' });
    const editedRecord = (await repo.loadWorkspace<CohortWorkspace>({ workspaceId, ownerId }))!;
    const edited = editedRecord.snapshot;
    expect(edited.sources[0].version).toBe(1);
    expect(edited.chunks.some(chunk => chunk.sourceId === 'source-1')).toBe(false);
    expect(edited.lessons.find(lesson => lesson.id === before.lessons[0].id)?.evidenceStatus).toBe('orphaned');
    expect(edited.chunks.filter(chunk => chunk.sourceId === 'source-2')).toEqual(before.chunks.filter(chunk => chunk.sourceId === 'source-2'));
    expect(() => planTextStage(edited, staleAction, { expectedRevision: editedRecord.revision, currentRevision: editedRecord.revision })).toThrow('STALE_SOURCE_RESULT');
    for (let stage = 0; stage < 5; stage += 1) await advanceTextWorkspace(repo, ownerId, workspaceId);
    const after = (await repo.loadWorkspace<CohortWorkspace>({ workspaceId, ownerId }))!.snapshot;
    expect(after.chunks.find(chunk => chunk.sourceId === 'source-1')?.sourceVersion).toBe(1);
    expect(after.chunks.filter(chunk => chunk.sourceId === 'source-2')).toEqual(before.chunks.filter(chunk => chunk.sourceId === 'source-2'));
  });

  it('assembles every accepted chunk instead of silently dropping chunks after twelve', async () => {
    const repo = await setup();
    await userAction(repo, { type: 'add_text_source', sourceId: 'source-1', label: 'Thirteen facts', text: Array.from({ length: 13 }, (_, i) => `Fact ${i + 1} matters.`).join(' ') });
    for (let stage = 0; stage < 5; stage += 1) await advanceTextWorkspace(repo, ownerId, workspaceId);
    const state = (await repo.loadWorkspace<CohortWorkspace>({ workspaceId, ownerId }))!.snapshot;
    expect(state.processing.status).toBe('ready');
    expect(state.chunks).toHaveLength(13);
    expect(state.lessons).toHaveLength(13);
    expect(new Set(state.lessons.flatMap(lesson => lesson.sourceChunkIds))).toEqual(new Set(state.chunks.map(chunk => chunk.id)));
  });

  it('rejects an oversized source before persistence', () => {
    const state = initial();
    expect(() => planCohortAction(state, { type: 'add_text_source', label: 'Huge', text: 'é'.repeat(110_000) }, {
      actionId: 'a', workspaceId, expectedRevision: 0, currentRevision: 0, entityVersions: new Map(),
    })).toThrow('SOURCE_TOO_LARGE');
  });

  it('fences a second worker accepting the same checkpoint', async () => {
    const repo = await setup();
    await userAction(repo, { type: 'add_text_source', sourceId: 'source-1', label: 'Notes', text: 'Durable jobs resume from checkpoints.' });
    const ws = (await repo.loadWorkspace<CohortWorkspace>({ workspaceId, ownerId }))!;
    const action = computeTextStage(ws.snapshot);
    const envelope = { actionId: crypto.randomUUID(), workspaceId, expectedRevision: ws.revision, entityVersions: [], action };
    await repo.commitAction<CohortWorkspace>({ ownerId, workspaceId, expectedRevision: ws.revision, envelope, plan: planTextStage });
    await expect(repo.commitAction<CohortWorkspace>({ ownerId, workspaceId, expectedRevision: ws.revision,
      envelope: { ...envelope, actionId: crypto.randomUUID() }, plan: planTextStage,
    })).rejects.toThrow('STALE_WORKSPACE');
  });

  it('rebuilds only the dependent stage when the goal changes after processing', async () => {
    const repo = await setup();
    await userAction(repo, { type: 'add_text_source', sourceId: 'source-1', label: 'Notes', text: 'Logs record events durably.' });
    for (let stage = 0; stage < 5; stage += 1) await advanceTextWorkspace(repo, ownerId, workspaceId);
    const before = (await repo.loadWorkspace<CohortWorkspace>({ workspaceId, ownerId }))!.snapshot;
    await userAction(repo, { type: 'set_intent', intent: 'Learn event sourcing' });
    const queued = (await repo.loadWorkspace<CohortWorkspace>({ workspaceId, ownerId }))!.snapshot;
    expect(queued.processing).toMatchObject({ status: 'queued', stage: 'assembly' });
    await advanceTextWorkspace(repo, ownerId, workspaceId);
    const after = (await repo.loadWorkspace<CohortWorkspace>({ workspaceId, ownerId }))!.snapshot;
    expect(after.chunks).toEqual(before.chunks);
    expect(after.analyses).toEqual(before.analyses);
    expect(after.lessons[0].objective).toContain('Learn event sourcing');
  });

  it('keeps acquisition queued if the goal changes before the first worker stage', async () => {
    const repo = await setup();
    await userAction(repo, { type: 'add_text_source', sourceId: 'source-1', label: 'Notes', text: 'Quorums overlap.' });
    await userAction(repo, { type: 'set_intent', intent: 'Learn consensus' });
    const ws = (await repo.loadWorkspace<CohortWorkspace>({ workspaceId, ownerId }))!.snapshot;
    expect(ws.processing.stage).toBe('acquisition');
  });

  it('persists a processing failure and allows an explicit retry', async () => {
    const repo = await setup();
    await userAction(repo, { type: 'add_text_source', sourceId: 'source-1', label: 'Pathological notes', text: 'x.'.repeat(2_100) });
    await advanceTextWorkspace(repo, ownerId, workspaceId); // acquisition
    await advanceTextWorkspace(repo, ownerId, workspaceId); // understanding
    expect(await advanceTextWorkspace(repo, ownerId, workspaceId)).toBe(true); // chunking fails
    const failed = (await repo.loadWorkspace<CohortWorkspace>({ workspaceId, ownerId }))!.snapshot;
    expect(failed.processing).toMatchObject({ status: 'failed', stage: 'chunking' });
    expect(failed.processing.error).toMatch(/TOO_MANY_CHUNKS/);
    expect(await advanceTextWorkspace(repo, ownerId, workspaceId)).toBe(false);
    await userAction(repo, { type: 'retry_processing' });
    const retried = (await repo.loadWorkspace<CohortWorkspace>({ workspaceId, ownerId }))!.snapshot;
    expect(retried.processing).toMatchObject({ status: 'queued', stage: 'acquisition' });
    expect(retried.processing.generation).toBeGreaterThan(failed.processing.generation);
  });
});
