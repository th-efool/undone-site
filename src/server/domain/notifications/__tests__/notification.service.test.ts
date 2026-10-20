import { describe, expect, it, vi, beforeEach } from 'vitest';
import { notificationService } from '../notification.service';
import { prisma } from '@/src/server/infrastructure/db/postgres/client';

vi.mock('server-only', () => ({}));

vi.mock('@/src/server/infrastructure/db/postgres/client', () => {
  const mockNotification = {
    create: vi.fn(),
    findMany: vi.fn(),
    count: vi.fn(),
    updateMany: vi.fn(),
  };

  const mockNotificationPreference = {
    findUnique: vi.fn(),
    upsert: vi.fn(),
  };

  const mockPushSubscription = {
    upsert: vi.fn(),
    deleteMany: vi.fn(),
  };

  return {
    prisma: {
      notification: mockNotification,
      notificationPreference: mockNotificationPreference,
      pushSubscription: mockPushSubscription,
    },
  };
});

describe('Phase 9: Notification Domain Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('createNotification', () => {
    it('creates notification when user has not muted scope', async () => {
      vi.mocked(prisma.notificationPreference.findUnique).mockResolvedValueOnce({
        userId: 'user-recip',
        mutedScopes: [],
        mentionOnly: false,
      } as any);

      vi.mocked(prisma.notification.create).mockResolvedValueOnce({
        id: 'notif-1',
        userId: 'user-recip',
        actorId: 'user-actor',
        scopeType: 'channel',
        scopeId: 'ch-1',
        type: 'mention',
        title: 'New mention',
        body: 'Hello @user',
        isRead: false,
        readAt: null,
        createdAt: new Date(),
        actor: { name: 'Actor', username: 'actor', image: '/img.png' },
      } as any);

      const notif = await notificationService.createNotification({
        userId: 'user-recip',
        actorId: 'user-actor',
        scopeType: 'channel',
        scopeId: 'ch-1',
        type: 'mention',
        title: 'New mention',
        body: 'Hello @user',
      });

      expect(notif).not.toBeNull();
      expect(notif?.id).toBe('notif-1');
      expect(notif?.actorName).toBe('Actor');
    });

    it('suppresses notification if actor is recipient (no self notifications)', async () => {
      const notif = await notificationService.createNotification({
        userId: 'user-self',
        actorId: 'user-self',
        scopeType: 'channel',
        scopeId: 'ch-1',
        type: 'reply',
        title: 'Self action',
        body: 'Text',
      });

      expect(notif).toBeNull();
      expect(prisma.notification.create).not.toHaveBeenCalled();
    });

    it('suppresses notification if scope is in user mutedScopes', async () => {
      vi.mocked(prisma.notificationPreference.findUnique).mockResolvedValueOnce({
        userId: 'user-recip',
        mutedScopes: ['ch-muted'],
        mentionOnly: false,
      } as any);

      const notif = await notificationService.createNotification({
        userId: 'user-recip',
        actorId: 'user-actor',
        scopeType: 'channel',
        scopeId: 'ch-muted',
        type: 'message',
        title: 'Muted channel message',
        body: 'Hello',
      });

      expect(notif).toBeNull();
      expect(prisma.notification.create).not.toHaveBeenCalled();
    });

    it('suppresses non-mentions when mentionOnly preference is enabled', async () => {
      vi.mocked(prisma.notificationPreference.findUnique).mockResolvedValueOnce({
        userId: 'user-recip',
        mutedScopes: [],
        mentionOnly: true,
      } as any);

      const notif = await notificationService.createNotification({
        userId: 'user-recip',
        actorId: 'user-actor',
        scopeType: 'channel',
        scopeId: 'ch-1',
        type: 'group_message',
        title: 'Regular chat',
        body: 'Hello guys',
      });

      expect(notif).toBeNull();
      expect(prisma.notification.create).not.toHaveBeenCalled();
    });
  });

  describe('getUserNotifications & Read Receipts', () => {
    it('returns notifications and unread count', async () => {
      vi.mocked(prisma.notification.findMany).mockResolvedValueOnce([
        {
          id: 'notif-1',
          userId: 'user-1',
          actorId: 'user-2',
          scopeType: 'channel',
          scopeId: 'ch-1',
          entityId: 'msg-1',
          type: 'mention',
          title: 'Mention',
          body: 'Hello',
          isRead: false,
          readAt: null,
          createdAt: new Date(),
          actor: { name: 'Alice', image: null },
        },
      ] as any);

      vi.mocked(prisma.notification.count).mockResolvedValueOnce(1);

      const result = await notificationService.getUserNotifications('user-1');
      expect(result.notifications).toHaveLength(1);
      expect(result.unreadCount).toBe(1);
    });

    it('marks notification as read', async () => {
      vi.mocked(prisma.notification.updateMany).mockResolvedValueOnce({ count: 1 });

      const success = await notificationService.markNotificationRead('user-1', 'notif-1');
      expect(success).toBe(true);
      expect(prisma.notification.updateMany).toHaveBeenCalledWith({
        where: { id: 'notif-1', userId: 'user-1' },
        data: expect.objectContaining({ isRead: true }),
      });
    });

    it('marks all notifications read', async () => {
      vi.mocked(prisma.notification.updateMany).mockResolvedValueOnce({ count: 5 });

      const count = await notificationService.markAllRead('user-1');
      expect(count).toBe(5);
    });
  });

  describe('Preferences & Push Subscriptions', () => {
    it('updates notification preferences', async () => {
      vi.mocked(prisma.notificationPreference.upsert).mockResolvedValueOnce({
        userId: 'user-1',
        emailNotifications: false,
        pushNotifications: true,
        mentionOnly: true,
        mutedScopes: ['ch-mute-1'],
        updatedAt: new Date(),
      } as any);

      const pref = await notificationService.updatePreferences('user-1', {
        emailNotifications: false,
        mentionOnly: true,
        mutedScopes: ['ch-mute-1'],
      });

      expect(pref.emailNotifications).toBe(false);
      expect(pref.mentionOnly).toBe(true);
      expect(pref.mutedScopes).toContain('ch-mute-1');
    });

    it('subscribes and unsubscribes web push endpoint', async () => {
      vi.mocked(prisma.pushSubscription.upsert).mockResolvedValueOnce({} as any);

      await notificationService.subscribePush({
        userId: 'user-1',
        endpoint: 'https://push.example.com/sub/123',
        p256dh: 'p256-key',
        auth: 'auth-key',
      });

      expect(prisma.pushSubscription.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            userId_endpoint: {
              userId: 'user-1',
              endpoint: 'https://push.example.com/sub/123',
            },
          },
        })
      );

      vi.mocked(prisma.pushSubscription.deleteMany).mockResolvedValueOnce({ count: 1 });
      const unsub = await notificationService.unsubscribePush('user-1', 'https://push.example.com/sub/123');
      expect(unsub).toBe(true);
    });
  });
});
