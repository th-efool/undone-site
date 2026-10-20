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

vi.mock('@/src/server/infrastructure/db/postgres/client', () => ({
  prisma: {
    studyRoom: {
      findUnique: vi.fn(),
    },
    roomEnvironment: {
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
  },
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

      vi.mocked(prisma.roomEnvironment.update).mockResolvedValueOnce({
        studyRoomId: 'room-1',
        sceneId: 'cyberpunk-rain',
        soundscapeId: 'rain',
        musicPresetId: 'lofi-beats',
        musicStreamUrl: 'https://soundcloud.com/chill/lofi',
        revision: 2,
        updatedByUserId: 'controller-1',
        updatedAt: new Date(),
      } as any);

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
  });
});
