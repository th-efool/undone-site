import { afterEach, expect, it, vi } from 'vitest';
vi.mock('server-only', () => ({}));
import { createInteractionModelAdapter } from '@/src/server/infrastructure/ai/interactionModel';
afterEach(() => vi.unstubAllEnvs());
it.each([
  ['production', 'postgresql://test:test@127.0.0.1/s3test'],
  ['development', 'postgresql://test:test@db.example.test/s3test'],
  ['development', 'postgresql://test:test@127.0.0.1/production'],
])('refuses local provider fixtures outside the isolated development database', async (mode, database) => {
  vi.stubEnv('INTERACTION_LOCAL_MODEL_FIXTURE', '1'); vi.stubEnv('NODE_ENV', mode); vi.stubEnv('DATABASE_URL', database);
  await expect(createInteractionModelAdapter()).rejects.toThrow('LOCAL_MODEL_FIXTURE_FORBIDDEN');
});
