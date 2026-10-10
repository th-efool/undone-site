import { afterEach, describe, expect, it, vi } from 'vitest';
vi.mock('server-only', () => ({}));
import { creationConnectorConfig, handleCreationConnectorDelivery, CREATION_CONNECTOR_DELIVERY_PATH } from '@/src/server/infrastructure/connectors/creation-corsair';

const env = {
  DATABASE_URL: 'postgres://localhost/unused', CREATION_CONNECTOR_ORIGIN: 'https://sidequest.test',
  CREATION_CORSAIR_KEK: 'a'.repeat(64), CREATION_CORSAIR_API_KEY: 'ck_dev_fixture',
  CREATION_CORSAIR_SIGNING_SECRET: 'fixture-signing-secret', NODE_ENV: 'test',
} as const;
afterEach(() => vi.unstubAllEnvs());
describe('isolated connector runtime', () => {
  it('requires explicit configuration and rejects legacy fallback, bad encryption and cloud semantics', () => {
    expect(() => creationConnectorConfig({ NODE_ENV: 'test', CORSAIR_KEK: env.CREATION_CORSAIR_KEK })).toThrow();
    for (const patch of [{ CREATION_CORSAIR_KEK: '0'.repeat(64) }, { CREATION_CORSAIR_API_KEY: 'ck_cloud_bad' },
      { CREATION_CONNECTOR_ORIGIN: 'https://sidequest.test/path' }, { CREATION_CONNECTOR_ORIGIN: 'http://sidequest.test' }]) {
      expect(() => creationConnectorConfig({ ...env, ...patch })).toThrow();
    }
    const config = creationConnectorConfig(env);
    expect(config.hub).toMatchObject({ allowWorkflowExecution: false, tunnel: false, redirectURL: 'https://sidequest.test/quest/connections/return' });
    expect(config.hub).not.toHaveProperty('oauthCallbackUrl'); // OAuth callback belongs to Hub, not token delivery.
  });
  it('never mounts management/call routes', async () => {
    for (const path of ['/connect/links', '/tenants', '/call', '/tenant/notion/call/pages.create', `${CREATION_CONNECTOR_DELIVERY_PATH}/tenants`]) {
      expect((await handleCreationConnectorDelivery(new Request(`https://sidequest.test${path}`, { method: 'POST' }))).status).toBe(404);
    }
  });
  it('uses installed SDK signature verification before token delivery', async () => {
    for (const [key, value] of Object.entries(env)) vi.stubEnv(key, value);
    const response = await handleCreationConnectorDelivery(new Request(`https://sidequest.test${CREATION_CONNECTOR_DELIVERY_PATH}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'oauth.tokens', payload: { tenantId: 'forged-owner', plugin: 'notion' } }),
    }));
    expect(response.status).toBe(400);
    expect(await response.text()).toContain('Invalid tunnel signature');
    const unsignedGet = await handleCreationConnectorDelivery(new Request(`https://sidequest.test${CREATION_CONNECTOR_DELIVERY_PATH}`));
    expect(unsignedGet.status).toBe(400);
    const forgedGet = await handleCreationConnectorDelivery(new Request(`https://sidequest.test${CREATION_CONNECTOR_DELIVERY_PATH}?d=forged`));
    expect(forgedGet.status).toBe(400);
    expect(await forgedGet.text()).toContain('Invalid or expired delivery token');
  });
});
