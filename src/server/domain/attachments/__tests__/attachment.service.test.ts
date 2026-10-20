import { describe, expect, it, vi, beforeEach } from 'vitest';
import { attachmentService } from '../attachment.service';
import { prisma } from '@/src/server/infrastructure/db/postgres/client';
import { interactionService } from '@/src/server/domain/messaging/interaction.service';
import { chatStorageAdapter } from '../storage.adapter';
import {
  MessagingForbiddenError,
  MessagingNotFoundError,
  MessagingValidationError,
} from '@/src/server/domain/messaging/contracts';

vi.mock('server-only', () => ({}));

vi.mock('@/src/server/infrastructure/db/postgres/client', () => {
  const mockChatAttachment = {
    create: vi.fn(),
    findUnique: vi.fn(),
    findMany: vi.fn(),
    update: vi.fn(),
    updateMany: vi.fn(),
    deleteMany: vi.fn(),
  };

  return {
    prisma: {
      chatAttachment: mockChatAttachment,
    },
  };
});

vi.mock('@/src/server/domain/messaging/interaction.service', () => ({
  interactionService: {
    authorizeChannelAccess: vi.fn(),
  },
}));

vi.mock('../storage.adapter', () => ({
  chatStorageAdapter: {
    saveObject: vi.fn().mockResolvedValue(undefined),
    getObject: vi.fn(),
    deleteObject: vi.fn().mockResolvedValue(undefined),
    clearMemoryForTest: vi.fn(),
  },
}));

describe('Phase 9: Attachment Domain Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('reserveUpload', () => {
    it('authorizes channel and reserves upload ticket', async () => {
      vi.mocked(interactionService.authorizeChannelAccess).mockResolvedValueOnce({} as any);
      vi.mocked(prisma.chatAttachment.findMany).mockResolvedValueOnce([]); // 0 quota used
      vi.mocked(prisma.chatAttachment.create).mockResolvedValueOnce({
        id: 'att-1',
        storageKey: 'att-uuid-1',
        filename: 'diagram.png',
        mediaType: 'image/png',
        byteLength: 500000,
        status: 'RESERVED',
      } as any);

      const res = await attachmentService.reserveUpload({
        userId: 'user-1',
        channelId: 'ch-1',
        filename: 'diagram.png',
        mediaType: 'image/png',
        byteLength: 500000,
      });

      expect(res.attachmentId).toBe('att-1');
      expect(res.storageKey).toBe('att-uuid-1');
      expect(res.uploadUrl).toBe('/api/attachments/att-1/upload');
      expect(interactionService.authorizeChannelAccess).toHaveBeenCalledWith('user-1', 'ch-1');
    });

    it('rejects unsupported media types (e.g. video, SVG, executable)', async () => {
      vi.mocked(interactionService.authorizeChannelAccess).mockResolvedValueOnce({} as any);

      await expect(
        attachmentService.reserveUpload({
          userId: 'user-1',
          channelId: 'ch-1',
          filename: 'vector.svg',
          mediaType: 'image/svg+xml',
          byteLength: 1000,
        })
      ).rejects.toThrow(MessagingValidationError);

      await expect(
        attachmentService.reserveUpload({
          userId: 'user-1',
          channelId: 'ch-1',
          filename: 'video.mp4',
          mediaType: 'video/mp4',
          byteLength: 5000000,
        })
      ).rejects.toThrow(MessagingValidationError);
    });

    it('rejects files larger than 10 MiB', async () => {
      vi.mocked(interactionService.authorizeChannelAccess).mockResolvedValueOnce({} as any);

      await expect(
        attachmentService.reserveUpload({
          userId: 'user-1',
          channelId: 'ch-1',
          filename: 'large.pdf',
          mediaType: 'application/pdf',
          byteLength: 11 * 1024 * 1024, // 11 MiB
        })
      ).rejects.toThrow(MessagingValidationError);
    });

    it('enforces 100 MiB daily user upload quota', async () => {
      vi.mocked(interactionService.authorizeChannelAccess).mockResolvedValueOnce({} as any);
      // Already uploaded 95 MiB today
      vi.mocked(prisma.chatAttachment.findMany).mockResolvedValueOnce([
        { byteLength: 95 * 1024 * 1024 },
      ] as any);

      // Attempting to upload another 6 MiB exceeds 100 MiB limit
      await expect(
        attachmentService.reserveUpload({
          userId: 'user-1',
          channelId: 'ch-1',
          filename: 'paper.pdf',
          mediaType: 'application/pdf',
          byteLength: 6 * 1024 * 1024,
        })
      ).rejects.toThrow(MessagingForbiddenError);
    });
  });

  describe('uploadFile & Validation', () => {
    it('validates magic bytes, saves object, and transitions status to READY', async () => {
      vi.mocked(prisma.chatAttachment.findUnique).mockResolvedValueOnce({
        id: 'att-1',
        uploaderId: 'user-1',
        mediaType: 'image/png',
        byteLength: 8,
        status: 'RESERVED',
        storageKey: 'att-uuid-1',
      } as any);

      // Valid PNG header: 89 50 4E 47 0D 0A 1A 0A
      const validPngBuffer = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

      vi.mocked(prisma.chatAttachment.update).mockResolvedValueOnce({
        id: 'att-1',
        filename: 'image.png',
        mediaType: 'image/png',
        byteLength: 8,
        status: 'READY',
      } as any);

      const res = await attachmentService.uploadFile({
        attachmentId: 'att-1',
        userId: 'user-1',
        buffer: validPngBuffer,
      });

      expect(res.status).toBe('READY');
      expect(chatStorageAdapter.saveObject).toHaveBeenCalledWith('att-uuid-1', validPngBuffer);
    });

    it('rejects upload when magic bytes do not match declared media type', async () => {
      vi.mocked(prisma.chatAttachment.findUnique).mockResolvedValueOnce({
        id: 'att-1',
        uploaderId: 'user-1',
        mediaType: 'image/png',
        status: 'RESERVED',
      } as any);

      // Fake JPEG header for declared PNG
      const fakeBuffer = Buffer.from([0xff, 0xd8, 0xff, 0xe0]);

      await expect(
        attachmentService.uploadFile({
          attachmentId: 'att-1',
          userId: 'user-1',
          buffer: fakeBuffer,
        })
      ).rejects.toThrow(MessagingValidationError);

      expect(prisma.chatAttachment.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: 'FAILED' }),
        })
      );
    });

    it('rejects files containing active executable or HTML script content', async () => {
      vi.mocked(prisma.chatAttachment.findUnique).mockResolvedValueOnce({
        id: 'att-1',
        uploaderId: 'user-1',
        mediaType: 'application/pdf',
        status: 'RESERVED',
      } as any);

      // PDF header followed by embedded script tag
      const scriptInPdf = Buffer.concat([
        Buffer.from('%PDF-1.4\n'),
        Buffer.from('<script>alert("hack")</script>'),
      ]);

      await expect(
        attachmentService.uploadFile({
          attachmentId: 'att-1',
          userId: 'user-1',
          buffer: scriptInPdf,
        })
      ).rejects.toThrow(MessagingForbiddenError);
    });
  });

  describe('linkAttachmentsToMessage', () => {
    it('links READY attachments belonging to author and channel', async () => {
      vi.mocked(prisma.chatAttachment.findMany).mockResolvedValueOnce([
        {
          id: 'att-1',
          uploaderId: 'user-1',
          channelId: 'ch-1',
          status: 'READY',
          messageId: null,
          filename: 'doc.pdf',
        },
      ] as any);

      await attachmentService.linkAttachmentsToMessage({
        messageId: 'msg-1',
        channelId: 'ch-1',
        userId: 'user-1',
        attachmentIds: ['att-1'],
      });

      expect(prisma.chatAttachment.updateMany).toHaveBeenCalledWith({
        where: { id: { in: ['att-1'] } },
        data: { messageId: 'msg-1' },
      });
    });

    it('rejects cross-user attachment theft', async () => {
      vi.mocked(prisma.chatAttachment.findMany).mockResolvedValueOnce([
        {
          id: 'att-foreign',
          uploaderId: 'user-other',
          channelId: 'ch-1',
          status: 'READY',
          messageId: null,
        },
      ] as any);

      await expect(
        attachmentService.linkAttachmentsToMessage({
          messageId: 'msg-1',
          channelId: 'ch-1',
          userId: 'user-hacker',
          attachmentIds: ['att-foreign'],
        })
      ).rejects.toThrow(MessagingForbiddenError);
    });

    it('rejects linking unready or quarantined attachments', async () => {
      vi.mocked(prisma.chatAttachment.findMany).mockResolvedValueOnce([
        {
          id: 'att-reserved',
          uploaderId: 'user-1',
          channelId: 'ch-1',
          status: 'RESERVED',
          messageId: null,
          filename: 'unready.png',
        },
      ] as any);

      await expect(
        attachmentService.linkAttachmentsToMessage({
          messageId: 'msg-1',
          channelId: 'ch-1',
          userId: 'user-1',
          attachmentIds: ['att-reserved'],
        })
      ).rejects.toThrow(MessagingValidationError);
    });
  });

  describe('getDownloadStream', () => {
    it('authorizes channel and returns file buffer with safe headers', async () => {
      vi.mocked(prisma.chatAttachment.findUnique).mockResolvedValueOnce({
        id: 'att-1',
        channelId: 'ch-1',
        storageKey: 'att-uuid-1',
        filename: 'photo.jpg',
        mediaType: 'image/jpeg',
        byteLength: 100,
        status: 'READY',
      } as any);

      vi.mocked(interactionService.authorizeChannelAccess).mockResolvedValueOnce({} as any);
      const testBuffer = Buffer.from([0xff, 0xd8, 0xff, 0xe0]);
      vi.mocked(chatStorageAdapter.getObject).mockResolvedValueOnce(testBuffer);

      const file = await attachmentService.getDownloadStream({
        attachmentId: 'att-1',
        userId: 'user-1',
      });

      expect(file.filename).toBe('photo.jpg');
      expect(file.mediaType).toBe('image/jpeg');
      expect(file.buffer).toEqual(testBuffer);
    });

    it('denies download if user is not authorized in channel', async () => {
      vi.mocked(prisma.chatAttachment.findUnique).mockResolvedValueOnce({
        id: 'att-1',
        channelId: 'ch-private',
      } as any);

      vi.mocked(interactionService.authorizeChannelAccess).mockRejectedValueOnce(
        new MessagingForbiddenError('Not a member of this cohort')
      );

      await expect(
        attachmentService.getDownloadStream({
          attachmentId: 'att-1',
          userId: 'user-outsider',
        })
      ).rejects.toThrow(MessagingForbiddenError);
    });
  });
});
