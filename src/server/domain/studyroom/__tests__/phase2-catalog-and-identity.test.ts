/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('server-only', () => ({}));

import { prisma } from '@/src/server/infrastructure/db/postgres/client';
import { roomManagementService } from '../room-management.service';
import { roomDiscoveryService } from '../room-discovery.service';
import { environmentService } from '../environment.service';
import { sprintService } from '../sprint.service';
import { RoomNotFoundError } from '@/src/shared/studyroom/contracts';

vi.mock('@/src/server/infrastructure/db/postgres/client', () => ({
  prisma: {
    studyRoom: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      count: vi.fn(),
    },
    roomEnvironment: {
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      upsert: vi.fn(),
    },
    channel: {
      create: vi.fn(),
    },
    realtimeStream: {
      create: vi.fn(),
    },
    chatChannel: {
      create: vi.fn(),
    },
    streamChannel: {
      create: vi.fn(),
    },
    roomAuditLog: {
      findFirst: vi.fn(),
      create: vi.fn(),
    },
    cohort: {
      findUnique: vi.fn(),
    },
    cohortMember: {
      findUnique: vi.fn(),
    },
    roomController: {
      findMany: vi.fn(),
    },
    roomLease: {
      findFirst: vi.fn(),
      deleteMany: vi.fn(),
    },
    roomParticipant: {
      deleteMany: vi.fn(),
    },
    roomOwnershipTransfer: {
      findFirst: vi.fn(),
    },
    $transaction: vi.fn((callback) => callback(prisma)),
  },
}));

vi.mock('../sprint.service', () => ({
  sprintService: {
    isRoomController: vi.fn(),
  },
}));

describe('Integration Phase 2: Stable Room Identity and Safe Catalog', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Slug Resolution and Preservation', () => {
    it('creates room with unique sanitized slug from title', async () => {
      vi.mocked(prisma.studyRoom.count).mockResolvedValue(0);
      vi.mocked(prisma.studyRoom.findUnique).mockResolvedValue(null);
      vi.mocked(prisma.roomAuditLog.findFirst).mockResolvedValue(null);

      const fakeRoom = {
        id: 'room-new-1',
        slug: 'quantum-physics-den',
        title: 'Quantum Physics Den!',
        description: 'Study hard',
        status: 'OPEN',
        listing: 'PUBLIC',
        scopeKind: 'STANDALONE',
        capacity: 25,
        revision: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      vi.mocked(prisma.studyRoom.create).mockResolvedValue(fakeRoom as any);
      vi.mocked(prisma.channel.create).mockResolvedValue({ id: 'chan-1' } as any);
      vi.mocked(prisma.realtimeStream.create).mockResolvedValue({ id: 'stream-1' } as any);
      vi.mocked(prisma.roomEnvironment.create).mockResolvedValue({ id: 'env-1' } as any);
      vi.mocked(prisma.roomAuditLog.create).mockResolvedValue({ id: 'audit-1' } as any);

      const result = await roomManagementService.createRoom(
        {
          requestId: 'req-1',
          title: 'Quantum Physics Den!',
          scopeKind: 'STANDALONE',
          listing: 'LISTED',
        },
        'owner-1'
      );

      expect(result.slug).toBe('quantum-physics-den');
      expect(prisma.studyRoom.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            slug: 'quantum-physics-den',
          }),
        })
      );
    });

    it('renaming room title preserves original slug', async () => {
      const existingRoom = {
        id: 'room-1',
        slug: 'original-slug',
        title: 'Original Title',
        ownerId: 'owner-1',
        listing: 'PUBLIC',
        status: 'OPEN',
        capacity: 25,
        revision: 3,
        rules: null,
        tags: [],
        language: 'en',
        updatedAt: new Date(),
      };

      vi.mocked(prisma.studyRoom.findFirst).mockResolvedValue(existingRoom as any);
      vi.mocked(prisma.studyRoom.findUnique).mockResolvedValue(existingRoom as any);
      vi.mocked(prisma.studyRoom.update).mockResolvedValue({
        ...existingRoom,
        title: 'Brand New Title',
        revision: 4,
      } as any);

      const updated = await roomManagementService.updateRoomSettings(
        'original-slug',
        {
          expectedRevision: 3,
          title: 'Brand New Title',
        },
        'owner-1'
      );

      expect(updated.slug).toBe('original-slug');
      expect(updated.revision).toBe(4);
      // Slug was not overwritten by title update
      expect(prisma.studyRoom.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            title: 'Brand New Title',
          }),
        })
      );
    });

    it('throws RoomNotFoundError when slug does not exist', async () => {
      vi.mocked(prisma.studyRoom.findFirst).mockResolvedValue(null);
      vi.mocked(prisma.studyRoom.findUnique).mockResolvedValue(null);

      await expect(
        roomManagementService.getRoomBootstrap('nonexistent-slug', 'user-1')
      ).rejects.toThrow(RoomNotFoundError);
    });
  });

  describe('Discovery Catalog Scope Isolation', () => {
    it('excludes private cohort and unlisted rooms from public discovery query', async () => {
      vi.mocked(prisma.studyRoom.findMany).mockResolvedValue([
        {
          id: 'room-pub',
          slug: 'public-room',
          title: 'Public Room',
          listing: 'PUBLIC',
          status: 'OPEN',
          scopeKind: 'STANDALONE',
          cohortId: null,
          capacity: 25,
          onlineCount: 2,
          tags: [],
          language: 'en',
          createdAt: new Date(),
          updatedAt: new Date(),
          ownerId: 'user-1',
          owner: { id: 'user-1', name: 'User 1', username: 'user1', image: null },
        },
      ] as any);

      const result = await roomDiscoveryService.discoverRooms({ tab: 'discover' }, null);

      expect(result.rooms).toHaveLength(1);
      expect(result.rooms[0].slug).toBe('public-room');

      expect(prisma.studyRoom.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            AND: expect.arrayContaining([
              { status: 'OPEN' },
              { listing: 'LISTED' },
              { cohortId: null },
            ]),
          },
        })
      );
    });
  });

  describe('GET Performs Zero Database Writes', () => {
    it('getRoomEnvironment returns default snapshot without calling prisma.roomEnvironment.create on cache miss', async () => {
      vi.mocked(prisma.studyRoom.findUnique).mockResolvedValue({
        id: 'room-1',
        visualPresetId: 'library-dawn',
        ownerId: 'owner-1',
        createdAt: new Date('2026-10-21T00:00:00.000Z'),
      } as any);
      vi.mocked(prisma.roomEnvironment.findUnique).mockResolvedValue(null);

      const env = await environmentService.getRoomEnvironment('room-1');

      expect(env.sceneId).toBe('library-dawn');
      expect(env.revision).toBe(1);
      // Crucial: create was NOT invoked during GET read
      expect(prisma.roomEnvironment.create).not.toHaveBeenCalled();
    });

    it('updateRoomEnvironment uses upsert for atomic updates', async () => {
      vi.mocked(sprintService.isRoomController).mockResolvedValue(true);
      vi.mocked(prisma.studyRoom.findUnique).mockResolvedValue({
        id: 'room-1',
        visualPresetId: 'lofi-cafe',
        createdAt: new Date(),
      } as any);
      vi.mocked(prisma.roomEnvironment.findUnique).mockResolvedValue({
        studyRoomId: 'room-1',
        sceneId: 'lofi-cafe',
        revision: 1,
        soundscapeId: null,
        musicPresetId: null,
        musicStreamUrl: null,
        updatedByUserId: null,
        updatedAt: new Date(),
      } as any);
      vi.mocked(prisma.roomEnvironment.update).mockResolvedValue({
        studyRoomId: 'room-1',
        sceneId: 'cyberpunk-rain',
        soundscapeId: null,
        musicPresetId: null,
        musicStreamUrl: null,
        revision: 2,
        updatedByUserId: 'user-1',
        updatedAt: new Date(),
      } as any);

      const res = await environmentService.updateRoomEnvironment({
        userId: 'user-1',
        roomId: 'room-1',
        sceneId: 'cyberpunk-rain',
        expectedRevision: 1,
      });

      expect(res.sceneId).toBe('cyberpunk-rain');
      expect(res.revision).toBe(2);
      expect(prisma.roomEnvironment.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { studyRoomId: 'room-1' },
        })
      );
    });
  });
});
