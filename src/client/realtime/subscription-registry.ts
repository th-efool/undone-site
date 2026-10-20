import type { Centrifuge, Subscription, PublicationContext, SubscribedContext, UnsubscribedContext, SubscriptionErrorContext } from 'centrifuge';
import type { PublicationHandler, SubscriptionStatus } from './types';

export const MAX_ACTIVE_SUBSCRIPTION_CAP = 32;

interface SubscriptionEntry {
  channel: string;
  sub: Subscription;
  refCount: number;
  status: SubscriptionStatus;
  handlers: Set<PublicationHandler>;
  lastError?: string;
}

export interface SubscriptionRegistryOptions {
  onRevocation?: (channel: string) => void;
  maxCap?: number;
}

export class SubscriptionRegistry {
  private client: Centrifuge | null = null;
  private entries = new Map<string, SubscriptionEntry>();
  private readonly maxCap: number;
  private readonly onRevocation?: (channel: string) => void;

  constructor(options: SubscriptionRegistryOptions = {}) {
    this.maxCap = options.maxCap ?? MAX_ACTIVE_SUBSCRIPTION_CAP;
    this.onRevocation = options.onRevocation;
  }

  public setClient(client: Centrifuge | null): void {
    if (this.client === client) return;
    this.clearAll();
    this.client = client;
  }

  public acquire(channel: string, handler?: PublicationHandler): () => void {
    if (!channel || typeof channel !== 'string') {
      throw new Error('channel name must be a valid non-empty string');
    }

    let entry = this.entries.get(channel);

    if (entry) {
      entry.refCount += 1;
      if (handler) {
        entry.handlers.add(handler);
      }
    } else {
      if (this.entries.size >= this.maxCap) {
        throw new Error(
          `Cannot acquire subscription to ${channel}: active subscription cap of ${this.maxCap} reached`
        );
      }

      if (!this.client) {
        throw new Error(`Cannot acquire subscription to ${channel}: Centrifuge client is not connected`);
      }

      const sub = this.client.newSubscription(channel);
      entry = {
        channel,
        sub,
        refCount: 1,
        status: 'subscribing',
        handlers: new Set(handler ? [handler] : []),
      };

      this.entries.set(channel, entry);
      this.bindSubscriptionEvents(entry);
      sub.subscribe();
    }

    // Return the release function
    let released = false;
    return () => {
      if (released) return;
      released = true;
      this.release(channel, handler);
    };
  }

  private release(channel: string, handler?: PublicationHandler): void {
    const entry = this.entries.get(channel);
    if (!entry) return;

    if (handler) {
      entry.handlers.delete(handler);
    }

    entry.refCount -= 1;

    if (entry.refCount <= 0) {
      entry.status = 'unsubscribing';
      try {
        entry.sub.unsubscribe();
        if (this.client) {
          this.client.removeSubscription(entry.sub);
        }
      } catch (err) {
        console.error(`Error unsubscribing channel ${channel}:`, err);
      }
      this.entries.delete(channel);
    }
  }

  private bindSubscriptionEvents(entry: SubscriptionEntry): void {
    const { sub, channel } = entry;

    sub.on('subscribing', () => {
      entry.status = 'subscribing';
    });

    sub.on('subscribed', (_ctx: SubscribedContext) => {
      entry.status = 'subscribed';
    });

    sub.on('unsubscribed', (_ctx: UnsubscribedContext) => {
      entry.status = 'unsubscribed';
    });

    sub.on('publication', (ctx: PublicationContext) => {
      const payload = ctx.data;
      const info = { channel, offset: ctx.offset };
      for (const h of entry.handlers) {
        try {
          h(payload, info);
        } catch (handlerErr) {
          console.error(`Error in publication handler for ${channel}:`, handlerErr);
        }
      }
    });

    sub.on('error', (ctx: SubscriptionErrorContext) => {
      entry.status = 'error';
      entry.lastError = ctx.error?.message || 'Subscription error';

      if (ctx.error?.code === 103) {
        // Access revoked or expired
        if (this.onRevocation) {
          this.onRevocation(channel);
        }
      }
    });
  }

  public getStatus(channel: string): SubscriptionStatus {
    const entry = this.entries.get(channel);
    return entry ? entry.status : 'unsubscribed';
  }

  public getRefCount(channel: string): number {
    return this.entries.get(channel)?.refCount ?? 0;
  }

  public getActiveChannels(): string[] {
    return Array.from(this.entries.keys());
  }

  public size(): number {
    return this.entries.size;
  }

  public clearAll(): void {
    for (const [channel, entry] of this.entries) {
      try {
        entry.sub.unsubscribe();
        if (this.client) {
          this.client.removeSubscription(entry.sub);
        }
      } catch (err) {
        console.error(`Error cleaning subscription for ${channel}:`, err);
      }
    }
    this.entries.clear();
  }
}
