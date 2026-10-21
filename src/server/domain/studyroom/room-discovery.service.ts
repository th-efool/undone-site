import 'server-only';
import { prisma } from '@/src/server/infrastructure/db/postgres/client';
import type { Prisma } from '@/generated/prisma/client';
import {
  type StudyRoomDiscoveryQuery,
  type StudyRoomDiscoveryResponse,
  type StudyRoomCardDTO,
  type RoomStatus,
  type RoomListing,
  type RoomScopeKind,
} from '@/src/shared/studyroom/contracts';

export const roomDiscoveryService = {
  /**
   * Retrieves discoverable study rooms with tabs, search, filtering, and cursor pagination.
   */
  async discoverRooms(
    query: StudyRoomDiscoveryQuery,
    userId: string | null
  ): Promise<StudyRoomDiscoveryResponse> {
    const {
      tab = 'discover',
      query: searchKeyword,
      cohortId,
      tag,
      language,
      availableOnly = false,
      cursor,
      limit = 12,
    } = query;

    const safeLimit = Math.min(Math.max(limit, 1), 50);

    // 1. Resolve user's accessible cohort IDs
    let userCohortIds: string[] = [];
    if (userId) {
      const memberships =
        (await prisma.cohortMember.findMany({
          where: { userId },
          select: { cohortId: true },
        })) || [];
      userCohortIds = memberships.map((m) => m.cohortId);
    }

    // 2. Build Where Clauses based on Tab and Visibility
    const whereConditions: Prisma.StudyRoomWhereInput[] = [];

    // Exclude archived rooms from general discovery
    if (tab !== 'my-rooms') {
      whereConditions.push({ status: 'OPEN' });
      whereConditions.push({ listing: 'LISTED' });
    } else {
      whereConditions.push({ status: { not: 'ARCHIVED' } });
    }

    // Tab-specific scoping
    if (tab === 'discover') {
      if (userCohortIds.length > 0) {
        whereConditions.push({
          OR: [
            { cohortId: null },
            { cohortId: { in: userCohortIds } },
          ],
        });
      } else {
        whereConditions.push({ cohortId: null });
      }
    } else if (tab === 'cohorts') {
      if (!userId || userCohortIds.length === 0) {
        return { rooms: [], nextCursor: null, totalEstimatedCount: 0 };
      }
      whereConditions.push({ cohortId: { in: userCohortIds } });
    } else if (tab === 'my-rooms') {
      if (!userId) {
        return { rooms: [], nextCursor: null, totalEstimatedCount: 0 };
      }
      whereConditions.push({
        OR: [
          { ownerId: userId },
          { controllers: { some: { userId } } },
        ],
      });
    } else if (tab === 'recent') {
      if (!userId) {
        return { rooms: [], nextCursor: null, totalEstimatedCount: 0 };
      }

      // Find rooms where user has had leases or participant presence
      const recentPresence = await prisma.roomParticipant.findMany({
        where: { userId },
        select: { studyRoomId: true },
        take: 50,
      });

      const recentLeases = await prisma.roomLease.findMany({
        where: { userId },
        select: { studyRoomId: true },
        take: 50,
      });

      const recentRoomIds = Array.from(
        new Set([...recentPresence.map((p) => p.studyRoomId), ...recentLeases.map((l) => l.studyRoomId)])
      );

      if (recentRoomIds.length === 0) {
        return { rooms: [], nextCursor: null, totalEstimatedCount: 0 };
      }

      whereConditions.push({ id: { in: recentRoomIds } });
      if (userCohortIds.length > 0) {
        whereConditions.push({
          OR: [
            { cohortId: null },
            { cohortId: { in: userCohortIds } },
          ],
        });
      } else {
        whereConditions.push({ cohortId: null });
      }
    }

    // 3. Search Keyword
    if (searchKeyword && searchKeyword.trim()) {
      const trimmed = searchKeyword.trim();
      whereConditions.push({
        OR: [
          { title: { contains: trimmed, mode: 'insensitive' } },
          { description: { contains: trimmed, mode: 'insensitive' } },
        ],
      });
    }

    // 4. Cohort Filter
    if (cohortId) {
      // Security: if user requests specific cohort, ensure they are enrolled or cohort is public
      if (!userCohortIds.includes(cohortId)) {
        const publicCohort = await prisma.cohort.findFirst({
          where: { id: cohortId, visibility: 'PUBLIC' },
          select: { id: true },
        });
        if (!publicCohort) {
          return { rooms: [], nextCursor: null, totalEstimatedCount: 0 };
        }
      }
      whereConditions.push({ cohortId });
    }

    // 5. Tag Filter
    if (tag && tag.trim()) {
      whereConditions.push({ tags: { has: tag.trim() } });
    }

    // 6. Language Filter
    if (language && language.trim()) {
      whereConditions.push({ language: language.trim().toLowerCase() });
    }

    const where = whereConditions.length > 0 ? { AND: whereConditions } : {};

    // 7. Query Database with deterministic ordering
    const rooms = await prisma.studyRoom.findMany({
      where,
      take: safeLimit + 1,
      skip: cursor ? 1 : 0,
      cursor: cursor ? { id: cursor } : undefined,
      orderBy: [
        { onlineCount: 'desc' },
        { createdAt: 'desc' },
        { id: 'asc' },
      ],
      include: {
        owner: {
          select: { id: true, name: true, username: true, image: true },
        },
        cohort: {
          select: { id: true, title: true },
        },
      },
    });

    let nextCursor: string | null = null;
    if (rooms.length > safeLimit) {
      const nextItem = rooms.pop();
      nextCursor = nextItem?.id || null;
    }

    // 8. Transform to Safe DTO
    let results: StudyRoomCardDTO[] = rooms.map((r) => ({
      id: r.id,
      slug: r.slug || r.id,
      title: r.title,
      description: r.description,
      thumbnail: r.thumbnail,
      visualPresetId: r.visualPresetId,
      status: r.status as RoomStatus,
      listing: r.listing as RoomListing,
      scopeKind: (r.cohortId ? 'COHORT' : 'STANDALONE') as RoomScopeKind,
      cohortId: r.cohortId,
      cohortTitle: r.cohort?.title || null,
      owner: {
        id: r.owner?.id || r.ownerId || '',
        name: r.owner?.name || null,
        username: r.owner?.username || null,
        image: r.owner?.image || null,
      },
      onlineCount: r.onlineCount,
      capacity: r.capacity,
      tags: r.tags,
      language: r.language,
      createdAt: r.createdAt.toISOString(),
      updatedAt: r.updatedAt.toISOString(),
    }));

    // 9. Post-filter for availableOnly if requested
    if (availableOnly) {
      results = results.filter((r) => r.onlineCount < r.capacity);
    }

    return {
      rooms: results,
      nextCursor,
      totalEstimatedCount: results.length,
    };
  },

  /**
   * Retrieves cohorts where the user has creator/moderator authority to create rooms.
   */
  async getEligibleCohortsForCreation(userId: string): Promise<Array<{ id: string; title: string }>> {
    const memberships = await prisma.cohortMember.findMany({
      where: {
        userId,
        role: { in: ['CREATOR', 'MODERATOR'] },
      },
      include: {
        cohort: { select: { id: true, title: true } },
      },
      orderBy: { joinedAt: 'desc' },
    });

    const ownedCohorts = await prisma.cohort.findMany({
      where: { creatorId: userId },
      select: { id: true, title: true },
      orderBy: { createdAt: 'desc' },
    });

    const combinedMap = new Map<string, string>();
    memberships.forEach((m) => {
      if (m.cohort) combinedMap.set(m.cohort.id, m.cohort.title);
    });
    ownedCohorts.forEach((c) => {
      combinedMap.set(c.id, c.title);
    });

    return Array.from(combinedMap.entries()).map(([id, title]) => ({ id, title }));
  },
};
