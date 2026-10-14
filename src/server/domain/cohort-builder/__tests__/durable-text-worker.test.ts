import { describe, expect, it } from 'vitest';
import { runDurableTextJobTick } from '../durable-text-worker';

describe('durable text worker composition', () => {
  it('requires the durable ports and delegates one tick', async () => {
    let called = false;
    const result = await runDurableTextJobTick({
      sql: { query: async () => ({ rows: [] }) },
      transaction: { transaction: async work => work({ query: async () => ({ rows: [] }) }) },
      workerId: 'worker', leaseMs: 2_000, now: () => new Date(), loadWorkspace: async () => null,
    });
    called = result.status === 'idle';
    expect(called).toBe(true);
  });
});
