import { beforeEach, describe, expect, it, vi } from 'vitest';
vi.mock('server-only', () => ({}));
const mocks = vi.hoisted(() => ({ load: vi.fn(), status: vi.fn(), token: vi.fn(), tenant: vi.fn(), runtime: vi.fn() }));
vi.mock('../draft.runtime', () => ({ draftService: { load: mocks.load } }));
vi.mock('@/src/server/infrastructure/connectors/creation-corsair', () => ({ creationCorsairRuntime: mocks.runtime }));
vi.mock('corsair/hub', () => ({ getHubConfig: () => ({ projectApiKey: 'fixture' }), getManagedAccessToken: mocks.token }));
import { getOwnedCreationToken } from '@/src/server/infrastructure/connectors/creation-source-access';
import { creationConnectorTenant } from '../connectors.service';
import { DraftNotFound } from '../draft.service';
import { draftId } from '@/src/shared/cohort-creation/__tests__/fixtures';

const scope = { ownerId: 'alice', draftId };
beforeEach(() => {
  Object.values(mocks).forEach(mock => mock.mockReset());
  mocks.load.mockResolvedValue({});
  mocks.status.mockResolvedValue({ github: 'connected', notion: 'connected' });
  mocks.token.mockResolvedValue({ accessToken: 'fixture-owned-token', expiresAt: Date.now() + 60_000 });
  mocks.tenant.mockImplementation(tenant => ({ github: { keys: { tenant, plugin: 'github' } }, notion: { keys: { tenant, plugin: 'notion' } } }));
  mocks.runtime.mockReturnValue({ client: { withTenant: mocks.tenant }, gateway: { status: mocks.status } });
});
describe('owned source credentials', () => {
  it.each(['github', 'notion'] as const)('resolves %s credentials only after ownership, in the user tenant', async plugin => {
    expect(await getOwnedCreationToken(scope, plugin)).toBe('fixture-owned-token');
    expect(mocks.load).toHaveBeenCalledWith('alice', draftId);
    const tenant = creationConnectorTenant('alice');
    expect(mocks.status).toHaveBeenCalledWith(tenant);
    expect(mocks.tenant).toHaveBeenCalledWith(tenant);
    expect(mocks.token).toHaveBeenCalledWith(expect.objectContaining({ tenantId: tenant, plugin, keys: { tenant, plugin } }));
    expect(mocks.load.mock.invocationCallOrder[0]).toBeLessThan(mocks.runtime.mock.invocationCallOrder[0]);
  });
  it('denies foreign/expired drafts before touching credentials', async () => {
    mocks.load.mockRejectedValue(new DraftNotFound());
    await expect(getOwnedCreationToken({ ownerId: 'bob', draftId }, 'github')).rejects.toBeInstanceOf(DraftNotFound);
    expect(mocks.runtime).not.toHaveBeenCalled(); expect(mocks.token).not.toHaveBeenCalled();
  });
  it('requires a connected account without shared credential fallback', async () => {
    mocks.status.mockResolvedValue({ github: 'not_connected', notion: 'connected' });
    await expect(getOwnedCreationToken(scope, 'github')).rejects.toThrow('Connect your GitHub account');
    expect(mocks.token).not.toHaveBeenCalled();
  });
  it('sanitizes refresh failures and rejects malformed tokens', async () => {
    mocks.token.mockRejectedValueOnce(new Error('private provider payload or token'));
    await expect(getOwnedCreationToken(scope, 'github')).rejects.toThrow('Your source connection could not be refreshed');
    for (const accessToken of ['', 'token\r\nInjected: true', 'x'.repeat(4097)]) {
      mocks.token.mockResolvedValueOnce({ accessToken });
      await expect(getOwnedCreationToken(scope, 'github')).rejects.toThrow('Reconnect your account');
    }
  });
  it('cancels a pending refresh and never waits for its late token', async () => {
    const controller = new AbortController();
    mocks.token.mockReturnValue(new Promise(() => undefined));
    const work = getOwnedCreationToken(scope, 'github', controller.signal);
    await vi.waitFor(() => expect(mocks.token).toHaveBeenCalledOnce());
    controller.abort(new Error('Cancelled source acquisition'));
    await expect(work).rejects.toThrow('Cancelled source acquisition');
  });
  it('does not start work after cancellation or accept an unknown provider', async () => {
    const controller = new AbortController(); controller.abort();
    await expect(getOwnedCreationToken(scope, 'github', controller.signal)).rejects.toThrow();
    // Runtime schemas defend JavaScript/internal callers as well as typed commands.
    await expect(getOwnedCreationToken(scope, 'slack' as 'github')).rejects.toThrow();
    expect(mocks.load).not.toHaveBeenCalled(); expect(mocks.runtime).not.toHaveBeenCalled();
  });
});
