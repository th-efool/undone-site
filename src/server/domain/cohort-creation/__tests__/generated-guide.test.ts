import { createHash, randomUUID } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';
vi.mock('server-only', () => ({}));
import { intent } from '@/src/shared/cohort-creation/__tests__/fixtures';
import { generatedGuideArtifactSchema, generatedGuideProposalSchema, GENERATED_GUIDE_LIMITATION } from '@/src/shared/cohort-creation/generated-guide';
import { generatedGuideFingerprint, retainGeneratedGuide } from '../generated-guide';
import { GeneratedGuideService } from '../materials/generated-guide.service';

const proposal = { title: 'Learn light transport', sections: [{ heading: 'First experiment', text: 'Change one light and compare the surfaces.\nKeep a log of the result. 😀' }], limitations: ['Introductory scope; verify technical details.'] };
const identity = { provider: 'test', modelId: 'mock', adapterVersion: 'v1' };
describe('explicit retained AI-authored guides', () => {
  it('retains complete UTF-8 content with exact anchors, stable identity and AI disclosure', () => {
    const id = randomUUID(); const body = retainGeneratedGuide(id, intent.revision + 1, intent, identity, proposal);
    expect(body).toMatchObject({ contentOrigin: 'ai', extractionKind: 'generated_guide', intentId: intent.id,
      coverage: { exhaustive: false, scope: 'ai_authored_guide', limitations: [GENERATED_GUIDE_LIMITATION, ...proposal.limitations] } });
    expect(body.segments.map(segment => segment.text).join('')).toBe(body.text);
    expect(body.utf8ByteLength).toBe(Buffer.byteLength(body.text));
    expect(retainGeneratedGuide(id, intent.revision + 1, intent, identity, proposal).version).toBe(body.version);
    expect(retainGeneratedGuide(id, intent.revision + 2, intent, identity, proposal).version).not.toBe(body.version);
    expect(retainGeneratedGuide(id, intent.revision + 1, intent, { ...identity, modelId: 'different' }, proposal).version).not.toBe(body.version);
    expect(generatedGuideFingerprint(id, 1, intent)).not.toBe(generatedGuideFingerprint(id, 2, intent));
  });
  it('rejects invented links, duplicate headings, oversized text and tampered coverage', () => {
    expect(generatedGuideProposalSchema.safeParse({ ...proposal, sections: [{ heading: 'Link', text: 'See https://invented.example/lesson' }] }).success).toBe(false);
    expect(generatedGuideProposalSchema.safeParse({ ...proposal, sections: [proposal.sections[0], { ...proposal.sections[0], heading: 'Ｆｉｒｓｔ ｅｘｐｅｒｉｍｅｎｔ' }] }).success).toBe(false);
    expect(generatedGuideProposalSchema.safeParse({ ...proposal, sections: [{ heading: 'Long', text: 'a'.repeat(4001) }] }).success).toBe(false);
    const body = retainGeneratedGuide(randomUUID(), 1, intent, identity, proposal);
    expect(generatedGuideArtifactSchema.safeParse({ ...body, segments: body.segments.slice(1) }).success).toBe(false);
    expect(generatedGuideArtifactSchema.safeParse({ ...body, coverage: { ...body.coverage, limitations: [] } }).success).toBe(false);
  });
  it('stores actual authored content under the owned scope before returning a manifest', async () => {
    const materialId = randomUUID(); const scope = { ownerId: 'owner', draftId: randomUUID() };
    const author = { identity, author: vi.fn(async () => proposal) };
    const putJSON = vi.fn(async (_scope, value, options) => {
      const body = options.schema.parse(value); const bytes = Buffer.from(JSON.stringify(body));
      return { kind: 'artifact' as const, id: randomUUID(), checksum: createHash('sha256').update(bytes).digest('hex'), byteLength: bytes.length };
    });
    const source = { id: materialId, kind: 'generated_guide' as const, input: { kind: 'goal' as const, intentId: intent.id }, status: 'acquiring' as const, selectedUnitIds: [] };
    const manifest = await new GeneratedGuideService(author, { putJSON }).acquire(scope, source, 1, intent, new AbortController().signal);
    expect(putJSON.mock.calls[0][0]).toEqual(scope);
    expect(putJSON.mock.calls[0][1]).toMatchObject({ text: expect.stringContaining(proposal.sections[0].text), contentOrigin: 'ai' });
    expect(manifest.retainedSource).toEqual(manifest.extractionArtifact);
    expect(manifest.extraction).toMatchObject({ extractionKind: 'generated_guide', complete: true, checksum: manifest.retainedSource.checksum });
    expect(manifest.source).toMatchObject({ status: 'ready', selectedUnitIds: [materialId] });
    await expect(new GeneratedGuideService(author, { putJSON }).acquire(scope, { ...source, input: { kind: 'goal', intentId: randomUUID() } }, 1, intent, new AbortController().signal)).rejects.toMatchObject({ code: 'INVALID_INPUT' });
    expect(author.author).toHaveBeenCalledOnce();
  });
  it('never acknowledges failed storage or cancelled generation', async () => {
    const source = { id: randomUUID(), kind: 'generated_guide' as const, input: { kind: 'goal' as const, intentId: intent.id }, status: 'acquiring' as const, selectedUnitIds: [] };
    const author = { identity, author: vi.fn(async () => proposal) }; const putJSON = vi.fn(async () => { throw new Error('storage failed'); });
    const service = new GeneratedGuideService(author, { putJSON }); const scope = { ownerId: 'owner', draftId: randomUUID() };
    await expect(service.acquire(scope, source, 1, intent, new AbortController().signal)).rejects.toThrow('storage failed');
    const controller = new AbortController(); controller.abort();
    await expect(service.acquire(scope, source, 1, intent, controller.signal)).rejects.toThrow();
    expect(author.author).toHaveBeenCalledOnce(); expect(putJSON).toHaveBeenCalledOnce();
  });
});
