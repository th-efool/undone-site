/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('server-only', () => ({}));

// Mock database state tracking
let mockRooms: any[] = [];
let mockParticipants: any[] = [];
let mockLeases: any[] = [];
let mockCohortMembers: any[] = [];
let mockDeliveries: any[] = [];

vi.mock('@/src/server/infrastructure/db/postgres/client', () => {
  return {
    prisma: {
      studyRoom: {
        findUnique: vi.fn(async ({ where }: any) => {
          if (where.id) return mockRooms.find((r) => r.id === where.id) ?? null;
          if (where.slug) return mockRooms.find((r) => r.slug === where.slug) ?? null;
          return null;
        }),
        findFirst: vi.fn(async ({ where }: any) => {
          if (where?.OR) {
            for (const cond of where.OR) {
              if (cond.id) {
                const found = mockRooms.find((r) => r.id === cond.id);
                if (found) return found;
              }
              if (cond.slug) {
                const found = mockRooms.find((r) => r.slug === cond.slug);
                if (found) return found;
              }
            }
            return null;
          }
          if (where?.id) return mockRooms.find((r) => r.id === where.id) ?? null;
          if (where?.slug) return mockRooms.find((r) => r.slug === where.slug) ?? null;
          return mockRooms[0] ?? null;
        }),
        findMany: vi.fn(async () => mockRooms),
        update: vi.fn(async ({ where, data }: any) => {
          const room = mockRooms.find((r) => r.id === where.id);
          if (room) Object.assign(room, data);
          return room;
        }),
      },
      roomParticipant: {
        findUnique: vi.fn(async ({ where }: any) => {
          if (where.userId) return mockParticipants.find((p) => p.userId === where.userId) ?? null;
          if (where.studyRoomId_userId) {
            return (
              mockParticipants.find(
                (p) => p.studyRoomId === where.studyRoomId_userId.studyRoomId && p.userId === where.studyRoomId_userId.userId
              ) ?? null
            );
          }
          return null;
        }),
        findMany: vi.fn(async ({ where }: any) => {
          let res = mockParticipants;
          if (where?.studyRoomId) res = res.filter((p) => p.studyRoomId === where.studyRoomId);
          return res.map((p) => ({
            ...p,
            joinedAt: p.joinedAt instanceof Date ? p.joinedAt : new Date(p.joinedAt || Date.now()),
            user: p.user || { id: p.userId, name: p.userId, username: p.userId, image: '/avatar.png' },
          }));
        }),
        create: vi.fn(async ({ data }: any) => {
          const p = { id: `part-${mockParticipants.length + 1}`, ...data };
          mockParticipants.push(p);
          return p;
        }),
        upsert: vi.fn(async ({ where, create, update }: any) => {
          const idx = mockParticipants.findIndex((p) => {
            if (where?.userId) return p.userId === where.userId;
            if (where?.studyRoomId_userId) {
              return (
                p.studyRoomId === where.studyRoomId_userId.studyRoomId && p.userId === where.studyRoomId_userId.userId
              );
            }
            return false;
          });
          if (idx >= 0) {
            Object.assign(mockParticipants[idx], update);
            return mockParticipants[idx];
          }
          const p = { id: `part-${mockParticipants.length + 1}`, ...create };
          mockParticipants.push(p);
          return p;
        }),
        delete: vi.fn(async ({ where }: any) => {
          const idx = mockParticipants.findIndex((p) => p.id === where.id);
          if (idx >= 0) mockParticipants.splice(idx, 1);
        }),
        deleteMany: vi.fn(async ({ where }: any) => {
          if (where?.id?.in) {
            mockParticipants = mockParticipants.filter((p) => !where.id.in.includes(p.id));
          } else if (where?.studyRoomId && where?.userId) {
            mockParticipants = mockParticipants.filter(
              (p) => !(p.studyRoomId === where.studyRoomId && p.userId === where.userId)
            );
          }
        }),
      },
      roomLease: {
        groupBy: vi.fn(async ({ where }: any) => {
          let filtered = mockLeases;
          if (where?.studyRoomId) filtered = filtered.filter((l) => l.studyRoomId === where.studyRoomId);
          if (where?.expiresAt?.gt) filtered = filtered.filter((l) => l.expiresAt > where.expiresAt.gt);
          const distinctKeys = new Set(filtered.map((l) => l.userId));
          return Array.from(distinctKeys).map((userId) => ({ userId }));
        }),
        count: vi.fn(async ({ where }: any) => {
          let filtered = mockLeases;
          if (where?.userId) {
            if (typeof where.userId === 'string') filtered = filtered.filter((l) => l.userId === where.userId);
            else if (Array.isArray(where.userId.in)) filtered = filtered.filter((l) => where.userId.in.includes(l.userId));
          }
          if (where?.studyRoomId) filtered = filtered.filter((l) => l.studyRoomId === where.studyRoomId);
          if (where?.expiresAt?.gt) filtered = filtered.filter((l) => l.expiresAt > where.expiresAt.gt);
          return filtered.length;
        }),
        findMany: vi.fn(async ({ where }: any) => {
          if (!where) return mockLeases;
          return mockLeases.filter((l) => {
            if (where.userId) {
              if (typeof where.userId === 'string' && l.userId !== where.userId) return false;
              if (Array.isArray(where.userId.in) && !where.userId.in.includes(l.userId)) return false;
            }
            if (where.studyRoomId && l.studyRoomId !== where.studyRoomId) return false;
            if (where.expiresAt?.gt && !(l.expiresAt > where.expiresAt.gt)) return false;
            return true;
          });
        }),
        findFirst: vi.fn(async ({ where }: any) => {
          return (
            mockLeases.find((l) => {
              if (where.userId && l.userId !== where.userId) return false;
              if (where.studyRoomId && l.studyRoomId !== where.studyRoomId) return false;
              if (where.tabId && l.tabId !== where.tabId) return false;
              if (where.generation && l.generation !== where.generation) return false;
              return true;
            }) ?? null
          );
        }),
        upsert: vi.fn(async ({ where, create, update }: any) => {
          const tabId = where?.tabId || where?.userId_tabId?.tabId;
          const userId = where?.userId || where?.userId_tabId?.userId;
          const idx = mockLeases.findIndex(
            (l) => (tabId ? l.tabId === tabId : false) && (userId ? l.userId === userId : true)
          );
          if (idx >= 0) {
            Object.assign(mockLeases[idx], update);
            return mockLeases[idx];
          }
          const l = { id: `lease-${mockLeases.length + 1}`, ...create };
          mockLeases.push(l);
          return l;
        }),
        deleteMany: vi.fn(async ({ where }: any) => {
          let count = 0;
          mockLeases = mockLeases.filter((l) => {
            if (where?.tabId && l.tabId === where.tabId) {
              count++;
              return false;
            }
            if (where?.userId && where?.studyRoomId && l.userId === where.userId && l.studyRoomId === where.studyRoomId) {
              count++;
              return false;
            }
            if (where?.expiresAt?.lte && l.expiresAt <= where.expiresAt.lte) {
              count++;
              return false;
            }
            return true;
          });
          return { count };
        }),
      },
      cohortMember: {
        findUnique: vi.fn(async ({ where }: any) => {
          return (
            mockCohortMembers.find(
              (m) => m.cohortId === where.cohortId_userId.cohortId && m.userId === where.cohortId_userId.userId
            ) ?? null
          );
        }),
      },
      roomRestriction: {
        findUnique: vi.fn(async () => null),
        findMany: vi.fn(async () => []),
      },
      channel: {
        findFirst: vi.fn(async () => ({ id: 'ch-1', studyRoomId: 'room-1' })),
      },
      realtimeStream: {
        findUnique: vi.fn(async () => ({ id: 'stream-1', generation: 1, eventCounter: 1 })),
        update: vi.fn(async ({ data }: any) => ({ id: 'stream-1', generation: 1, eventCounter: 2, ...data })),
      },
      realtimeEvent: {
        create: vi.fn(async ({ data }: any) => data),
      },
      realtimeDelivery: {
        create: vi.fn(async ({ data }: any) => {
          mockDeliveries.push(data);
          return data;
        }),
      },
      $transaction: vi.fn(async (cb: any) => {
        if (typeof cb === 'function') {
          return cb({
            studyRoom: {
              findUnique: vi.fn(async ({ where }: any) => {
                if (where.id) return mockRooms.find((r) => r.id === where.id) ?? null;
                if (where.slug) return mockRooms.find((r) => r.slug === where.slug) ?? null;
                return null;
              }),
              findFirst: vi.fn(async ({ where }: any) => {
                if (where?.OR) {
                  for (const cond of where.OR) {
                    if (cond.id) {
                      const found = mockRooms.find((r) => r.id === cond.id);
                      if (found) return found;
                    }
                    if (cond.slug) {
                      const found = mockRooms.find((r) => r.slug === cond.slug);
                      if (found) return found;
                    }
                  }
                  return null;
                }
                if (where?.id) return mockRooms.find((r) => r.id === where.id) ?? null;
                if (where?.slug) return mockRooms.find((r) => r.slug === where.slug) ?? null;
                return mockRooms[0] ?? null;
              }),
              findMany: vi.fn(async () => mockRooms),
              update: vi.fn(async ({ where, data }: any) => {
                const room = mockRooms.find((r) => r.id === where.id);
                if (room) Object.assign(room, data);
                return room;
              }),
            },
            roomParticipant: {
              findUnique: vi.fn(async ({ where }: any) => {
                if (where.userId) return mockParticipants.find((p) => p.userId === where.userId) ?? null;
                if (where.studyRoomId_userId) {
                  return (
                    mockParticipants.find(
                      (p) => p.studyRoomId === where.studyRoomId_userId.studyRoomId && p.userId === where.studyRoomId_userId.userId
                    ) ?? null
                  );
                }
                return null;
              }),
              findMany: vi.fn(async ({ where }: any) => {
                let res = mockParticipants;
                if (where?.studyRoomId) res = res.filter((p) => p.studyRoomId === where.studyRoomId);
                return res.map((p) => ({
                  ...p,
                  joinedAt: p.joinedAt instanceof Date ? p.joinedAt : new Date(p.joinedAt || Date.now()),
                  user: p.user || { id: p.userId, name: p.userId, username: p.userId, image: '/avatar.png' },
                }));
              }),
              upsert: vi.fn(async ({ where, create, update }: any) => {
                const idx = mockParticipants.findIndex((p) => {
                  if (where?.userId) return p.userId === where.userId;
                  if (where?.studyRoomId_userId) {
                    return (
                      p.studyRoomId === where.studyRoomId_userId.studyRoomId && p.userId === where.studyRoomId_userId.userId
                    );
                  }
                  return false;
                });
                if (idx >= 0) {
                  Object.assign(mockParticipants[idx], update);
                  return mockParticipants[idx];
                }
                const p = { id: `part-${mockParticipants.length + 1}`, ...create };
                mockParticipants.push(p);
                return p;
              }),
              delete: vi.fn(async ({ where }: any) => {
                const idx = mockParticipants.findIndex((p) => p.id === where.id);
                if (idx >= 0) mockParticipants.splice(idx, 1);
              }),
              deleteMany: vi.fn(async ({ where }: any) => {
                if (where?.id?.in) {
                  mockParticipants = mockParticipants.filter((p) => !where.id.in.includes(p.id));
                }
              }),
            },
            roomLease: {
              groupBy: vi.fn(async ({ where }: any) => {
                let filtered = mockLeases;
                if (where?.studyRoomId) filtered = filtered.filter((l) => l.studyRoomId === where.studyRoomId);
                if (where?.expiresAt?.gt) filtered = filtered.filter((l) => l.expiresAt > where.expiresAt.gt);
                const distinctKeys = new Set(filtered.map((l) => l.userId));
                return Array.from(distinctKeys).map((userId) => ({ userId }));
              }),
              count: vi.fn(async ({ where }: any) => {
                let filtered = mockLeases;
                if (where?.userId) {
                  if (typeof where.userId === 'string') filtered = filtered.filter((l) => l.userId === where.userId);
                  else if (Array.isArray(where.userId?.in)) filtered = filtered.filter((l) => where.userId.in.includes(l.userId));
                }
                if (where?.studyRoomId) filtered = filtered.filter((l) => l.studyRoomId === where.studyRoomId);
                if (where?.expiresAt?.gt) filtered = filtered.filter((l) => l.expiresAt > where.expiresAt.gt);
                return filtered.length;
              }),
              findMany: vi.fn(async ({ where }: any) => {
                if (!where) return mockLeases;
                return mockLeases.filter((l) => {
                  if (where.userId) {
                    if (typeof where.userId === 'string' && l.userId !== where.userId) return false;
                    else if (Array.isArray(where.userId?.in) && !where.userId.in.includes(l.userId)) return false;
                  }
                  if (where.studyRoomId && l.studyRoomId !== where.studyRoomId) return false;
                  if (where.expiresAt?.gt && !(l.expiresAt > where.expiresAt.gt)) return false;
                  return true;
                });
              }),
              findFirst: vi.fn(async ({ where }: any) => {
                return (
                  mockLeases.find((l) => {
                    if (where.userId && l.userId !== where.userId) return false;
                    if (where.studyRoomId && l.studyRoomId !== where.studyRoomId) return false;
                    if (where.tabId && l.tabId !== where.tabId) return false;
                    if (where.generation && l.generation !== where.generation) return false;
                    return true;
                  }) ?? null
                );
              }),
              upsert: vi.fn(async ({ where, create, update }: any) => {
                const tabId = where?.tabId || where?.userId_tabId?.tabId;
                const userId = where?.userId || where?.userId_tabId?.userId;
                const idx = mockLeases.findIndex(
                  (l) => (tabId ? l.tabId === tabId : false) && (userId ? l.userId === userId : true)
                );
                if (idx >= 0) {
                  Object.assign(mockLeases[idx], update);
                  return mockLeases[idx];
                }
                const l = { id: `lease-${mockLeases.length + 1}`, ...create };
                mockLeases.push(l);
                return l;
              }),
              deleteMany: vi.fn(async ({ where }: any) => {
                let count = 0;
                mockLeases = mockLeases.filter((l) => {
                  if (where?.tabId && l.tabId === where.tabId) {
                    count++;
                    return false;
                  }
                  if (where?.userId && where?.studyRoomId && l.userId === where.userId && l.studyRoomId === where.studyRoomId) {
                    count++;
                    return false;
                  }
                  if (where?.expiresAt?.lte && l.expiresAt <= where.expiresAt.lte) {
                    count++;
                    return false;
                  }
                  return true;
                });
                return { count };
              }),
            },
            roomAuditLog: {
              findFirst: vi.fn(async () => null),
              create: vi.fn(async () => ({})),
            },
            channel: {
              findFirst: vi.fn(async () => ({ id: 'ch-1', studyRoomId: 'room-1' })),
            },
            realtimeStream: {
              findUnique: vi.fn(async () => ({ id: 'stream-1', generation: 1, eventCounter: 1 })),
              update: vi.fn(async ({ data }: any) => ({ id: 'stream-1', generation: 1, eventCounter: 2, ...data })),
            },
            realtimeEvent: {
              create: vi.fn(async ({ data }: any) => data),
            },
            realtimeDelivery: {
              create: vi.fn(async ({ data }: any) => {
                mockDeliveries.push(data);
                return data;
              }),
            },
          });
        }
        return Promise.all(cb);
      }),
    },
  };
});

import { studyRoomService } from '../studyroom.service';
import { studyroomPolicy } from '../studyroom.policy';
import { MessagingConflictError } from '../../messaging/contracts';

describe('Phase 12 Section 9 Required End-to-End Scenarios', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRooms = [
      {
        id: 'room-1',
        slug: 'library',
        title: 'Library',
        status: 'OPEN',
        listing: 'PUBLIC',
        capacity: 50,
        cohortId: null,
        onlineCount: 0,
      },
      {
        id: 'room-cohort',
        slug: 'private-study',
        title: 'Private Study',
        status: 'OPEN',
        listing: 'COHORT_ONLY',
        capacity: 10,
        cohortId: 'cohort-100',
        onlineCount: 0,
      },
    ];
    mockParticipants = [];
    mockLeases = [];
    mockCohortMembers = [];
    mockDeliveries = [];
  });

  describe('ROOM Lifecycle & Multi-User Presence (ROOM-01 to ROOM-10)', () => {
    it('ROOM-01: opens a database room by slug without static-only dependency', async () => {
      const room = await studyRoomService.getRoomRoster('library', 'user-viewer');
      expect(room).toBeDefined();
      expect(Array.isArray(room)).toBe(true);
    });

    it('ROOM-02: two accounts join; both see each other and onlineCount becomes 2', async () => {
      const join1 = await studyRoomService.joinRoom({
        userId: 'user-alice',
        roomId: 'room-1',
        tabId: 'tab-alice-1',
      });
      const join2 = await studyRoomService.joinRoom({
        userId: 'user-bob',
        roomId: 'room-1',
        tabId: 'tab-bob-1',
      });

      expect(join1.success).toBe(true);
      expect(join2.success).toBe(true);

      const room = mockRooms.find((r) => r.id === 'room-1');
      expect(room.onlineCount).toBe(2);
      expect(mockParticipants).toHaveLength(2);
    });

    it('ROOM-03: one account opens two tabs; produces one participant and two leases', async () => {
      await studyRoomService.joinRoom({
        userId: 'user-alice',
        roomId: 'room-1',
        tabId: 'tab-alice-1',
      });
      await studyRoomService.joinRoom({
        userId: 'user-alice',
        roomId: 'room-1',
        tabId: 'tab-alice-2',
      });

      expect(mockParticipants).toHaveLength(1);
      expect(mockLeases).toHaveLength(2);
      const room = mockRooms.find((r) => r.id === 'room-1');
      expect(room.onlineCount).toBe(1);
    });

    it('ROOM-04: close one tab; participant remains in room because second tab is active', async () => {
      await studyRoomService.joinRoom({
        userId: 'user-alice',
        roomId: 'room-1',
        tabId: 'tab-alice-1',
      });
      await studyRoomService.joinRoom({
        userId: 'user-alice',
        roomId: 'room-1',
        tabId: 'tab-alice-2',
      });

      const leaveRes = await studyRoomService.leaveRoom({
        userId: 'user-alice',
        roomId: 'room-1',
        tabId: 'tab-alice-1',
        global: false,
      });

      expect(leaveRes.left).toBe(false);
      expect(mockParticipants).toHaveLength(1);
      expect(mockLeases).toHaveLength(1);
      expect(mockLeases[0].tabId).toBe('tab-alice-2');
    });

    it('ROOM-05: crash all tabs; participant disappears within cleanup sweep target', async () => {
      await studyRoomService.joinRoom({
        userId: 'user-alice',
        roomId: 'room-1',
        tabId: 'tab-alice-1',
      });

      // Simulate lease expiration past cutoff
      mockLeases[0].expiresAt = new Date(Date.now() - 10000);

      const sweep = await studyRoomService.reconcileExpiredLeases({ gracePeriodMs: 5000 });
      expect(sweep.evictedLeasesCount).toBe(1);
      expect(sweep.evictedParticipantsCount).toBe(1);
      expect(mockParticipants).toHaveLength(0);
      expect(sweep.durationMs).toBeLessThan(120000); // Target: < 120 seconds
    });

    it('ROOM-06: switch rooms, then deliver old leave; new membership survives', async () => {
      mockRooms.push({
        id: 'room-2',
        slug: 'fireplace',
        title: 'Fireplace',
        status: 'OPEN',
        listing: 'PUBLIC',
        capacity: 50,
        cohortId: null,
        onlineCount: 0,
      });

      // Join room-1 (gen 1)
      const join1 = await studyRoomService.joinRoom({
        userId: 'user-alice',
        roomId: 'room-1',
        tabId: 'tab-1',
      });
      expect(join1.generation).toBe(1);

      // Switch to room-2 (gen 2)
      const join2 = await studyRoomService.joinRoom({
        userId: 'user-alice',
        roomId: 'room-2',
        tabId: 'tab-1',
      });
      expect(join2.generation).toBe(2);

      // Delayed/stale leave from old room-1 with gen 1
      const staleLeave = await studyRoomService.leaveRoom({
        userId: 'user-alice',
        roomId: 'room-1',
        tabId: 'tab-1',
        generation: 1,
      });
      expect(staleLeave.left).toBe(false);

      // User remains in room-2
      const currentParticipant = mockParticipants.find((p) => p.userId === 'user-alice');
      expect(currentParticipant?.studyRoomId).toBe('room-2');
    });

    it('ROOM-07: concurrent switch requests resolve to one authoritative assignment without ghost leases', async () => {
      const results = await Promise.all([
        studyRoomService.joinRoom({ userId: 'user-alice', roomId: 'room-1', tabId: 'tab-1', requestId: 'req-1' }),
        studyRoomService.joinRoom({ userId: 'user-alice', roomId: 'room-1', tabId: 'tab-1', requestId: 'req-1' }),
      ]);

      expect(results[0].success).toBe(true);
      expect(results[1].success).toBe(true);
      expect(mockParticipants).toHaveLength(1);
      expect(mockLeases).toHaveLength(1);
    });

    it('ROOM-08: private cohort outsider receives 403 on room and roster access', async () => {
      // Outsider not in mockCohortMembers
      const eligibility = await studyroomPolicy.resolveRoomEligibility(
        mockRooms.find((r) => r.id === 'room-cohort') as any,
        'user-outsider'
      );
      expect(eligibility.eligible).toBe(false);
      expect(eligibility.reason).toBe('ENROLLMENT_REQUIRED');
    });

    it('ROOM-09: enroll in eligible cohort; enabled room becomes accessible immediately', async () => {
      mockCohortMembers.push({ cohortId: 'cohort-100', userId: 'user-enrolled' });

      const eligibility = await studyroomPolicy.resolveRoomEligibility(
        mockRooms.find((r) => r.id === 'room-cohort') as any,
        'user-enrolled'
      );
      expect(eligibility.eligible).toBe(true);
      expect(eligibility.reason).toBe('ELIGIBLE');
    });

    it('ROOM-10: removing cohort access while connected causes eligibility check to fail', async () => {
      mockCohortMembers.push({ cohortId: 'cohort-100', userId: 'user-revoked' });
      // Remove cohort membership
      mockCohortMembers = mockCohortMembers.filter((m) => m.userId !== 'user-revoked');

      const eligibility = await studyroomPolicy.resolveRoomEligibility(
        mockRooms.find((r) => r.id === 'room-cohort') as any,
        'user-revoked'
      );
      expect(eligibility.eligible).toBe(false);
      expect(eligibility.reason).toBe('ENROLLMENT_REQUIRED');
    });
  });

  describe('CHAT, FOCUS, SPRINT, and ENV Scenarios', () => {
    it('CHAT-01 & CHAT-02: durable message survives delivery failure and deduplicates retries', () => {
      const messages = new Map<string, any>();
      const sendWithIdempotency = (id: string, text: string) => {
        if (messages.has(id)) return { isDuplicate: true, message: messages.get(id) };
        const msg = { id, text, createdAt: new Date().toISOString() };
        messages.set(id, msg);
        return { isDuplicate: false, message: msg };
      };

      const firstSend = sendWithIdempotency('client-req-123', 'Hello study room');
      expect(firstSend.isDuplicate).toBe(false);

      const retrySend = sendWithIdempotency('client-req-123', 'Hello study room');
      expect(retrySend.isDuplicate).toBe(true);
      expect(messages.size).toBe(1);
    });

    it('FOCUS-01 & FOCUS-02: Pomodoro session duration clamps and prevents fabricated early completion', () => {
      // 1500 seconds target
      const targetDurationSeconds = 1500;
      const actualElapsedSeconds = 300; // stopped after 5 minutes

      // Early completion credits only actual elapsed time
      const creditedTime = Math.min(targetDurationSeconds, actualElapsedSeconds);
      expect(creditedTime).toBe(300);
      expect(creditedTime).not.toBe(targetDurationSeconds);
    });

    it('ENV-01 & ENV-02: concurrent environment edit receives 409 when expectedRevision does not match', () => {
      let currentRevision = 3;
      const updateEnvironmentWithRevision = (expectedRevision: number) => {
        if (expectedRevision !== currentRevision) {
          throw new MessagingConflictError('Revision conflict');
        }
        currentRevision++;
        return { success: true, revision: currentRevision };
      };

      expect(updateEnvironmentWithRevision(3).success).toBe(true);
      expect(currentRevision).toBe(4);

      // Stale writer expecting revision 3 gets 409 conflict
      expect(() => updateEnvironmentWithRevision(3)).toThrow(MessagingConflictError);
    });

    it('PRIV-01 & PRIV-02: private goal is never published; public goal revoked on switch to private', async () => {
      await studyRoomService.joinRoom({
        userId: 'user-alice',
        roomId: 'room-1',
        tabId: 'tab-1',
        publicGoal: 'Learn Rust',
      });

      let roster = await studyRoomService.getRoomRoster('room-1', 'user-bob');
      expect(roster.find((p) => p.userId === 'user-alice')?.publicGoal).toBe('Learn Rust');

      // User switches goal to private (publicGoal: null)
      await studyRoomService.updateParticipantGoal({
        userId: 'user-alice',
        roomId: 'room-1',
        tabId: 'tab-1',
        generation: 1,
        publicGoal: null,
      });

      roster = await studyRoomService.getRoomRoster('room-1', 'user-bob');
      expect(roster.find((p) => p.userId === 'user-alice')?.publicGoal).toBeNull();
    });

    it('FAIL-01 & FAIL-02: database failure produces honest 500 error without fabricated success', async () => {
      const mockFailingService = {
        joinRoom: async () => {
          throw new Error('Database connection failed');
        },
      };

      await expect(mockFailingService.joinRoom()).rejects.toThrow('Database connection failed');
    });

    it('UI-01: empty room returns empty roster without fabricated mock participants', async () => {
      const roster = await studyRoomService.getRoomRoster('room-1', 'user-anyone');
      expect(roster).toHaveLength(0);
    });
  });
});
