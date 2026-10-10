import { describe, expect, it, vi } from 'vitest';
vi.mock('server-only', () => ({}));
import { connectionReturnHandler } from '../connectors-return.http';
import { CONNECTION_RETURN_COOKIE } from '../connectors.http';
import { DraftNotFound } from '../draft.service';
import type { DraftService } from '../draft.service';
import { draftId } from '@/src/shared/cohort-creation/__tests__/fixtures';
import { initialSnapshot } from '@/src/shared/cohort-creation/flow';

const request = (id?: string) => new Request('https://sidequest.test/quest/connections/return', {
  headers: id ? { Cookie: `${CONNECTION_RETURN_COOKIE}=${id}` } : {},
});
describe('connection return continuity', () => {
  it('rechecks ownership before opening the durable draft and clears the continuation', async () => {
    const load = vi.fn(async () => initialSnapshot(draftId));
    const response = await connectionReturnHandler({ load }, async () => 'alice')(request(draftId));
    expect(load).toHaveBeenCalledWith('alice', draftId);
    expect(response.headers.get('Location')).toBe(`https://sidequest.test/quest/draft/${draftId}`);
    expect(response.headers.get('Set-Cookie')).toContain('Max-Age=0');
    expect(response.headers.get('Cache-Control')).toBe('no-store');
  });
  it('preserves the cookie across sign-in', async () => {
    const load = vi.fn();
    const response = await connectionReturnHandler({ load }, async () => null)(request(draftId));
    expect(response.headers.get('Location')).toContain('returnTo=%2Fquest%2Fconnections%2Freturn');
    expect(response.headers.get('Set-Cookie')).toBeNull();
    expect(load).not.toHaveBeenCalled();
  });
  it.each([undefined, 'invalid', 'https://evil.test/', '%2F%2Fevil.test'])('ignores missing/forged destinations %s', async value => {
    const load = vi.fn();
    const response = await connectionReturnHandler({ load }, async () => 'alice')(request(value));
    expect(response.headers.get('Location')).toBe('https://sidequest.test/quest/new');
    expect(load).not.toHaveBeenCalled();
  });
  it('does not open a previous account’s draft after switching accounts', async () => {
    const load = vi.fn(async () => { throw new DraftNotFound(); });
    const response = await connectionReturnHandler({ load }, async () => 'bob')(request(draftId));
    expect(load).toHaveBeenCalledWith('bob', draftId);
    expect(response.headers.get('Location')).toBe('https://sidequest.test/quest/new');
    expect(response.headers.get('Set-Cookie')).toContain('Max-Age=0');
  });
  it('preserves continuation on storage failure so reload can recover', async () => {
    const load = vi.fn<DraftService['load']>(async () => { throw new Error('Database failed'); });
    const response = await connectionReturnHandler({ load }, async () => 'alice')(request(draftId));
    expect(response.status).toBe(503);
    expect(response.headers.get('Set-Cookie')).toBeNull();
    load.mockImplementation(async () => initialSnapshot(draftId));
    expect((await connectionReturnHandler({ load }, async () => 'alice')(request(draftId))).status).toBe(302);
  });
});
