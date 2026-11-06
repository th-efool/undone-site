/** @vitest-environment jsdom */
import { act, renderHook, waitFor, cleanup } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { EventEmitter } from 'node:events';
import type { Centrifuge } from 'centrifuge';
import { SubscriptionRegistry } from '../../../../realtime/subscription-registry';
import { loadChatCatchup } from '../hooks/loadChatCatchup';
import { useRoomRoster } from '../hooks/useRoomRoster';

const realtime = vi.hoisted(() => ({ handler: undefined as undefined | ((data: unknown) => void) }));
const subscribe = vi.hoisted(() => vi.fn((_channel: string, handler: (data: unknown) => void) => {
  realtime.handler = handler;
  return () => {};
}));
vi.mock('@/src/client/realtime', () => ({ useRealtime: () => ({ status: 'connected', subscribe }) }));
afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.clearAllMocks(); });

describe('Studyroom QA recovery regressions', () => {
  it.each([103, 1])('notifies once for permanent unsubscribe code %s', code => {
    const sub = Object.assign(new EventEmitter(), { subscribe: vi.fn(), unsubscribe: vi.fn() });
    const client = { newSubscription: () => sub, removeSubscription: vi.fn() };
    const revoked = vi.fn();
    const registry = new SubscriptionRegistry({ onRevocation: revoked });
    registry.setClient(client as unknown as Centrifuge);
    const release = registry.acquire('room:r:g1');
    sub.emit('unsubscribed', { code, reason: 'permission denied' });
    sub.emit('unsubscribed', { code, reason: 'permission denied' });
    expect(revoked).toHaveBeenCalledExactlyOnceWith('room:r:g1');
    release();
    expect(registry.size()).toBe(0);
  });
  it('does not classify ordinary unsubscribe as revocation', () => {
    const sub = Object.assign(new EventEmitter(), { subscribe: vi.fn(), unsubscribe: vi.fn() });
    const revoked = vi.fn();
    const registry = new SubscriptionRegistry({ onRevocation: revoked });
    registry.setClient({ newSubscription: () => sub, removeSubscription: vi.fn() } as unknown as Centrifuge);
    const release = registry.acquire('room:r:g1');
    sub.emit('unsubscribed', { code: 0, reason: 'unsubscribe called' });
    expect(revoked).not.toHaveBeenCalled();
    release();
  });
  it('recovers 120 missed messages using chronological pages and ID cursor', async () => {
    const all = Array.from({ length: 121 }, (_, i) => ({ id: String(i + 1) }));
    const fetchPage = vi.fn(async (before?: string) => {
      const end = before ? all.findIndex(m => m.id === before) : all.length;
      return all.slice(Math.max(0, end - 50), end);
    });
    const recovered = await loadChatCatchup(fetchPage, '1', () => true);
    expect(new Set(recovered?.map(m => m.id)).size).toBe(121);
    expect(fetchPage.mock.calls).toEqual([[undefined], ['72'], ['22']]);
  });
  it('cancels pagination after channel departure', async () => {
    let current = true;
    const result = await loadChatCatchup(async () => { current = false; return [{ id: 'old' }]; }, '1', () => current);
    expect(result).toBeNull();
  });
  it('fails visibly on a repeated full-page cursor', async () => {
    const page = Array.from({ length: 50 }, (_, i) => ({ id: String(i + 2) }));
    await expect(loadChatCatchup(async () => page, '1', () => true)).rejects.toThrow('cursor did not advance');
  });
  it.each(['new goal', null])('does not overwrite goal event with stale HTTP: %s', async goal => {
    let resolveOld!: (response: Response) => void;
    const fetcher = vi.fn().mockImplementationOnce(() => new Promise<Response>(resolve => { resolveOld = resolve; }))
      .mockResolvedValue({ ok: true, json: async () => [{ userId: 'u', publicGoal: goal }] });
    vi.stubGlobal('fetch', fetcher);
    const { result } = renderHook(() => useRoomRoster({ roomId: 'r' }));
    await waitFor(() => expect(fetcher).toHaveBeenCalledTimes(1));
    await act(async () => {
      realtime.handler?.({ type: 'room.participant.updated', payload: { userId: 'u', publicGoal: goal } });
      resolveOld({ ok: true, json: async () => [{ userId: 'u', publicGoal: 'old' }] } as Response);
    });
    expect(result.current.roster).toEqual([]);
    await waitFor(() => expect(result.current.roster[0]?.publicGoal).toBe(goal));
    expect(fetcher).toHaveBeenCalledTimes(2);
  });
});
