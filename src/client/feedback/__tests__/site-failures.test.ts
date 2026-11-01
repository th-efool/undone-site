// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest';
afterEach(() => { vi.resetModules(); vi.useRealTimers(); });
it('buffers safely, deduplicates storms and permits a later failure', async () => {
  vi.useFakeTimers(); vi.setSystemTime(new Date('2026-11-01T12:00:00Z'));
  const { reportSiteFailure, subscribeSiteFailures } = await import('../site-failures');
  reportSiteFailure('home');
  const listener = vi.fn(); const stop = subscribeSiteFailures(listener);
  expect(listener).toHaveBeenCalledTimes(1);
  reportSiteFailure('home'); expect(listener).toHaveBeenCalledTimes(1);
  vi.advanceTimersByTime(8001); reportSiteFailure('home'); expect(listener).toHaveBeenCalledTimes(2);
  expect(Object.keys(listener.mock.calls[0][0]).sort()).toEqual(['code', 'message']);
  stop(); reportSiteFailure('feed'); expect(listener).toHaveBeenCalledTimes(2);
});
it('captures the same bounded public code in DEBUG without user content', async () => {
  const { devLogger } = await import('@/src/shared/lib/dev-logger');
  devLogger.enable('DEBUG'); devLogger.clear();
  const { reportSiteFailure } = await import('../site-failures'); reportSiteFailure('notesLocal');
  const logs = devLogger.getRecentLogs({ tag: 'SiteFailure' });
  expect(logs.some(log => log.message === 'operation_failed')).toBe(true);
  expect(logs.some(log => log.message === 'failure_context')).toBe(true);
});
