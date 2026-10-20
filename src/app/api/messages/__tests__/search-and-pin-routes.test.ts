import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { GET as searchMessages } from '../search/route';
import { POST as setPin } from '../[messageId]/pin/route';
import { POST as setAnnouncement } from '../[messageId]/announcement/route';
import { GET as getPins } from '../../channels/[channelId]/pins/route';
import { getUser } from '@/src/server/infrastructure/auth/getUser';
import { searchService } from '@/src/server/domain/messaging/search.service';
import { moderationService } from '@/src/server/domain/messaging/moderation.service';

vi.mock('@/src/server/infrastructure/auth/getUser', () => ({
  getUser: vi.fn(),
}));

vi.mock('@/src/server/infrastructure/auth/guestAccount', () => ({
  isSharedGuestAccount: vi.fn((user) => user?.id === 'guest-user'),
}));

vi.mock('@/src/server/domain/messaging/search.service', () => ({
  searchService: {
    searchMessages: vi.fn(),
  },
}));

vi.mock('@/src/server/domain/messaging/moderation.service', () => ({
  moderationService: {
    setPinState: vi.fn(),
    setAnnouncementState: vi.fn(),
    getChannelPins: vi.fn(),
  },
}));

describe('Search and Pin/Announcement API Routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('GET /api/messages/search', () => {
    it('returns 401 when unauthorized', async () => {
      vi.mocked(getUser).mockResolvedValueOnce(null);
      const req = new NextRequest('http://localhost/api/messages/search?q=test');
      const res = await searchMessages(req);
      expect(res.status).toBe(401);
    });

    it('returns search results for authorized user', async () => {
      vi.mocked(getUser).mockResolvedValueOnce({ id: 'user-1' } as any);
      vi.mocked(searchService.searchMessages).mockResolvedValueOnce({
        messages: [{ id: 'msg-1', content: 'test content' }] as any,
        nextCursor: null,
      });

      const req = new NextRequest('http://localhost/api/messages/search?q=test');
      const res = await searchMessages(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.messages).toHaveLength(1);
    });
  });

  describe('POST /api/messages/[messageId]/pin', () => {
    it('sets pin state via moderation service', async () => {
      vi.mocked(getUser).mockResolvedValueOnce({ id: 'mod-1' } as any);
      vi.mocked(moderationService.setPinState).mockResolvedValueOnce({
        id: 'msg-1',
        isPinned: true,
      } as any);

      const req = new NextRequest('http://localhost/api/messages/msg-1/pin', {
        method: 'POST',
        body: JSON.stringify({ isPinned: true, reason: 'Important message' }),
      });
      const res = await setPin(req, { params: Promise.resolve({ messageId: 'msg-1' }) });
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.isPinned).toBe(true);
    });
  });

  describe('POST /api/messages/[messageId]/announcement', () => {
    it('sets announcement state via moderation service', async () => {
      vi.mocked(getUser).mockResolvedValueOnce({ id: 'mod-1' } as any);
      vi.mocked(moderationService.setAnnouncementState).mockResolvedValueOnce({
        id: 'msg-2',
        isAnnouncement: true,
      } as any);

      const req = new NextRequest('http://localhost/api/messages/msg-2/announcement', {
        method: 'POST',
        body: JSON.stringify({ isAnnouncement: true }),
      });
      const res = await setAnnouncement(req, { params: Promise.resolve({ messageId: 'msg-2' }) });
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.isAnnouncement).toBe(true);
    });
  });

  describe('GET /api/channels/[channelId]/pins', () => {
    it('retrieves pinned messages in channel', async () => {
      vi.mocked(getUser).mockResolvedValueOnce({ id: 'user-1' } as any);
      vi.mocked(moderationService.getChannelPins).mockResolvedValueOnce([
        { id: 'pin-1', isPinned: true },
      ] as any);

      const req = new NextRequest('http://localhost/api/channels/ch-1/pins');
      const res = await getPins(req, { params: Promise.resolve({ channelId: 'ch-1' }) });
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data).toHaveLength(1);
    });
  });
});
