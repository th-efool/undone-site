/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('server-only', () => ({}));

// In-memory relational database state for multi-user integration testing
let users: any[] = [];
let rooms: any[] = [];
let participants: any[] = [];
let leases: any[] = [];
let conversations: any[] = [];
let conversationParticipants: any[] = [];
let channels: any[] = [];
let messages: any[] = [];
let userBlocks: any[] = [];
let environments: any[] = [];
let auditLogs: any[] = [];
let realtimeStreams: any[] = [];

vi.mock('@/src/server/infrastructure/db/postgres/client', () => {
  return {
    prisma: {
      user: {
        findFirst: vi.fn(async ({ where }: any) => {
          return (
            users.find((u) => {
              if (where.id && where.id.not && u.id === where.id.not) return false;
              if (where.username?.equals) {
                const target = where.username.equals.toLowerCase();
                return u.username?.toLowerCase() === target;
              }
              if (where.OR) {
                return where.OR.some((cond: any) => {
                  if (cond.name?.contains) {
                    return u.name?.toLowerCase().includes(cond.name.contains.toLowerCase());
                  }
                  if (cond.username?.contains) {
                    return u.username?.toLowerCase().includes(cond.username.contains.toLowerCase());
                  }
                  return false;
                });
              }
              return false;
            }) ?? null
          );
        }),
        findUnique: vi.fn(async ({ where }: any) => {
          if (where.id) return users.find((u) => u.id === where.id) ?? null;
          if (where.username) return users.find((u) => u.username?.toLowerCase() === where.username.toLowerCase()) ?? null;
          return null;
        }),
        findMany: vi.fn(async ({ where }: any) => {
          let list = users;
          if (where?.id?.notIn) {
            const notIn = new Set(where.id.notIn);
            list = list.filter((u) => !notIn.has(u.id));
          }
          if (where?.OR) {
            list = list.filter((u) => {
              return where.OR.some((cond: any) => {
                if (cond.name?.contains) {
                  return u.name?.toLowerCase().includes(cond.name.contains.toLowerCase());
                }
                if (cond.username?.contains) {
                  return u.username?.toLowerCase().includes(cond.username.contains.toLowerCase());
                }
                return false;
              });
            });
          }
          return list.map((u) => ({ id: u.id, name: u.name, image: u.image, username: u.username }));
        }),
        update: vi.fn(async ({ where, data }: any) => {
          const u = users.find((x) => x.id === where.id);
          if (u) Object.assign(u, data);
          return u;
        }),
      },
      userBlock: {
        findMany: vi.fn(async () => userBlocks),
        findFirst: vi.fn(async () => null),
      },
      studyRoom: {
        create: vi.fn(async ({ data }: any) => {
          const newRoom = {
            id: `room-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
            slug: data.slug || 'alpha-study-room',
            title: data.title,
            name: data.title,
            description: data.description || '',
            ownerId: data.ownerId,
            status: data.status || 'OPEN',
            listing: data.listing || 'PUBLIC',
            isPrivate: false,
            channelId: `chan-room-${Date.now()}`,
            maxSeats: 10,
            capacity: data.capacity || 10,
            activeCount: 1,
            generation: 1,
            revision: 1,
            tags: data.tags || [],
            language: data.language || 'en',
            createdAt: new Date(),
            updatedAt: new Date(),
            owner: users.find((u) => u.id === data.ownerId) || null,
          };
          rooms.push(newRoom);
          return newRoom;
        }),
        findUnique: vi.fn(async ({ where }: any) => {
          if (where.id) return rooms.find((r) => r.id === where.id) ?? null;
          if (where.slug) return rooms.find((r) => r.slug === where.slug) ?? null;
          return null;
        }),
        findFirst: vi.fn(async ({ where }: any) => {
          if (where.id) return rooms.find((r) => r.id === where.id) ?? null;
          if (where.slug) return rooms.find((r) => r.slug === where.slug) ?? null;
          return rooms[0] ?? null;
        }),
        findMany: vi.fn(async () => rooms),
        count: vi.fn(async () => 0),
        update: vi.fn(async ({ where, data }: any) => {
          const r = rooms.find((x) => x.id === where.id);
          if (r) Object.assign(r, data);
          return r;
        }),
      },
      roomParticipant: {
        create: vi.fn(async ({ data }: any) => {
          const p = {
            id: `part-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
            studyRoomId: data.studyRoomId,
            userId: data.userId,
            role: data.role || 'STUDENT',
            joinedAt: new Date(),
            user: users.find((u) => u.id === data.userId),
          };
          participants.push(p);
          return p;
        }),
        upsert: vi.fn(async ({ where, create, update }: any) => {
          let p = participants.find((x) => x.userId === where.userId);
          if (p) {
            Object.assign(p, update);
          } else {
            p = {
              id: `part-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
              studyRoomId: create.studyRoomId,
              userId: create.userId,
              role: create.role || 'STUDENT',
              joinedAt: new Date(),
              user: users.find((u) => u.id === create.userId),
            };
            participants.push(p);
          }
          return p;
        }),
        findUnique: vi.fn(async ({ where }: any) => {
          if (where.userId) return participants.find((p) => p.userId === where.userId) ?? null;
          if (where.studyRoomId_userId) {
            return (
              participants.find(
                (p) =>
                  p.studyRoomId === where.studyRoomId_userId.studyRoomId &&
                  p.userId === where.studyRoomId_userId.userId
              ) ?? null
            );
          }
          return null;
        }),
        findMany: vi.fn(async ({ where }: any) => {
          return participants
            .filter((p) => p.studyRoomId === where.studyRoomId)
            .map((p) => ({
              ...p,
              user: users.find((u) => u.id === p.userId),
            }));
        }),
        deleteMany: vi.fn(async () => ({ count: 0 })),
      },
      participantLease: {
        create: vi.fn(async ({ data }: any) => {
          const lease = {
            id: `lease-${Date.now()}`,
            studyRoomId: data.studyRoomId,
            userId: data.userId,
            tabId: data.tabId || 'default-tab',
            generation: 1,
            expiresAt: new Date(Date.now() + 60000),
          };
          leases.push(lease);
          return lease;
        }),
        findMany: vi.fn(async ({ where }: any) => {
          return leases.filter((l) => l.studyRoomId === where.studyRoomId);
        }),
        findFirst: vi.fn(async () => null),
        deleteMany: vi.fn(async () => ({ count: 0 })),
      },
      roomLease: {
        deleteMany: vi.fn(async () => ({ count: 0 })),
        findMany: vi.fn(async ({ where }: any) => {
          return leases.filter((l) => {
            if (where?.studyRoomId && l.studyRoomId !== where.studyRoomId) return false;
            return true;
          });
        }),
        findFirst: vi.fn(async ({ where }: any) => {
          return leases.find((l) => {
            if (where?.userId && l.userId !== where.userId) return false;
            if (where?.studyRoomId && l.studyRoomId !== where.studyRoomId) return false;
            return true;
          }) ?? null;
        }),
        groupBy: vi.fn(async () => []),
        upsert: vi.fn(async ({ create }: any) => {
          const l = {
            id: `lease-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
            studyRoomId: create.studyRoomId,
            userId: create.userId,
            tabId: create.tabId || 'default-tab',
            generation: create.generation || 1,
            expiresAt: create.expiresAt || new Date(Date.now() + 60000),
          };
          leases.push(l);
          return l;
        }),
      },
      roomEnvironment: {
        create: vi.fn(async ({ data }: any) => {
          const env = { id: `env-${Date.now()}`, ...data };
          environments.push(env);
          return env;
        }),
        findUnique: vi.fn(async () => null),
      },
      roomAuditLog: {
        create: vi.fn(async ({ data }: any) => {
          const log = { id: `audit-${Date.now()}`, ...data };
          auditLogs.push(log);
          return log;
        }),
        findFirst: vi.fn(async () => null),
      },
      realtimeStream: {
        create: vi.fn(async ({ data }: any) => {
          const stream = { id: `stream-${Date.now()}`, ...data };
          realtimeStreams.push(stream);
          return stream;
        }),
        findUnique: vi.fn(async () => null),
      },
      conversation: {
        findUnique: vi.fn(async ({ where }: any) => {
          if (where.directKey) return conversations.find((c) => c.directKey === where.directKey) ?? null;
          if (where.id) return conversations.find((c) => c.id === where.id) ?? null;
          return null;
        }),
        create: vi.fn(async ({ data }: any) => {
          const conv = {
            id: `conv-${Date.now()}`,
            kind: data.kind,
            directKey: data.directKey,
            title: data.title || null,
            channelId: data.channelId || `chan-${Date.now()}`,
            creatorId: data.creatorId,
            accessGeneration: 1,
            createdAt: new Date(),
            updatedAt: new Date(),
          };
          conversations.push(conv);
          channels.push({ id: conv.channelId, type: 'DM' });
          return conv;
        }),
        findMany: vi.fn(async ({ where }: any) => {
          const userParticipantConvIds = conversationParticipants
            .filter((cp) => cp.userId === where.participants.some.userId)
            .map((cp) => cp.conversationId);
          return conversations
            .filter((c) => userParticipantConvIds.includes(c.id))
            .map((c) => {
              const parts = conversationParticipants
                .filter((cp) => cp.conversationId === c.id)
                .map((cp) => ({
                  ...cp,
                  user: users.find((u) => u.id === cp.userId),
                }));
              return {
                ...c,
                participants: parts,
                channel: {
                  messages: messages
                    .filter((m) => m.channelId === c.channelId)
                    .map((m) => ({
                      ...m,
                      author: users.find((u) => u.id === m.authorId),
                    })),
                },
              };
            });
        }),
      },
      conversationParticipant: {
        createMany: vi.fn(async ({ data }: any) => {
          for (const item of data) {
            conversationParticipants.push({
              id: `cp-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
              conversationId: item.conversationId,
              userId: item.userId,
              role: item.role,
              leftAt: null,
              joinedAt: new Date(),
            });
          }
          return { count: data.length };
        }),
        findMany: vi.fn(async ({ where }: any) => {
          if (where.userId) {
            return conversationParticipants
              .filter((cp) => cp.userId === where.userId && (where.leftAt === null ? cp.leftAt === null : true))
              .map((cp) => {
                const conv = conversations.find((c) => c.id === cp.conversationId);
                const chan = channels.find((ch) => ch.conversationId === conv?.id || ch.id === conv?.channelId);
                const convParts = conversationParticipants
                  .filter((p) => p.conversationId === cp.conversationId)
                  .map((p) => ({
                    ...p,
                    user: users.find((u) => u.id === p.userId),
                  }));
                const chanMsgs = messages
                  .filter((m) => m.channelId === chan?.id)
                  .map((m) => ({
                    ...m,
                    author: users.find((u) => u.id === m.authorId),
                  }));
                return {
                  ...cp,
                  conversation: {
                    ...conv,
                    channelId: chan?.id,
                    participants: convParts,
                    channel: chan ? { id: chan.id, messages: chanMsgs } : null,
                  },
                };
              });
          }
          return conversationParticipants.filter((cp) => cp.conversationId === where.conversationId);
        }),
        updateMany: vi.fn(async () => ({ count: 0 })),
      },
      channel: {
        create: vi.fn(async ({ data }: any) => {
          const chan = { id: `chan-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`, ...data };
          channels.push(chan);
          if (data.conversationId) {
            const conv = conversations.find((c) => c.id === data.conversationId);
            if (conv) conv.channelId = chan.id;
          }
          return chan;
        }),
        findUnique: vi.fn(async ({ where }: any) => {
          return channels.find((c) => c.id === where.id) ?? null;
        }),
      },
      message: {
        create: vi.fn(async ({ data }: any) => {
          const msg = {
            id: `msg-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
            channelId: data.channelId,
            authorId: data.authorId,
            content: data.content,
            createdAt: new Date(),
            updatedAt: new Date(),
            author: users.find((u) => u.id === data.authorId),
          };
          messages.push(msg);
          return msg;
        }),
        findMany: vi.fn(async ({ where }: any) => {
          return messages
            .filter((m) => m.channelId === where.channelId)
            .map((m) => ({
              ...m,
              author: users.find((u) => u.id === m.authorId),
            }));
        }),
      },
      cohort: {
        findUnique: vi.fn(async () => null),
      },
      cohortMember: {
        findUnique: vi.fn(async () => null),
      },
      roomOwnershipTransfer: {
        findFirst: vi.fn(async () => null),
      },
      $transaction: vi.fn(async (cb: any) => {
        if (typeof cb === 'function') {
          return cb((prisma as any));
        }
        return Promise.all(cb);
      }),
    },
  };
});

import { prisma } from '@/src/server/infrastructure/db/postgres/client';
import { usernameService, UsernameValidationError, UsernameConflictError } from '../../user/username.service';
import { conversationService } from '../conversation.service';
import { roomManagementService } from '../../studyroom/room-management.service';
import { studyRoomService } from '../../studyroom/studyroom.service';

describe('E2E Scenario: Username System, Cross-User Study Room, & Direct Messaging', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    users = [
      {
        id: 'u-alpha-1',
        name: 'Alpha User',
        email: 'alpha@example.com',
        username: null,
        image: 'https://avatar.vercel.sh/alpha',
      },
      {
        id: 'u-beta-2',
        name: 'Beta User',
        email: 'beta@example.com',
        username: null,
        image: 'https://avatar.vercel.sh/beta',
      },
    ];
    rooms = [];
    participants = [];
    leases = [];
    conversations = [];
    conversationParticipants = [];
    channels = [];
    messages = [];
    userBlocks = [];
    environments = [];
    auditLogs = [];
    realtimeStreams = [];
  });

  it('Step 1: Validates username rules and enforces conflict protection between User 1 & User 2', async () => {
    // 1a. User 1 tries invalid handles
    await expect(usernameService.claimUsername('u-alpha-1', 'a')).rejects.toThrow(UsernameValidationError);
    await expect(usernameService.claimUsername('u-alpha-1', 'has space')).rejects.toThrow(UsernameValidationError);
    await expect(usernameService.claimUsername('u-alpha-1', 'admin')).rejects.toThrow(UsernameValidationError);
    await expect(usernameService.claimUsername('u-alpha-1', 'alpha!')).rejects.toThrow(UsernameValidationError);

    // 1b. User 1 claims @user_alpha
    const claimResult1 = await usernameService.claimUsername('u-alpha-1', '@user_alpha');
    expect(claimResult1.username).toBe('user_alpha');

    // Update in-memory user
    const user1 = users.find((u) => u.id === 'u-alpha-1')!;
    user1.username = 'user_alpha';

    // 1c. User 2 attempts to claim 'user_alpha' (conflict)
    await expect(usernameService.claimUsername('u-beta-2', 'user_alpha')).rejects.toThrow(UsernameConflictError);

    // 1d. User 2 claims @user_beta
    const claimResult2 = await usernameService.claimUsername('u-beta-2', 'user_beta');
    expect(claimResult2.username).toBe('user_beta');

    const user2 = users.find((u) => u.id === 'u-beta-2')!;
    user2.username = 'user_beta';

    // 1e. Resolving users by username handles
    const resolvedAlpha = await usernameService.resolveByUsername('@user_alpha');
    expect(resolvedAlpha?.id).toBe('u-alpha-1');

    const resolvedBeta = await usernameService.resolveByUsername('user_beta');
    expect(resolvedBeta?.id).toBe('u-beta-2');
  });

  it('Step 2: User 1 creates a study room and User 2 joins with authentic username presence', async () => {
    users[0].username = 'user_alpha';
    users[1].username = 'user_beta';

    // 2a. User 1 creates study room
    const createRoomInput = {
      requestId: 'req-alpha-001',
      title: 'Alpha Deep Focus Room',
      description: 'Focusing on distributed systems',
      scopeKind: 'STANDALONE' as const,
      listing: 'PUBLIC' as const,
      capacity: 10,
      tags: ['engineering', 'systems'],
      language: 'en',
      publishImmediately: true,
    };

    const roomRes = await roomManagementService.createRoom(createRoomInput as any, 'u-alpha-1');
    expect(roomRes.id).toBeDefined();
    expect(roomRes.title).toBe('Alpha Deep Focus Room');
    expect(roomRes.slug).toBeDefined();

    const roomId = roomRes.id;

    // User 1 (Host) enters their created room
    const hostJoinRes = await studyRoomService.joinRoom({
      userId: 'u-alpha-1',
      roomId,
      tabId: 'tab-alpha-host',
      publicGoal: 'Hosting distributed systems study hall',
    });
    expect(hostJoinRes.success).toBe(true);

    // Verify room metadata in database has owner with username
    const dbRoom = (await prisma.studyRoom.findUnique({
      where: { id: roomId },
      include: { owner: true },
    })) as any;
    expect(dbRoom?.owner?.username).toBe('user_alpha');

    // 2b. User 2 joins the room created by User 1
    const joinRes = await studyRoomService.joinRoom({
      userId: 'u-beta-2',
      roomId,
      tabId: 'tab-beta-42',
      publicGoal: 'Solve 3 graph algorithms',
    });

    expect(joinRes.success).toBe(true);
    expect(joinRes.roomId).toBe(roomId);
    expect(joinRes.lease.leaseId).toBeDefined();

    // 2c. Verify both participants and usernames in room roster
    const roster = await studyRoomService.getRoomRoster(roomId);
    expect(roster.length).toBe(2);

    const participantUsernames = roster.map((p) => p.username);
    expect(participantUsernames).toContain('user_alpha');
    expect(participantUsernames).toContain('user_beta');

    const alphaParticipant = roster.find((p) => p.username === 'user_alpha')!;
    expect(alphaParticipant.role).toBe('OWNER');

    const betaParticipant = roster.find((p) => p.username === 'user_beta')!;
    expect(betaParticipant.name).toBe('Beta User');
    expect(betaParticipant.publicGoal).toBe('Solve 3 graph algorithms');
  });

  it('Step 3: User 1 finds User 2 by username and texts back-and-forth in direct messages', async () => {
    users[0].username = 'user_alpha';
    users[1].username = 'user_beta';

    // 3a. User 1 searches for User 2 using handle prefix '@user_beta'
    const searchResults = await conversationService.searchPeople('u-alpha-1', '@user_beta');
    expect(searchResults.length).toBeGreaterThan(0);
    expect(searchResults[0].username).toBe('user_beta');
    expect(searchResults[0].id).toBe('u-beta-2');

    // 3b. User 1 starts direct conversation with User 2
    const convResult = await conversationService.createDirectConversation('u-alpha-1', 'u-beta-2');
    expect(convResult.kind).toBe('DIRECT');
    expect(convResult.recipient.username).toBe('user_beta');
    expect(convResult.channelId).toBeDefined();

    const channelId = convResult.channelId;

    // 3c. User 1 sends message to User 2
    const msg1 = await prisma.message.create({
      data: {
        channelId,
        authorId: 'u-alpha-1',
        content: "Hey Beta! I see you joined the study room. Let's conquer graph algorithms today!",
      },
    });
    expect(msg1.content).toContain('Hey Beta!');

    // 3d. User 2 lists their conversations and sees User 1's DM
    const betaConversations = await conversationService.getUserConversations('u-beta-2');
    expect(betaConversations.length).toBe(1);
    expect(betaConversations[0].otherParticipant?.username).toBe('user_alpha');
    expect(betaConversations[0].lastMessage?.content).toBe(msg1.content);

    // 3e. User 2 replies to User 1 in the direct channel
    const msg2 = await prisma.message.create({
      data: {
        channelId,
        authorId: 'u-beta-2',
        content: 'Hey Alpha! Ready to focus. Starting 50-minute sprint now.',
      },
    });
    expect(msg2.content).toContain('Ready to focus');

    // 3f. User 1 reads the channel messages and sees the full conversation transcript
    const channelMessages = (await prisma.message.findMany({
      where: { channelId },
      include: { author: true },
    })) as any[];

    expect(channelMessages.length).toBe(2);
    expect(channelMessages[0].author?.username).toBe('user_alpha');
    expect(channelMessages[0].content).toBe(msg1.content);
    expect(channelMessages[1].author?.username).toBe('user_beta');
    expect(channelMessages[1].content).toBe(msg2.content);
  });
});
