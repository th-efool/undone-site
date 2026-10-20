import 'server-only';
import { prisma } from '@/src/server/infrastructure/db/postgres/client';
import {
  type CreateNotificationInput,
  type NotificationDTO,
  type NotificationPreferenceDTO,
  type PushSubscriptionInput,
} from './contracts';

export const notificationService = {
  /**
   * Persists a durable in-app notification.
   * Checks recipient notification preferences and suppresses notifications if scope is muted.
   */
  async createNotification(input: CreateNotificationInput): Promise<NotificationDTO | null> {
    const { userId, actorId, scopeType, scopeId, entityId, type, title, body } = input;

    // Do not notify self
    if (actorId && actorId === userId) {
      return null;
    }

    // 1. Check recipient preferences
    const pref = await prisma.notificationPreference.findUnique({
      where: { userId },
    });

    const mutedScopes: string[] = Array.isArray(pref?.mutedScopes)
      ? (pref!.mutedScopes as string[])
      : [];

    // Suppress if scope is explicitly muted
    if (mutedScopes.includes(scopeId)) {
      return null;
    }

    // Suppress non-mentions if mentionOnly is enabled
    if (pref?.mentionOnly && type !== 'mention') {
      return null;
    }

    // 2. Persist notification
    const notification = await prisma.notification.create({
      data: {
        userId,
        actorId: actorId ?? null,
        scopeType,
        scopeId,
        entityId: entityId ?? null,
        type,
        title,
        body: body.slice(0, 200),
      },
      include: {
        actor: {
          select: { id: true, name: true, image: true, username: true },
        },
      },
    });

    return {
      id: notification.id,
      userId: notification.userId,
      actorId: notification.actorId,
      actorName: notification.actor?.name || notification.actor?.username || null,
      actorAvatar: notification.actor?.image || null,
      scopeType: notification.scopeType,
      scopeId: notification.scopeId,
      entityId: notification.entityId,
      type: notification.type,
      title: notification.title,
      body: notification.body,
      isRead: notification.isRead,
      readAt: notification.readAt ? notification.readAt.toISOString() : null,
      createdAt: notification.createdAt.toISOString(),
    };
  },

  /**
   * Retrieves user's in-app notifications and unread count.
   */
  async getUserNotifications(
    userId: string,
    limit = 50
  ): Promise<{ notifications: NotificationDTO[]; unreadCount: number }> {
    const [rawList, unreadCount] = await Promise.all([
      prisma.notification.findMany({
        where: { userId },
        include: {
          actor: {
            select: { id: true, name: true, image: true, username: true },
          },
        },
        orderBy: { createdAt: 'desc' },
        take: limit,
      }),
      prisma.notification.count({
        where: { userId, isRead: false },
      }),
    ]);

    const notifications: NotificationDTO[] = rawList.map((n) => ({
      id: n.id,
      userId: n.userId,
      actorId: n.actorId,
      actorName: n.actor?.name || n.actor?.username || null,
      actorAvatar: n.actor?.image || null,
      scopeType: n.scopeType,
      scopeId: n.scopeId,
      entityId: n.entityId,
      type: n.type,
      title: n.title,
      body: n.body,
      isRead: n.isRead,
      readAt: n.readAt ? n.readAt.toISOString() : null,
      createdAt: n.createdAt.toISOString(),
    }));

    return { notifications, unreadCount };
  },

  /**
   * Marks a single notification as read.
   */
  async markNotificationRead(userId: string, notificationId: string): Promise<boolean> {
    const count = await prisma.notification.updateMany({
      where: { id: notificationId, userId },
      data: { isRead: true, readAt: new Date() },
    });
    return count.count > 0;
  },

  /**
   * Marks all notifications as read for a user.
   */
  async markAllRead(userId: string): Promise<number> {
    const result = await prisma.notification.updateMany({
      where: { userId, isRead: false },
      data: { isRead: true, readAt: new Date() },
    });
    return result.count;
  },

  /**
   * Gets or creates default notification preferences for a user.
   */
  async getPreferences(userId: string): Promise<NotificationPreferenceDTO> {
    const pref = await prisma.notificationPreference.findUnique({
      where: { userId },
    });

    if (!pref) {
      return {
        userId,
        emailNotifications: true,
        pushNotifications: true,
        mentionOnly: false,
        mutedScopes: [],
      };
    }

    return {
      userId: pref.userId,
      emailNotifications: pref.emailNotifications,
      pushNotifications: pref.pushNotifications,
      mentionOnly: pref.mentionOnly,
      mutedScopes: Array.isArray(pref.mutedScopes) ? (pref.mutedScopes as string[]) : [],
    };
  },

  /**
   * Updates notification preferences for a user.
   */
  async updatePreferences(
    userId: string,
    updates: Partial<Omit<NotificationPreferenceDTO, 'userId'>>
  ): Promise<NotificationPreferenceDTO> {
    const data: any = {};
    if (updates.emailNotifications !== undefined) data.emailNotifications = updates.emailNotifications;
    if (updates.pushNotifications !== undefined) data.pushNotifications = updates.pushNotifications;
    if (updates.mentionOnly !== undefined) data.mentionOnly = updates.mentionOnly;
    if (updates.mutedScopes !== undefined) data.mutedScopes = updates.mutedScopes;

    const pref = await prisma.notificationPreference.upsert({
      where: { userId },
      create: {
        userId,
        emailNotifications: updates.emailNotifications ?? true,
        pushNotifications: updates.pushNotifications ?? true,
        mentionOnly: updates.mentionOnly ?? false,
        mutedScopes: updates.mutedScopes ?? [],
      },
      update: data,
    });

    return {
      userId: pref.userId,
      emailNotifications: pref.emailNotifications,
      pushNotifications: pref.pushNotifications,
      mentionOnly: pref.mentionOnly,
      mutedScopes: Array.isArray(pref.mutedScopes) ? (pref.mutedScopes as string[]) : [],
    };
  },

  /**
   * Registers a web push device subscription.
   */
  async subscribePush(input: PushSubscriptionInput): Promise<void> {
    const { userId, endpoint, p256dh, auth, userAgent } = input;

    await prisma.pushSubscription.upsert({
      where: {
        userId_endpoint: {
          userId,
          endpoint,
        },
      },
      create: {
        userId,
        endpoint,
        p256dh,
        auth,
        userAgent: userAgent ?? null,
      },
      update: {
        p256dh,
        auth,
        userAgent: userAgent ?? null,
        updatedAt: new Date(),
      },
    });
  },

  /**
   * Unregisters a web push subscription endpoint.
   */
  async unsubscribePush(userId: string, endpoint: string): Promise<boolean> {
    const deleted = await prisma.pushSubscription.deleteMany({
      where: { userId, endpoint },
    });
    return deleted.count > 0;
  },
};
