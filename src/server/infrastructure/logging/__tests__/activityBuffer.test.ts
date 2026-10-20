import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  ActivityBufferService,
  activityBuffer,
  UserActivityEvent,
} from '../activityBuffer.service';

describe('ActivityBufferService', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    activityBuffer.clear();
  });

  afterEach(() => {
    activityBuffer.clear();
    vi.restoreAllMocks();
  });

  it('records events and tracks buffer length accurately', () => {
    const buffer = new ActivityBufferService({ maxBufferSize: 10 });

    expect(buffer.getBufferSize()).toBe(0);

    buffer.record({
      userId: 'user-1',
      eventType: 'LESSON_VIEW',
      entityId: 'lesson-101',
      metadata: { page: 1 },
    });

    expect(buffer.getBufferSize()).toBe(1);

    buffer.record({
      userId: 'user-1',
      eventType: 'LESSON_VIEW',
      entityId: 'lesson-102',
    });

    expect(buffer.getBufferSize()).toBe(2);
    buffer.clear();
  });

  it('debounces and coalesces duplicate events with identical userId, eventType, and entityId', () => {
    const buffer = new ActivityBufferService({ maxBufferSize: 10, debounceWindowMs: 3000 });

    const initialTime = 10000;
    vi.setSystemTime(initialTime);

    buffer.record({
      userId: 'user-1',
      eventType: 'SEARCH',
      entityId: 'query-cluster',
      metadata: { query: 'math', count: 1 },
      timestamp: initialTime,
    });

    expect(buffer.getBufferSize()).toBe(1);

    // Fast-forward by 500ms (within 3000ms debounce window)
    const laterTime = initialTime + 500;
    vi.setSystemTime(laterTime);

    buffer.record({
      userId: 'user-1',
      eventType: 'SEARCH',
      entityId: 'query-cluster',
      metadata: { query: 'mathematics', results: 12 },
      timestamp: laterTime,
    });

    // Buffer length must remain 1 due to debouncing/coalescing
    expect(buffer.getBufferSize()).toBe(1);

    const events = buffer.getEvents();
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      userId: 'user-1',
      eventType: 'SEARCH',
      entityId: 'query-cluster',
      timestamp: laterTime,
      metadata: {
        query: 'mathematics',
        count: 1,
        results: 12,
      },
    });

    buffer.clear();
  });

  it('does not coalesce events when userId, eventType, or entityId differ', () => {
    const buffer = new ActivityBufferService({ maxBufferSize: 10 });

    buffer.record({ userId: 'u1', eventType: 'CLICK', entityId: 'btn1' });
    buffer.record({ userId: 'u2', eventType: 'CLICK', entityId: 'btn1' });
    buffer.record({ userId: 'u1', eventType: 'HOVER', entityId: 'btn1' });
    buffer.record({ userId: 'u1', eventType: 'CLICK', entityId: 'btn2' });

    expect(buffer.getBufferSize()).toBe(4);
    buffer.clear();
  });

  it('manually flushes events, drains queue, and returns the correct flushed count', async () => {
    const flushedBatches: UserActivityEvent[][] = [];
    const sink = vi.fn(async (batch: UserActivityEvent[]) => {
      flushedBatches.push(batch);
    });

    const buffer = new ActivityBufferService({ maxBufferSize: 10, sink });

    buffer.record({ userId: 'u1', eventType: 'PREF_UPDATE', entityId: 'theme' });
    buffer.record({ userId: 'u1', eventType: 'PREF_UPDATE', entityId: 'volume' });
    buffer.record({ userId: 'u2', eventType: 'HEARTBEAT', entityId: 'session-xyz' });

    expect(buffer.getBufferSize()).toBe(3);

    const count = await buffer.flush();

    expect(count).toBe(3);
    expect(buffer.getBufferSize()).toBe(0);
    expect(sink).toHaveBeenCalledTimes(1);
    expect(flushedBatches[0]).toHaveLength(3);

    // Flushing an empty queue returns 0 and does not invoke sink again
    const secondCount = await buffer.flush();
    expect(secondCount).toBe(0);
    expect(sink).toHaveBeenCalledTimes(1);

    buffer.clear();
  });

  it('triggers auto-flush when buffer reaches maxBufferSize', async () => {
    const sink = vi.fn().mockResolvedValue(undefined);
    const maxBufferSize = 5;
    const buffer = new ActivityBufferService({ maxBufferSize, sink });

    for (let i = 0; i < maxBufferSize - 1; i++) {
      buffer.record({
        userId: 'user-bulk',
        eventType: 'HEARTBEAT',
        entityId: `node-${i}`,
      });
    }

    expect(buffer.getBufferSize()).toBe(maxBufferSize - 1);
    expect(sink).not.toHaveBeenCalled();

    // Trigger the threshold event
    buffer.record({
      userId: 'user-bulk',
      eventType: 'HEARTBEAT',
      entityId: `node-${maxBufferSize - 1}`,
    });

    // Buffer should be drained atomically
    expect(buffer.getBufferSize()).toBe(0);
    expect(sink).toHaveBeenCalledTimes(1);
    expect(sink).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ entityId: 'node-0' }),
        expect.objectContaining({ entityId: `node-${maxBufferSize - 1}` }),
      ])
    );

    buffer.clear();
  });

  it('triggers periodic auto-flush on timer interval', async () => {
    const sink = vi.fn().mockResolvedValue(undefined);
    const flushIntervalMs = 3000;
    const buffer = new ActivityBufferService({ flushIntervalMs, sink });

    buffer.record({
      userId: 'u1',
      eventType: 'HEARTBEAT',
      entityId: 'beat-1',
    });

    expect(buffer.getBufferSize()).toBe(1);
    expect(sink).not.toHaveBeenCalled();

    // Advance time past flushIntervalMs
    await vi.advanceTimersByTimeAsync(flushIntervalMs + 50);

    expect(sink).toHaveBeenCalledTimes(1);
    expect(buffer.getBufferSize()).toBe(0);

    buffer.clear();
  });

  it('handles errors gracefully when sink rejects without unhandled rejections', async () => {
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const sink = vi.fn().mockRejectedValue(new Error('Sink database failure'));

    const buffer = new ActivityBufferService({ sink });

    buffer.record({
      userId: 'u1',
      eventType: 'LESSON_VIEW',
      entityId: 'lesson-error',
    });

    // flush should catch error gracefully and return 0
    let flushResult: number | null = null;
    await expect(
      (async () => {
        flushResult = await buffer.flush();
      })()
    ).resolves.not.toThrow();

    expect(flushResult).toBe(0);
    expect(buffer.getBufferSize()).toBe(0);
    expect(consoleErrorSpy).toHaveBeenCalled();

    buffer.clear();
  });

  it('clears pending events and stops active timers on clear()', async () => {
    const sink = vi.fn().mockResolvedValue(undefined);
    const buffer = new ActivityBufferService({ flushIntervalMs: 3000, sink });

    buffer.record({ userId: 'u1', eventType: 'VIEW', entityId: 'item-1' });
    expect(buffer.getBufferSize()).toBe(1);

    buffer.clear();
    expect(buffer.getBufferSize()).toBe(0);

    // Advance time past interval, sink must NOT be called since timer was cancelled
    await vi.advanceTimersByTimeAsync(5000);
    expect(sink).not.toHaveBeenCalled();
  });

  it('ignores malformed records with missing required fields', () => {
    const buffer = new ActivityBufferService();

    // @ts-expect-error intentionally testing invalid input
    buffer.record(null);
    // @ts-expect-error intentionally testing invalid input
    buffer.record({ userId: '' });
    // @ts-expect-error intentionally testing invalid input
    buffer.record({ userId: 'u1', eventType: '' });
    // Empty entityId string is ignored by runtime validation
    buffer.record({ userId: 'u1', eventType: 'CLICK', entityId: '' });

    expect(buffer.getBufferSize()).toBe(0);
  });
});
