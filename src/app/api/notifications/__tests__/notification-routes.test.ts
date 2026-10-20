import { describe, expect, it, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { GET as getNotifications } from '../route';
import { POST as markAllRead } from '../read-all/route';
import { POST as markSingleRead } from '../[id]/read/route';
import { GET as getPrefs, PUT as updatePrefs } from '../preferences/route';
import { POST as subscribePush, DELETE as unsubscribePush } from '../push/subscribe/route';
import { getUser } from '@/src/server/infrastructure/auth/getUser';
import { isSharedGuestAccount } from '@/src/server/infrastructure/auth/guestAccount';
import { notificationService } from '@/src/server/domain/notifications/notification.service';

vi.mock('server-only', () => ({}));

vi.mock('@/src/server/infrastructure/auth/getUser', () => ({
  getUser: vi.fn(),
}));

vi.mock('@/src/server/infrastructure/auth/guestAccount', () => ({
  isSharedGuestAccount: vi.fn(),
}));

vi.mock('@/src/server/domain/notifications/notification.service', () => ({
  notificationService: {
    getUserNotifications: vi.fn(),
    markAllRead: vi.fn(),
    markNotificationRead: vi.fn(),
    getPreferences: vi.fn(),
    updatePreferences: vi.fn(),
    subscribePush: vi.fn(),
    unsubscribePush: vi.fn(),
  },
}));

describe('Phase 9 Notification API Routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('GET /api/notifications', () => {
    it('returns notifications and unread count', async () => {
      vi.mocked(getUser).mockResolvedValueOnce({ id: 'user-1' } as any);
      vi.mocked(isSharedGuestAccount).mockReturnValueOnce(false);
      vi.mocked(notificationService.getUserNotifications).mockResolvedValueOnce({
        notifications: [
          {
            id: 'notif-1',
            userId: 'user-1',
            actorId: 'user-2',
            actorName: 'Bob',
            actorAvatar: null,
            scopeType: 'channel',
            scopeId: 'ch-1',
            entityId: 'msg-1',
            type: 'mention',
            title: 'Mention',
            body: 'Hello',
            isRead: false,
            readAt: null,
            createdAt: new Date().toISOString(),
          },
        ],
        unreadCount: 1,
      });

      const req = new NextRequest('http://localhost/api/notifications');
      const res = await getNotifications(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.unreadCount).toBe(1);
      expect(data.notifications).toHaveLength(1);
    });
  });

  describe('POST /api/notifications/read-all', () => {
    it('marks all as read and returns count', async () => {
      vi.mocked(getUser).mockResolvedValueOnce({ id: 'user-1' } as any);
      vi.mocked(isSharedGuestAccount).mockReturnValueOnce(false);
      vi.mocked(notificationService.markAllRead).mockResolvedValueOnce(3);

      const res = await markAllRead();
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.count).toBe(3);
    });
  });

  describe('Notification Preferences & Push', () => {
    it('GET /api/notifications/preferences returns user preferences', async () => {
      vi.mocked(getUser).mockResolvedValueOnce({ id: 'user-1' } as any);
      vi.mocked(isSharedGuestAccount).mockReturnValueOnce(false);
      vi.mocked(notificationService.getPreferences).mockResolvedValueOnce({
        userId: 'user-1',
        emailNotifications: true,
        pushNotifications: true,
        mentionOnly: false,
        mutedScopes: ['ch-mute'],
      });

      const res = await getPrefs();
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.mutedScopes).toContain('ch-mute');
    });

    it('POST /api/notifications/push/subscribe registers subscription', async () => {
      vi.mocked(getUser).mockResolvedValueOnce({ id: 'user-1' } as any);
      vi.mocked(isSharedGuestAccount).mockReturnValueOnce(false);

      const req = new NextRequest('http://localhost/api/notifications/push/subscribe', {
        method: 'POST',
        body: JSON.stringify({
          endpoint: 'https://push.example.com',
          p256dh: 'p256',
          auth: 'auth',
        }),
      });
      const res = await subscribePush(req);
      expect(res.status).toBe(201);
      const data = await res.json();
      expect(data.success).toBe(true);
    });
  });
});
