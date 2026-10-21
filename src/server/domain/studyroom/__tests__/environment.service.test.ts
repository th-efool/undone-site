import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('server-only', () => ({}));

import { environmentService, validateExternalStreamUrl } from '../environment.service';
import { sprintService } from '../sprint.service';
import { prisma } from '@/src/server/infrastructure/db/postgres/client';
import {
  MessagingConflictError,
  MessagingForbiddenError,
  MessagingNotFoundError,
  MessagingValidationError,
} from '../../messaging/contracts';

const { mockPrisma } = vi.hoisted(() => {
  const mock: any = {
    studyRoom: {
      findUnique: vi.fn(),
    },
    roomEnvironment: {
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      upsert: vi.fn(),
    },
    realtimeStream: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    realtimeEvent: {
      create: vi.fn(),
    },
    realtimeDelivery: {
      create: vi.fn(),
    },
    $transaction: vi.fn(async (cb: any) => cb(mock)),
  };
  return { mockPrisma: mock };
});

vi.mock('@/src/server/infrastructure/db/postgres/client', () => ({
  prisma: mockPrisma,
}));

vi.mock('../sprint.service', () => ({
  sprintService: {
    isRoomController: vi.fn(),
  },
}));

describe('environmentService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('validateExternalStreamUrl', () => {
    it('approves whitelisted HTTPS streaming URLs', () => {
      expect(
        validateExternalStreamUrl('https://soundcloud.com/artist/track-name')
      ).toBe('https://soundcloud.com/artist/track-name');

      expect(
        validateExternalStreamUrl('https://www.youtube.com/watch?v=jfKfPfyJRdk')
      ).toBe('https://www.youtube.com/watch?v=jfKfPfyJRdk');

      expect(
        validateExternalStreamUrl('https://music.youtube.com/watch?v=jfKfPfyJRdk')
      ).toBe('https://music.youtube.com/watch?v=jfKfPfyJRdk');

      expect(
        validateExternalStreamUrl('https://open.spotify.com/track/4cOdK2wGLETKBW3PvgPWqT')
      ).toBe('https://open.spotify.com/track/4cOdK2wGLETKBW3PvgPWqT');

      expect(
        validateExternalStreamUrl('https://cdn.sidequesthq.com/audio/focus-lofi.mp3')
      ).toBe('https://cdn.sidequesthq.com/audio/focus-lofi.mp3');
    });

    it('rejects non-HTTPS URLs', () => {
      expect(() =>
        validateExternalStreamUrl('http://soundcloud.com/track')
      ).toThrow(MessagingValidationError);

      expect(() =>
        validateExternalStreamUrl('ftp://soundcloud.com/track')
      ).toThrow(MessagingValidationError);
    });

    it('rejects loopback, internal IP, and localhost targets (SSRF prevention)', () => {
      expect(() =>
        validateExternalStreamUrl('https://localhost/stream')
      ).toThrow(MessagingValidationError);

      expect(() =>
        validateExternalStreamUrl('https://127.0.0.1:8080/stream')
      ).toThrow(MessagingValidationError);

      expect(() =>
        validateExternalStreamUrl('https://169.254.169.254/latest/meta-data/')
      ).toThrow(MessagingValidationError);

      expect(() =>
        validateExternalStreamUrl('https://10.0.0.1/stream')
      ).toThrow(MessagingValidationError);

      expect(() =>
        validateExternalStreamUrl('https://192.168.1.1/stream')
      ).toThrow(MessagingValidationError);
    });

    it('rejects embedded credentials and unauthorized domains', () => {
      expect(() =>
        validateExternalStreamUrl('https://user:password@soundcloud.com/track')
      ).toThrow(MessagingValidationError);

      expect(() =>
        validateExternalStreamUrl('https://evil-attacker.com/malicious.mp3')
      ).toThrow(MessagingValidationError);
    });
  });

  describe('updateRoomEnvironment', () => {
    it('updates shared settings when authorized as controller', async () => {
      vi.mocked(sprintService.isRoomController).mockResolvedValueOnce(true);

      vi.mocked(prisma.studyRoom.findUnique).mockResolvedValueOnce({ id: 'room-1' } as any);
      vi.mocked(prisma.roomEnvironment.findUnique).mockResolvedValueOnce({
        studyRoomId: 'room-1',
        sceneId: 'lofi-cafe',
        revision: 1,
        soundscapeId: null,
        musicPresetId: null,
        musicStreamUrl: null,
        updatedByUserId: null,
        updatedAt: new Date(),
      } as any);

      const updatedSnapshot = {
        studyRoomId: 'room-1',
        sceneId: 'cyberpunk-rain',
        soundscapeId: 'rain',
        musicPresetId: 'lofi-beats',
        musicStreamUrl: 'https://soundcloud.com/chill/lofi',
        revision: 2,
        updatedByUserId: 'controller-1',
        updatedAt: new Date(),
      } as any;
      vi.mocked(prisma.roomEnvironment.update).mockResolvedValue(updatedSnapshot);
      vi.mocked(prisma.roomEnvironment.upsert).mockResolvedValue(updatedSnapshot);

      const result = await environmentService.updateRoomEnvironment({
        userId: 'controller-1',
        roomId: 'room-1',
        sceneId: 'cyberpunk-rain',
        soundscapeId: 'rain',
        musicPresetId: 'lofi-beats',
        musicStreamUrl: 'https://soundcloud.com/chill/lofi',
        expectedRevision: 1,
      });

      expect(result.sceneId).toBe('cyberpunk-rain');
      expect(result.revision).toBe(2);
      expect(prisma.roomEnvironment.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            sceneId: 'cyberpunk-rain',
            revision: { increment: 1 },
          }),
        })
      );
    });

    it('rejects update when caller is not a room controller', async () => {
      vi.mocked(sprintService.isRoomController).mockResolvedValueOnce(false);

      await expect(
        environmentService.updateRoomEnvironment({
          userId: 'random-user',
          roomId: 'room-1',
          sceneId: 'cyberpunk-rain',
        })
      ).rejects.toThrow(MessagingForbiddenError);
    });

    it('rejects update with revision conflict', async () => {
      vi.mocked(sprintService.isRoomController).mockResolvedValueOnce(true);
      vi.mocked(prisma.studyRoom.findUnique).mockResolvedValueOnce({ id: 'room-1' } as any);
      vi.mocked(prisma.roomEnvironment.findUnique).mockResolvedValueOnce({
        studyRoomId: 'room-1',
        revision: 5,
        sceneId: 'lofi-cafe',
        updatedAt: new Date(),
      } as any);

      await expect(
        environmentService.updateRoomEnvironment({
          userId: 'controller-1',
          roomId: 'room-1',
          sceneId: 'cyberpunk-rain',
          expectedRevision: 4, // Stale revision
        })
      ).rejects.toThrow(MessagingConflictError);
    });

    it('rejects update with unauthorized scene identifier', async () => {
      vi.mocked(sprintService.isRoomController).mockResolvedValueOnce(true);

      await expect(
        environmentService.updateRoomEnvironment({
          userId: 'controller-1',
          roomId: 'room-1',
          sceneId: 'unsupported-fantasy-room',
        })
      ).rejects.toThrow(MessagingValidationError);
    });

    it('emits room.environment.updated transactional outbox event on success', async () => {
      vi.mocked(sprintService.isRoomController).mockResolvedValueOnce(true);
      vi.mocked(prisma.studyRoom.findUnique).mockResolvedValueOnce({ id: 'room-1' } as any);
      vi.mocked(prisma.roomEnvironment.findUnique).mockResolvedValueOnce({
        studyRoomId: 'room-1',
        sceneId: 'cozy-fireplace',
        revision: 2,
        updatedAt: new Date(),
      } as any);

      vi.mocked(prisma.roomEnvironment.update).mockResolvedValueOnce({
        studyRoomId: 'room-1',
        sceneId: 'rainy-window',
        soundscapeId: 'rain',
        musicPresetId: null,
        musicStreamUrl: null,
        revision: 3,
        updatedByUserId: 'controller-1',
        updatedAt: new Date(),
      } as any);

      vi.mocked(prisma.realtimeStream.findUnique).mockResolvedValueOnce({
        id: 'stream-1',
        studyRoomId: 'room-1',
        generation: 2,
        eventCounter: 10,
      } as any);

      vi.mocked(prisma.realtimeStream.update).mockResolvedValueOnce({
        id: 'stream-1',
        eventCounter: 11,
        generation: 2,
      } as any);

      await environmentService.updateRoomEnvironment({
        userId: 'controller-1',
        roomId: 'room-1',
        sceneId: 'rainy-window',
        soundscapeId: 'rain',
        expectedRevision: 2,
      });

      expect(prisma.realtimeEvent.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            streamId: 'stream-1',
            type: 'room.environment.updated',
            generation: 2,
            entityId: 'room-1',
            entityRevision: 3,
            payload: expect.objectContaining({
              sceneId: 'rainy-window',
              soundscapeId: 'rain',
              revision: 3,
            }),
          }),
        })
      );

      expect(prisma.realtimeDelivery.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            destination: 'room:room-1:g2',
            status: 'PENDING',
          }),
        })
      );
    });
  });
});
