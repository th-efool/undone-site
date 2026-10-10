import { createHash, randomUUID } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';
vi.mock('server-only', () => ({}));
import { MockLanguageModelV4 } from 'ai/test';
import { intent, modelOutput } from '@/src/shared/cohort-creation/__tests__/fixtures';
import { extractRetainedText } from '@/src/server/domain/cohort-creation/materials/text';
import { normalizeProcessingInput, partitionProcessingInput } from '@/src/server/domain/cohort-creation/processing-input';
import { validateUnderstanding } from '@/src/server/domain/cohort-creation/understanding';
import { JobBudgetExceeded } from '@/src/server/domain/cohort-creation/durable-job';
import { VercelCreationUnderstanding } from '../vercelCreationUnderstanding';

function fixture() {
  const materialId = randomUUID(); const bytes = Buffer.from('Light transport and surface reflectance.');
  const ref = { id: randomUUID(), kind: 'upload' as const, checksum: createHash('sha256').update(bytes).digest('hex'), byteLength: bytes.length };
  const body = extractRetainedText(bytes, ref, materialId, materialId);
  const units = normalizeProcessingInput({ id: materialId, kind: 'markdown', input: { kind: 'upload', assetId: ref.id }, selectedUnitIds: [materialId], status: 'ready' },
    { materialId, version: body.version, checksum: ref.checksum, artifactRef: randomUUID(), extractionKind: 'text', segmentCount: body.segments.length, complete: true }, body);
  const partition = partitionProcessingInput(units)[0];
  const proposal = { summary: 'A lighting introduction.', concepts: [{ label: 'Light transport', summary: 'Light interacts with surfaces.', segmentIds: [body.segments[0].id] }], limitations: [] };
  return { partition, proposal };
}
describe('bounded retained-content understanding', () => {
  it('uses structured output, supplied evidence and one reserved model call without tools or persistence IDs', async () => {
    const f = fixture(); const model = new MockLanguageModelV4({ doGenerate: modelOutput(f.proposal) });
    const release = vi.fn(async () => {}); const beforeCall = vi.fn(async () => release);
    const service = new VercelCreationUnderstanding(model, { beforeCall });
    expect(await service.understand(intent, f.partition, new AbortController().signal)).toEqual(f.proposal);
    expect(service.identity.adapterVersion).toBe('vercel-creation-understanding-v1');
    expect(beforeCall).toHaveBeenCalledWith(f.partition.id); expect(release).toHaveBeenCalledOnce();
    const call = model.doGenerateCalls[0]; expect(call.responseFormat?.type).toBe('json'); expect(call.maxOutputTokens).toBe(6000);
    expect(call.tools ?? []).toEqual([]);
    const prompt = JSON.stringify(call.prompt); expect(prompt).toContain(f.partition.segments[0].text);
    expect(prompt).not.toContain(f.partition.artifactId); expect(prompt).not.toContain(f.partition.materialId);
  });
  it('repairs unknown evidence once with a separate reservation and refuses repeated malformed output', async () => {
    const f = fixture(); const bad = { ...f.proposal, concepts: [{ ...f.proposal.concepts[0], segmentIds: ['invented'] }] };
    const model = new MockLanguageModelV4({ doGenerate: [modelOutput(bad), modelOutput(f.proposal)] });
    const beforeCall = vi.fn(async () => {});
    await new VercelCreationUnderstanding(model, { beforeCall }).understand(intent, f.partition, new AbortController().signal);
    expect(beforeCall).toHaveBeenCalledTimes(2);
    const malformed = new MockLanguageModelV4({ doGenerate: modelOutput({ command: 'publish' }) });
    await expect(new VercelCreationUnderstanding(malformed, { beforeCall }).understand(intent, f.partition, new AbortController().signal))
      .rejects.toMatchObject({ detail: { code: 'AI_INVALID_OUTPUT' } });
    expect(malformed.doGenerateCalls).toHaveLength(2);
  });
  it('rejects duplicate evidence and concept labels, including Unicode-equivalent labels', () => {
    const f = fixture();
    expect(() => validateUnderstanding({ ...f.proposal, concepts: [{ ...f.proposal.concepts[0], segmentIds: [f.partition.segments[0].id, f.partition.segments[0].id] }] }, f.partition)).toThrow();
    expect(() => validateUnderstanding({ ...f.proposal, concepts: [f.proposal.concepts[0], { ...f.proposal.concepts[0], label: 'Ｌｉｇｈｔ transport' }] }, f.partition)).toThrow();
    expect(() => validateUnderstanding({ ...f.proposal, concepts: [] }, f.partition)).toThrow();
  });
  it('does not repair truncated output or leak provider details', async () => {
    const f = fixture(); const truncated = new MockLanguageModelV4({ doGenerate: { ...modelOutput(f.proposal), finishReason: { unified: 'length', raw: 'MAX_TOKENS' } } });
    await expect(new VercelCreationUnderstanding(truncated, { beforeCall: async () => {} }).understand(intent, f.partition, new AbortController().signal))
      .rejects.toMatchObject({ detail: { code: 'AI_INVALID_OUTPUT', retryable: false } });
    expect(truncated.doGenerateCalls).toHaveLength(1);
    const failed = new MockLanguageModelV4({ doGenerate: async () => { throw new Error('private-secret-provider-body'); } });
    await expect(new VercelCreationUnderstanding(failed, { beforeCall: async () => {} }).understand(intent, f.partition, new AbortController().signal))
      .rejects.toMatchObject({ detail: { code: 'AI_UNAVAILABLE', message: 'Understanding is unavailable. Retained material remains saved.' } });
    expect(failed.doGenerateCalls).toHaveLength(1);
  });
  it('preserves reservation failures and cancellation without invoking the model', async () => {
    const f = fixture(); const model = new MockLanguageModelV4({ doGenerate: modelOutput(f.proposal) }); const failure = new JobBudgetExceeded();
    const beforeCall = vi.fn(async () => { throw failure; }); const service = new VercelCreationUnderstanding(model, { beforeCall });
    await expect(service.understand(intent, f.partition, new AbortController().signal)).rejects.toBe(failure);
    const controller = new AbortController(); controller.abort();
    await expect(service.understand(intent, f.partition, controller.signal)).rejects.toThrow();
    expect(model.doGenerateCalls).toHaveLength(0); expect(beforeCall).toHaveBeenCalledOnce();
  });
  it('refuses tampered partition identity and oversized prompt before reserving a call', async () => {
    const f = fixture(); const model = new MockLanguageModelV4({ doGenerate: modelOutput(f.proposal) }); const beforeCall = vi.fn(async () => {});
    const service = new VercelCreationUnderstanding(model, { beforeCall });
    await expect(service.understand(intent, { ...f.partition, id: 'b'.repeat(64) }, new AbortController().signal)).rejects.toThrow('accepted source');
    const huge = partitionProcessingInput([{ ...f.partition, coverage: { ...f.partition.coverage, limitations: ['x'.repeat(50_000)] } }])[0];
    await expect(service.understand(intent, huge, new AbortController().signal)).rejects.toMatchObject({ detail: { code: 'INVALID_REQUEST' } });
    expect(beforeCall).not.toHaveBeenCalled(); expect(model.doGenerateCalls).toHaveLength(0);
  });
});
