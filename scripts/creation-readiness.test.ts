import { describe, expect, it } from 'vitest';
import { configurationChecks } from './creation-readiness';
const env = { NODE_ENV: 'test' as const, AUTH_URL: 'http://localhost:4177', AUTH_SECRET: 'fixture-secret-long-enough', GEMINI_API_KEY: 'fixture-key-long-enough' };
describe('readiness configuration gate', () => {
  it('separates optional connector/video capabilities from core prerequisites', () => {
    const checks = configurationChecks(env);
    expect(checks.filter(check => check.required).every(check => check.status === 'configured')).toBe(true);
    expect(checks.filter(check => !check.required).every(check => check.status === 'not_configured')).toBe(true);
  });
  it.each(['https://[SENSITIVE]', 'ftp://fixture.test', 'https://user:secret@fixture.test', 'https://fixture.test/?secret=value'])('rejects unsafe authentication URL %s', AUTH_URL => {
    expect(configurationChecks({ ...env, AUTH_URL }).find(check => check.name === 'authentication origins')?.status).toBe('blocked');
  });
  it('allows a configured authentication base path', () => {
    expect(configurationChecks({ ...env, AUTH_URL: 'https://fixture.test/api/auth' })[0].status).toBe('configured');
  });
  it('does not accept a valid legacy origin when the higher-priority origin is invalid', () => {
    expect(configurationChecks({ ...env, AUTH_URL: 'invalid', NEXTAUTH_URL: 'https://fixture.test' })[0].status).toBe('blocked');
  });
  it('rejects placeholder keys without including their value in the report', () => {
    const value = 'placeholder-secret-that-must-not-be-logged';
    const checks = configurationChecks({ ...env, GEMINI_API_KEY: value });
    expect(checks.find(check => check.name.startsWith('Google'))?.status).toBe('blocked');
    expect(JSON.stringify(checks)).not.toContain(value);
  });
});
