import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  assertSafeLoadEnvironment,
  assertSafeFixtureId,
  makeFixtureId,
  calculateDistribution,
  getHardwareProfile,
  StudyRoomBenchmarkRunner,
  LoadEnvironmentSafetyError,
  FIXTURE_STUDYROOM_PREFIX,
} from '../load/studyroom-benchmark-engine';
import { formatStudyRoomLoadReportMarkdown } from '../../../../../scripts/load/studyroom-load-harness';

describe('Phase 12: Study Room Multi-User & Load Benchmark Engine', () => {
  const originalEnv = process.env.NODE_ENV;
  const originalDbUrl = process.env.DATABASE_URL;

  beforeEach(() => {
    (process.env as Record<string, string | undefined>).NODE_ENV = 'test';
  });

  afterEach(() => {
    if (originalEnv !== undefined) {
      (process.env as Record<string, string | undefined>).NODE_ENV = originalEnv;
    } else {
      delete (process.env as Record<string, string | undefined>).NODE_ENV;
    }
    if (originalDbUrl !== undefined) {
      process.env.DATABASE_URL = originalDbUrl;
    } else {
      delete process.env.DATABASE_URL;
    }
  });

  describe('1. Safety Guardrails', () => {
    it('throws if NODE_ENV is production', () => {
      (process.env as Record<string, string | undefined>).NODE_ENV = 'production';
      expect(() => assertSafeLoadEnvironment()).toThrow(LoadEnvironmentSafetyError);
      expect(() => assertSafeLoadEnvironment()).toThrow(/NODE_ENV is set to "production"/);
    });

    it('throws if target host is a remote cloud database provider', () => {
      const unsafeHosts = [
        'postgres://user:pass@db.supabase.co:5432/postgres',
        'postgres://user:pass@ep-cool-fog.neon.tech:5432/main',
        'postgres://user:pass@prod-db.us-east-1.rds.amazonaws.com:5432/undone',
        'postgres://user:pass@undone-production.railway.app:5432/prod',
      ];

      for (const url of unsafeHosts) {
        expect(() => assertSafeLoadEnvironment(url)).toThrow(LoadEnvironmentSafetyError);
        expect(() => assertSafeLoadEnvironment(url)).toThrow(/Refusing to run load test against potential production host/);
      }
    });

    it('passes for localhost and isolated test database URLs', () => {
      expect(() => assertSafeLoadEnvironment('postgresql://user:pass@localhost:5432/undone_test')).not.toThrow();
      expect(() => assertSafeLoadEnvironment('postgresql://user:pass@127.0.0.1:15439/load_measured_db')).not.toThrow();
      expect(() => assertSafeLoadEnvironment(undefined)).not.toThrow();
    });

    it('enforces prefix fixture:load:studyroom: on all generated entities', () => {
      const validId = makeFixtureId('user', 'u-123');
      expect(validId.startsWith(FIXTURE_STUDYROOM_PREFIX)).toBe(true);
      expect(() => assertSafeFixtureId(validId, 'user')).not.toThrow();

      expect(() => assertSafeFixtureId('real-user-uuid-1234', 'user')).toThrow(LoadEnvironmentSafetyError);
      expect(() => assertSafeFixtureId('user-456', 'user')).toThrow(/All load test entities must start with/);
    });
  });

  describe('2. Distribution & Percentile Calculations', () => {
    it('calculates sample metric distributions and percentiles correctly', () => {
      const samples = [10, 20, 30, 40, 50, 60, 70, 80, 90, 100];
      const dist = calculateDistribution(samples);

      expect(dist.count).toBe(10);
      expect(dist.min).toBe(10);
      expect(dist.max).toBe(100);
      expect(dist.avg).toBe(55);
      expect(dist.p50).toBe(60);
      expect(dist.p95).toBe(100);
      expect(dist.p99).toBe(100);
    });

    it('handles empty distribution cleanly without division by zero', () => {
      const dist = calculateDistribution([]);
      expect(dist.count).toBe(0);
      expect(dist.avg).toBe(0);
    });
  });

  describe('3. Hardware Profile', () => {
    it('introspects host hardware profile without disclosing secrets', () => {
      const hw = getHardwareProfile();
      expect(hw.platform).toBeDefined();
      expect(hw.arch).toBeDefined();
      expect(hw.cpuCores).toBeGreaterThan(0);
      expect(hw.totalMemoryMb).toBeGreaterThan(0);
      expect(hw.nodeVersion).toBeDefined();
    });
  });

  describe('4. Staging Workload Execution (100 users, 150 tabs, 10 rooms + hot room)', () => {
    it('executes measured staging workload and satisfies all acceptance SLOs', async () => {
      const runner = new StudyRoomBenchmarkRunner();
      const results = await runner.runBenchmark({
        totalUsers: 100,
        totalTabs: 150,
        roomCount: 10,
        hotRoomUsers: 100,
        durationSeconds: 1,
        messagesPerSecond: 10,
        enableReconnectStorm: true,
      });

      // Staging workload invariants
      expect(results.invariants.totalJoinsAttempted).toBeGreaterThanOrEqual(250);
      expect(results.invariants.totalJoinsSucceeded).toBe(results.invariants.totalJoinsAttempted);
      expect(results.invariants.totalRenewals).toBeGreaterThanOrEqual(150);
      expect(results.invariants.reconnectedTabs).toBe(45); // 30% of 150 tabs
      expect(results.invariants.authoritativeCountMatchesUI).toBe(true);
      expect(results.invariants.zeroGhostLeases).toBe(true);
      expect(results.invariants.duplicateMessages).toBe(0);
      expect(results.invariants.lostMessages).toBe(0);
      expect(results.invariants.unauthorizedDeliveries).toBe(0);
      expect(results.invariants.cleanupWithin120sTarget).toBe(true);
      expect(results.invariants.dbPoolExhausted).toBe(false);

      // SLO Targets
      expect(results.slo.joinLatencyPassed).toBe(true);
      expect(results.slo.renewLatencyPassed).toBe(true);
      expect(results.slo.eventVisibilityPassed).toBe(true); // p95 ≤ 2000ms
      expect(results.slo.zeroDuplicateMessagesPassed).toBe(true);
      expect(results.slo.zeroLostMessagesPassed).toBe(true);
      expect(results.slo.cleanupTargetPassed).toBe(true);
      expect(results.slo.overallPassed).toBe(true);

      // Formatted report verification
      const report = formatStudyRoomLoadReportMarkdown(results);
      expect(report).toContain('# Phase 12: Measured Study Room Multi-User & Load Capacity Report');
      expect(report).toContain('ALL GATES SATISFIED');
      expect(report).toContain('Hot Room Users');
      expect(report).toContain('Event Visibility Fan-out');
    });
  });
});
