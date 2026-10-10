import { randomUUID } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';
vi.mock('server-only', () => ({}));
import { MockLanguageModelV4 } from 'ai/test';
import { modelOutput } from '@/src/shared/cohort-creation/__tests__/fixtures';
import { generatedCurriculumSchema } from '@/src/shared/cohort-creation/artifacts';
import { reviewWorkspaceSchema } from '@/src/shared/cohort-creation/review';
import { refinementContext, validateRefinementProposal } from '@/src/server/domain/cohort-creation/refinement';
import { JobBudgetExceeded } from '@/src/server/domain/cohort-creation/durable-job';
import { VercelCreationRefinement } from '../vercelCreationRefinement';

function fixture() {
  const lessonId = randomUUID(); const field = (value: string) => ({ value, origin: 'ai', acceptedRevision: 1 });
  const curriculum = generatedCurriculumSchema.parse({ version: 'a'.repeat(64), inputRevision: 1,
    title: field('Rendering'), description: field('Study retained rendering material.'), warnings: [], seasons: [{ id: randomUUID(),
      title: field('Light'), order: 0, lessons: [{ id: lessonId, title: field('Surfaces'), objectives: { value: ['Describe reflectance.'], origin: 'ai', acceptedRevision: 1 },
        order: 0, type: 'ARTICLE', chunkIds: ['accepted-chunk'], materialIds: ['private-material'], durationSeconds: 12 }] }] });
  const review = reviewWorkspaceSchema.parse({ title: 'Rendering', description: 'Study retained rendering material.', buildFingerprint: curriculum.version,
    editRevision: 2, lessonEdits: [{ lessonId, title: 'My edited surface title' }], visibility: 'PRIVATE', chatEnabled: false, eventsEnabled: false, proposal: null });
  const proposal = { message: 'Proposed a clearer title.', changes: [{ type: 'lesson_title' as const, lessonId, value: 'Understanding surface reflectance' }] };
  return { lessonId, curriculum, review, proposal };
}
describe('bounded conversational refinement', () => {
  it('proposes typed edits from current user-edited curriculum without source bodies or application controls', async () => {
    const f = fixture(); const model = new MockLanguageModelV4({ doGenerate: modelOutput(f.proposal) });
    const release = vi.fn(async () => {}); const beforeCall = vi.fn(async () => release);
    expect(await new VercelCreationRefinement(model, { beforeCall }).refine('Make that lesson title clearer', f.curriculum, f.review, new AbortController().signal)).toEqual(f.proposal);
    expect(release).toHaveBeenCalledOnce(); const call = model.doGenerateCalls[0]; const prompt = JSON.stringify(call.prompt);
    expect(call.responseFormat?.type).toBe('json'); expect(call.tools ?? []).toEqual([]); expect(call.maxOutputTokens).toBe(6000);
    expect(prompt).toContain('My edited surface title'); expect(prompt).not.toContain('private-material'); expect(prompt).not.toContain('accepted-chunk');
    expect(f.review.lessonEdits[0].title).toBe('My edited surface title');
  });
  it('honestly permits unsupported requests to return explanation without changes', async () => {
    const f = fixture(); const proposal = { message: 'Adding new sources requires returning to material selection.', changes: [] };
    const model = new MockLanguageModelV4({ doGenerate: modelOutput(proposal) });
    expect(await new VercelCreationRefinement(model, { beforeCall: async () => {} }).refine('Import another book', f.curriculum, f.review, new AbortController().signal)).toEqual(proposal);
  });
  it('repairs a foreign lesson key once with an independently reserved call', async () => {
    const f = fixture(); const model = new MockLanguageModelV4({ doGenerate: [modelOutput({ ...f.proposal, changes: [{ ...f.proposal.changes[0], lessonId: 'foreign' }] }), modelOutput(f.proposal)] });
    const beforeCall = vi.fn(async () => {});
    expect(await new VercelCreationRefinement(model, { beforeCall }).refine('Clarify title', f.curriculum, f.review, new AbortController().signal)).toEqual(f.proposal);
    expect(beforeCall).toHaveBeenCalledTimes(2); expect(model.doGenerateCalls).toHaveLength(2);
  });
  it('rejects duplicate edits, invented lessons, arbitrary commands and excessive changes', () => {
    const f = fixture();
    for (const changes of [[f.proposal.changes[0], f.proposal.changes[0]], [{ ...f.proposal.changes[0], lessonId: 'foreign' }],
      [{ type: 'publish', value: true }], Array.from({ length: 21 }, () => ({ type: 'title', value: 'Title' }))]) {
      expect(() => validateRefinementProposal({ message: 'Proposal', changes }, f.curriculum)).toThrow();
    }
    expect(() => reviewWorkspaceSchema.parse({ ...f.review, lessonEdits: [f.review.lessonEdits[0], f.review.lessonEdits[0]] })).toThrow();
    expect(() => refinementContext(f.curriculum, { ...f.review, buildFingerprint: 'f'.repeat(64) })).toThrow();
  });
  it('rejects repeated invalid output and truncation without accepting partial actions', async () => {
    const f = fixture(); const bad = new MockLanguageModelV4({ doGenerate: modelOutput({ command: 'publish' }) });
    await expect(new VercelCreationRefinement(bad, { beforeCall: async () => {} }).refine('Publish', f.curriculum, f.review, new AbortController().signal))
      .rejects.toMatchObject({ detail: { code: 'AI_INVALID_OUTPUT' } }); expect(bad.doGenerateCalls).toHaveLength(2);
    const truncated = new MockLanguageModelV4({ doGenerate: { ...modelOutput(f.proposal), finishReason: { unified: 'length', raw: 'MAX_TOKENS' } } });
    await expect(new VercelCreationRefinement(truncated, { beforeCall: async () => {} }).refine('Clarify', f.curriculum, f.review, new AbortController().signal))
      .rejects.toMatchObject({ detail: { code: 'AI_INVALID_OUTPUT', retryable: false } }); expect(truncated.doGenerateCalls).toHaveLength(1);
  });
  it('preserves quota errors and cancellation while releasing reserved slots', async () => {
    const f = fixture(); const model = new MockLanguageModelV4({ doGenerate: modelOutput(f.proposal) }); const failure = new JobBudgetExceeded();
    await expect(new VercelCreationRefinement(model, { beforeCall: async () => { throw failure; } }).refine('Clarify', f.curriculum, f.review, new AbortController().signal)).rejects.toBe(failure);
    const controller = new AbortController(); const release = vi.fn(async () => {});
    await expect(new VercelCreationRefinement(model, { beforeCall: async () => { controller.abort(); return release; } }).refine('Clarify', f.curriculum, f.review, controller.signal)).rejects.toThrow();
    expect(release).toHaveBeenCalledOnce(); expect(model.doGenerateCalls).toHaveLength(0);
  });
});
