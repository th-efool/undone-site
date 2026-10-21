import { describe, expect, it, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { GET as getConversations, POST as postConversations } from '../route';
import { POST as leaveGroup } from '../[id]/leave/route';
import { GET as searchPeople } from '@/src/app/api/people/route';
import { POST as blockUser, DELETE as unblockUser } from '@/src/app/api/blocks/route';
import { POST as reportMessage } from '@/src/app/api/reports/route';
import { getUser } from '@/src/server/infrastructure/auth/getUser';
import { isSharedGuestAccount } from '@/src/server/infrastructure/auth/guestAccount';
import { conversationService } from '@/src/server/domain/messaging/conversation.service';

import { prisma } from '@/src/server/infrastructure/db/postgres/client';

vi.mock('server-only', () => ({}));

vi.mock('@/src/server/infrastructure/db/postgres/client', () => ({
  prisma: {
    user: {
      findFirst: vi.fn(),
    },
  },
}));

vi.mock('@/src/server/infrastructure/auth/getUser', () => ({
  getUser: vi.fn(),
}));

vi.mock('@/src/server/infrastructure/auth/guestAccount', () => ({
  isSharedGuestAccount: vi.fn(),
}));

vi.mock('@/src/server/domain/messaging/conversation.service', () => ({
  conversationService: {
    getUserConversations: vi.fn(),
    createDirectConversation: vi.fn(),
    createGroupConversation: vi.fn(),
    leaveGroup: vi.fn(),
    searchPeople: vi.fn(),
    blockUser: vi.fn(),
    unblockUser: vi.fn(),
    reportMessage: vi.fn(),
  },
}));

describe('Phase 6 Conversations & People API Routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('GET /api/conversations', () => {
    it('returns 401 when unauthorized', async () => {
      vi.mocked(getUser).mockResolvedValueOnce(null);

      const res = await getConversations();
      expect(res.status).toBe(401);
    });

    it('returns empty array for guest accounts', async () => {
      vi.mocked(getUser).mockResolvedValueOnce({ id: 'guest-1' } as any);
      vi.mocked(isSharedGuestAccount).mockReturnValueOnce(true);

      const res = await getConversations();
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data).toEqual([]);
      expect(conversationService.getUserConversations).not.toHaveBeenCalled();
    });

    it('returns user conversations with private no-store headers', async () => {
      vi.mocked(getUser).mockResolvedValueOnce({ id: 'user-1' } as any);
      vi.mocked(isSharedGuestAccount).mockReturnValueOnce(false);
      vi.mocked(conversationService.getUserConversations).mockResolvedValueOnce([
        {
          id: 'conv-1',
          kind: 'DIRECT',
          title: 'Bob',
          channelId: 'chan-1',
          unreadCount: 0,
          participantCount: 2,
          accessGeneration: 1,
          updatedAt: new Date().toISOString(),
        },
      ]);

      const res = await getConversations();
      expect(res.status).toBe(200);
      expect(res.headers.get('Cache-Control')).toBe('private, no-store');
      const data = await res.json();
      expect(data).toHaveLength(1);
      expect(data[0].id).toBe('conv-1');
    });
  });

  describe('POST /api/conversations', () => {
    it('returns 403 for guest account attempting creation', async () => {
      vi.mocked(getUser).mockResolvedValueOnce({ id: 'guest-1' } as any);
      vi.mocked(isSharedGuestAccount).mockReturnValueOnce(true);

      const req = new NextRequest('http://localhost/api/conversations', {
        method: 'POST',
        body: JSON.stringify({ kind: 'DIRECT', recipientId: 'user-2' }),
      });

      const res = await postConversations(req);
      expect(res.status).toBe(403);
    });

    it('creates direct conversation and returns 201/200', async () => {
      vi.mocked(getUser).mockResolvedValueOnce({ id: 'user-1' } as any);
      vi.mocked(isSharedGuestAccount).mockReturnValueOnce(false);
      vi.mocked(conversationService.createDirectConversation).mockResolvedValueOnce({
        conversationId: 'conv-1',
        channelId: 'chan-1',
        kind: 'DIRECT',
        directKey: 'user-1:user-2',
        recipient: { id: 'user-2', name: 'Bob', image: null, username: 'bob' },
        isExisting: false,
      });

      const req = new NextRequest('http://localhost/api/conversations', {
        method: 'POST',
        body: JSON.stringify({ kind: 'DIRECT', recipientId: 'user-2' }),
      });

      const res = await postConversations(req);
      expect(res.status).toBe(201);
      const data = await res.json();
      expect(data.conversationId).toBe('conv-1');
    });

    it('creates direct conversation resolving recipientUsername', async () => {
      vi.mocked(getUser).mockResolvedValueOnce({ id: 'user-1' } as any);
      vi.mocked(isSharedGuestAccount).mockReturnValueOnce(false);
      vi.mocked(prisma.user.findFirst).mockResolvedValueOnce({ id: 'user-2' } as any);
      vi.mocked(conversationService.createDirectConversation).mockResolvedValueOnce({
        conversationId: 'conv-1',
        channelId: 'chan-1',
        kind: 'DIRECT',
        directKey: 'user-1:user-2',
        recipient: { id: 'user-2', name: 'Bob', image: null, username: 'bob' },
        isExisting: false,
      });

      const req = new NextRequest('http://localhost/api/conversations', {
        method: 'POST',
        body: JSON.stringify({ kind: 'DIRECT', recipientUsername: '@bob' }),
      });

      const res = await postConversations(req);
      expect(res.status).toBe(201);
      expect(prisma.user.findFirst).toHaveBeenCalledWith({
        where: {
          username: {
            equals: 'bob',
            mode: 'insensitive',
          },
        },
        select: { id: true },
      });
      expect(conversationService.createDirectConversation).toHaveBeenCalledWith('user-1', 'user-2');
    });

    it('returns 404 when recipientUsername is not found', async () => {
      vi.mocked(getUser).mockResolvedValueOnce({ id: 'user-1' } as any);
      vi.mocked(isSharedGuestAccount).mockReturnValueOnce(false);
      vi.mocked(prisma.user.findFirst).mockResolvedValueOnce(null);

      const req = new NextRequest('http://localhost/api/conversations', {
        method: 'POST',
        body: JSON.stringify({ kind: 'DIRECT', recipientUsername: '@nonexistent' }),
      });

      const res = await postConversations(req);
      expect(res.status).toBe(404);
      const data = await res.json();
      expect(data.error).toMatch(/not found/);
    });

    it('creates group conversation and returns 201', async () => {
      vi.mocked(getUser).mockResolvedValueOnce({ id: 'user-1' } as any);
      vi.mocked(isSharedGuestAccount).mockReturnValueOnce(false);
      vi.mocked(conversationService.createGroupConversation).mockResolvedValueOnce({
        conversationId: 'group-1',
        channelId: 'chan-group-1',
        kind: 'GROUP',
        title: 'Project Alpha',
        creatorId: 'user-1',
        participantCount: 3,
      });

      const req = new NextRequest('http://localhost/api/conversations', {
        method: 'POST',
        body: JSON.stringify({
          kind: 'GROUP',
          title: 'Project Alpha',
          participantIds: ['user-2', 'user-3'],
        }),
      });

      const res = await postConversations(req);
      expect(res.status).toBe(201);
      const data = await res.json();
      expect(data.title).toBe('Project Alpha');
    });
  });

  describe('POST /api/conversations/[id]/leave', () => {
    it('calls leaveGroup and returns success', async () => {
      vi.mocked(getUser).mockResolvedValueOnce({ id: 'user-2' } as any);
      vi.mocked(isSharedGuestAccount).mockReturnValueOnce(false);
      vi.mocked(conversationService.leaveGroup).mockResolvedValueOnce({ success: true });

      const req = new Request('http://localhost/api/conversations/group-1/leave', {
        method: 'POST',
      });

      const res = await leaveGroup(req, { params: Promise.resolve({ id: 'group-1' }) });
      expect(res.status).toBe(200);
      expect(conversationService.leaveGroup).toHaveBeenCalledWith('group-1', 'user-2');
    });
  });

  describe('GET /api/people', () => {
    it('searches people with query and limit parameters', async () => {
      vi.mocked(getUser).mockResolvedValueOnce({ id: 'user-1' } as any);
      vi.mocked(isSharedGuestAccount).mockReturnValueOnce(false);
      vi.mocked(conversationService.searchPeople).mockResolvedValueOnce([
        { id: 'user-2', name: 'Bob', image: null, username: 'bob' },
      ]);

      const req = new NextRequest('http://localhost/api/people?q=bob&limit=5');
      const res = await searchPeople(req);
      expect(res.status).toBe(200);
      expect(conversationService.searchPeople).toHaveBeenCalledWith('user-1', 'bob', 5);
      const data = await res.json();
      expect(data).toHaveLength(1);
    });
  });

  describe('POST & DELETE /api/blocks', () => {
    it('blocks user successfully', async () => {
      vi.mocked(getUser).mockResolvedValueOnce({ id: 'user-1' } as any);
      vi.mocked(isSharedGuestAccount).mockReturnValueOnce(false);
      vi.mocked(conversationService.blockUser).mockResolvedValueOnce({ success: true });

      const req = new NextRequest('http://localhost/api/blocks', {
        method: 'POST',
        body: JSON.stringify({ blockedId: 'user-bad' }),
      });

      const res = await blockUser(req);
      expect(res.status).toBe(200);
      expect(conversationService.blockUser).toHaveBeenCalledWith('user-1', 'user-bad');
    });

    it('unblocks user successfully', async () => {
      vi.mocked(getUser).mockResolvedValueOnce({ id: 'user-1' } as any);
      vi.mocked(isSharedGuestAccount).mockReturnValueOnce(false);
      vi.mocked(conversationService.unblockUser).mockResolvedValueOnce({ success: true });

      const req = new NextRequest('http://localhost/api/blocks?blockedId=user-bad', {
        method: 'DELETE',
      });

      const res = await unblockUser(req);
      expect(res.status).toBe(200);
      expect(conversationService.unblockUser).toHaveBeenCalledWith('user-1', 'user-bad');
    });
  });

  describe('POST /api/reports', () => {
    it('creates message report successfully', async () => {
      vi.mocked(getUser).mockResolvedValueOnce({ id: 'user-1' } as any);
      vi.mocked(isSharedGuestAccount).mockReturnValueOnce(false);
      vi.mocked(conversationService.reportMessage).mockResolvedValueOnce({ id: 'rep-1' });

      const req = new NextRequest('http://localhost/api/reports', {
        method: 'POST',
        body: JSON.stringify({ messageId: 'msg-123', reason: 'Spam content' }),
      });

      const res = await reportMessage(req);
      expect(res.status).toBe(201);
      const data = await res.json();
      expect(data.id).toBe('rep-1');
      expect(conversationService.reportMessage).toHaveBeenCalledWith(
        'user-1',
        'msg-123',
        'Spam content'
      );
    });
  });
});
