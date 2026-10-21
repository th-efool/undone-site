import { describe, expect, it, vi, beforeEach } from 'vitest';
import { studyRoomService } from '../studyroom.service';
import { prisma } from '@/src/server/infrastructure/db/postgres/client';

vi.mock('server-only', () => ({}));

vi.mock('@/src/server/infrastructure/db/postgres/client', () => {
  const mockStudyRoom = {
    count: vi.fn(),
    findMany: vi.fn(),
    findUnique: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  };

  const mockChannel = {
    create: vi.fn(),
  };

  const mockRealtimeStream = {
    create: vi.fn(),
  };

  const mockRoomParticipant = {
    findMany: vi.fn(),
    findUnique: vi.fn(),
    create: vi.fn(),
    upsert: vi.fn(),
    delete: vi.fn(),
    deleteMany: vi.fn(),
  };

  const mockRoomLease = {
    findMany: vi.fn(),
    upsert: vi.fn(),
    deleteMany: vi.fn(),
    count: vi.fn(),
    groupBy: vi.fn(),
  };

  const mockTransaction = vi.fn(async (callback) => {
    if (typeof callback === 'function') {
      return callback({
        studyRoom: mockStudyRoom,
        channel: mockChannel,
        realtimeStream: mockRealtimeStream,
        roomParticipant: mockRoomParticipant,
        roomLease: mockRoomLease,
      });
    }
    return Promise.all(callback);
  });

  return {
    prisma: {
      studyRoom: mockStudyRoom,
      channel: mockChannel,
      realtimeStream: mockRealtimeStream,
      roomParticipant: mockRoomParticipant,
      roomLease: mockRoomLease,
      $transaction: mockTransaction,
    },
  };
});

describe('Phase 8: Study Room Membership & Lease Domain Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('seedRoomsIfEmpty', () => {
    it('creates default rooms and channels when room count is 0', async () => {
      vi.mocked(prisma.studyRoom.count).mockResolvedValueOnce(0);
      vi.mocked(prisma.studyRoom.create).mockResolvedValue({ id: 'room-new' } as any);

      await studyRoomService.seedRoomsIfEmpty();

      expect(prisma.studyRoom.count).toHaveBeenCalledTimes(1);
      expect(prisma.studyRoom.create).toHaveBeenCalledTimes(3); // Fireplace, Library, Dev Den
      expect(prisma.channel.create).toHaveBeenCalledTimes(3);
      expect(prisma.realtimeStream.create).toHaveBeenCalledTimes(3);
    });

    it('does not write or seed when rooms already exist', async () => {
      vi.mocked(prisma.studyRoom.count).mockResolvedValueOnce(3);

      await studyRoomService.seedRoomsIfEmpty();

      expect(prisma.studyRoom.count).toHaveBeenCalledTimes(1);
      expect(prisma.studyRoom.create).not.toHaveBeenCalled();
    });
  });

  describe('getRoomCatalog', () => {
    it('is strictly read-only and computes authoritative SHA-256 ETag', async () => {
      vi.mocked(prisma.studyRoom.findMany).mockResolvedValueOnce([
        { id: 'room-1', title: 'Fireplace', thumbnail: '/fp.jpg', status: 'ACTIVE', onlineCount: 2 },
        { id: 'room-2', title: 'Library', thumbnail: '/lib.jpg', status: 'ACTIVE', onlineCount: 0 },
      ] as any);

      const catalog = await studyRoomService.getRoomCatalog();

      expect(prisma.studyRoom.findMany).toHaveBeenCalledTimes(1);
      expect(prisma.studyRoom.create).not.toHaveBeenCalled();
      expect(catalog.rooms).toHaveLength(2);
      expect(catalog.etag).toMatch(/^"[a-f0-9]{64}"$/);
      expect(catalog.notModified).toBe(false);
    });

    it('returns notModified true when If-None-Match matches SHA-256 ETag', async () => {
      vi.mocked(prisma.studyRoom.findMany).mockResolvedValueOnce([
        { id: 'room-1', title: 'Fireplace', thumbnail: '/fp.jpg', status: 'ACTIVE', onlineCount: 1 },
      ] as any);

      const firstCall = await studyRoomService.getRoomCatalog();
      const etag = firstCall.etag;

      vi.mocked(prisma.studyRoom.findMany).mockResolvedValueOnce([
        { id: 'room-1', title: 'Fireplace', thumbnail: '/fp.jpg', status: 'ACTIVE', onlineCount: 1 },
      ] as any);

      const secondCall = await studyRoomService.getRoomCatalog(etag);
      expect(secondCall.notModified).toBe(true);
    });
  });

  describe('joinRoom & Room Switching', () => {
    it('joins a new room with generation 1 and creates tab lease', async () => {
      vi.mocked(prisma.studyRoom.findUnique).mockResolvedValueOnce({
        id: 'room-1',
        title: 'Fireplace',
      } as any);

      // User not in any room currently
      vi.mocked(prisma.roomParticipant.findUnique).mockResolvedValueOnce(null);

      const expiresAt = new Date(Date.now() + 90000);
      vi.mocked(prisma.roomParticipant.upsert).mockResolvedValueOnce({
        userId: 'user-1',
        studyRoomId: 'room-1',
        generation: 1,
      } as any);

      vi.mocked(prisma.roomLease.upsert).mockResolvedValueOnce({
        id: 'lease-1',
        userId: 'user-1',
        studyRoomId: 'room-1',
        tabId: 'tab-alpha',
        generation: 1,
        expiresAt,
      } as any);

      vi.mocked(prisma.roomLease.groupBy).mockResolvedValueOnce([{ userId: 'user-1' }] as any);

      const result = await studyRoomService.joinRoom({
        userId: 'user-1',
        roomId: 'room-1',
        tabId: 'tab-alpha',
      });

      expect(result.success).toBe(true);
      expect(result.roomId).toBe('room-1');
      expect(result.generation).toBe(1);
      expect(result.isSwitch).toBe(false);
      expect(prisma.studyRoom.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'room-1' },
          data: { onlineCount: 1 },
        })
      );
    });

    it('same user in two tabs in same room shares participant and counts as 1 distinct user', async () => {
      vi.mocked(prisma.studyRoom.findUnique).mockResolvedValueOnce({
        id: 'room-1',
      } as any);

      // User already in room-1 with generation 1
      vi.mocked(prisma.roomParticipant.findUnique).mockResolvedValueOnce({
        userId: 'user-1',
        studyRoomId: 'room-1',
        generation: 1,
      } as any);

      const expiresAt = new Date(Date.now() + 90000);
      vi.mocked(prisma.roomLease.upsert).mockResolvedValueOnce({
        id: 'lease-2',
        userId: 'user-1',
        studyRoomId: 'room-1',
        tabId: 'tab-beta',
        generation: 1,
        expiresAt,
      } as any);

      // groupBy distinct user returns 1 distinct user
      vi.mocked(prisma.roomLease.groupBy).mockResolvedValueOnce([{ userId: 'user-1' }] as any);

      const result = await studyRoomService.joinRoom({
        userId: 'user-1',
        roomId: 'room-1',
        tabId: 'tab-beta',
      });

      expect(result.success).toBe(true);
      expect(result.generation).toBe(1); // Same generation
      expect(result.isSwitch).toBe(false);
      // Online count set to 1 distinct user
      expect(prisma.studyRoom.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { onlineCount: 1 },
        })
      );
    });

    it('switching rooms evicts old room, increments generation, and updates both online counts', async () => {
      vi.mocked(prisma.studyRoom.findUnique).mockResolvedValueOnce({
        id: 'room-new',
      } as any);

      // User currently in room-old with generation 1
      vi.mocked(prisma.roomParticipant.findUnique).mockResolvedValueOnce({
        userId: 'user-1',
        studyRoomId: 'room-old',
        generation: 1,
      } as any);

      // Old room has 0 remaining users
      vi.mocked(prisma.roomLease.groupBy)
        .mockResolvedValueOnce([]) // old room after leave
        .mockResolvedValueOnce([{ userId: 'user-1' } as any]); // new room after join

      const expiresAt = new Date(Date.now() + 90000);
      vi.mocked(prisma.roomLease.upsert).mockResolvedValueOnce({
        id: 'lease-new',
        userId: 'user-1',
        studyRoomId: 'room-new',
        tabId: 'tab-alpha',
        generation: 2,
        expiresAt,
      } as any);

      const result = await studyRoomService.joinRoom({
        userId: 'user-1',
        roomId: 'room-new',
        tabId: 'tab-alpha',
      });

      expect(result.success).toBe(true);
      expect(result.isSwitch).toBe(true);
      expect(result.generation).toBe(2); // Incremented generation!
      // Old room leases deleted
      expect(prisma.roomLease.deleteMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId: 'user-1', studyRoomId: 'room-old' },
        })
      );
      // Both rooms' onlineCounts updated
      expect(prisma.studyRoom.update).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'room-old' }, data: { onlineCount: 0 } })
      );
      expect(prisma.studyRoom.update).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'room-new' }, data: { onlineCount: 1 } })
      );
    });
  });

  describe('renewLease & Stale Generation Rejection', () => {
    it('renews lease when generation matches', async () => {
      vi.mocked(prisma.roomParticipant.findUnique).mockResolvedValueOnce({
        userId: 'user-1',
        studyRoomId: 'room-1',
        generation: 3,
      } as any);

      const newExpiry = new Date(Date.now() + 90000);
      vi.mocked(prisma.roomLease.upsert).mockResolvedValueOnce({
        expiresAt: newExpiry,
      } as any);

      const result = await studyRoomService.renewLease({
        userId: 'user-1',
        roomId: 'room-1',
        tabId: 'tab-alpha',
        generation: 3,
      });

      expect(result.success).toBe(true);
      expect(result.expiresAt).toBe(newExpiry.toISOString());
    });

    it('rejects stale generation without modifying room membership', async () => {
      // Participant is now in generation 4 (e.g. switched rooms)
      vi.mocked(prisma.roomParticipant.findUnique).mockResolvedValueOnce({
        userId: 'user-1',
        studyRoomId: 'room-1',
        generation: 4,
      } as any);

      // Delayed heartbeat from an old tab with generation 2
      const result = await studyRoomService.renewLease({
        userId: 'user-1',
        roomId: 'room-1',
        tabId: 'tab-old',
        generation: 2,
      });

      expect(result.success).toBe(false);
      expect(result.reason).toBe('stale_generation');
      expect(prisma.roomLease.upsert).not.toHaveBeenCalled();
    });
  });

  describe('leaveRoom', () => {
    it('global leave removes all user leases and participant row', async () => {
      vi.mocked(prisma.roomParticipant.findUnique).mockResolvedValueOnce({
        userId: 'user-1',
        studyRoomId: 'room-1',
      } as any);

      vi.mocked(prisma.roomLease.groupBy).mockResolvedValueOnce([]); // 0 remaining users

      const result = await studyRoomService.leaveRoom({
        userId: 'user-1',
        roomId: 'room-1',
        global: true,
      });

      expect(result.success).toBe(true);
      expect(result.left).toBe(true);
      expect(prisma.roomLease.deleteMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId: 'user-1', studyRoomId: 'room-1' },
        })
      );
      expect(prisma.roomParticipant.delete).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId: 'user-1' },
        })
      );
    });

    it('closing one tab does not evict user when other tabs remain', async () => {
      vi.mocked(prisma.roomParticipant.findUnique).mockResolvedValueOnce({
        userId: 'user-1',
        studyRoomId: 'room-1',
      } as any);

      // 1 other active lease remains
      vi.mocked(prisma.roomLease.count).mockResolvedValueOnce(1);
      vi.mocked(prisma.roomLease.groupBy).mockResolvedValueOnce([{ userId: 'user-1' } as any]);

      const result = await studyRoomService.leaveRoom({
        userId: 'user-1',
        roomId: 'room-1',
        tabId: 'tab-closed',
        global: false,
      });

      expect(result.success).toBe(true);
      expect(result.left).toBe(false); // User still in room
      expect(result.remainingLeases).toBe(1);
      // Only that tab's lease was deleted
      expect(prisma.roomLease.deleteMany).toHaveBeenCalledWith({
        where: { userId: 'user-1', tabId: 'tab-closed' },
      });
      // Participant row was NOT deleted
      expect(prisma.roomParticipant.delete).not.toHaveBeenCalled();
    });
  });

  describe('reconcileExpiredLeases', () => {
    it('evicts expired leases and ghost participants without active leases', async () => {
      vi.mocked(prisma.roomLease.deleteMany).mockResolvedValueOnce({ count: 5 } as any);
      vi.mocked(prisma.roomParticipant.findMany).mockResolvedValueOnce([
        { id: 'p-ghost', userId: 'user-dead', studyRoomId: 'room-1' },
        { id: 'p-alive', userId: 'user-active', studyRoomId: 'room-1' },
      ] as any);

      // Only user-active has an unexpired lease
      vi.mocked(prisma.roomLease.findMany).mockResolvedValueOnce([
        { userId: 'user-active', studyRoomId: 'room-1' },
      ] as any);

      vi.mocked(prisma.studyRoom.findMany).mockResolvedValueOnce([{ id: 'room-1' }] as any);
      vi.mocked(prisma.roomLease.groupBy).mockResolvedValueOnce([{ userId: 'user-active' } as any]);

      const result = await studyRoomService.reconcileExpiredLeases();

      expect(result.evictedLeasesCount).toBe(5);
      expect(result.evictedParticipantsCount).toBe(1); // p-ghost removed
      expect(prisma.roomParticipant.deleteMany).toHaveBeenCalledWith({
        where: { id: { in: ['p-ghost'] } },
      });
      expect(prisma.studyRoom.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'room-1' },
          data: { onlineCount: 1 },
        })
      );
    });
  });
});
