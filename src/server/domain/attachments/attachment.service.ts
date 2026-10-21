import 'server-only';
import { createHash, randomUUID } from 'node:crypto';
import { prisma } from '@/src/server/infrastructure/db/postgres/client';
import { interactionService } from '@/src/server/domain/messaging/interaction.service';
import {
  ALLOWED_MIME_TYPES,
  MAX_FILE_SIZE_BYTES,
  MAX_ATTACHMENTS_PER_MESSAGE,
  DAILY_UPLOAD_QUOTA_BYTES,
  validateMagicBytes,
  containsActiveExecutableContent,
  type ReserveUploadInput,
  type ReserveUploadResult,
  type AttachmentSummaryDTO,
} from './contracts';
import { chatStorageAdapter } from './storage.adapter';
import {
  MessagingForbiddenError,
  MessagingNotFoundError,
  MessagingValidationError,
} from '@/src/server/domain/messaging/contracts';

export const attachmentService = {
  /**
   * Reserves an upload ticket.
   * Verifies channel access, MIME type whitelist, file size limit, and per-user daily quota.
   */
  async reserveUpload(input: ReserveUploadInput): Promise<ReserveUploadResult> {
    const { userId, channelId, filename, mediaType, byteLength } = input;

    // 1. Authorize channel access
    await interactionService.authorizeChannelAccess(userId, channelId);

    // 2. Validate MIME type against strict whitelist (images and PDFs only)
    if (!ALLOWED_MIME_TYPES.includes(mediaType as any)) {
      throw new MessagingValidationError(
        `Unsupported media type '${mediaType}'. Allowed: ${ALLOWED_MIME_TYPES.join(', ')}`
      );
    }

    // 3. Validate size <= 10 MiB
    if (byteLength <= 0 || byteLength > MAX_FILE_SIZE_BYTES) {
      throw new MessagingValidationError(
        `File size exceeds maximum allowed size of ${MAX_FILE_SIZE_BYTES / (1024 * 1024)} MiB`
      );
    }

    // 4. Validate per-user daily quota (100 MiB / 24h)
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const recentUploads = await prisma.chatAttachment.findMany({
      where: {
        uploaderId: userId,
        createdAt: { gte: twentyFourHoursAgo },
        status: { in: ['RESERVED', 'READY'] },
      },
      select: { byteLength: true },
    });

    const usedQuotaBytes = recentUploads.reduce((acc, curr) => acc + curr.byteLength, 0);
    if (usedQuotaBytes + byteLength > DAILY_UPLOAD_QUOTA_BYTES) {
      throw new MessagingForbiddenError(
        'Daily upload quota exceeded (100 MiB limit). Try again later.'
      );
    }

    // 5. Generate opaque storage key
    const storageKey = `att-${randomUUID()}`;
    const sanitizedFilename = filename.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 120);

    const attachment = await prisma.chatAttachment.create({
      data: {
        uploaderId: userId,
        channelId,
        storageKey,
        filename: sanitizedFilename,
        mediaType,
        byteLength,
        checksum: 'pending',
        status: 'RESERVED',
      },
    });

    return {
      attachmentId: attachment.id,
      storageKey: attachment.storageKey,
      uploadUrl: `/api/attachments/${attachment.id}/upload`,
      filename: attachment.filename,
      mediaType: attachment.mediaType,
      byteLength: attachment.byteLength,
      maxByteLength: MAX_FILE_SIZE_BYTES,
    };
  },

  /**
   * Uploads and validates file payload into private quarantine storage.
   * Checks magic bytes, scans for active scripts/SVG/HTML, computes SHA-256 checksum,
   * and transitions status to READY.
   */
  async uploadFile(params: {
    attachmentId: string;
    userId: string;
    buffer: Buffer;
  }): Promise<AttachmentSummaryDTO> {
    const { attachmentId, userId, buffer } = params;

    const attachment = await prisma.chatAttachment.findUnique({
      where: { id: attachmentId },
    });

    if (!attachment) {
      throw new MessagingNotFoundError('Attachment reservation not found');
    }

    if (attachment.uploaderId !== userId) {
      throw new MessagingForbiddenError('Not authorized to upload for this attachment');
    }

    if (attachment.status !== 'RESERVED') {
      throw new MessagingValidationError(`Cannot upload: attachment status is ${attachment.status}`);
    }

    // Size check
    if (buffer.length > MAX_FILE_SIZE_BYTES) {
      await prisma.chatAttachment.update({
        where: { id: attachmentId },
        data: { status: 'FAILED', failureReason: 'File size exceeds maximum limit' },
      });
      throw new MessagingValidationError('File exceeds size limit');
    }

    // Magic bytes verification
    if (!validateMagicBytes(buffer, attachment.mediaType)) {
      await prisma.chatAttachment.update({
        where: { id: attachmentId },
        data: { status: 'FAILED', failureReason: 'Magic bytes mismatch declared media type' },
      });
      throw new MessagingValidationError('File content does not match declared media type');
    }

    // Scan for dangerous executable/active content (SVG, HTML, JS)
    if (containsActiveExecutableContent(buffer)) {
      await prisma.chatAttachment.update({
        where: { id: attachmentId },
        data: { status: 'FAILED', failureReason: 'File contains forbidden active executable content' },
      });
      throw new MessagingForbiddenError('File contains forbidden active executable content');
    }

    // Compute SHA-256 checksum
    const checksum = createHash('sha256').update(buffer).digest('hex');

    // Store in quarantine/private storage
    await chatStorageAdapter.saveObject(attachment.storageKey, buffer);

    const updated = await prisma.chatAttachment.update({
      where: { id: attachmentId },
      data: {
        checksum,
        byteLength: buffer.length,
        status: 'READY',
      },
    });

    return {
      id: updated.id,
      filename: updated.filename,
      mediaType: updated.mediaType,
      byteLength: updated.byteLength,
      downloadUrl: `/api/attachments/${updated.id}/download`,
      status: updated.status,
    };
  },

  /**
   * Links validated attachments to a message.
   * Ensures attachments belong to the author, match the message channel,
   * are in READY status, and prevents cross-scope theft.
   */
  async linkAttachmentsToMessage(params: {
    messageId: string;
    channelId: string;
    userId: string;
    attachmentIds: string[];
  }): Promise<void> {
    const { messageId, channelId, userId, attachmentIds } = params;
    if (!attachmentIds || attachmentIds.length === 0) return;

    if (attachmentIds.length > MAX_ATTACHMENTS_PER_MESSAGE) {
      throw new MessagingValidationError(
        `Exceeded maximum attachments limit of ${MAX_ATTACHMENTS_PER_MESSAGE} per message`
      );
    }

    const attachments = await prisma.chatAttachment.findMany({
      where: { id: { in: attachmentIds } },
    });

    if (attachments.length !== attachmentIds.length) {
      throw new MessagingNotFoundError('One or more attachments not found');
    }

    for (const att of attachments) {
      if (att.uploaderId !== userId) {
        throw new MessagingForbiddenError('Cannot link attachment uploaded by another user');
      }
      if (att.channelId !== channelId) {
        throw new MessagingForbiddenError('Cannot link attachment from a different channel/scope');
      }
      if (att.status !== 'READY') {
        throw new MessagingValidationError(
          `Attachment ${att.filename} is not in READY status (current: ${att.status})`
        );
      }
      if (att.messageId && att.messageId !== messageId) {
        throw new MessagingConflictError('Attachment is already linked to another message');
      }
    }

    await prisma.chatAttachment.updateMany({
      where: { id: { in: attachmentIds } },
      data: { messageId },
    });
  },

  /**
   * Streams/retrieves an attachment for authorized download.
   * Re-verifies channel membership and prevents access to quarantined or foreign files.
   */
  async getDownloadStream(params: {
    attachmentId: string;
    userId: string;
  }): Promise<{
    buffer: Buffer;
    filename: string;
    mediaType: string;
    byteLength: number;
  }> {
    const { attachmentId, userId } = params;

    const attachment = await prisma.chatAttachment.findUnique({
      where: { id: attachmentId },
    });

    if (!attachment) {
      throw new MessagingNotFoundError('Attachment not found');
    }

    // Recheck current channel access at download time
    await interactionService.authorizeChannelAccess(userId, attachment.channelId);

    if (attachment.status !== 'READY') {
      throw new MessagingForbiddenError(`Attachment cannot be downloaded: status is ${attachment.status}`);
    }

    const buffer = await chatStorageAdapter.getObject(attachment.storageKey);
    if (!buffer) {
      throw new MessagingNotFoundError('Stored file object not found in private storage');
    }

    return {
      buffer,
      filename: attachment.filename,
      mediaType: attachment.mediaType,
      byteLength: attachment.byteLength,
    };
  },

  /**
   * Periodic retention cleanup for unreferenced or failed uploads older than 24 hours.
   */
  async cleanupOrphanAttachments(): Promise<number> {
    const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const orphans = await prisma.chatAttachment.findMany({
      where: {
        messageId: null,
        createdAt: { lte: cutoff },
        status: { in: ['RESERVED', 'FAILED'] },
      },
      select: { id: true, storageKey: true },
    });

    for (const orphan of orphans) {
      await chatStorageAdapter.deleteObject(orphan.storageKey);
    }

    if (orphans.length > 0) {
      await prisma.chatAttachment.deleteMany({
        where: { id: { in: orphans.map((o) => o.id) } },
      });
    }

    return orphans.length;
  },
};

class MessagingConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'MessagingConflictError';
  }
}
