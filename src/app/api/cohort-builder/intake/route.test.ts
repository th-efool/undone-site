import { afterEach, expect, it, vi } from 'vitest';
const fake = vi.hoisted(() => ({ owner: 'owner', accept: vi.fn().mockResolvedValue({ workspaceId: 'saved' }) }));
vi.mock('@/src/server/infrastructure/auth/getCreationOwner', () => ({ getCreationOwner: async () => fake.owner }));
vi.mock('@/src/server/infrastructure/db/postgres/cohort-intake', () => ({ acceptCohortIntake: fake.accept }));
import { GET, POST } from './route';
afterEach(() => { vi.unstubAllEnvs(); fake.owner = 'owner'; fake.accept.mockClear(); });
const body = { requestId: '54103d7b-2709-4dd6-bb18-522f96b97241', prompt: 'Learn', expectedOwnerId: 'owner' };
const request = (data: unknown, origin = 'https://test.local') => new Request('https://test.local/api/cohort-builder/intake', { method: 'POST', headers: { origin }, body: JSON.stringify(data) });
it('requires same origin, current identity and enabled server policy', async () => {
  vi.stubEnv('INTERACTION_COHORT_V2_ENABLED', '1');
  expect((await POST(request(body,'https://foreign.local'))).status).toBe(403);
  expect((await POST(request({ ...body, expectedOwnerId: 'different' }))).status).toBe(409);
  vi.stubEnv('INTERACTION_COHORT_V2_ENABLED','0');
  expect((await POST(request(body))).status).toBe(403);
  expect(fake.accept).not.toHaveBeenCalled();
});
it('allows anonymous auth handoff but requires authentication for mutation', async () => {
  vi.stubEnv('INTERACTION_COHORT_V2_ENABLED', '1'); vi.stubEnv('INTERACTION_COHORT_V2_OWNERS','owner');
  fake.owner = '';
  expect((await (await GET()).json()).enabled).toBe(true);
  expect((await POST(request(body))).status).toBe(401);
  fake.owner = 'owner';
  expect((await POST(request(body))).status).toBe(202);
  expect(fake.accept).toHaveBeenCalledWith('owner', { requestId: body.requestId, prompt: 'Learn' });
});
it('bounds streaming bodies before accepting intake', async () => {
  vi.stubEnv('INTERACTION_COHORT_V2_ENABLED','1');
  expect((await POST(request({ ...body, prompt: 'x'.repeat(850_001) }))).status).toBe(413);
  expect(fake.accept).not.toHaveBeenCalled();
});
