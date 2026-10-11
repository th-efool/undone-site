import { describe, expect, it } from 'vitest';
import { readCorsairConfig } from './corsair-config';

const base = { NODE_ENV: 'test' as const, DATABASE_URL: 'postgres://fixture', CORSAIR_KEK: 'a'.repeat(64) };
describe('Corsair Hub configuration', () => {
  it('uses the standard key pair with the existing database and KEK', () => {
    expect(readCorsairConfig({ ...base, CORSAIR_API_KEY: 'ck_dev_fixture', CORSAIR_SIGNING_SECRET: 'fixture-secret' })).toEqual({
      connectionString: base.DATABASE_URL, kek: base.CORSAIR_KEK,
      hub: { projectApiKey: 'ck_dev_fixture', signingSecret: 'fixture-secret' },
    });
  });
  it.each(['development', 'production'] as const)('preserves the legacy %s credential pair', NODE_ENV => {
    const prefix = NODE_ENV === 'production' ? 'CORSAIR_PROD' : 'CORSAIR_DEV';
    expect(readCorsairConfig({ ...base, NODE_ENV, [`${prefix}_API_KEY`]: 'fixture-key', [`${prefix}_SIGNING_SECRET`]: 'fixture-secret' }).hub.projectApiKey).toBe('fixture-key');
  });
  it('does not combine a partial standard pair with legacy secrets', () => {
    expect(() => readCorsairConfig({ ...base, CORSAIR_API_KEY: 'ck_dev_fixture', CORSAIR_DEV_SIGNING_SECRET: 'legacy' })).toThrow('Missing CORSAIR_SIGNING_SECRET');
  });
  it.each(['', 'invalid', '0'.repeat(64)])('rejects missing or insecure encryption keys', CORSAIR_KEK => {
    expect(() => readCorsairConfig({ ...base, CORSAIR_KEK })).toThrow();
  });
});
