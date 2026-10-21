import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  assertSafeLoadEnvironment,
  assertSafeFixtureId,
  makeFixtureId,
  LoadEnvironmentSafetyError,
  FIXTURE_LOAD_PREFIX,
} from '../load/safety';
import {
  SimulatedCentrifugeClient,
  type SimulatedMessagePayload,
} from '../load/protocol-client';
import {
  MessagingBenchmarkRunner,
  calculateDistribution,
  type LoadRunConfig,
} from '../load/benchmark-engine';

describe('Phase 12: Load Harness & Safety Guardrails', () => {
  const originalEnv = process.env.NODE_ENV;
  const originalDbUrl = process.env.DATABASE_URL;

  beforeEach(() => {
    process.env.NODE_ENV = 'test';
  });

  afterEach(() => {
    if (originalEnv !== undefined) {
      process.env.NODE_ENV = originalEnv;
    } else {
      delete process.env.NODE_ENV;
    }
    if (originalDbUrl !== undefined) {
      process.env.DATABASE_URL = originalDbUrl;
    } else {
      delete process.env.DATABASE_URL;
    }
  });

  describe('assertSafeLoadEnvironment', () => {
    it('throws if NODE_ENV is production', () => {
      process.env.NODE_ENV = 'production';
      expect(() => assertSafeLoadEnvironment()).toThrow(LoadEnvironmentSafetyError);
      expect(() => assertSafeLoadEnvironment()).toThrow(/NODE_ENV is set to "production"/);
    });

    it('throws if target host is a remote cloud provider', () => {
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
  });

  describe('assertSafeFixtureId', () => {
    it('enforces prefix fixture:load: on all generated entities', () => {
      const validId = makeFixtureId('user', 'test-123');
      expect(validId.startsWith(FIXTURE_LOAD_PREFIX)).toBe(true);
      expect(() => assertSafeFixtureId(validId, 'user')).not.toThrow();

      expect(() => assertSafeFixtureId('real-user-uuid-1234', 'user')).toThrow(LoadEnvironmentSafetyError);
      expect(() => assertSafeFixtureId('user-456', 'user')).toThrow(/All load test entities must start with/);
    });
  });
});

describe('Phase 12: Centrifuge Protocol Client Simulator', () => {
  it('performs connect handshake and validates authentication tokens', async () => {
    const client = new SimulatedCentrifugeClient({ userId: 'fixture:load:user:1' });
    expect(client.state).toBe('DISCONNECTED');

    // Invalid token rejected
    const badReply = await client.connect('short');
    expect(badReply.error).toBeDefined();
    expect(badReply.error?.code).toBe(100);
    expect(client.state).toBe('ERROR');

    // Valid token succeeds
    const goodReply = await client.connect('valid-test-token-exceeding-length');
    expect(goodReply.connect).toBeDefined();
    expect(goodReply.connect?.version).toBe('6.10.0');
    expect(client.state).toBe('CONNECTED');
    expect(client.clientId).toBeDefined();
  });

  it('manages channel subscriptions and tracks monotonic offsets', async () => {
    const client = new SimulatedCentrifugeClient({ userId: 'fixture:load:user:2' });
    await client.connect('valid-test-token-exceeding-length');

    const channel = 'community:fixture:load:cohort:gen:g1';
    const subReply = await client.subscribe(channel);
    expect(subReply.subscribe).toBeDefined();
    expect(client.isSubscribedTo(channel)).toBe(true);

    const payload: SimulatedMessagePayload = {
      id: 'msg-1',
      channelId: channel,
      content: 'hello load test',
      senderId: 'fixture:load:user:3',
      sequence: 101,
      serverCreatedAt: Date.now() - 5,
    };

    client.receivePublication(channel, payload);
    expect(client.getReceivedCount()).toBe(1);
    expect(client.getDuplicateCount()).toBe(0);

    const metrics = client.getTransitMetrics();
    expect(metrics.length).toBe(1);
    expect(metrics[0].transitMs).toBeGreaterThanOrEqual(0);
    expect(metrics[0].sequence).toBe(101);
  });

  it('detects duplicate message publications', async () => {
    const client = new SimulatedCentrifugeClient({ userId: 'fixture:load:user:4' });
    await client.connect('valid-test-token-exceeding-length');
    const channel = 'room:fixture:load:room:1:g1';
    await client.subscribe(channel);

    const payload: SimulatedMessagePayload = {
      id: 'msg-duplicate-test',
      channelId: channel,
      content: 'duplicate test',
      senderId: 'fixture:load:user:5',
      sequence: 200,
      serverCreatedAt: Date.now(),
    };

    client.receivePublication(channel, payload);
    expect(client.getDuplicateCount()).toBe(0);

    // Same message ID received again
    client.receivePublication(channel, payload);
    expect(client.getDuplicateCount()).toBe(1);
  });
});

describe('Phase 12: Messaging Load & Capacity Verification (LOAD-01)', () => {
  it('calculates statistical distributions (min, avg, p50, p95, p99)', () => {
    const samples = [10, 20, 30, 40, 50, 60, 70, 80, 90, 100];
    const dist = calculateDistribution(samples);

    expect(dist.count).toBe(10);
    expect(dist.min).toBe(10);
    expect(dist.max).toBe(100);
    expect(dist.avg).toBe(55);
    expect(dist.p50).toBe(60);
    expect(dist.p95).toBe(100);
    expect(dist.p99).toBe(100);

    const emptyDist = calculateDistribution([]);
    expect(emptyDist.count).toBe(0);
    expect(emptyDist.p50).toBe(0);
  });

  it('meets Tier 1 (65 connections baseline) SLO gates', async () => {
    const runner = new MessagingBenchmarkRunner({ simulatedDbPoolLimit: 20 });
    const config: LoadRunConfig = {
      connectionCount: 65,
      averageSubscriptionsPerConnection: 4,
      connectionsPerUser: 1.3,
      messagesPerSecond: 2,
      controlSignalsPerSecond: 8,
      durationSeconds: 1,
      hotChannelSubscribers: 20,
      enableBurst2x: false,
      reconnectPercent: 25,
    };

    const results = await runner.runBenchmark(config);

    expect(results.invariants.peakSimulatedConns).toBe(65);
    expect(results.invariants.peakSimulatedSubs).toBe(260);
    expect(results.invariants.lostAcceptedMessages).toBe(0);
    expect(results.invariants.duplicateMessages).toBe(0);
    expect(results.invariants.dbPoolExhausted).toBe(false);

    // Verify SLO Gates
    expect(results.slo.messageAcceptancePassed).toBe(true);
    expect(results.slo.commitToRecipientPassed).toBe(true);
    expect(results.slo.commitToRecipientP99Passed).toBe(true);
    expect(results.slo.oldestPendingAgePassed).toBe(true);
    expect(results.slo.zeroLostMessagesPassed).toBe(true);
    expect(results.slo.zeroDuplicateMessagesPassed).toBe(true);
    expect(results.slo.overallPassed).toBe(true);
  });

  it('handles hot channel fan-out (500 subscribers) with strict delivery integrity', async () => {
    const runner = new MessagingBenchmarkRunner({ simulatedDbPoolLimit: 20 });
    const config: LoadRunConfig = {
      connectionCount: 500,
      averageSubscriptionsPerConnection: 4,
      connectionsPerUser: 1.0,
      messagesPerSecond: 5,
      controlSignalsPerSecond: 10,
      durationSeconds: 1,
      hotChannelSubscribers: 500,
      enableBurst2x: false,
    };

    const results = await runner.runBenchmark(config);

    expect(results.invariants.peakSimulatedConns).toBe(500);
    expect(results.invariants.lostAcceptedMessages).toBe(0);
    expect(results.invariants.duplicateMessages).toBe(0);
    expect(results.invariants.totalDeliveriesReceived).toBeGreaterThan(0);
    expect(results.slo.overallPassed).toBe(true);
  });

  it('guarantees zero message loss during worker failure injection and recovery (LOAD-01)', async () => {
    const runner = new MessagingBenchmarkRunner({ simulatedDbPoolLimit: 20 });
    const config: LoadRunConfig = {
      connectionCount: 100,
      averageSubscriptionsPerConnection: 4,
      connectionsPerUser: 1.3,
      messagesPerSecond: 10,
      controlSignalsPerSecond: 20,
      durationSeconds: 2,
      enableWorkerKill: true, // Injects worker outage
    };

    const results = await runner.runBenchmark(config);

    // Invariant: zero lost accepted messages and zero duplicates even with injected worker kill
    expect(results.invariants.lostAcceptedMessages).toBe(0);
    expect(results.invariants.duplicateMessages).toBe(0);
    expect(results.slo.zeroLostMessagesPassed).toBe(true);
    expect(results.slo.zeroDuplicateMessagesPassed).toBe(true);
    expect(results.slo.overallPassed).toBe(true);
  });

  it('absorbs 100% reconnect storms within connection and callback budgets', async () => {
    const runner = new MessagingBenchmarkRunner({ simulatedDbPoolLimit: 20 });
    const config: LoadRunConfig = {
      connectionCount: 150,
      averageSubscriptionsPerConnection: 4,
      connectionsPerUser: 1.0,
      messagesPerSecond: 2,
      controlSignalsPerSecond: 5,
      durationSeconds: 1,
      reconnectPercent: 100, // All 150 clients reconnect simultaneously
    };

    const results = await runner.runBenchmark(config);

    expect(results.invariants.reconnectedClients).toBe(150);
    expect(results.metrics.proxyAuthLatencyMs.p95).toBeLessThan(100);
    expect(results.slo.overallPassed).toBe(true);
  });
});
