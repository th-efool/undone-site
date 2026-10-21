import 'server-only';
import { prisma } from '@/src/server/infrastructure/db/postgres/client';
import { studyroomPolicy, type RoomEntity } from './studyroom.policy';
import {
  type CreateRoomInput,
  type CreateRoomResponse,
  type UpdateRoomSettingsInput,
  type UpdateRoomSettingsResponse,
  type RoomLifecycleInput,
  type RoomLifecycleResponse,
  type RoomBootstrapResponse,
  type OwnershipTransferDTO,
  type TransferStatus,
  type RoomStatus,
  type RoomListing,
  STUDY_ROOM_LIMITS,
  RoomNotFoundError,
  RoomForbiddenError,
  RoomConflictError,
  RoomValidationError,
} from '@/src/shared/studyroom/contracts';

function sanitizeSlug(raw: string): string {
  return raw
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48);
}

export const roomManagementService = {
  /**
   * Idempotent atomic room creation.
   */
  async createRoom(input: CreateRoomInput, userId: string): Promise<CreateRoomResponse> {
    const {
      requestId,
      title,
      description,
      scopeKind,
      cohortId,
      listing = 'LISTED',
      capacity = STUDY_ROOM_LIMITS.CAPACITY_DEFAULT,
      rules,
      tags = [],
      language = 'en',
      visualPresetId,
      initialSceneId = 'lofi-cafe',
      initialAmbiencePresetId = null,
      publishImmediately = false,
    } = input;

    // 1. Idempotency Check: if requestId was already processed, return existing room
    if (requestId) {
      const existingAudit = await prisma.roomAuditLog.findFirst({
        where: {
          clientRequestId: requestId,
          actorId: userId,
          action: 'ROOM_CREATED',
        },
        include: {
          room: {
            select: {
              id: true,
              slug: true,
              title: true,
              status: true,
              revision: true,
            },
          },
        },
      });

      if (existingAudit?.room) {
        return {
          id: existingAudit.room.id,
          slug: existingAudit.room.slug || existingAudit.room.id,
          title: existingAudit.room.title,
          status: existingAudit.room.status as RoomStatus,
          revision: existingAudit.room.revision,
          isIdempotentReplay: true,
        };
      }
    }

    // 2. Validate Inputs
    const cleanTitle = (title || '').trim();
    if (
      cleanTitle.length < STUDY_ROOM_LIMITS.TITLE_MIN_LENGTH ||
      cleanTitle.length > STUDY_ROOM_LIMITS.TITLE_MAX_LENGTH
    ) {
      throw new RoomValidationError(
        `Title must be between ${STUDY_ROOM_LIMITS.TITLE_MIN_LENGTH} and ${STUDY_ROOM_LIMITS.TITLE_MAX_LENGTH} characters`
      );
    }

    if (description && description.length > STUDY_ROOM_LIMITS.DESCRIPTION_MAX_LENGTH) {
      throw new RoomValidationError(
        `Description cannot exceed ${STUDY_ROOM_LIMITS.DESCRIPTION_MAX_LENGTH} characters`
      );
    }

    if (rules && rules.length > STUDY_ROOM_LIMITS.RULES_MAX_LENGTH) {
      throw new RoomValidationError(
        `Rules cannot exceed ${STUDY_ROOM_LIMITS.RULES_MAX_LENGTH} characters`
      );
    }

    if (tags.length > STUDY_ROOM_LIMITS.TAGS_MAX_COUNT) {
      throw new RoomValidationError(
        `Maximum ${STUDY_ROOM_LIMITS.TAGS_MAX_COUNT} tags allowed`
      );
    }

    for (const tag of tags) {
      if (tag.length > STUDY_ROOM_LIMITS.TAG_MAX_LENGTH) {
        throw new RoomValidationError(
          `Tag length cannot exceed ${STUDY_ROOM_LIMITS.TAG_MAX_LENGTH} characters`
        );
      }
    }

    if (capacity < STUDY_ROOM_LIMITS.CAPACITY_MIN || capacity > STUDY_ROOM_LIMITS.CAPACITY_MAX) {
      throw new RoomValidationError(
        `Capacity must be between ${STUDY_ROOM_LIMITS.CAPACITY_MIN} and ${STUDY_ROOM_LIMITS.CAPACITY_MAX}`
      );
    }

    // 3. Quota and Scope Checks
    const effectiveScopeKind = scopeKind || (cohortId ? 'COHORT' : 'STANDALONE');
    if (effectiveScopeKind === 'STANDALONE') {
      await studyroomPolicy.assertCreationQuota(userId);
    } else if (effectiveScopeKind === 'COHORT') {
      if (!cohortId) {
        throw new RoomValidationError('Cohort ID is required for cohort-scoped room');
      }

      const cohort = await prisma.cohort.findUnique({
        where: { id: cohortId },
        select: { creatorId: true },
      });

      if (!cohort) {
        throw new RoomValidationError('Cohort not found');
      }

      const membership = await prisma.cohortMember.findUnique({
        where: { cohortId_userId: { cohortId, userId } },
        select: { role: true },
      });

      const isAuthorized =
        cohort.creatorId === userId ||
        (membership && (membership.role === 'CREATOR' || membership.role === 'MODERATOR'));

      if (!isAuthorized) {
        throw new RoomForbiddenError('Only cohort creator or moderator can create cohort rooms');
      }
    }

    // 4. Generate Slug with Collision Handling
    const baseSlug = sanitizeSlug(cleanTitle) || 'study-room';
    studyroomPolicy.validateRoomSlug(baseSlug);

    let targetSlug = baseSlug;
    let collisionCount = 0;
    while (collisionCount < 10) {
      const existing = await prisma.studyRoom.findUnique({
        where: { slug: targetSlug },
        select: { id: true },
      });
      if (!existing) break;
      collisionCount++;
      targetSlug = `${baseSlug}-${Math.floor(1000 + Math.random() * 9000)}`;
    }

    if (collisionCount >= 10) {
      throw new RoomConflictError('Could not allocate unique room slug; please try a different title');
    }

    const initialStatus = publishImmediately ? 'OPEN' : 'DRAFT';
    const now = new Date();

    // 5. Atomic Transaction: Room, Channel, RealtimeStream, RoomEnvironment, AuditLog
    const room = await prisma.$transaction(async (tx) => {
      const createdRoom = await tx.studyRoom.create({
        data: {
          title: cleanTitle,
          slug: targetSlug,
          description: description?.trim() || null,
          thumbnail: visualPresetId ? `/images/studyrooms/scenes/${visualPresetId}.webp` : '/images/studyrooms/scenes/library.webp',
          ownerId: userId,
          cohortId: scopeKind === 'COHORT' ? cohortId : null,
          listing,
          capacity,
          rules: rules?.trim() || null,
          tags,
          language,
          visualPresetId: visualPresetId || null,
          status: initialStatus,
          revision: 1,
          publishedAt: publishImmediately ? now : null,
          onlineCount: 0,
        },
      });

      // Chat Channel
      await tx.channel.create({
        data: {
          name: createdRoom.title,
          studyRoomId: createdRoom.id,
          messageCounter: 0,
        },
      });

      // Event Stream
      await tx.realtimeStream.create({
        data: {
          studyRoomId: createdRoom.id,
          generation: 1,
          eventCounter: 0,
        },
      });

      // Shared Environment
      await tx.roomEnvironment.create({
        data: {
          studyRoomId: createdRoom.id,
          sceneId: initialSceneId,
          soundscapeId: initialAmbiencePresetId,
          revision: 1,
          updatedByUserId: userId,
        },
      });

      // Durable Audit Log
      await tx.roomAuditLog.create({
        data: {
          studyRoomId: createdRoom.id,
          actorId: userId,
          action: 'ROOM_CREATED',
          clientRequestId: requestId || null,
          details: {
            title: cleanTitle,
            slug: targetSlug,
            scopeKind,
            cohortId: scopeKind === 'COHORT' ? cohortId : null,
            status: initialStatus,
            capacity,
          },
        },
      });

      return createdRoom;
    });

    return {
      id: room.id,
      slug: room.slug || room.id,
      title: room.title,
      status: room.status as RoomStatus,
      revision: room.revision,
    };
  },

  /**
   * Updates room metadata with expectedRevision concurrency protection.
   */
  async updateRoomSettings(
    roomSlugOrId: string,
    input: UpdateRoomSettingsInput,
    userId: string
  ): Promise<UpdateRoomSettingsResponse> {
    const { expectedRevision, title, description, listing, capacity, rules, tags, language, visualPresetId } = input;

    const room = await prisma.studyRoom.findFirst({
      where: {
        OR: [{ id: roomSlugOrId }, { slug: roomSlugOrId }],
      },
    });

    if (!room) {
      throw new RoomNotFoundError();
    }

    // Authority Check: Owner or Platform Admin only
    const roleRes = await studyroomPolicy.resolveUserRoomRole(room as unknown as RoomEntity, userId);
    if (!roleRes.isOwner && !roleRes.isPlatformAdmin) {
      throw new RoomForbiddenError('Only room owner can modify room settings');
    }

    // Optimistic Concurrency Check
    if (room.revision !== expectedRevision) {
      throw new RoomConflictError();
    }

    // Validation
    if (capacity !== undefined) {
      if (capacity < STUDY_ROOM_LIMITS.CAPACITY_MIN || capacity > STUDY_ROOM_LIMITS.CAPACITY_MAX) {
        throw new RoomValidationError(`Capacity must be between ${STUDY_ROOM_LIMITS.CAPACITY_MIN} and ${STUDY_ROOM_LIMITS.CAPACITY_MAX}`);
      }
    }

    if (title !== undefined) {
      const clean = title.trim();
      if (clean.length < STUDY_ROOM_LIMITS.TITLE_MIN_LENGTH || clean.length > STUDY_ROOM_LIMITS.TITLE_MAX_LENGTH) {
        throw new RoomValidationError(`Title must be between ${STUDY_ROOM_LIMITS.TITLE_MIN_LENGTH} and ${STUDY_ROOM_LIMITS.TITLE_MAX_LENGTH} characters`);
      }
    }

    const updated = await prisma.$transaction(async (tx) => {
      const res = await tx.studyRoom.update({
        where: { id: room.id },
        data: {
          title: title !== undefined ? title.trim() : undefined,
          description: description !== undefined ? (description ? description.trim() : null) : undefined,
          listing: listing !== undefined ? listing : undefined,
          capacity: capacity !== undefined ? capacity : undefined,
          rules: rules !== undefined ? (rules ? rules.trim() : null) : undefined,
          tags: tags !== undefined ? tags : undefined,
          language: language !== undefined ? language : undefined,
          visualPresetId: visualPresetId !== undefined ? visualPresetId : undefined,
          revision: { increment: 1 },
        },
      });

      await tx.roomAuditLog.create({
        data: {
          studyRoomId: room.id,
          actorId: userId,
          action: 'SETTINGS_UPDATED',
          details: { previousRevision: room.revision, newRevision: res.revision },
        },
      });

      return res;
    });

    return {
      id: updated.id,
      slug: updated.slug || updated.id,
      revision: updated.revision,
      updatedAt: updated.updatedAt.toISOString(),
    };
  },

  /**
   * Transitions room lifecycle state (PUBLISH, CLOSE, REOPEN, ARCHIVE, RESTORE).
   */
  async transitionLifecycle(
    roomSlugOrId: string,
    input: RoomLifecycleInput,
    userId: string
  ): Promise<RoomLifecycleResponse> {
    const { action, expectedRevision, requestId } = input;

    const room = await prisma.studyRoom.findFirst({
      where: {
        OR: [{ id: roomSlugOrId }, { slug: roomSlugOrId }],
      },
    });

    if (!room) {
      throw new RoomNotFoundError();
    }

    // Authority Check: Owner or Platform Admin only
    const roleRes = await studyroomPolicy.resolveUserRoomRole(room as unknown as RoomEntity, userId);
    if (!roleRes.isOwner && !roleRes.isPlatformAdmin) {
      throw new RoomForbiddenError('Only room owner can alter room lifecycle');
    }

    // Optimistic Concurrency Check
    if (room.revision !== expectedRevision) {
      throw new RoomConflictError();
    }

    const currentStatus = room.status.toUpperCase();
    let nextStatus: string;
    const now = new Date();
    let publishedAt: Date | undefined;
    let closedAt: Date | null | undefined;
    let archivedAt: Date | null | undefined;

    switch (action) {
      case 'PUBLISH':
        if (currentStatus !== 'DRAFT') {
          throw new RoomValidationError(`Cannot publish room in status ${currentStatus}`);
        }
        nextStatus = 'OPEN';
        publishedAt = now;
        break;

      case 'CLOSE':
        if (currentStatus !== 'OPEN') {
          throw new RoomValidationError(`Cannot close room in status ${currentStatus}`);
        }
        nextStatus = 'CLOSED';
        closedAt = now;
        break;

      case 'REOPEN':
        if (currentStatus !== 'CLOSED') {
          throw new RoomValidationError(`Cannot reopen room in status ${currentStatus}`);
        }
        nextStatus = 'OPEN';
        closedAt = null;
        break;

      case 'ARCHIVE':
        if (currentStatus !== 'CLOSED') {
          throw new RoomValidationError('Room must be CLOSED before it can be ARCHIVED');
        }
        nextStatus = 'ARCHIVED';
        archivedAt = now;
        break;

      case 'RESTORE':
        if (currentStatus !== 'ARCHIVED') {
          throw new RoomValidationError('Only ARCHIVED rooms can be restored');
        }
        nextStatus = 'CLOSED';
        archivedAt = null;
        break;

      default:
        throw new RoomValidationError(`Invalid lifecycle action: ${action}`);
    }

    const result = await prisma.$transaction(async (tx) => {
      // If closing room, evict all active leases and participant presence records
      if (action === 'CLOSE') {
        await tx.roomLease.deleteMany({
          where: { studyRoomId: room.id },
        });
        await tx.roomParticipant.deleteMany({
          where: { studyRoomId: room.id },
        });
      }

      const updated = await tx.studyRoom.update({
        where: { id: room.id },
        data: {
          status: nextStatus,
          publishedAt: publishedAt !== undefined ? publishedAt : undefined,
          closedAt: closedAt !== undefined ? closedAt : undefined,
          archivedAt: archivedAt !== undefined ? archivedAt : undefined,
          onlineCount: action === 'CLOSE' ? 0 : undefined,
          revision: { increment: 1 },
        },
      });

      await tx.roomAuditLog.create({
        data: {
          studyRoomId: room.id,
          actorId: userId,
          action: 'LIFECYCLE_CHANGED',
          clientRequestId: requestId || null,
          details: {
            from: currentStatus,
            to: nextStatus,
            lifecycleAction: action,
            newRevision: updated.revision,
          },
        },
      });

      return updated;
    });

    return {
      id: result.id,
      slug: result.slug || result.id,
      status: result.status as RoomStatus,
      revision: result.revision,
      occurredAt: now.toISOString(),
    };
  },

  /**
   * Room preview/bootstrap safe metadata and capabilities.
   */
  async getRoomBootstrap(roomSlugOrId: string, userId: string | null): Promise<RoomBootstrapResponse> {
    const room = await prisma.studyRoom.findFirst({
      where: {
        OR: [{ id: roomSlugOrId }, { slug: roomSlugOrId }],
      },
      include: {
        owner: {
          select: { id: true, name: true, username: true },
        },
        cohort: {
          select: { id: true, title: true, visibility: true },
        },
      },
    });

    if (!room) {
      throw new RoomNotFoundError();
    }

    // Active lease check for viewer
    let activeLease: { expiresAt: Date; generation: number } | null = null;
    if (userId) {
      activeLease = await prisma.roomLease.findFirst({
        where: {
          studyRoomId: room.id,
          userId,
          expiresAt: { gt: new Date() },
        },
        select: { expiresAt: true, generation: true },
      });
    }

    const roleRes = await studyroomPolicy.resolveUserRoomRole(room as unknown as RoomEntity, userId);
    const capabilities = await studyroomPolicy.evaluateCapabilities(
      room as unknown as RoomEntity,
      userId,
      null,
      Boolean(activeLease)
    );

    // Unlisted room isolation check: if unlisted and user is not owner/controller, throw 404
    if (room.listing === 'UNLISTED') {
      const isManager = roleRes.isOwner || roleRes.isPlatformAdmin || roleRes.role === 'MODERATOR';
      if (!isManager && !activeLease && !userId) {
        throw new RoomNotFoundError();
      }
    }

    // Pending ownership transfer check for recipient
    let pendingTransfer: OwnershipTransferDTO | null = null;
    if (userId && prisma.roomOwnershipTransfer?.findFirst) {
      const transfer = await prisma.roomOwnershipTransfer.findFirst({
        where: {
          studyRoomId: room.id,
          recipientId: userId,
          status: 'PENDING',
          expiresAt: { gt: new Date() },
        },
        include: {
          recipient: { select: { id: true, name: true, username: true } },
        },
      });
      if (transfer) {
        pendingTransfer = {
          id: transfer.id,
          studyRoomId: transfer.studyRoomId,
          senderId: transfer.senderId,
          recipientId: transfer.recipientId,
          recipientName: transfer.recipient?.name || transfer.recipient?.username || null,
          status: transfer.status as TransferStatus,
          expectedRevision: transfer.expectedRevision,
          expiresAt: transfer.expiresAt.toISOString(),
          createdAt: transfer.createdAt.toISOString(),
        };
      }
    }

    return {
      room: {
        id: room.id,
        slug: room.slug || room.id,
        title: room.title,
        description: room.description,
        thumbnail: room.thumbnail,
        visualPresetId: room.visualPresetId,
        status: room.status as RoomStatus,
        listing: room.listing as RoomListing,
        scopeKind: room.cohortId ? 'COHORT' : 'STANDALONE',
        cohortId: room.cohortId,
        cohortTitle: room.cohort?.title || null,
        capacity: room.capacity,
        onlineCount: room.onlineCount,
        rules: room.rules,
        tags: room.tags,
        language: room.language,
        revision: room.revision,
        ownerId: room.ownerId || '',
        ownerName: room.owner?.name || null,
        ownerUsername: room.owner?.username || null,
        createdAt: room.createdAt.toISOString(),
      },
      viewer: {
        userId,
        role: roleRes.role,
        isJoined: Boolean(activeLease),
        leaseExpiresAt: activeLease?.expiresAt.toISOString() || null,
        generation: activeLease?.generation || null,
      },
      capabilities,
      pendingTransfer,
    };
  },
};
