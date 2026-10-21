import { describe, expect, it, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('server-only', () => ({}));

const hoisted = vi.hoisted(() => ({
  getUser: vi.fn(),
  rateLimitAllowed: true,
  rateLimitResult: {
    allowed: true,
    limit: 15,
    remaining: 14,
    resetSeconds: 60,
  },
  studyRoomCount: vi.fn(),
  studyRoomFindMany: vi.fn(),
  studyRoomFindUnique: vi.fn(),
  joinRoom: vi.fn(),
  renewLease: vi.fn(),
  leaveRoom: vi.fn(),
  updateParticipantGoal: vi.fn(),
  updateRoomEnvironment: vi.fn(),
  getRoomEnvironment: vi.fn(),
  startSession: vi.fn(),
  pauseSession: vi.fn(),
  resumeSession: vi.fn(),
  completeSession: vi.fn(),
  interruptSession: vi.fn(),
}));

vi.mock('@/src/server/infrastructure/auth/getUser', () => ({
  getUser: hoisted.getUser,
}));

vi.mock('@/src/server/domain/messaging/rate-limiter.service', () => ({
  rateLimiterService: {
    checkRoomJoinRateLimit: vi.fn().mockImplementation(() => Promise.resolve(hoisted.rateLimitResult)),
    checkRoomRenewRateLimit: vi.fn().mockImplementation(() => Promise.resolve(hoisted.rateLimitResult)),
    checkRoomControlRateLimit: vi.fn().mockImplementation(() => Promise.resolve(hoisted.rateLimitResult)),
    checkRoomGoalRateLimit: vi.fn().mockImplementation(() => Promise.resolve(hoisted.rateLimitResult)),
    createHeaders: vi.fn((res) => ({
      'X-RateLimit-Limit': String(res.limit),
      'X-RateLimit-Remaining': String(res.remaining),
      'X-RateLimit-Reset': String(res.resetSeconds),
      ...(!res.allowed && { 'Retry-After': String(res.resetSeconds) }),
    })),
  },
}));

vi.mock('@/src/server/domain/studyroom/studyroom.service', () => ({
  studyRoomService: {
    joinRoom: hoisted.joinRoom,
    renewLease: hoisted.renewLease,
    leaveRoom: hoisted.leaveRoom,
    updateParticipantGoal: hoisted.updateParticipantGoal,
  },
}));

vi.mock('@/src/server/domain/studyroom/environment.service', () => ({
  environmentService: {
    updateRoomEnvironment: hoisted.updateRoomEnvironment,
    getRoomEnvironment: hoisted.getRoomEnvironment,
  },
}));

vi.mock('@/src/server/domain/studyroom/sprint.service', () => ({
  sprintService: {
    resolveRoom: vi.fn().mockResolvedValue({ id: 'room-1', title: 'Fireplace' }),
  },
}));

vi.mock('@/src/server/domain/studyroom/session.service', () => ({
  sessionService: {
    startSession: hoisted.startSession,
    pauseSession: hoisted.pauseSession,
    resumeSession: hoisted.resumeSession,
    completeSession: hoisted.completeSession,
    interruptSession: hoisted.interruptSession,
    getActiveSession: vi.fn().mockResolvedValue(null),
  },
  SessionConflictError: class SessionConflictError extends Error {
    status = 409;
  },
}));

vi.mock('@/src/server/infrastructure/db/postgres/client', () => ({
  prisma: {
    studyRoom: {
      count: hoisted.studyRoomCount,
      findMany: hoisted.studyRoomFindMany,
      findUnique: hoisted.studyRoomFindUnique,
    },
    realtimeDelivery: {
      count: vi.fn().mockResolvedValue(0),
      findFirst: vi.fn().mockResolvedValue(null),
    },
    roomLease: {
      count: vi.fn().mockResolvedValue(5),
    },
    roomSprint: {
      count: vi.fn().mockResolvedValue(1),
    },
  },
}));

import { POST as mainStudyRoomPost, GET as mainStudyRoomGet } from '@/src/app/api/studyroom/route';
import { PATCH as statusPatch } from '@/src/app/api/studyroom/[roomSlug]/status/route';
import { PUT as environmentPut } from '@/src/app/api/studyroom/[roomSlug]/environment/route';
import { POST as sessionPost, PATCH as sessionPatch } from '@/src/app/api/studyroom/session/route';
import { GET as metricsGet } from '@/src/app/api/internal/studyroom/metrics/route';
import { studyRoomMetricsService } from '../studyroom-metrics.service';
import {
  evaluateStudyRoomEnvironment,
  formatStudyRoomReadinessMarkdown,
  runStudyRoomReadinessProbe,
} from '../../../../../scripts/studyroom-readiness';

describe('Phase 11: Security, Errors, and Operational Completion', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.clearAllMocks();
    studyRoomMetricsService.resetMetricsForTest();
    process.env = { ...originalEnv };
    hoisted.getUser.mockResolvedValue({ id: 'user-alice', email: 'alice@example.com' });
    hoisted.rateLimitResult = {
      allowed: true,
      limit: 15,
      remaining: 14,
      resetSeconds: 60,
    };
  });

  describe('1. CSRF & Origin Verification', () => {
    it('rejects cross-origin POST on /api/studyroom', async () => {
      const req = new NextRequest('http://localhost:3000/api/studyroom', {
        method: 'POST',
        headers: {
          origin: 'https://malicious-site.com',
          'content-type': 'application/json',
        },
        body: JSON.stringify({ action: 'join', roomId: 'room-1' }),
      });

      const res = await mainStudyRoomPost(req);
      expect(res.status).toBe(403);
      const json = await res.json();
      expect(json.code).toBe('INVALID_ORIGIN');
    });

    it('rejects cross-origin PUT on /api/studyroom/[roomSlug]/environment', async () => {
      const req = new NextRequest('http://localhost:3000/api/studyroom/fireplace/environment', {
        method: 'PUT',
        headers: {
          origin: 'https://attacker.com',
          'content-type': 'application/json',
        },
        body: JSON.stringify({ sceneId: 'library' }),
      });

      const res = await environmentPut(req, { params: Promise.resolve({ roomSlug: 'fireplace' }) });
      expect(res.status).toBe(403);
      const json = await res.json();
      expect(json.code).toBe('INVALID_ORIGIN');
    });

    it('rejects cross-origin PATCH on /api/studyroom/[roomSlug]/status', async () => {
      const req = new NextRequest('http://localhost:3000/api/studyroom/fireplace/status', {
        method: 'PATCH',
        headers: {
          origin: 'https://evil.org',
          'content-type': 'application/json',
        },
        body: JSON.stringify({ tabId: 'tab-1', generation: 1, publicGoal: 'Hacked' }),
      });

      const res = await statusPatch(req, { params: Promise.resolve({ roomSlug: 'fireplace' }) });
      expect(res.status).toBe(403);
      const json = await res.json();
      expect(json.code).toBe('INVALID_ORIGIN');
    });

    it('rejects cross-origin POST on /api/studyroom/session', async () => {
      const req = new NextRequest('http://localhost:3000/api/studyroom/session', {
        method: 'POST',
        headers: {
          origin: 'https://attacker.org',
          'content-type': 'application/json',
        },
        body: JSON.stringify({ targetDurationSeconds: 1500 }),
      });

      const res = await sessionPost(req);
      expect(res.status).toBe(403);
      const json = await res.json();
      expect(json.code).toBe('INVALID_ORIGIN');
    });

    it('rejects cross-origin PATCH on /api/studyroom/session', async () => {
      const req = new NextRequest('http://localhost:3000/api/studyroom/session', {
        method: 'PATCH',
        headers: {
          origin: 'https://attacker.org',
          'content-type': 'application/json',
        },
        body: JSON.stringify({ action: 'pause', sessionId: 'sess-1' }),
      });

      const res = await sessionPatch(req);
      expect(res.status).toBe(403);
      const json = await res.json();
      expect(json.code).toBe('INVALID_ORIGIN');
    });

    it('allows same-origin requests', async () => {
      hoisted.joinRoom.mockResolvedValueOnce({
        status: 'joined',
        role: 'member',
        generation: 1,
        streamGeneration: 1,
        channelId: 'ch-1',
      });

      const req = new NextRequest('http://localhost:3000/api/studyroom', {
        method: 'POST',
        headers: {
          origin: 'http://localhost:3000',
          'content-type': 'application/json',
        },
        body: JSON.stringify({ action: 'join', roomId: 'room-1' }),
      });

      const res = await mainStudyRoomPost(req);
      expect(res.status).toBe(200);
    });
  });

  describe('2. Payload Size & Input Bounds', () => {
    it('rejects oversized request bodies on POST /api/studyroom (> 32KB)', async () => {
      const giantString = 'A'.repeat(35 * 1024);
      const req = new NextRequest('http://localhost:3000/api/studyroom', {
        method: 'POST',
        headers: {
          origin: 'http://localhost:3000',
          'content-type': 'application/json',
        },
        body: JSON.stringify({ action: 'join', roomId: 'room-1', extra: giantString }),
      });

      const res = await mainStudyRoomPost(req);
      expect(res.status).toBe(413);
      const json = await res.json();
      expect(json.code).toBe('INPUT_TOO_LARGE');
    });

    it('rejects goal string exceeding maximum length (> 280 chars)', async () => {
      const longGoal = 'G'.repeat(300);
      const req = new NextRequest('http://localhost:3000/api/studyroom', {
        method: 'POST',
        headers: {
          origin: 'http://localhost:3000',
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          action: 'update_goal',
          roomId: 'room-1',
          tabId: 'tab-1',
          generation: 1,
          publicGoal: longGoal,
        }),
      });

      const res = await mainStudyRoomPost(req);
      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.code).toBe('INPUT_TOO_LONG');
    });

    it('rejects invalid session duration (< 60s or > 14400s) on /api/studyroom/session', async () => {
      const tooShortReq = new NextRequest('http://localhost:3000/api/studyroom/session', {
        method: 'POST',
        headers: {
          origin: 'http://localhost:3000',
          'content-type': 'application/json',
        },
        body: JSON.stringify({ targetDurationSeconds: 30 }),
      });

      const shortRes = await sessionPost(tooShortReq);
      expect(shortRes.status).toBe(400);
      const shortJson = await shortRes.json();
      expect(shortJson.code).toBe('INVALID_DURATION');

      const tooLongReq = new NextRequest('http://localhost:3000/api/studyroom/session', {
        method: 'POST',
        headers: {
          origin: 'http://localhost:3000',
          'content-type': 'application/json',
        },
        body: JSON.stringify({ targetDurationSeconds: 20000 }),
      });

      const longRes = await sessionPost(tooLongReq);
      expect(longRes.status).toBe(400);
      const longJson = await longRes.json();
      expect(longJson.code).toBe('INVALID_DURATION');
    });
  });

  describe('3. Rate Limiting Enforcement', () => {
    it('returns 429 when join rate limit is exceeded', async () => {
      hoisted.rateLimitResult = {
        allowed: false,
        limit: 15,
        remaining: 0,
        resetSeconds: 45,
      };

      const req = new NextRequest('http://localhost:3000/api/studyroom', {
        method: 'POST',
        headers: {
          origin: 'http://localhost:3000',
          'content-type': 'application/json',
        },
        body: JSON.stringify({ action: 'join', roomId: 'room-1' }),
      });

      const res = await mainStudyRoomPost(req);
      expect(res.status).toBe(429);
      expect(res.headers.get('Retry-After')).toBe('45');
      expect(res.headers.get('X-RateLimit-Remaining')).toBe('0');
      const json = await res.json();
      expect(json.code).toBe('RATE_LIMIT_EXCEEDED');
    });

    it('returns 429 when renewal rate limit is exceeded', async () => {
      hoisted.rateLimitResult = {
        allowed: false,
        limit: 20,
        remaining: 0,
        resetSeconds: 30,
      };

      const req = new NextRequest('http://localhost:3000/api/studyroom', {
        method: 'POST',
        headers: {
          origin: 'http://localhost:3000',
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          action: 'renew',
          roomId: 'room-1',
          tabId: 'tab-1',
          generation: 1,
        }),
      });

      const res = await mainStudyRoomPost(req);
      expect(res.status).toBe(429);
      expect(res.headers.get('Retry-After')).toBe('30');
    });

    it('returns 429 when control rate limit is exceeded on environment endpoint', async () => {
      hoisted.rateLimitResult = {
        allowed: false,
        limit: 30,
        remaining: 0,
        resetSeconds: 25,
      };

      const req = new NextRequest('http://localhost:3000/api/studyroom/fireplace/environment', {
        method: 'PUT',
        headers: {
          origin: 'http://localhost:3000',
          'content-type': 'application/json',
        },
        body: JSON.stringify({ sceneId: 'library' }),
      });

      const res = await environmentPut(req, { params: Promise.resolve({ roomSlug: 'fireplace' }) });
      expect(res.status).toBe(429);
      expect(res.headers.get('Retry-After')).toBe('25');
    });
  });

  describe('4. Public Cache Sanitization', () => {
    it('ensures GET /api/studyroom never leaks participant user profiles in public cached rooms', async () => {
      hoisted.studyRoomCount.mockResolvedValue(1);
      hoisted.studyRoomFindMany.mockResolvedValueOnce([
        {
          id: 'room-1',
          title: 'Fireplace',
          onlineCount: 2,
          participants: [
            { id: 'part-1', userId: 'user-1' },
            { id: 'part-2', userId: 'user-2' },
          ],
        },
      ]);

      const res = await mainStudyRoomGet();
      expect(res.status).toBe(200);
      const data = await res.json();

      expect(data).toHaveLength(1);
      const room = data[0];
      expect(room.id).toBe('room-1');
      // Verify no participant names, emails, or user profiles are present
      for (const p of room.participants) {
        expect(p.user).toBeUndefined();
        expect(p.name).toBeUndefined();
        expect(p.email).toBeUndefined();
        expect(p.image).toBeUndefined();
      }
    });

    it('serves authenticated endpoints with Cache-Control: private, no-store', async () => {
      const req = new NextRequest('http://localhost:3000/api/studyroom/fireplace/status', {
        method: 'PATCH',
        headers: {
          origin: 'http://localhost:3000',
          'content-type': 'application/json',
        },
        body: JSON.stringify({ tabId: 'tab-1', generation: 1, publicGoal: 'Study math' }),
      });

      hoisted.updateParticipantGoal.mockResolvedValueOnce({
        success: true,
        publicGoal: 'Study math',
      });

      const res = await statusPatch(req, { params: Promise.resolve({ roomSlug: 'fireplace' }) });
      expect(res.status).toBe(200);
      expect(res.headers.get('Cache-Control')).toBe('private, no-store');
    });
  });

  describe('5. Operational Metrics & Internal Telemetry Endpoint', () => {
    it('records renewal failures and latency correctly', async () => {
      studyRoomMetricsService.recordRenewalFailure('stale_generation');
      studyRoomMetricsService.recordRenewalFailure('stale_generation');
      studyRoomMetricsService.recordRenewalFailure('rate_limited');
      studyRoomMetricsService.recordJoinLatency(120);
      studyRoomMetricsService.recordJoinLatency(80);
      studyRoomMetricsService.recordReconciliation(4, 35);
      studyRoomMetricsService.recordVersionConflict('session');

      const summary = await studyRoomMetricsService.getMetricsSummary();
      expect(summary.counters.renewalFailures['stale_generation']).toBe(2);
      expect(summary.counters.renewalFailures['rate_limited']).toBe(1);
      expect(summary.counters.versionConflicts['session']).toBe(1);
      expect(summary.latency.totalJoinsSampled).toBe(2);
      expect(summary.latency.joinAvgMs).toBe(100);
      expect(summary.reconciliation.lastSweptCount).toBe(4);
      expect(summary.reconciliation.lastDurationMs).toBe(35);
    });

    it('rejects unauthorized access to internal metrics endpoint (403)', async () => {
      const req = new NextRequest('http://localhost:3000/api/internal/studyroom/metrics', {
        headers: { 'x-internal-secret': 'wrong-secret' },
      });

      const res = await metricsGet(req);
      expect(res.status).toBe(403);
    });

    it('returns metrics summary when authorized with INTERNAL_API_SECRET', async () => {
      process.env.INTERNAL_API_SECRET = 'valid-test-secret-32-chars-long-1234';

      const req = new NextRequest('http://localhost:3000/api/internal/studyroom/metrics', {
        headers: { 'x-internal-secret': 'valid-test-secret-32-chars-long-1234' },
      });

      const res = await metricsGet(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.status).toBe('healthy');
      expect(data.counters).toBeDefined();
      expect(data.studyRooms).toBeDefined();
    });
  });

  describe('6. Operational Readiness Probe', () => {
    it('evaluates environment readiness and detects missing or weak secrets', () => {
      const weakEnv: NodeJS.ProcessEnv = {
        NODE_ENV: 'test',
        DATABASE_URL: '',
        CENTRIFUGO_HMAC_SECRET_KEY: 'changeme',
        CENTRIFUGO_API_KEY: '123',
        INTERNAL_API_SECRET: 'short',
        NEXTAUTH_SECRET: '',
      };

      const checks = evaluateStudyRoomEnvironment(weakEnv);
      const dbCheck = checks.find(c => c.name.includes('DATABASE_URL'));
      expect(dbCheck?.status).toBe('blocked');

      const hmacCheck = checks.find(c => c.name.includes('CENTRIFUGO_HMAC_SECRET_KEY'));
      expect(hmacCheck?.status).toBe('blocked');

      const apiKeyCheck = checks.find(c => c.name.includes('CENTRIFUGO_API_KEY'));
      expect(apiKeyCheck?.status).toBe('blocked');
    });

    it('passes environment checks when valid strong configuration is provided', () => {
      const validEnv: NodeJS.ProcessEnv = {
        NODE_ENV: 'test',
        DATABASE_URL: 'postgresql://localhost:5432/test',
        CENTRIFUGO_HMAC_SECRET_KEY: 'c7d8e9f0a1b2c3d4e5f60718293a4b5c6d7e8f90a1b2c3d4e5f60718293a4b5c',
        CENTRIFUGO_API_KEY: 'api-key-32-chars-long-secure-token-1234',
        INTERNAL_API_SECRET: 'internal-secret-valid-token-9012',
        NEXTAUTH_SECRET: 'nextauth-secret-32-chars-long-valid',
      };

      const checks = evaluateStudyRoomEnvironment(validEnv);
      expect(checks.every(c => c.status === 'ready')).toBe(true);
    });

    it('generates formatted markdown report', async () => {
      const report = await runStudyRoomReadinessProbe({
        skipDb: true,
        env: {
          NODE_ENV: 'test',
          DATABASE_URL: 'postgresql://localhost:5432/test',
          CENTRIFUGO_HMAC_SECRET_KEY: 'c7d8e9f0a1b2c3d4e5f60718293a4b5c6d7e8f90a1b2c3d4e5f60718293a4b5c',
          CENTRIFUGO_API_KEY: 'api-key-32-chars-long-secure-token-1234',
          INTERNAL_API_SECRET: 'internal-secret-valid-token-9012',
          NEXTAUTH_SECRET: 'nextauth-secret-32-chars-long-valid',
        },
      });

      const md = formatStudyRoomReadinessMarkdown(report);
      expect(md).toContain('# Study Room Readiness Probe Report');
      expect(md).toContain('READY FOR PRODUCTION');
      expect(md).toContain('DATABASE_URL');
      expect(md).toContain('CENTRIFUGO_HMAC_SECRET_KEY');
    });
  });
});
