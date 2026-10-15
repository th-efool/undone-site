import { describe, it, expect } from 'vitest';
import {
  runMeasuredWorkload,
  formatLoadReportMarkdown,
  getHardwareProfile,
  calculateDistribution,
} from '@/scripts/load/measured-load-harness';

describe('S6 Checkpoint 4: Measured Load & Operational Performance Acceptance', () => {
  it('correctly calculates sample metric distributions and percentiles', () => {
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

  it('introspects host hardware profile without disclosing environment secrets', () => {
    const hw = getHardwareProfile();
    expect(hw.platform).toBeDefined();
    expect(hw.arch).toBeDefined();
    expect(hw.cpuCores).toBeGreaterThan(0);
    expect(hw.totalMemoryMb).toBeGreaterThan(0);
    expect(hw.nodeVersion).toBeDefined();
  });

  it('executes measured load harness, satisfies Plan 06 provisional targets, and recovers from overload', async () => {
    const results = await runMeasuredWorkload({
      concurrency: 4,
      workspacesPerWorker: 2,
      actionsPerWorkspace: 3,
    });

    // Invariants
    expect(results.invariants.totalWorkspacesCreated).toBe(8);
    expect(results.invariants.totalActionsCommitted).toBe(24);
    expect(results.invariants.lostAcceptedActions).toBe(0);
    expect(results.invariants.duplicateReleases).toBe(0);
    expect(results.invariants.overloadRejections).toBeGreaterThan(0);
    expect(results.invariants.overloadRecovered).toBe(true);

    // Plan 06 Section 9 targets
    expect(results.planComparisons.intakeAckTargetPassed).toBe(true);
    expect(results.planComparisons.eventVisibilityTargetPassed).toBe(true);
    expect(results.planComparisons.reconnectSnapshotTargetPassed).toBe(true);
    expect(results.planComparisons.zeroLostActionsPassed).toBe(true);
    expect(results.planComparisons.zeroDuplicateReleasesPassed).toBe(true);

    // Latency distributions
    expect(results.metrics.intakeAckMs.p95).toBeLessThan(1000);
    expect(results.metrics.eventVisibilityMs.p95).toBeLessThan(1000);
    expect(results.metrics.reconnectSnapshotMs.p95).toBeLessThan(3000);

    // Formatted markdown output
    const report = formatLoadReportMarkdown(results);
    expect(report).toContain('S6 Checkpoint 4: Measured Load & Operational Performance Report');
    expect(report).toContain('Intake Acknowledgement');
    expect(report).toContain('Event-to-Client Visibility');
    expect(report).toContain('Reconnect / Resnapshot');
    expect(report).toContain('PASSED');
  });
});
