import { describe, expect, it } from 'vitest';
import { configurationChecks, connectionFailureReason } from './creation-readiness';
const env = { NODE_ENV: 'test' as const, AUTH_URL: 'http://localhost:4177', AUTH_SECRET: 'fixture-secret-long-enough', GEMINI_API_KEY: 'fixture-key-long-enough' };
describe('readiness configuration gate', () => {
  it('separates optional connector/video capabilities from core prerequisites', () => {
    const checks = configurationChecks(env);
    expect(checks.filter(check => check.required).every(check => check.status === 'configured')).toBe(true);
    expect(checks.filter(check => !check.required).every(check => check.status === 'not_configured')).toBe(true);
  });
  it.each(['https://[SENSITIVE]', 'ftp://fixture.test', 'https://user:secret@fixture.test', 'https://fixture.test/?secret=value'])('ignores obsolete fixed auth override %s without mutating environment', AUTH_URL => {
    const config = { ...env, AUTH_URL }; const report = configurationChecks(config);
    expect(report[0].status).toBe('configured'); expect(config.AUTH_URL).toBe(AUTH_URL);
    expect(JSON.stringify(report)).not.toContain(AUTH_URL);
    expect(configurationChecks({ ...env, NEXT_PUBLIC_APP_URL: AUTH_URL }).find(check => check.name === 'site metadata origin')?.status).toBe('blocked');
  });
  it('allows a configured authentication base path', () => {
    expect(configurationChecks({ ...env, AUTH_URL: 'https://fixture.test/api/auth' })[0].status).toBe('configured');
  });
  it('uses request-derived auth even when stale fixed origins conflict', () => {
    expect(configurationChecks({ ...env, AUTH_URL: 'invalid', NEXTAUTH_URL: 'https://fixture.test' })[0].status).toBe('configured');
  });
  it('rejects placeholder keys without including their value in the report', () => {
    const value = 'placeholder-secret-that-must-not-be-logged';
    const checks = configurationChecks({ ...env, GEMINI_API_KEY: value });
    expect(checks.find(check => check.name.startsWith('Google'))?.status).toBe('blocked');
    expect(JSON.stringify(checks)).not.toContain(value);
  });
  it('does not require fixed origins or claim a verified authentication session', () => {
    const report = configurationChecks({ ...env, AUTH_URL: undefined, NEXTAUTH_URL: undefined });
    expect(report[0]).toMatchObject({ status: 'configured' }); expect(report[0].name).toContain('not live session verification');
    expect(configurationChecks({ ...env, AUTH_SECRET: undefined, NEXTAUTH_SECRET: undefined }).find(check => check.name === 'authentication secret')?.status).toBe('blocked');
  });
  it.each([['ENOTFOUND', 'dns_not_found'], ['ETIMEOUT', 'dns_timeout'], [18, 'authentication_failed'],
    ['28P01', 'authentication_failed'], ['secret-bearing-arbitrary-code', 'connection_failed']])('classifies %s without copying provider messages', (code, reason) => {
    expect(connectionFailureReason({ code, message: 'secret driver details' })).toBe(reason);
    expect(connectionFailureReason(new Error('secret driver details'))).toBe('connection_failed');
  });
});
