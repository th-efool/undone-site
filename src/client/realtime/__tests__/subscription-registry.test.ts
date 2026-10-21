import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SubscriptionRegistry } from '../subscription-registry';

class MockSubscription {
  public listeners: Record<string, ((...args: any[]) => void)[]> = {};
  public subscribe = vi.fn();
  public unsubscribe = vi.fn();

  public on(event: string, callback: (...args: any[]) => void) {
    if (!this.listeners[event]) {
      this.listeners[event] = [];
    }
    this.listeners[event].push(callback);
    return this;
  }

  public emit(event: string, ...args: any[]) {
    const list = this.listeners[event] || [];
    for (const cb of list) {
      cb(...args);
    }
  }
}

class MockCentrifugeClient {
  public subscriptions = new Map<string, MockSubscription>();
  public removeSubscription = vi.fn((sub: any) => {
    for (const [ch, s] of this.subscriptions.entries()) {
      if (s === sub) {
        this.subscriptions.delete(ch);
      }
    }
  });

  public newSubscription(channel: string) {
    const sub = new MockSubscription();
    this.subscriptions.set(channel, sub);
    return sub as any;
  }
}

describe('SubscriptionRegistry', () => {
  let mockClient: MockCentrifugeClient;
  let registry: SubscriptionRegistry;

  beforeEach(() => {
    mockClient = new MockCentrifugeClient();
    registry = new SubscriptionRegistry();
    registry.setClient(mockClient as any);
  });

  it('acquires a subscription, creates Centrifuge subscription, and subscribes', () => {
    const release = registry.acquire('user:u1:g1');

    expect(registry.getRefCount('user:u1:g1')).toBe(1);
    expect(registry.getActiveChannels()).toEqual(['user:u1:g1']);
    expect(mockClient.subscriptions.has('user:u1:g1')).toBe(true);

    const sub = mockClient.subscriptions.get('user:u1:g1');
    expect(sub?.subscribe).toHaveBeenCalledTimes(1);

    release();
    expect(sub?.unsubscribe).toHaveBeenCalledTimes(1);
    expect(mockClient.removeSubscription).toHaveBeenCalledTimes(1);
    expect(registry.getActiveChannels()).toEqual([]);
  });

  it('ref-counts multiple acquires for the same channel without duplicate subscriptions', () => {
    const release1 = registry.acquire('community:chan_general:g1');
    expect(registry.getRefCount('community:chan_general:g1')).toBe(1);

    const release2 = registry.acquire('community:chan_general:g1');
    expect(registry.getRefCount('community:chan_general:g1')).toBe(2);

    const sub = mockClient.subscriptions.get('community:chan_general:g1');
    expect(sub?.subscribe).toHaveBeenCalledTimes(1); // Only 1 subscription created

    // Release 1 - refCount becomes 1, no unsubscription yet
    release1();
    expect(registry.getRefCount('community:chan_general:g1')).toBe(1);
    expect(sub?.unsubscribe).not.toHaveBeenCalled();

    // Release 2 - refCount becomes 0, unsubscription occurs
    release2();
    expect(registry.getRefCount('community:chan_general:g1')).toBe(0);
    expect(sub?.unsubscribe).toHaveBeenCalledTimes(1);
    expect(registry.getActiveChannels()).toEqual([]);
  });

  it('enforces maximum active subscription cap', () => {
    const cappedRegistry = new SubscriptionRegistry({ maxCap: 2 });
    cappedRegistry.setClient(mockClient as any);

    cappedRegistry.acquire('chan_1');
    cappedRegistry.acquire('chan_2');

    expect(() => {
      cappedRegistry.acquire('chan_3');
    }).toThrow(/active subscription cap of 2 reached/);
  });

  it('dispatches incoming publications to all active handlers on the channel', () => {
    const handler1 = vi.fn();
    const handler2 = vi.fn();

    const release1 = registry.acquire('dm:conv_1:g1', handler1);
    const release2 = registry.acquire('dm:conv_1:g1', handler2);

    const sub = mockClient.subscriptions.get('dm:conv_1:g1')!;
    sub.emit('publication', { data: { text: 'hello world' }, offset: 42 });

    expect(handler1).toHaveBeenCalledWith(
      { text: 'hello world' },
      { channel: 'dm:conv_1:g1', offset: 42 }
    );
    expect(handler2).toHaveBeenCalledWith(
      { text: 'hello world' },
      { channel: 'dm:conv_1:g1', offset: 42 }
    );

    release1();
    release2();
  });

  it('triggers onRevocation callback on Centrifugo 103 permission error', () => {
    const onRevocation = vi.fn();
    const customRegistry = new SubscriptionRegistry({ onRevocation });
    customRegistry.setClient(mockClient as any);

    customRegistry.acquire('community:chan_expired:g1');
    const sub = mockClient.subscriptions.get('community:chan_expired:g1')!;

    sub.emit('error', { error: { code: 103, message: 'Subscription revoked' } });

    expect(onRevocation).toHaveBeenCalledWith('community:chan_expired:g1');
    expect(customRegistry.getStatus('community:chan_expired:g1')).toBe('error');
  });

  it('clears all subscriptions on clearAll()', () => {
    registry.acquire('chan_a');
    registry.acquire('chan_b');
    expect(registry.size()).toBe(2);

    registry.clearAll();
    expect(registry.size()).toBe(0);
    expect(registry.getActiveChannels()).toEqual([]);
  });
});
