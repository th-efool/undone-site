/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from 'vitest';
vi.mock('server-only', () => ({}));
import * as jose from 'jose';
import { tokenService } from '../token.service';
import { manifestService } from '@/src/server/domain/messaging/manifest.service';
import { prisma } from '@/src/server/infrastructure/db/postgres/client';

describe('tokenService', () => {
  beforeEach(() => {
    process.env.CENTRIFUGO_TOKEN_HMAC_SECRET_KEY =
      'test_secret_key_minimum_32_characters_for_hmac_hs256';
    process.env.CENTRIFUGO_ISSUER = 'undone-messaging';
    process.env.CENTRIFUGO_AUDIENCE = 'undone-centrifugo';
  });

  it('generates a valid HS256 connection JWT with sub = userId and 5-minute lifetime', async () => {
    const userId = 'user_test_123';
    const result = await tokenService.createConnectionToken(userId);

    expect(result.token).toBeDefined();
    expect(typeof result.token).toBe('string');
    expect(result.endpoint).toBeDefined();

    const now = Math.floor(Date.now() / 1000);
    expect(result.expiresAt).toBeGreaterThanOrEqual(now + 295);
    expect(result.expiresAt).toBeLessThanOrEqual(now + 305);

    // Verify token using jose directly
    const secret = new TextEncoder().encode(process.env.CENTRIFUGO_TOKEN_HMAC_SECRET_KEY);
    const { payload } = await jose.jwtVerify(result.token, secret, {
      issuer: 'undone-messaging',
      audience: 'undone-centrifugo',
    });

    expect(payload.sub).toBe(userId);
    expect(payload.iss).toBe('undone-messaging');
    expect(payload.aud).toBe('undone-centrifugo');
    expect(payload.exp).toBe(result.expiresAt);
  });

  it('verifies a valid token and extracts userId', async () => {
    const userId = 'user_test_verify';
    const { token, expiresAt } = await tokenService.createConnectionToken(userId);

    const verified = await tokenService.verifyConnectionToken(token);
    expect(verified.userId).toBe(userId);
    expect(verified.expiresAt).toBe(expiresAt);
  });

  it('rejects a token signed with an invalid secret', async () => {
    const wrongSecret = new TextEncoder().encode('wrong_secret_key_32_characters_long_for_test');
    const fakeToken = await new jose.SignJWT({ sub: 'user_attacker' })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setIssuer('undone-messaging')
      .setAudience('undone-centrifugo')
      .setExpirationTime('5m')
      .sign(wrongSecret);

    await expect(tokenService.verifyConnectionToken(fakeToken)).rejects.toThrow();
  });

  it('rejects empty or non-string userId', async () => {
    await expect(tokenService.createConnectionToken('')).rejects.toThrow();
  });
});

describe('manifestService', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('resolves authorized subscription manifest including inbox, community, dm, and active room', async () => {
    const userId = 'user_manifest_test';

    // Mock enrolled community
    vi.spyOn(prisma.cohortMember, 'findMany').mockResolvedValue([
      {
        cohort: {
          id: 'cohort_1',
          community: {
            id: 'comm_1',
            chatEnabled: true,
            accessGeneration: 2,
            channels: [{ id: 'chan_general' }, { id: 'chan_random' }],
          },
        },
      },
    ] as any);

    // Mock created cohort
    vi.spyOn(prisma.cohort, 'findMany').mockResolvedValue([]);

    // Mock direct and group conversations
    vi.spyOn(prisma.conversationParticipant, 'findMany').mockResolvedValue([
      {
        conversation: {
          id: 'conv_dm_1',
          kind: 'DIRECT',
          accessGeneration: 1,
          channel: { id: 'chan_dm_1' },
        },
      },
      {
        conversation: {
          id: 'conv_group_2',
          kind: 'GROUP',
          accessGeneration: 3,
          channel: { id: 'chan_grp_2' },
        },
      },
    ] as any);

    // Mock active room
    vi.spyOn(prisma.roomParticipant, 'findUnique').mockResolvedValue({
      room: {
        id: 'room_123',
        status: 'active',
        channel: { id: 'chan_room_123' },
      },
    } as any);
    vi.spyOn(prisma.roomLease, 'findFirst').mockResolvedValue({
      id: 'lease_123',
    } as any);

    const manifest = await manifestService.getAuthorizedSubscriptionManifest(userId);

    expect(manifest.userId).toBe(userId);
    expect(manifest.channels).toEqual([
      {
        channel: `user:${userId}:g1`,
        scopeType: 'user',
        entityId: userId,
        generation: 1,
      },
      {
        channel: 'community:chan_general:g2',
        scopeType: 'community',
        entityId: 'chan_general',
        generation: 2,
      },
      {
        channel: 'community:chan_random:g2',
        scopeType: 'community',
        entityId: 'chan_random',
        generation: 2,
      },
      {
        channel: 'dm:conv_dm_1:g1',
        scopeType: 'dm',
        entityId: 'conv_dm_1',
        generation: 1,
      },
      {
        channel: 'group:conv_group_2:g3',
        scopeType: 'group',
        entityId: 'conv_group_2',
        generation: 3,
      },
      {
        channel: 'room:room_123:g1',
        scopeType: 'room',
        entityId: 'room_123',
        generation: 1,
      },
      {
        channel: 'roomchat:chan_room_123:g1',
        scopeType: 'roomchat',
        entityId: 'chan_room_123',
        generation: 1,
      },
    ]);
  });

  it('excludes disabled community chat and inactive study rooms', async () => {
    const userId = 'user_manifest_inactive';

    vi.spyOn(prisma.cohortMember, 'findMany').mockResolvedValue([
      {
        cohort: {
          id: 'cohort_disabled',
          community: {
            id: 'comm_disabled',
            chatEnabled: false, // Disabled
            accessGeneration: 1,
            channels: [{ id: 'chan_disabled' }],
          },
        },
      },
    ] as any);

    vi.spyOn(prisma.cohort, 'findMany').mockResolvedValue([]);
    vi.spyOn(prisma.conversationParticipant, 'findMany').mockResolvedValue([]);
    vi.spyOn(prisma.roomParticipant, 'findUnique').mockResolvedValue({
      room: {
        id: 'room_ended',
        status: 'ended', // Inactive
        channel: { id: 'chan_room_ended' },
      },
    } as any);

    const manifest = await manifestService.getAuthorizedSubscriptionManifest(userId);

    // Only personal inbox channel should be returned
    expect(manifest.channels).toHaveLength(1);
    expect(manifest.channels[0].channel).toBe(`user:${userId}:g1`);
  });
});
