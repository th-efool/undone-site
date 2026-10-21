/**
 * Centrifuge v6 Protocol Client Simulator for Load & Performance Benchmarking.
 * Simulates real wire protocol framing, connection lifecycles, subscriptions,
 * message transit latency tracking, and deduplication verification.
 */

import { randomUUID } from 'node:crypto';
import { assertSafeFixtureId } from './safety';

export type ClientConnectionState = 'DISCONNECTED' | 'CONNECTING' | 'CONNECTED' | 'ERROR';

export interface CentrifugeCommand {
  id?: number;
  connect?: {
    token?: string;
    data?: Record<string, unknown>;
  };
  subscribe?: {
    channel: string;
    token?: string;
    recover?: boolean;
    epoch?: string;
    offset?: number;
  };
  unsubscribe?: {
    channel: string;
  };
  publish?: {
    channel: string;
    data: unknown;
  };
  sub_refresh?: {
    channel: string;
    token: string;
  };
  rpc?: {
    method: string;
    data: unknown;
  };
}

export interface CentrifugeReply {
  id?: number;
  error?: {
    code: number;
    message: string;
  };
  connect?: {
    client: string;
    version: string;
    expires?: boolean;
    ttl?: number;
    data?: Record<string, unknown>;
  };
  subscribe?: {
    epoch?: string;
    offset?: number;
    recovered?: boolean;
    publications?: Array<{ data: unknown; offset: number }>;
  };
  publish?: Record<string, unknown>;
  pub?: {
    data: unknown;
    offset?: number;
  };
  channel?: string;
}

export interface SimulatedMessagePayload {
  id: string;
  channelId: string;
  content: string;
  senderId: string;
  sequence: number;
  serverCreatedAt: number;
  clientRequestId?: string;
}

export interface SimulatedTransitMetric {
  messageId: string;
  channel: string;
  transitMs: number;
  sequence: number;
}

export interface SimulatedClientOptions {
  userId: string;
  connectionId?: string;
  userAgent?: string;
  networkLatencyMs?: number;
  onDelivery?: (metric: SimulatedTransitMetric) => void;
}

export class SimulatedCentrifugeClient {
  public readonly userId: string;
  public readonly connectionId: string;
  public state: ClientConnectionState = 'DISCONNECTED';
  public clientId?: string;

  private commandSeq = 0;
  private subscribedChannels = new Map<string, { epoch?: string; offset: number }>();
  private receivedMessageIds = new Set<string>();
  private duplicateMessageCount = 0;
  private transitMetrics: SimulatedTransitMetric[] = [];
  private onDeliveryCallback?: (metric: SimulatedTransitMetric) => void;
  private networkLatencyMs: number;

  constructor(options: SimulatedClientOptions) {
    this.userId = options.userId;
    this.connectionId = options.connectionId ?? `conn-${randomUUID()}`;
    this.networkLatencyMs = options.networkLatencyMs ?? 0;
    this.onDeliveryCallback = options.onDelivery;
  }

  /**
   * Connects client using simulated Centrifuge v6 handshake.
   */
  async connect(token: string): Promise<CentrifugeReply> {
    this.state = 'CONNECTING';
    if (this.networkLatencyMs > 0) {
      await new Promise(r => setTimeout(r, this.networkLatencyMs));
    }

    const command: CentrifugeCommand = {
      id: ++this.commandSeq,
      connect: { token },
    };

    // Protocol validation
    if (!token || token.length < 10) {
      this.state = 'ERROR';
      return {
        id: command.id,
        error: { code: 100, message: 'Invalid or missing authentication token' },
      };
    }

    this.clientId = `client-${randomUUID().slice(0, 8)}`;
    this.state = 'CONNECTED';

    return {
      id: command.id,
      connect: {
        client: this.clientId,
        version: '6.10.0',
        expires: true,
        ttl: 300,
      },
    };
  }

  /**
   * Subscribes to a channel using Centrifuge protocol.
   */
  async subscribe(channel: string, token?: string): Promise<CentrifugeReply> {
    if (this.state !== 'CONNECTED') {
      throw new Error(`Cannot subscribe while in state: ${this.state}`);
    }

    if (this.networkLatencyMs > 0) {
      await new Promise(r => setTimeout(r, this.networkLatencyMs));
    }

    const command: CentrifugeCommand = {
      id: ++this.commandSeq,
      subscribe: { channel, token },
    };

    this.subscribedChannels.set(channel, { offset: 0, epoch: 'epoch-1' });

    return {
      id: command.id,
      subscribe: {
        epoch: 'epoch-1',
        offset: 0,
        recovered: false,
      },
    };
  }

  /**
   * Handles inbound publication pushed by Centrifugo broker.
   */
  receivePublication(channel: string, payload: SimulatedMessagePayload): void {
    if (this.state !== 'CONNECTED') {
      return;
    }

    const sub = this.subscribedChannels.get(channel);
    if (!sub) {
      // Ignored: not subscribed to this channel
      return;
    }

    const now = Date.now();
    const transitMs = Math.max(0, now - payload.serverCreatedAt);

    if (this.receivedMessageIds.has(payload.id)) {
      this.duplicateMessageCount++;
    } else {
      this.receivedMessageIds.add(payload.id);
    }

    sub.offset = payload.sequence;

    const metric: SimulatedTransitMetric = {
      messageId: payload.id,
      channel,
      transitMs,
      sequence: payload.sequence,
    };

    this.transitMetrics.push(metric);
    this.onDeliveryCallback?.(metric);
  }

  /**
   * Disconnects client.
   */
  disconnect(): void {
    this.state = 'DISCONNECTED';
    this.subscribedChannels.clear();
  }

  getSubscribedChannels(): string[] {
    return Array.from(this.subscribedChannels.keys());
  }

  isSubscribedTo(channel: string): boolean {
    return this.subscribedChannels.has(channel);
  }

  getReceivedCount(): number {
    return this.receivedMessageIds.size;
  }

  getDuplicateCount(): number {
    return this.duplicateMessageCount;
  }

  getTransitMetrics(): SimulatedTransitMetric[] {
    return [...this.transitMetrics];
  }
}
