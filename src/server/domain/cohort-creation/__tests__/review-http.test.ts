import { describe, expect, it, vi } from 'vitest';
vi.mock('server-only', () => ({}));
import { draftId } from '@/src/shared/cohort-creation/__tests__/fixtures';
import { initialSnapshot } from '@/src/shared/cohort-creation/flow';
import { generatedCurriculumSchema } from '@/src/shared/cohort-creation/artifacts';
import { rebaseReview } from '../review.service';
import { reviewHandler } from '../review.http';
import { DraftNotFound } from '../draft.service';

const curriculum = generatedCurriculumSchema.parse({ version: 'a'.repeat(64), inputRevision: 1,
  title: { value: 'Retained course', origin: 'ai', acceptedRevision: 1 }, description: { value: 'Original material', origin: 'user', acceptedRevision: 1 },
  seasons: [], warnings: [] });
function fixture() {
  const snapshot = { ...initialSnapshot(draftId), stage: 'review' as const, review: rebaseReview(curriculum, null) };
  const service = { load: vi.fn(async () => snapshot) }; const owner = vi.fn(async (): Promise<string | null> => 'owner');
  const content = { load: vi.fn<Parameters<typeof reviewHandler>[2]['load']>(async () => ({ curriculum })) }; const conversation = { list: vi.fn(async () => []) };
  const handle = reviewHandler(service, owner, content, conversation);
  return { snapshot, service, owner, content, conversation, handle };
}
describe('owned review reads', () => {
  it('authenticates and validates IDs before source reads', async () => {
    const f = fixture(); f.owner.mockResolvedValue(null);
    expect((await f.handle(new Request('https://example.test/review'), draftId)).status).toBe(401);
    expect(f.service.load).not.toHaveBeenCalled(); f.owner.mockResolvedValue('owner');
    expect((await f.handle(new Request('https://example.test/review'), 'bad')).status).toBe(404);
    expect(f.content.load).not.toHaveBeenCalled();
  });
  it('does not disclose foreign/nonexistent drafts or invalid conversation cursors', async () => {
    const f = fixture(); f.service.load.mockRejectedValueOnce(new DraftNotFound());
    expect((await f.handle(new Request('https://example.test/review'), draftId)).status).toBe(404);
    expect((await f.handle(new Request('https://example.test/review?before=bad'), draftId)).status).toBe(400);
    expect(f.content.load).not.toHaveBeenCalled();
  });
  it('projects user edits over retained curriculum and returns uncached owned history', async () => {
    const f = fixture(); f.snapshot.review.title = 'User title'; const response = await f.handle(new Request('https://example.test/review'), draftId);
    expect(response.status).toBe(200); expect(response.headers.get('Cache-Control')).toBe('no-store');
    expect((await response.json()).curriculum.title).toMatchObject({ value: 'User title', origin: 'user' });
    expect(f.content.load.mock.calls[0][0]).toEqual({ ownerId: 'owner', draftId });
    expect(f.conversation.list).toHaveBeenCalledWith('owner', draftId, { before: undefined, limit: 30 });
  });
  it('rejects a revision race and reports retained storage failure without private details', async () => {
    const f = fixture(); f.service.load.mockResolvedValueOnce(f.snapshot).mockResolvedValueOnce({ ...f.snapshot, revision: 1 });
    expect((await f.handle(new Request('https://example.test/review'), draftId)).status).toBe(409);
    f.content.load.mockRejectedValueOnce(new Error('secret blob location'));
    const response = await f.handle(new Request('https://example.test/review'), draftId);
    expect(response.status).toBe(503); expect(await response.text()).not.toContain('secret');
  });
});
