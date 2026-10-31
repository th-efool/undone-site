import { afterEach, expect, it, vi } from 'vitest';
afterEach(() => { vi.unstubAllEnvs(); vi.resetModules(); });
it('retains production server operational logs without public debug flags', async () => {
  vi.stubEnv('NODE_ENV', 'production');
  vi.stubEnv('NEXT_PUBLIC_ENABLE_LOGS', '');
  vi.stubEnv('UNDONE_LOG_LEVEL', 'INFO');
  const { devLogger } = await import('../dev-logger');
  devLogger.info('LatencyTest', 'model_completed', { durationMs: 123 });
  expect(devLogger.getRecentLogs({ tag: 'LatencyTest' }).some(log => log.message === 'model_completed')).toBe(true);
});
