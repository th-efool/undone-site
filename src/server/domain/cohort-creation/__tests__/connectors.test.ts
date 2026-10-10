import { describe, expect, it, vi } from 'vitest';
vi.mock('server-only', () => ({}));
import { CreationConnectorService, creationConnectorTenant, type CreationConnectorGateway } from '../connectors.service';
import { creationConnectorHandler } from '../connectors.http';
import { DraftNotFound } from '../draft.service';
import { initialSnapshot } from '@/src/shared/cohort-creation/flow';
import { draftId } from '@/src/shared/cohort-creation/__tests__/fixtures';

function fixture() {
  const load = vi.fn(async (owner: string, id: string) => {
    if (owner !== 'alice' || id !== draftId) throw new DraftNotFound();
    return initialSnapshot(draftId);
  });
  const gateway: CreationConnectorGateway = {
    status: vi.fn(async () => ({ github: 'connected', notion: 'not_connected', unrelated: 'private' })),
    connect: vi.fn(async tenantId => ({ tenantId, connectUrl: 'https://auth.corsair.dev/connect/session' })),
    disconnect: vi.fn(async () => ({ ok: true as const, disconnected: true })),
  };
  const getGateway = vi.fn(() => gateway);
  const service = new CreationConnectorService({ load }, getGateway);
  const handler = creationConnectorHandler(service, async () => 'alice', () => 'https://sidequest.test');
  return { load, gateway, getGateway, service, handler };
}
function request(method = 'GET', body?: unknown, origin = 'https://sidequest.test') {
  return new Request('https://sidequest.test/api/connections', { method,
    headers: { Origin: origin, 'Content-Type': 'application/json' },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
}
describe('owned creation connections', () => {
  it('uses a stable opaque user tenant across drafts, never a material or client tenant', () => {
    expect(creationConnectorTenant('alice')).toMatch(/^creation_[a-f0-9]{64}$/);
    expect(creationConnectorTenant('alice')).toBe(creationConnectorTenant('alice'));
    expect(creationConnectorTenant('alice')).not.toBe(creationConnectorTenant('bob'));
    expect(() => creationConnectorTenant(' ')).toThrow();
  });
  it('checks the owned draft before exposing status and strips provider extras', async () => {
    const { service, load, gateway } = fixture();
    expect(await service.status('alice', draftId)).toEqual({ github: 'connected', notion: 'not_connected' });
    expect(load).toHaveBeenCalledWith('alice', draftId);
    expect(gateway.status).toHaveBeenCalledWith(creationConnectorTenant('alice'));
  });
  it.each(['status', 'connect', 'disconnect'] as const)('denies foreign/expired drafts before %s', async operation => {
    const { service, getGateway } = fixture();
    await expect(service[operation]('bob', draftId, 'github')).rejects.toBeInstanceOf(DraftNotFound);
    expect(getGateway).not.toHaveBeenCalled();
  });
  it('creates only an owned provider link and disconnects only that user', async () => {
    const { service, gateway } = fixture();
    expect(await service.connect('alice', draftId, 'notion')).toEqual({ connectUrl: 'https://auth.corsair.dev/connect/session' });
    expect(gateway.connect).toHaveBeenCalledWith(creationConnectorTenant('alice'), 'notion');
    await service.disconnect('alice', draftId, 'github');
    expect(gateway.disconnect).toHaveBeenCalledWith(creationConnectorTenant('alice'), 'github');
  });
  it.each(['https://evil.test/connect', 'https://auth.corsair.dev.evil.test/', 'http://auth.corsair.dev/', 'https://x@auth.corsair.dev/'])('rejects unexpected connect destination %s', async connectUrl => {
    const { service, gateway } = fixture();
    vi.mocked(gateway.connect).mockImplementation(async tenantId => ({ tenantId, connectUrl }));
    await expect(service.connect('alice', draftId, 'github')).rejects.toThrow('Invalid connector link');
  });
  it('rejects tenant mismatches and malformed gateway status without leaking internals', async () => {
    const { handler, gateway } = fixture();
    vi.mocked(gateway.connect).mockResolvedValue({ tenantId: 'bob', connectUrl: 'https://auth.corsair.dev/connect' });
    expect((await handler(request('POST', { plugin: 'github' }), draftId)).status).toBe(503);
    vi.mocked(gateway.status).mockResolvedValue({ github: 'secret-token', notion: 'connected' });
    const response = await handler(request(), draftId);
    expect(response.status).toBe(503);
    expect(await response.text()).not.toContain('secret-token');
  });
  it('denies unauthenticated, invalid and foreign draft access', async () => {
    const { service, getGateway, handler } = fixture();
    expect((await creationConnectorHandler(service, async () => null, () => '')(request(), draftId)).status).toBe(401);
    expect((await handler(request(), 'invalid')).status).toBe(404);
    const foreign = creationConnectorHandler(service, async () => 'bob', () => 'https://sidequest.test');
    expect((await foreign(request(), draftId)).status).toBe(404);
    expect(getGateway).not.toHaveBeenCalled();
  });
  it('rejects cross-origin mutations, unexpected fields/providers and oversized bodies', async () => {
    const { handler, getGateway } = fixture();
    expect((await handler(request('POST', { plugin: 'github' }, 'https://evil.test'), draftId)).status).toBe(403);
    for (const body of [{ plugin: 'github', tenantId: 'bob' }, { plugin: 'slack' }, { plugin: 'github', padding: 'x'.repeat(600) }]) {
      expect((await handler(request('POST', body), draftId)).status).toBe(400);
    }
    expect(getGateway).not.toHaveBeenCalled();
  });
  it('returns no-store results for status/connect/disconnect', async () => {
    const { handler } = fixture();
    for (const method of ['GET', 'POST', 'DELETE']) {
      const response = await handler(request(method, method === 'GET' ? undefined : { plugin: 'github' }), draftId);
      expect(response.status).toBe(200);
      expect(response.headers.get('Cache-Control')).toBe('no-store');
      if (method === 'POST') {
        expect(response.headers.get('Set-Cookie')).toContain(`${draftId}; Path=/quest/connections/return; HttpOnly; SameSite=Lax; Max-Age=1800; Secure`);
      } else expect(response.headers.get('Set-Cookie')).toBeNull();
    }
  });
});
