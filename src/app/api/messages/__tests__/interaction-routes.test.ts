import { describe, expect, it, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { POST as postReadWatermark } from '@/src/app/api/community/channels/[channelId]/read/route';
import { POST as postPreferences } from '@/src/app/api/community/channels/[channelId]/preferences/route';
import { POST as postTyping } from '@/src/app/api/community/channels/[channelId]/typing/route';
import { POST as postReaction, DELETE as deleteReaction } from '@/src/app/api/messages/[messageId]/reactions/route';
import { PATCH as patchMessage, DELETE as deleteMessage } from '@/src/app/api/messages/[messageId]/route';
import { getUser } from '@/src/server/infrastructure/auth/getUser';
import { isSharedGuestAccount } from '@/src/server/infrastructure/auth/guestAccount';
import { interactionService } from '@/src/server/domain/messaging/interaction.service';
import { presenceService } from '@/src/server/domain/messaging/presence.service';

vi.mock('server-only', () => ({}));

vi.mock('@/src/server/infrastructure/auth/getUser', () => ({
  getUser: vi.fn(),
}));

vi.mock('@/src/server/infrastructure/auth/guestAccount', () => ({
  isSharedGuestAccount: vi.fn(),
}));

vi.mock('@/src/server/domain/messaging/interaction.service', () => ({
  interactionService: {
    updateReadWatermark: vi.fn(),
    updateChannelPreferences: vi.fn(),
    toggleReaction: vi.fn(),
    editMessage: vi.fn(),
    deleteMessage: vi.fn(),
  },
}));

vi.mock('@/src/server/domain/messaging/presence.service', () => ({
  presenceService: {
    handleTypingSignal: vi.fn(),
  },
}));

describe('Phase 7 Messaging Interaction API Routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('POST /api/community/channels/[channelId]/read', () => {
    it('returns 401 when unauthorized', async () => {
      vi.mocked(getUser).mockResolvedValueOnce(null);
      const req = new NextRequest('http://localhost/api/community/channels/ch-1/read', {
        method: 'POST',
        body: JSON.stringify({ sequence: 10 }),
      });
      const res = await postReadWatermark(req, { params: Promise.resolve({ channelId: 'ch-1' }) });
      expect(res.status).toBe(401);
    });

    it('returns 403 for guest account', async () => {
      vi.mocked(getUser).mockResolvedValueOnce({ id: 'guest-1' } as any);
      vi.mocked(isSharedGuestAccount).mockReturnValueOnce(true);

      const req = new NextRequest('http://localhost/api/community/channels/ch-1/read', {
        method: 'POST',
        body: JSON.stringify({ sequence: 10 }),
      });
      const res = await postReadWatermark(req, { params: Promise.resolve({ channelId: 'ch-1' }) });
      expect(res.status).toBe(403);
    });

    it('advances watermark and returns updated state', async () => {
      vi.mocked(getUser).mockResolvedValueOnce({ id: 'user-1' } as any);
      vi.mocked(isSharedGuestAccount).mockReturnValueOnce(false);
      vi.mocked(interactionService.updateReadWatermark).mockResolvedValueOnce({
        channelId: 'ch-1',
        userId: 'user-1',
        lastReadSequence: 15,
        unreadCount: 0,
      });

      const req = new NextRequest('http://localhost/api/community/channels/ch-1/read', {
        method: 'POST',
        body: JSON.stringify({ sequence: 15 }),
      });
      const res = await postReadWatermark(req, { params: Promise.resolve({ channelId: 'ch-1' }) });
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.lastReadSequence).toBe(15);
      expect(body.unreadCount).toBe(0);
    });
  });

  describe('POST /api/community/channels/[channelId]/preferences', () => {
    it('updates channel isPinned and mutedUntil preferences', async () => {
      vi.mocked(getUser).mockResolvedValueOnce({ id: 'user-1' } as any);
      vi.mocked(isSharedGuestAccount).mockReturnValueOnce(false);
      vi.mocked(interactionService.updateChannelPreferences).mockResolvedValueOnce({
        channelId: 'ch-1',
        userId: 'user-1',
        isPinned: true,
        mutedUntil: '2026-10-21T10:00:00Z',
      });

      const req = new NextRequest('http://localhost/api/community/channels/ch-1/preferences', {
        method: 'POST',
        body: JSON.stringify({ isPinned: true, mutedUntil: '2026-10-21T10:00:00Z' }),
      });
      const res = await postPreferences(req, { params: Promise.resolve({ channelId: 'ch-1' }) });
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.isPinned).toBe(true);
    });
  });

  describe('POST /api/community/channels/[channelId]/typing', () => {
    it('handles typing signal broadcast', async () => {
      vi.mocked(getUser).mockResolvedValueOnce({ id: 'user-1' } as any);
      vi.mocked(isSharedGuestAccount).mockReturnValueOnce(false);
      vi.mocked(presenceService.handleTypingSignal).mockResolvedValueOnce({
        success: true,
        throttled: false,
      });

      const req = new NextRequest('http://localhost/api/community/channels/ch-1/typing', {
        method: 'POST',
        body: JSON.stringify({ isTyping: true }),
      });
      const res = await postTyping(req, { params: Promise.resolve({ channelId: 'ch-1' }) });
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.success).toBe(true);
    });
  });

  describe('POST /api/messages/[messageId]/reactions', () => {
    it('validates emoji payload and toggles reaction', async () => {
      vi.mocked(getUser).mockResolvedValueOnce({ id: 'user-1' } as any);
      vi.mocked(isSharedGuestAccount).mockReturnValueOnce(false);
      vi.mocked(interactionService.toggleReaction).mockResolvedValueOnce({
        messageId: 'msg-1',
        channelId: 'ch-1',
        emoji: '❤️',
        added: true,
        reactions: [{ emoji: '❤️', count: 1, reactedByMe: true }],
        revision: 2,
      });

      const req = new NextRequest('http://localhost/api/messages/msg-1/reactions', {
        method: 'POST',
        body: JSON.stringify({ emoji: '❤️' }),
      });
      const res = await postReaction(req, { params: Promise.resolve({ messageId: 'msg-1' }) });
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.added).toBe(true);
      expect(body.reactions[0].emoji).toBe('❤️');
    });

    it('rejects empty emoji with 400', async () => {
      vi.mocked(getUser).mockResolvedValueOnce({ id: 'user-1' } as any);
      vi.mocked(isSharedGuestAccount).mockReturnValueOnce(false);

      const req = new NextRequest('http://localhost/api/messages/msg-1/reactions', {
        method: 'POST',
        body: JSON.stringify({ emoji: '' }),
      });
      const res = await postReaction(req, { params: Promise.resolve({ messageId: 'msg-1' }) });
      expect(res.status).toBe(400);
    });
  });

  describe('PATCH /api/messages/[messageId]', () => {
    it('updates message content when revision matches', async () => {
      vi.mocked(getUser).mockResolvedValueOnce({ id: 'user-1' } as any);
      vi.mocked(isSharedGuestAccount).mockReturnValueOnce(false);
      vi.mocked(interactionService.editMessage).mockResolvedValueOnce({
        id: 'msg-1',
        content: 'Edited content',
        channelId: 'ch-1',
        authorId: 'user-1',
        messageSequence: 1,
        revision: 2,
        editedAt: new Date().toISOString(),
        deletedAt: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        author: { id: 'user-1', name: 'User' },
      } as any);

      const req = new NextRequest('http://localhost/api/messages/msg-1', {
        method: 'PATCH',
        body: JSON.stringify({ content: 'Edited content', expectedRevision: 1 }),
      });
      const res = await patchMessage(req, { params: Promise.resolve({ messageId: 'msg-1' }) });
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.content).toBe('Edited content');
      expect(body.revision).toBe(2);
    });
  });

  describe('DELETE /api/messages/[messageId]', () => {
    it('tombstones message and replaces content', async () => {
      vi.mocked(getUser).mockResolvedValueOnce({ id: 'user-1' } as any);
      vi.mocked(isSharedGuestAccount).mockReturnValueOnce(false);
      vi.mocked(interactionService.deleteMessage).mockResolvedValueOnce({
        id: 'msg-1',
        content: '[This message was deleted]',
        channelId: 'ch-1',
        authorId: 'user-1',
        messageSequence: 1,
        revision: 3,
        editedAt: null,
        deletedAt: new Date().toISOString(),
        deletionReason: 'Redundant',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        author: { id: 'user-1', name: 'User' },
      } as any);

      const req = new NextRequest('http://localhost/api/messages/msg-1', {
        method: 'DELETE',
        body: JSON.stringify({ reason: 'Redundant' }),
      });
      const res = await deleteMessage(req, { params: Promise.resolve({ messageId: 'msg-1' }) });
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.content).toBe('[This message was deleted]');
      expect(body.deletedAt).not.toBeNull();
    });
  });
});
