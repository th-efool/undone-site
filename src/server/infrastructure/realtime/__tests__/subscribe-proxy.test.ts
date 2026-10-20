import { describe, it, expect, vi, beforeEach } from 'vitest';
vi.mock('server-only', () => ({}));
import { NextRequest } from 'next/server';
import {
  verifyProxyStaticKey,
  parseChannelString,
  proxyAuthService,
  CENTRIFUGO_PROXY_KEY_HEADER,
} from '@/src/server/domain/messaging/proxy-auth.service';
import { POST as subscribeHandler } from '@/src/app/api/internal/realtime/subscribe/route';
import { POST as subRefreshHandler } from '@/src/app/api/internal/realtime/sub-refresh/route';
import { prisma } from '@/src/server/infrastructure/db/postgres/client';

describe('verifyProxyStaticKey', () => {
  const STATIC_KEY = 'secret_proxy_key_test_1234567890';

  beforeEach(() => {
    process.env.CENTRIFUGO_PROXY_STATIC_KEY = STATIC_KEY;
  });

  it('accepts exact matching key', () => {
    expect(verifyProxyStaticKey(STATIC_KEY)).toBe(true);
  });

  it('rejects mismatched, missing, or empty key', () => {
    expect(verifyProxyStaticKey('wrong_key')).toBe(false);
    expect(verifyProxyStaticKey(null)).toBe(false);
    expect(verifyProxyStaticKey(undefined)).toBe(false);
    expect(verifyProxyStaticKey('')).toBe(false);
  });
});

describe('parseChannelString', () => {
  it('parses valid channel strings with namespace, entityId, and generation', () => {
    expect(parseChannelString('user:u123:g1')).toEqual({
      namespace: 'user',
      entityId: 'u123',
      generation: 1,
    });
    expect(parseChannelString('community:chan_general:g3')).toEqual({
      namespace: 'community',
      entityId: 'chan_general',
      generation: 3,
    });
    expect(parseChannelString('dm:conv_456:g2')).toEqual({
      namespace: 'dm',
      entityId: 'conv_456',
      generation: 2,
    });
    expect(parseChannelString('group:conv_789:g10')).toEqual({
      namespace: 'group',
      entityId: 'conv_789',
      generation: 10,
    });
  });

  it('rejects malformed channel strings', () => {
    expect(parseChannelString('')).toBeNull();
    expect(parseChannelString('invalid')).toBeNull();
    expect(parseChannelString('user:u123')).toBeNull();
    expect(parseChannelString('user:u123:g0')).toBeNull();
    expect(parseChannelString('user:u123:abc')).toBeNull();
    expect(parseChannelString('a:b:c:d')).toBeNull();
  });
});

describe('proxyAuthService.authorizeSubscription', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(prisma.userRestriction, 'findUnique').mockResolvedValue(null);
  });

  it('authorizes own user inbox but rejects foreign inbox', async () => {
    const own = await proxyAuthService.authorizeSubscription('u1', 'user:u1:g1');
    expect(own.allowed).toBe(true);
    expect(own.expireAt).toBeGreaterThan(Math.floor(Date.now() / 1000));

    const foreign = await proxyAuthService.authorizeSubscription('u1', 'user:u2:g1');
    expect(foreign.allowed).toBe(false);
    expect(foreign.code).toBe(103);
  });

  it('authorizes enrolled community member with matching generation', async () => {
    vi.spyOn(prisma.channel, 'findUnique').mockResolvedValue({
      id: 'chan_1',
      communityId: 'comm_1',
      community: {
        cohortId: 'cohort_1',
        chatEnabled: true,
        accessGeneration: 2,
        cohort: { creatorId: 'creator_99' },
      },
    } as any);

    vi.spyOn(prisma.cohortMember, 'findUnique').mockResolvedValue({
      cohortId: 'cohort_1',
      userId: 'member_1',
    } as any);

    // Matching generation
    const res = await proxyAuthService.authorizeSubscription('member_1', 'community:chan_1:g2');
    expect(res.allowed).toBe(true);

    // Outdated generation (g1 instead of g2)
    const staleRes = await proxyAuthService.authorizeSubscription('member_1', 'community:chan_1:g1');
    expect(staleRes.allowed).toBe(false);
    expect(staleRes.code).toBe(103);
    expect(staleRes.message).toContain('Invalid access generation');
  });

  it('denies community subscription if member was removed or chat disabled', async () => {
    vi.spyOn(prisma.channel, 'findUnique').mockResolvedValue({
      id: 'chan_1',
      communityId: 'comm_1',
      community: {
        cohortId: 'cohort_1',
        chatEnabled: true,
        accessGeneration: 1,
        cohort: { creatorId: 'creator_99' },
      },
    } as any);

    // Not a member
    vi.spyOn(prisma.cohortMember, 'findUnique').mockResolvedValue(null);

    const res = await proxyAuthService.authorizeSubscription('intruder', 'community:chan_1:g1');
    expect(res.allowed).toBe(false);
    expect(res.code).toBe(103);
  });

  it('authorizes conversation participant with matching generation, denies removed participant', async () => {
    vi.spyOn(prisma.conversation, 'findUnique').mockResolvedValue({
      id: 'conv_1',
      kind: 'DIRECT',
      accessGeneration: 1,
    } as any);

    // Active participant
    vi.spyOn(prisma.conversationParticipant, 'findUnique').mockResolvedValueOnce({
      conversationId: 'conv_1',
      userId: 'u1',
      leftAt: null,
    } as any);

    const active = await proxyAuthService.authorizeSubscription('u1', 'dm:conv_1:g1');
    expect(active.allowed).toBe(true);

    // Left participant
    vi.spyOn(prisma.conversationParticipant, 'findUnique').mockResolvedValueOnce({
      conversationId: 'conv_1',
      userId: 'u1',
      leftAt: new Date(),
    } as any);

    const left = await proxyAuthService.authorizeSubscription('u1', 'dm:conv_1:g1');
    expect(left.allowed).toBe(false);
    expect(left.code).toBe(103);
  });

  it('denies all subscriptions for restricted accounts', async () => {
    vi.spyOn(prisma.userRestriction, 'findUnique').mockResolvedValue({
      userId: 'restricted_user',
      expiresAt: new Date(Date.now() + 60000), // active restriction
    } as any);

    const res = await proxyAuthService.authorizeSubscription('restricted_user', 'user:restricted_user:g1');
    expect(res.allowed).toBe(false);
    expect(res.code).toBe(103);
    expect(res.message).toContain('Account is restricted');
  });
});

describe('Centrifugo Proxy Callback HTTP Endpoints', () => {
  const STATIC_KEY = 'secret_proxy_key_test_1234567890';

  beforeEach(() => {
    process.env.CENTRIFUGO_PROXY_STATIC_KEY = STATIC_KEY;
    vi.restoreAllMocks();
    vi.spyOn(prisma.userRestriction, 'findUnique').mockResolvedValue(null);
  });

  it('subscribe endpoint rejects requests without static proxy key header with HTTP 403', async () => {
    const req = new NextRequest('http://localhost:3000/api/internal/realtime/subscribe', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
      },
      body: JSON.stringify({ user: 'u1', channel: 'user:u1:g1' }),
    });

    const res = await subscribeHandler(req);
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toContain('Forbidden');
  });

  it('subscribe endpoint returns Centrifugo result envelope on authorized subscription', async () => {
    const req = new NextRequest('http://localhost:3000/api/internal/realtime/subscribe', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        [CENTRIFUGO_PROXY_KEY_HEADER]: STATIC_KEY,
      },
      body: JSON.stringify({ user: 'u1', channel: 'user:u1:g1' }),
    });

    const res = await subscribeHandler(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.result).toBeDefined();
    expect(body.result.expire_at).toBeGreaterThan(Math.floor(Date.now() / 1000));
    expect(body.error).toBeUndefined();
  });

  it('subscribe endpoint returns Centrifugo error code 103 envelope on unauthorized subscription', async () => {
    const req = new NextRequest('http://localhost:3000/api/internal/realtime/subscribe', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        [CENTRIFUGO_PROXY_KEY_HEADER]: STATIC_KEY,
      },
      body: JSON.stringify({ user: 'u1', channel: 'user:u2:g1' }), // foreign inbox
    });

    const res = await subscribeHandler(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.error).toBeDefined();
    expect(body.error.code).toBe(103);
    expect(body.result).toBeUndefined();
  });

  it('sub-refresh endpoint returns error code 103 when subscription access has been revoked', async () => {
    vi.spyOn(prisma.channel, 'findUnique').mockResolvedValue({
      id: 'chan_1',
      communityId: 'comm_1',
      community: {
        cohortId: 'cohort_1',
        chatEnabled: true,
        accessGeneration: 2, // Community moved to g2
        cohort: { creatorId: 'creator_99' },
      },
    } as any);

    const req = new NextRequest('http://localhost:3000/api/internal/realtime/sub-refresh', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        [CENTRIFUGO_PROXY_KEY_HEADER]: STATIC_KEY,
      },
      body: JSON.stringify({ user: 'member_1', channel: 'community:chan_1:g1' }), // Client still on g1
    });

    const res = await subRefreshHandler(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.error).toBeDefined();
    expect(body.error.code).toBe(103);
  });
});
