import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { POST as createInvitation } from '../[id]/invitations/route';
import { GET as getInvitations } from '../invitations/route';
import { POST as acceptInvitation } from '../invitations/[id]/accept/route';
import { POST as transferOwner } from '../[id]/transfer-owner/route';
import { POST as updateRole } from '../[id]/roles/route';
import { POST as removeMember } from '../[id]/members/[memberId]/remove/route';
import { getUser } from '@/src/server/infrastructure/auth/getUser';
import { conversationService } from '@/src/server/domain/messaging/conversation.service';

vi.mock('@/src/server/infrastructure/auth/getUser', () => ({
  getUser: vi.fn(),
}));

vi.mock('@/src/server/infrastructure/auth/guestAccount', () => ({
  isSharedGuestAccount: vi.fn((user) => user?.id === 'guest-user'),
}));

vi.mock('@/src/server/domain/messaging/conversation.service', () => ({
  conversationService: {
    createGroupInvitation: vi.fn(),
    getPendingInvitations: vi.fn(),
    acceptGroupInvitation: vi.fn(),
    transferGroupOwnership: vi.fn(),
    updateParticipantRole: vi.fn(),
    removeGroupMember: vi.fn(),
  },
}));

describe('Group Invitation and Role Management API Routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('POST /api/conversations/[id]/invitations', () => {
    it('creates invitation for valid payload', async () => {
      vi.mocked(getUser).mockResolvedValueOnce({ id: 'user-1' } as any);
      vi.mocked(conversationService.createGroupInvitation).mockResolvedValueOnce({
        id: 'inv-1',
        status: 'PENDING',
      });

      const req = new NextRequest('http://localhost/api/conversations/conv-1/invitations', {
        method: 'POST',
        body: JSON.stringify({ inviteeId: 'invitee-1' }),
      });
      const res = await createInvitation(req, { params: Promise.resolve({ id: 'conv-1' }) });
      expect(res.status).toBe(201);
      const data = await res.json();
      expect(data.id).toBe('inv-1');
    });

    it('returns 400 when inviteeId is missing', async () => {
      vi.mocked(getUser).mockResolvedValueOnce({ id: 'user-1' } as any);
      const req = new NextRequest('http://localhost/api/conversations/conv-1/invitations', {
        method: 'POST',
        body: JSON.stringify({}),
      });
      const res = await createInvitation(req, { params: Promise.resolve({ id: 'conv-1' }) });
      expect(res.status).toBe(400);
    });
  });

  describe('GET /api/conversations/invitations', () => {
    it('lists pending invitations for authenticated user', async () => {
      vi.mocked(getUser).mockResolvedValueOnce({ id: 'user-1' } as any);
      vi.mocked(conversationService.getPendingInvitations).mockResolvedValueOnce([
        { id: 'inv-1', conversationTitle: 'Study Squad' } as any,
      ]);

      const req = new NextRequest('http://localhost/api/conversations/invitations');
      const res = await getInvitations(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data).toHaveLength(1);
    });
  });

  describe('POST /api/conversations/invitations/[id]/accept', () => {
    it('accepts invitation via conversation service', async () => {
      vi.mocked(getUser).mockResolvedValueOnce({ id: 'user-1' } as any);
      vi.mocked(conversationService.acceptGroupInvitation).mockResolvedValueOnce({
        success: true,
        conversationId: 'conv-1',
      });

      const req = new NextRequest('http://localhost/api/conversations/invitations/inv-1/accept', {
        method: 'POST',
      });
      const res = await acceptInvitation(req, { params: Promise.resolve({ id: 'inv-1' }) });
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
    });
  });

  describe('POST /api/conversations/[id]/transfer-owner', () => {
    it('transfers ownership to new member', async () => {
      vi.mocked(getUser).mockResolvedValueOnce({ id: 'owner-1' } as any);
      vi.mocked(conversationService.transferGroupOwnership).mockResolvedValueOnce({
        success: true,
      });

      const req = new NextRequest('http://localhost/api/conversations/conv-1/transfer-owner', {
        method: 'POST',
        body: JSON.stringify({ newOwnerId: 'new-owner' }),
      });
      const res = await transferOwner(req, { params: Promise.resolve({ id: 'conv-1' }) });
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
    });
  });

  describe('POST /api/conversations/[id]/roles', () => {
    it('updates member role to ADMIN', async () => {
      vi.mocked(getUser).mockResolvedValueOnce({ id: 'owner-1' } as any);
      vi.mocked(conversationService.updateParticipantRole).mockResolvedValueOnce({
        success: true,
      });

      const req = new NextRequest('http://localhost/api/conversations/conv-1/roles', {
        method: 'POST',
        body: JSON.stringify({ targetUserId: 'target-1', role: 'ADMIN' }),
      });
      const res = await updateRole(req, { params: Promise.resolve({ id: 'conv-1' }) });
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
    });
  });

  describe('POST /api/conversations/[id]/members/[memberId]/remove', () => {
    it('removes member from group', async () => {
      vi.mocked(getUser).mockResolvedValueOnce({ id: 'owner-1' } as any);
      vi.mocked(conversationService.removeGroupMember).mockResolvedValueOnce({
        success: true,
      });

      const req = new NextRequest(
        'http://localhost/api/conversations/conv-1/members/target-1/remove',
        { method: 'POST' }
      );
      const res = await removeMember(req, {
        params: Promise.resolve({ id: 'conv-1', memberId: 'target-1' }),
      });
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
    });
  });
});
