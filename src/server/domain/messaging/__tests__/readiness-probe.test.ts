import { describe, it, expect } from 'vitest';
import {
  evaluateEnvironmentConfig,
  formatReadinessReportMarkdown,
  runMessagingReadinessProbe,
  type MessagingReadinessReport,
} from '../../../../../scripts/messaging-readiness';

describe('Phase 13: Messaging Readiness Probe', () => {
  it('blocks when required secrets or DATABASE_URL are missing', () => {
    const emptyEnv = {} as unknown as NodeJS.ProcessEnv;
    const checks = evaluateEnvironmentConfig(emptyEnv);

    const dbCheck = checks.find(c => c.name.includes('DATABASE_URL'));
    expect(dbCheck?.status).toBe('blocked');

    const hmacCheck = checks.find(c => c.name.includes('CENTRIFUGO_HMAC_SECRET_KEY'));
    expect(hmacCheck?.status).toBe('blocked');

    const apiKeyCheck = checks.find(c => c.name.includes('CENTRIFUGO_API_KEY'));
    expect(apiKeyCheck?.status).toBe('blocked');

    const internalSecretCheck = checks.find(c => c.name.includes('INTERNAL_API_SECRET'));
    expect(internalSecretCheck?.status).toBe('blocked');
  });

  it('rejects trivial or short placeholder secrets', () => {
    const weakEnv = {
      NODE_ENV: 'test',
      DATABASE_URL: 'postgresql://localhost:5432/test',
      CENTRIFUGO_HMAC_SECRET_KEY: 'secret-placeholder-changeme-too-weak',
      CENTRIFUGO_API_KEY: '12345',
      CENTRIFUGO_PROXY_KEY: 'short',
      INTERNAL_API_SECRET: 'test',
    } as unknown as NodeJS.ProcessEnv;

    const checks = evaluateEnvironmentConfig(weakEnv);
    const hmacCheck = checks.find(c => c.name.includes('CENTRIFUGO_HMAC_SECRET_KEY'));
    expect(hmacCheck?.status).toBe('blocked');

    const apiCheck = checks.find(c => c.name.includes('CENTRIFUGO_API_KEY'));
    expect(apiCheck?.status).toBe('blocked');
  });

  it('marks all checks ready when valid environment is configured', () => {
    const validEnv = {
      NODE_ENV: 'test',
      DATABASE_URL: 'postgresql://localhost:5432/test',
      CENTRIFUGO_HMAC_SECRET_KEY: 'c7d8e9f0a1b2c3d4e5f60718293a4b5c6d7e8f90a1b2c3d4e5f60718293a4b5c',
      CENTRIFUGO_API_KEY: 'api-key-32-chars-long-secure-token-1234',
      CENTRIFUGO_PROXY_KEY: 'proxy-key-32-chars-long-secure-tok-5678',
      INTERNAL_API_SECRET: 'internal-secret-valid-token-9012',
      CENTRIFUGO_WS_URL: 'ws://localhost:8000/connection/websocket',
      CENTRIFUGO_API_URL: 'http://localhost:8000/api',
    } as unknown as NodeJS.ProcessEnv;

    const checks = evaluateEnvironmentConfig(validEnv);
    expect(checks.every(c => c.status === 'ready')).toBe(true);
  });

  it('generates structured markdown readiness report', async () => {
    const mockReport: MessagingReadinessReport = {
      timestamp: '2026-10-21T05:00:00.000Z',
      allRequiredReady: true,
      checks: [
        {
          name: 'DATABASE_URL presence (PostgreSQL)',
          category: 'env',
          required: true,
          status: 'ready',
          details: 'Configured',
        },
        {
          name: 'Outbox pending backlog depth',
          category: 'backlog',
          required: true,
          status: 'ready',
          details: '0 deliveries pending',
        },
      ],
    };

    const markdown = formatReadinessReportMarkdown(mockReport);
    expect(markdown).toContain('# Messaging & Centrifugo Readiness Probe Report');
    expect(markdown).toContain('READY FOR PRODUCTION');
    expect(markdown).toContain('DATABASE_URL');
  });

  it('runs probe with skipDb flag and reports overall status', async () => {
    const validEnv = {
      NODE_ENV: 'test',
      DATABASE_URL: 'postgresql://localhost:5432/test',
      CENTRIFUGO_HMAC_SECRET_KEY: 'c7d8e9f0a1b2c3d4e5f60718293a4b5c6d7e8f90a1b2c3d4e5f60718293a4b5c',
      CENTRIFUGO_API_KEY: 'api-key-32-chars-long-secure-token-1234',
      CENTRIFUGO_PROXY_KEY: 'proxy-key-32-chars-long-secure-tok-5678',
      INTERNAL_API_SECRET: 'internal-secret-valid-token-9012',
      CENTRIFUGO_WS_URL: 'ws://localhost:8000/connection/websocket',
      CENTRIFUGO_API_URL: 'http://localhost:8000/api',
    } as unknown as NodeJS.ProcessEnv;

    const report = await runMessagingReadinessProbe({ env: validEnv, skipDb: true });
    expect(report.allRequiredReady).toBe(true);
    expect(report.checks.length).toBeGreaterThan(0);
  });
});
