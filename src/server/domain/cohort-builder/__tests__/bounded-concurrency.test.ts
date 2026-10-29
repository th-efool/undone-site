import { describe, expect, it, vi } from 'vitest';
vi.mock('server-only', () => ({}));
import { runInteractionWorkerLoop } from '@/src/server/interaction-worker';
import type { InteractionRepository } from 'interaction-builder/runtime';

describe('Bounded Concurrency for Durable Text Jobs', () => {
  it('passes configured sourceConcurrency to durable.tick()', async () => {
    const tickCalls: number[] = [];
    const dummyDurable = {
      tick: vi.fn(async (concurrency?: number) => {
        tickCalls.push(concurrency ?? 1);
        return [{ status: 'idle' }];
      }),
      close: vi.fn(async () => {}),
    };

    const dummyRepo = {
      claimRun: vi.fn(async () => null),
    } as unknown as InteractionRepository;

    const controller = new AbortController();

    await runInteractionWorkerLoop({
      repo: dummyRepo,
      durable: dummyDurable,
      sourceConcurrency: 4,
      maxIterations: 2,
      pollIntervalMs: 1,
    }, controller.signal);

    expect(dummyDurable.tick).toHaveBeenCalled();
    expect(tickCalls[0]).toBe(4);
  });

  it('respects custom concurrency limits (e.g. 2 or 6)', async () => {
    const tickCalls: number[] = [];
    const dummyDurable = {
      tick: vi.fn(async (concurrency?: number) => {
        tickCalls.push(concurrency ?? 1);
        return [{ status: 'idle' }];
      }),
      close: vi.fn(async () => {}),
    };

    const dummyRepo = {
      claimRun: vi.fn(async () => null),
    } as unknown as InteractionRepository;

    const controller = new AbortController();

    await runInteractionWorkerLoop({
      repo: dummyRepo,
      durable: dummyDurable,
      sourceConcurrency: 6,
      maxIterations: 1,
      pollIntervalMs: 1,
    }, controller.signal);

    expect(tickCalls[0]).toBe(6);
  });
});
