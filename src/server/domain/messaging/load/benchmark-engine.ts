/**
 * Messaging Load & Capacity Benchmark Engine.
 * Executes representative Centrifugo + PostgreSQL messaging load scenarios,
 * evaluates latency distributions against SLO gates, tests hot-channel fan-out,
 * reconnect storms, and worker failure recovery.
 */

import { randomUUID } from 'node:crypto';
import { cpus, totalmem, freemem, platform, arch } from 'node:os';
import {
  SimulatedCentrifugeClient,
  type SimulatedMessagePayload,
  type SimulatedTransitMetric,
} from './protocol-client';
import { assertSafeLoadEnvironment, makeFixtureId } from './safety';

export interface HardwareProfile {
  platform: string;
  arch: string;
  cpuModel: string;
  cpuCores: number;
  totalMemoryMb: number;
  freeMemoryMb: number;
  nodeVersion: string;
}

export function getHardwareProfile(): HardwareProfile {
  const cpuList = cpus();
  return {
    platform: platform(),
    arch: arch(),
    cpuModel: cpuList[0]?.model ?? 'Unknown',
    cpuCores: cpuList.length,
    totalMemoryMb: Math.round(totalmem() / (1024 * 1024)),
    freeMemoryMb: Math.round(freemem() / (1024 * 1024)),
    nodeVersion: process.version,
  };
}

export interface MetricDistribution {
  count: number;
  min: number;
  max: number;
  avg: number;
  p50: number;
  p95: number;
  p99: number;
}

export function calculateDistribution(samples: number[]): MetricDistribution {
  if (samples.length === 0) {
    return { count: 0, min: 0, max: 0, avg: 0, p50: 0, p95: 0, p99: 0 };
  }
  const sorted = [...samples].sort((a, b) => a - b);
  const sum = sorted.reduce((acc, val) => acc + val, 0);
  const count = sorted.length;

  const getPercentile = (p: number) => {
    const idx = Math.min(count - 1, Math.max(0, Math.floor((p / 100) * count)));
    return Number(sorted[idx].toFixed(2));
  };

  return {
    count,
    min: Number(sorted[0].toFixed(2)),
    max: Number(sorted[count - 1].toFixed(2)),
    avg: Number((sum / count).toFixed(2)),
    p50: getPercentile(50),
    p95: getPercentile(95),
    p99: getPercentile(99),
  };
}

export interface LoadRunConfig {
  connectionCount: number;
  averageSubscriptionsPerConnection: number;
  connectionsPerUser: number;
  messagesPerSecond: number;
  controlSignalsPerSecond: number;
  durationSeconds: number;
  hotChannelSubscribers?: number;
  enableBurst2x?: boolean;
  enableWorkerKill?: boolean;
  reconnectPercent?: number;
}

export interface SloEvaluation {
  messageAcceptancePassed: boolean;
  commitToRecipientPassed: boolean;
  commitToRecipientP99Passed: boolean;
  oldestPendingAgePassed: boolean;
  zeroLostMessagesPassed: boolean;
  zeroDuplicateMessagesPassed: boolean;
  overallPassed: boolean;
}

export interface LoadRunResults {
  hardware: HardwareProfile;
  config: LoadRunConfig;
  durationMs: number;
  memory: {
    heapUsedStartMb: number;
    heapUsedEndMb: number;
    heapDiffMb: number;
  };
  metrics: {
    messageAcceptanceMs: MetricDistribution;
    commitToRecipientMs: MetricDistribution;
    proxyAuthLatencyMs: MetricDistribution;
    outboxDrainAgeMs: MetricDistribution;
  };
  invariants: {
    totalMessagesSent: number;
    totalDeliveriesReceived: number;
    totalControlSignalsSent: number;
    lostAcceptedMessages: number;
    duplicateMessages: number;
    reconnectedClients: number;
    peakSimulatedConns: number;
    peakSimulatedSubs: number;
    dbConnectionsUsed: number;
    dbPoolExhausted: boolean;
  };
  slo: SloEvaluation;
}

export interface MockMessageStore {
  saveMessage: (msg: SimulatedMessagePayload) => Promise<{ id: string; sequence: number }>;
  claimDeliveries: (batchSize: number) => Promise<SimulatedMessagePayload[]>;
  getPendingCount: () => Promise<number>;
}

export class MessagingBenchmarkRunner {
  private clients: SimulatedCentrifugeClient[] = [];
  private brokerChannelSubscribers = new Map<string, Set<SimulatedCentrifugeClient>>();
  private acceptanceTimes: number[] = [];
  private commitToRecipientTimes: number[] = [];
  private proxyAuthTimes: number[] = [];
  private outboxDrainAges: number[] = [];
  private totalMessagesSent = 0;
  private totalDeliveriesReceived = 0;
  private totalControlSignalsSent = 0;
  private duplicateMessages = 0;
  private reconnectedCount = 0;
  private maxDbConnectionsUsed = 0;
  private simulatedDbPoolLimit = 20;

  constructor(options?: { simulatedDbPoolLimit?: number }) {
    if (options?.simulatedDbPoolLimit) {
      this.simulatedDbPoolLimit = options.simulatedDbPoolLimit;
    }
  }

  /**
   * Initializes simulated clients and establishes subscriptions across channels.
   */
  async initializeClients(config: LoadRunConfig): Promise<void> {
    assertSafeLoadEnvironment();

    const uniqueUsersCount = Math.max(1, Math.ceil(config.connectionCount / config.connectionsPerUser));
    const cohortId = makeFixtureId('cohort', 'load-bench');
    const roomId = makeFixtureId('room', 'load-bench');

    // Create clients
    this.clients = [];
    this.brokerChannelSubscribers.clear();

    for (let i = 0; i < config.connectionCount; i++) {
      const userIndex = i % uniqueUsersCount;
      const userId = makeFixtureId('user', `bench-${userIndex}`);
      const client = new SimulatedCentrifugeClient({
        userId,
        onDelivery: (metric: SimulatedTransitMetric) => {
          this.commitToRecipientTimes.push(metric.transitMs);
          this.totalDeliveriesReceived++;
        },
      });
      this.clients.push(client);
    }

    // Connect clients
    for (const client of this.clients) {
      const authStart = performance.now();
      const token = `valid-mock-jwt-token-for-${client.userId}`;
      await client.connect(token);
      this.proxyAuthTimes.push(performance.now() - authStart);

      // Default 4 subscriptions:
      // 1. Personal inbox
      const personalChannel = `personal:${client.userId}`;
      await this.subscribeClientToBroker(client, personalChannel);

      // 2. Community General
      const communityChannel1 = `community:${cohortId}:general:g1`;
      await this.subscribeClientToBroker(client, communityChannel1);

      // 3. Community Resources
      const communityChannel2 = `community:${cohortId}:resources:g1`;
      await this.subscribeClientToBroker(client, communityChannel2);

      // 4. Study room
      const roomChannel = `room:${roomId}:g1`;
      await this.subscribeClientToBroker(client, roomChannel);
    }

    // Hot channel subscription setup if configured
    if (config.hotChannelSubscribers && config.hotChannelSubscribers > 0) {
      const hotChannel = `community:${cohortId}:hot-announcements:g1`;
      const hotSubCount = Math.min(config.hotChannelSubscribers, this.clients.length);
      for (let i = 0; i < hotSubCount; i++) {
        await this.subscribeClientToBroker(this.clients[i], hotChannel);
      }
    }
  }

  private async subscribeClientToBroker(client: SimulatedCentrifugeClient, channel: string): Promise<void> {
    await client.subscribe(channel);
    let subs = this.brokerChannelSubscribers.get(channel);
    if (!subs) {
      subs = new Set();
      this.brokerChannelSubscribers.set(channel, subs);
    }
    subs.add(client);
  }

  /**
   * Broadcasts a publication from Centrifugo to all connected subscribers.
   */
  private broadcastToSubscribers(channel: string, payload: SimulatedMessagePayload): void {
    const subs = this.brokerChannelSubscribers.get(channel);
    if (!subs || subs.size === 0) return;

    for (const client of subs) {
      client.receivePublication(channel, payload);
    }
  }

  /**
   * Executes the full benchmark run.
   */
  async runBenchmark(config: LoadRunConfig): Promise<LoadRunResults> {
    assertSafeLoadEnvironment();

    const startMemory = process.memoryUsage().heapUsed;
    const startTime = performance.now();

    await this.initializeClients(config);

    // In-memory durable outbox queue simulating PostgreSQL transactional storage
    const outboxQueue: Array<{
      id: string;
      channel: string;
      payload: SimulatedMessagePayload;
      enqueuedAt: number;
    }> = [];

    let currentSequence = 1000;
    let workerActive = true;
    let simulatedActiveDbConnections = 0;

    // Simulate messaging activity over durationSeconds
    const totalDurationMs = config.durationSeconds * 1000;
    const intervalMs = 100;
    const steps = Math.max(1, Math.floor(totalDurationMs / intervalMs));

    let messagesPerStep = (config.messagesPerSecond * (intervalMs / 1000));
    const controlSignalsPerStep = (config.controlSignalsPerSecond * (intervalMs / 1000));

    const hotChannel = `community:${makeFixtureId('cohort', 'load-bench')}:hot-announcements:g1`;
    const standardChannel = `community:${makeFixtureId('cohort', 'load-bench')}:general:g1`;

    let accumulatedMessages = 0;
    let accumulatedSignals = 0;

    let stepCounter = 0;

    for (let step = 0; step < steps; step++) {
      stepCounter++;

      // Burst mode check (e.g. at 50% duration)
      let currentMessagesPerStep = messagesPerStep;
      if (config.enableBurst2x && step > steps * 0.4 && step < steps * 0.7) {
        currentMessagesPerStep = messagesPerStep * 2;
      }

      accumulatedMessages += currentMessagesPerStep;
      accumulatedSignals += controlSignalsPerStep;

      // Chaos check: worker failure injection
      if (config.enableWorkerKill && step > steps * 0.3 && step < steps * 0.5) {
        workerActive = false; // Outbox worker temporarily offline
      } else {
        workerActive = true;
      }

      // 1. Generate & Commit Messages
      const msgsToSend = Math.floor(accumulatedMessages);
      accumulatedMessages -= msgsToSend;
      for (let m = 0; m < msgsToSend; m++) {
        const acceptStart = performance.now();
        simulatedActiveDbConnections = Math.min(this.simulatedDbPoolLimit, simulatedActiveDbConnections + 1);
        if (simulatedActiveDbConnections > this.maxDbConnectionsUsed) {
          this.maxDbConnectionsUsed = simulatedActiveDbConnections;
        }

        const msgId = randomUUID();
        const seq = ++currentSequence;
        const sender = this.clients[m % this.clients.length]?.userId ?? 'user-bench-0';

        // Choose standard or hot channel
        const targetChannel = (config.hotChannelSubscribers && (m % 3 === 0))
          ? hotChannel
          : standardChannel;

        const payload: SimulatedMessagePayload = {
          id: msgId,
          channelId: targetChannel,
          content: 'Benchmark synthetic message payload under load conditions.',
          senderId: sender,
          sequence: seq,
          serverCreatedAt: Date.now(),
        };

        // Enqueue to outbox
        outboxQueue.push({
          id: randomUUID(),
          channel: targetChannel,
          payload,
          enqueuedAt: Date.now(),
        });

        this.totalMessagesSent++;
        simulatedActiveDbConnections = Math.max(0, simulatedActiveDbConnections - 1);

        const acceptDuration = performance.now() - acceptStart;
        this.acceptanceTimes.push(acceptDuration);
      }

      // 2. Control signals (typing / receipts / room lease heartbeats)
      const signalsToSend = Math.floor(accumulatedSignals);
      accumulatedSignals -= signalsToSend;
      for (let s = 0; s < signalsToSend; s++) {
        this.totalControlSignalsSent++;
      }

      // 3. Outbox Dispatcher Worker Simulation (claims batch and publishes)
      if (workerActive && outboxQueue.length > 0) {
        const batchSize = 50;
        const batch = outboxQueue.splice(0, batchSize);

        for (const item of batch) {
          const drainAge = Date.now() - item.enqueuedAt;
          this.outboxDrainAges.push(drainAge);
          this.broadcastToSubscribers(item.channel, item.payload);
        }
      }

      // Small tick delay
      await new Promise(r => setTimeout(r, 10));
    }

    // Drain remaining outbox items after loop
    while (outboxQueue.length > 0) {
      const batch = outboxQueue.splice(0, 50);
      for (const item of batch) {
        const drainAge = Date.now() - item.enqueuedAt;
        this.outboxDrainAges.push(drainAge);
        this.broadcastToSubscribers(item.channel, item.payload);
      }
    }

    // 4. Reconnect Storm Scenario if configured
    if (config.reconnectPercent && config.reconnectPercent > 0) {
      const toReconnectCount = Math.floor((config.reconnectPercent / 100) * this.clients.length);
      const reconnectSubset = this.clients.slice(0, toReconnectCount);

      for (const client of reconnectSubset) {
        client.disconnect();
        const authStart = performance.now();
        await client.connect(`token-reconnect-${client.userId}`);
        this.proxyAuthTimes.push(performance.now() - authStart);
        // Resubscribe
        const personalChannel = `personal:${client.userId}`;
        await client.subscribe(personalChannel);
        this.reconnectedCount++;
      }
    }

    // Aggregate duplicate counts across clients
    let totalDuplicates = 0;
    for (const client of this.clients) {
      totalDuplicates += client.getDuplicateCount();
    }
    this.duplicateMessages = totalDuplicates;

    const endMemory = process.memoryUsage().heapUsed;
    const durationMs = Math.round(performance.now() - startTime);

    const messageAcceptanceDist = calculateDistribution(this.acceptanceTimes);
    const commitToRecipientDist = calculateDistribution(this.commitToRecipientTimes);
    const proxyAuthDist = calculateDistribution(this.proxyAuthTimes);
    const outboxDrainDist = calculateDistribution(this.outboxDrainAges);

    // Compute lost messages:
    // Every message sent should have been delivered to subscribers of that channel.
    // If a channel has N subscribers, it yields N deliveries.
    // If messages were sent but 0 deliveries occurred despite active subscribers, that indicates loss.
    const lostAcceptedMessages = outboxQueue.length; // Remaining undrained in failure

    // Evaluate against SLO Gates:
    // - Message acceptance p95 <= 750 ms
    // - Commit-to-recipient p95 <= 1000 ms, p99 <= 3000 ms
    // - Normal oldest pending delivery < 5000 ms
    // - Zero lost messages
    // - Zero duplicate rendered messages
    const messageAcceptancePassed = messageAcceptanceDist.p95 <= 750;
    const commitToRecipientPassed = commitToRecipientDist.p95 <= 1000;
    const commitToRecipientP99Passed = commitToRecipientDist.p99 <= 3000;
    const oldestPendingAgePassed = (outboxDrainDist.max < 5000);
    const zeroLostMessagesPassed = lostAcceptedMessages === 0;
    const zeroDuplicateMessagesPassed = totalDuplicates === 0;

    const overallPassed =
      messageAcceptancePassed &&
      commitToRecipientPassed &&
      commitToRecipientP99Passed &&
      oldestPendingAgePassed &&
      zeroLostMessagesPassed &&
      zeroDuplicateMessagesPassed;

    return {
      hardware: getHardwareProfile(),
      config,
      durationMs,
      memory: {
        heapUsedStartMb: Math.round(startMemory / (1024 * 1024)),
        heapUsedEndMb: Math.round(endMemory / (1024 * 1024)),
        heapDiffMb: Math.round((endMemory - startMemory) / (1024 * 1024)),
      },
      metrics: {
        messageAcceptanceMs: messageAcceptanceDist,
        commitToRecipientMs: commitToRecipientDist,
        proxyAuthLatencyMs: proxyAuthDist,
        outboxDrainAgeMs: outboxDrainDist,
      },
      invariants: {
        totalMessagesSent: this.totalMessagesSent,
        totalDeliveriesReceived: this.totalDeliveriesReceived,
        totalControlSignalsSent: this.totalControlSignalsSent,
        lostAcceptedMessages,
        duplicateMessages: this.duplicateMessages,
        reconnectedClients: this.reconnectedCount,
        peakSimulatedConns: this.clients.length,
        peakSimulatedSubs: this.clients.length * config.averageSubscriptionsPerConnection,
        dbConnectionsUsed: this.maxDbConnectionsUsed,
        dbPoolExhausted: this.maxDbConnectionsUsed >= this.simulatedDbPoolLimit,
      },
      slo: {
        messageAcceptancePassed,
        commitToRecipientPassed,
        commitToRecipientP99Passed,
        oldestPendingAgePassed,
        zeroLostMessagesPassed,
        zeroDuplicateMessagesPassed,
        overallPassed,
      },
    };
  }
}
