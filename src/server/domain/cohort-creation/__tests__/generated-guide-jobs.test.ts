import { createHash, randomUUID } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';
vi.mock('server-only', () => ({}));
vi.mock('@/src/server/infrastructure/db/postgres/client', () => ({ prisma: {} }));
import { applyCommand, applyEvent, initialSnapshot } from '@/src/shared/cohort-creation/flow';
import { generatedGuideRequestSchema } from '@/src/shared/cohort-creation/jobs';
import { creationSnapshotSchema } from '@/src/shared/cohort-creation/contracts';
import { draftId, result, requestId } from '@/src/shared/cohort-creation/__tests__/fixtures';
import { GeneratedGuideService } from '../materials/generated-guide.service';
import { executeCreationJob } from '../durable-job.runner';
import type { ClaimedGuideJob, CreationJobRepository } from '../durable-job';
import { jobCompletion } from '../job-completion';
import { createCreationJobRepository } from '@/src/server/infrastructure/db/postgres/repositories/creationJob.repo';

async function fixture() {
  const accepted = applyEvent(applyCommand(initialSnapshot(draftId), { type: 'request_recommendations', requestId, query: result.intent.rawQuery }), { type: 'recommendations_received', result });
  const start = applyCommand(applyCommand(accepted, { type: 'create_own' }), { type: 'choose_starting_point', startingPoint: 'have_goal' });
  const command = { type: 'author_guide' as const, materialId: randomUUID(), requestId: randomUUID() }; const running = applyCommand(start, command);
  const input = generatedGuideRequestSchema.parse({ requestId: command.requestId, inputRevision: running.inputRevision, source: running.materials[0], intent: result.intent });
  const job: ClaimedGuideJob = { id: randomUUID(), draftId, ownerId: 'owner', kind: 'author_guide', requestId: command.requestId,
    inputRevision: running.inputRevision, inputFingerprint: 'b'.repeat(64), status: 'running', attempt: 1, input, checkpoint: null,
    leaseToken: 'lease', deadlineAt: new Date(Date.now() + 120_000), createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
  const service = new GeneratedGuideService({ identity: { provider: 'test', modelId: 'mock', adapterVersion: 'v1' },
    author: async () => ({ title: 'Lighting', sections: [{ heading: 'Experiment', text: 'Move a light and compare shading.' }], limitations: ['Verify factual claims.'] }) },
  { putJSON: async (_scope, body, options) => {
    options.schema.parse(body); const bytes = Buffer.from(JSON.stringify(body));
    return { id: randomUUID(), kind: 'artifact', checksum: createHash('sha256').update(bytes).digest('hex'), byteLength: bytes.length };
  } });
  const manifest = await service.acquire({ ownerId: job.ownerId, draftId }, input.source, input.inputRevision, input.intent, new AbortController().signal);
  const repo: CreationJobRepository = { enqueue: vi.fn(), cancel: vi.fn(), claim: vi.fn(), reserveModelCall: vi.fn(), heartbeat: vi.fn(async () => true),
    checkpoint: vi.fn(async () => true), finish: vi.fn(async () => true), retry: vi.fn(async () => false), release: vi.fn() };
  const acquire = vi.fn(async () => manifest); const args: Parameters<typeof executeCreationJob> = [repo, job, vi.fn(), new AbortController().signal];
  args[18] = () => ({ acquire });
  return { accepted, start, command, running, job, manifest, repo, acquire, args };
}
describe('explicit durable guide operation', () => {
  it('enqueues the typed owned operation once and rejects a stale draft before spending budget', async () => {
    const f = await fixture(); let current = f.start;
    const query = vi.fn(async (parts: TemplateStringsArray) => parts.join('').includes('FROM "creation_drafts"') ? [{ snapshot: current }] : [{ used: 1 }]);
    const create = vi.fn(async ({ data }) => ({ ...data, id: f.job.id, status: 'queued', attempt: 0, createdAt: new Date(), updatedAt: new Date(), leaseUntil: null }));
    const tx = { $queryRaw: query, creationJob: { create, findUnique: vi.fn(async () => null), updateMany: vi.fn() },
      creationDraft: { update: vi.fn(async () => ({ eventSequence: 1 })) }, creationEvent: { create: vi.fn() } };
    const client = { $transaction: async (work: (value: typeof tx) => unknown) => work(tx) } as unknown as Parameters<typeof createCreationJobRepository>[0];
    const repo = createCreationJobRepository(client);
    expect(await repo.enqueue('owner', f.start, f.running)).toEqual(f.running);
    expect(create).toHaveBeenCalledWith({ data: expect.objectContaining({ ownerId: 'owner', draftId, kind: 'author_guide', input: f.job.input }) });
    current = { ...f.start, revision: f.start.revision + 1 }; create.mockClear(); query.mockClear();
    expect(await repo.enqueue('owner', f.start, f.running)).toBeNull();
    expect(create).not.toHaveBeenCalled(); expect(query).toHaveBeenCalledOnce();
  });
  it('requires goal-only opt-in, uses accepted intent and permits no model-directed state', async () => {
    const f = await fixture();
    for (const startingPoint of ['have_material', 'find_material'] as const) {
      expect(() => applyCommand({ ...f.start, startingPoint }, f.command)).toThrow('Starting point');
    }
    expect(generatedGuideRequestSchema.safeParse({ ...f.job.input, intent: { ...result.intent, id: randomUUID() } }).success).toBe(false);
    expect(f.running.materials[0]).toMatchObject({ kind: 'generated_guide', input: { kind: 'goal', intentId: result.intent.id }, status: 'acquiring' });
    const ready = applyEvent(f.running, jobCompletion(f.job, f.manifest));
    expect(ready.materials[0].status).toBe('ready'); expect(ready.materialRefs[0].ids).toEqual([f.manifest.extractionArtifact.id]);
    expect(applyCommand(ready, { type: 'understand_material', requestId: randomUUID() }).processing?.phase).toBe('understanding');
  });
  it('checkpoints before completion and replays after restart without another model call', async () => {
    const f = await fixture(); await executeCreationJob(...f.args);
    expect(f.repo.checkpoint).toHaveBeenCalledWith(f.job, f.manifest);
    expect(vi.mocked(f.repo.checkpoint).mock.invocationCallOrder[0]).toBeLessThan(vi.mocked(f.repo.finish).mock.invocationCallOrder[0]);
    f.acquire.mockClear(); f.job.checkpoint = f.manifest; f.job.deadlineAt = new Date(0);
    await executeCreationJob(...f.args); expect(f.acquire).not.toHaveBeenCalled();
    expect(f.repo.finish).toHaveBeenLastCalledWith(f.job, jobCompletion(f.job, f.manifest));
  });
  it('rejects stale revisions, mismatched goal, wrong artifact and exceeded capacity', async () => {
    const f = await fixture();
    for (const bad of [ { ...f.manifest, inputRevision: f.manifest.inputRevision + 1 },
      { ...f.manifest, source: { ...f.manifest.source, input: { kind: 'goal' as const, intentId: randomUUID() } } },
      { ...f.manifest, retainedSource: { ...f.manifest.retainedSource, id: randomUUID() } } ]) {
      expect(() => jobCompletion(f.job, bad)).toThrow();
    }
    const changed = applyCommand(applyEvent(f.running, jobCompletion(f.job, f.manifest)), { type: 'remove_material', materialId: f.command.materialId });
    expect(applyEvent(changed, jobCompletion(f.job, f.manifest))).toBe(changed);
    const materials = Array.from({ length: 20 }, () => ({ ...f.manifest.source, id: randomUUID() }));
    expect(() => applyCommand(creationSnapshotSchema.parse({ ...f.start, materials }), f.command)).toThrow('20 sources');
  });
  it('does not accept cancelled or fenced results and releases interrupted work', async () => {
    const f = await fixture(); vi.mocked(f.repo.checkpoint).mockResolvedValue(false);
    await executeCreationJob(...f.args); expect(f.repo.finish).not.toHaveBeenCalled();
    const controller = new AbortController(); controller.abort(); f.args[3] = controller.signal;
    await executeCreationJob(...f.args); expect(f.repo.release).toHaveBeenCalledWith(f.job);
  });
  it('pins generated content with owner, draft, checksum and fingerprint under the existing lease', async () => {
    const f = await fixture(); const updateMany = vi.fn(async () => ({ count: 1 })); const update = vi.fn(async () => ({ ...f.job, checkpoint: f.manifest, createdAt: new Date(), updatedAt: new Date() }));
    const query = vi.fn(async (parts: TemplateStringsArray) => parts.join('').includes('FROM "creation_drafts"') ? [{ snapshot: f.running }] : [{ id: f.job.id }]);
    const tx = { $queryRaw: query, creationStorageObject: { updateMany }, creationJob: { update }, creationDraft: { update: vi.fn(async () => ({ eventSequence: 1 })) }, creationEvent: { create: vi.fn() } };
    const client = { $transaction: async (work: (value: typeof tx) => unknown) => work(tx) } as unknown as Parameters<typeof createCreationJobRepository>[0];
    const repository = createCreationJobRepository(client);
    expect(await repository.checkpoint(f.job, f.manifest)).toBe(true);
    expect(updateMany).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ ownerId: f.job.ownerId,
      draftId: f.job.draftId, artifactType: 'generated-guide', checksum: f.manifest.extractionArtifact.checksum, inputFingerprint: f.manifest.inputFingerprint }) }));
    query.mockImplementation(async (parts: TemplateStringsArray) => parts.join('').includes('FROM "creation_drafts"') ? [{ snapshot: { ...f.running, inputRevision: f.running.inputRevision + 1 } }] : [{ id: f.job.id }]);
    expect(await repository.checkpoint(f.job, f.manifest)).toBe(false);
  });
});

