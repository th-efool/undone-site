import { describe, expect, it, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('server-only', () => ({}));

import { POST as createRoomRoute } from '../rooms/route';
import { GET as getRoomRoute, PATCH as updateRoomRoute } from '../[roomSlug]/route';
import { POST as lifecycleRoute } from '../[roomSlug]/lifecycle/route';
import { GET as getControllersRoute } from '../[roomSlug]/controllers/route';
import { PUT as setControllerRoute, DELETE as revokeControllerRoute } from '../[roomSlug]/controllers/[userId]/route';
import { POST as removeParticipantRoute } from '../[roomSlug]/participants/[userId]/remove/route';
import { GET as getRestrictionsRoute, POST as banParticipantRoute } from '../[roomSlug]/restrictions/route';
import { DELETE as unbanParticipantRoute } from '../[roomSlug]/restrictions/[userId]/route';
import { POST as proposeTransferRoute } from '../[roomSlug]/ownership-transfers/route';
import { POST as acceptTransferRoute } from '../[roomSlug]/ownership-transfers/[id]/accept/route';
import { DELETE as cancelTransferRoute } from '../[roomSlug]/ownership-transfers/[id]/route';
import { GET as getAuditRoute } from '../[roomSlug]/audit/route';

import { getUser } from '@/src/server/infrastructure/auth/getUser';
import { roomManagementService } from '@/src/server/domain/studyroom/room-management.service';
import { roomGovernanceService } from '@/src/server/domain/studyroom/room-governance.service';
import { sprintService } from '@/src/server/domain/studyroom/sprint.service';

vi.mock('@/src/server/infrastructure/auth/getUser', () => ({
  getUser: vi.fn(),
}));

vi.mock('@/src/server/domain/studyroom/room-management.service', () => ({
  roomManagementService: {
    createRoom: vi.fn(),
    getRoomBootstrap: vi.fn(),
    updateRoomSettings: vi.fn(),
    transitionLifecycle: vi.fn(),
  },
}));

vi.mock('@/src/server/domain/studyroom/room-governance.service', () => ({
  roomGovernanceService: {
    getControllers: vi.fn(),
    setController: vi.fn(),
    revokeController: vi.fn(),
    removeParticipant: vi.fn(),
    banParticipant: vi.fn(),
    unbanParticipant: vi.fn(),
    getRestrictions: vi.fn(),
    proposeOwnershipTransfer: vi.fn(),
    acceptOwnershipTransfer: vi.fn(),
    cancelOwnershipTransfer: vi.fn(),
    getAuditLogs: vi.fn(),
  },
}));

vi.mock('@/src/server/domain/studyroom/sprint.service', () => ({
  sprintService: {
    resolveRoom: vi.fn(),
  },
}));

describe('Study Room Phase 2 Management & Governance API Routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('POST /api/studyroom/rooms', () => {
    it('returns 401 when unauthorized', async () => {
      vi.mocked(getUser).mockResolvedValueOnce(null);
      const req = new NextRequest('http://localhost/api/studyroom/rooms', {
        method: 'POST',
        body: JSON.stringify({ title: 'New Room' }),
      });
      const res = await createRoomRoute(req);
      expect(res.status).toBe(401);
    });

    it('creates room and returns 201', async () => {
      vi.mocked(getUser).mockResolvedValueOnce({ id: 'user-1' } as any);
      vi.mocked(roomManagementService.createRoom).mockResolvedValueOnce({
        id: 'room-1',
        slug: 'new-room',
        title: 'New Room',
        status: 'OPEN',
        revision: 1,
      });

      const req = new NextRequest('http://localhost/api/studyroom/rooms', {
        method: 'POST',
        body: JSON.stringify({ title: 'New Room' }),
      });
      const res = await createRoomRoute(req);
      expect(res.status).toBe(201);
      const json = await res.json();
      expect(json.id).toBe('room-1');
    });
  });

  describe('GET & PATCH /api/studyroom/[roomSlug]', () => {
    it('GET returns bootstrap payload', async () => {
      vi.mocked(getUser).mockResolvedValueOnce({ id: 'user-1' } as any);
      vi.mocked(roomManagementService.getRoomBootstrap).mockResolvedValueOnce({
        room: { id: 'room-1', title: 'Room One' } as any,
        viewer: { userId: 'user-1', role: 'OWNER', isJoined: true, leaseExpiresAt: null, generation: null },
        capabilities: { canJoin: true } as any,
      });

      const req = new NextRequest('http://localhost/api/studyroom/room-one');
      const res = await getRoomRoute(req, { params: Promise.resolve({ roomSlug: 'room-one' }) });
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.room.id).toBe('room-1');
    });

    it('PATCH updates room settings', async () => {
      vi.mocked(getUser).mockResolvedValueOnce({ id: 'user-1' } as any);
      vi.mocked(roomManagementService.updateRoomSettings).mockResolvedValueOnce({
        id: 'room-1',
        slug: 'room-one',
        revision: 2,
        updatedAt: new Date().toISOString(),
      });

      const req = new NextRequest('http://localhost/api/studyroom/room-one', {
        method: 'PATCH',
        body: JSON.stringify({ title: 'Updated Room', expectedRevision: 1 }),
      });
      const res = await updateRoomRoute(req, { params: Promise.resolve({ roomSlug: 'room-one' }) });
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.revision).toBe(2);
    });
  });

  describe('POST /api/studyroom/[roomSlug]/lifecycle', () => {
    it('transitions lifecycle successfully', async () => {
      vi.mocked(getUser).mockResolvedValueOnce({ id: 'user-1' } as any);
      vi.mocked(roomManagementService.transitionLifecycle).mockResolvedValueOnce({
        id: 'room-1',
        slug: 'room-one',
        status: 'CLOSED',
        revision: 2,
        occurredAt: new Date().toISOString(),
      });

      const req = new NextRequest('http://localhost/api/studyroom/room-one/lifecycle', {
        method: 'POST',
        body: JSON.stringify({ action: 'CLOSE', expectedRevision: 1 }),
      });
      const res = await lifecycleRoute(req, { params: Promise.resolve({ roomSlug: 'room-one' }) });
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.status).toBe('CLOSED');
    });
  });

  describe('Controllers: GET, PUT, DELETE', () => {
    it('GET returns room controllers', async () => {
      vi.mocked(getUser).mockResolvedValueOnce({ id: 'user-1' } as any);
      vi.mocked(sprintService.resolveRoom).mockResolvedValueOnce({ id: 'room-1' } as any);
      vi.mocked(roomGovernanceService.getControllers).mockResolvedValueOnce([
        { userId: 'u-2', name: 'Mod', username: 'mod', image: null, role: 'MODERATOR', assignedByUserId: 'u-1', assignedAt: new Date().toISOString() },
      ]);

      const req = new NextRequest('http://localhost/api/studyroom/room-one/controllers');
      const res = await getControllersRoute(req, { params: Promise.resolve({ roomSlug: 'room-one' }) });
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json).toHaveLength(1);
    });

    it('PUT sets room controller', async () => {
      vi.mocked(getUser).mockResolvedValueOnce({ id: 'user-1' } as any);
      vi.mocked(sprintService.resolveRoom).mockResolvedValueOnce({ id: 'room-1' } as any);

      const req = new NextRequest('http://localhost/api/studyroom/room-one/controllers/user-2', {
        method: 'PUT',
        body: JSON.stringify({ role: 'MODERATOR' }),
      });
      const res = await setControllerRoute(req, { params: Promise.resolve({ roomSlug: 'room-one', userId: 'user-2' }) });
      expect(res.status).toBe(200);
      expect(roomGovernanceService.setController).toHaveBeenCalledWith('room-1', 'user-2', 'MODERATOR', 'user-1');
    });

    it('DELETE revokes room controller', async () => {
      vi.mocked(getUser).mockResolvedValueOnce({ id: 'user-1' } as any);
      vi.mocked(sprintService.resolveRoom).mockResolvedValueOnce({ id: 'room-1' } as any);

      const req = new NextRequest('http://localhost/api/studyroom/room-one/controllers/user-2', { method: 'DELETE' });
      const res = await revokeControllerRoute(req, { params: Promise.resolve({ roomSlug: 'room-one', userId: 'user-2' }) });
      expect(res.status).toBe(200);
      expect(roomGovernanceService.revokeController).toHaveBeenCalledWith('room-1', 'user-2', 'user-1');
    });
  });

  describe('Moderation: Remove & Restrictions', () => {
    it('POST remove participant', async () => {
      vi.mocked(getUser).mockResolvedValueOnce({ id: 'user-1' } as any);
      vi.mocked(sprintService.resolveRoom).mockResolvedValueOnce({ id: 'room-1' } as any);

      const req = new NextRequest('http://localhost/api/studyroom/room-one/participants/user-2/remove', {
        method: 'POST',
        body: JSON.stringify({ reason: 'Disruptive' }),
      });
      const res = await removeParticipantRoute(req, { params: Promise.resolve({ roomSlug: 'room-one', userId: 'user-2' }) });
      expect(res.status).toBe(200);
      expect(roomGovernanceService.removeParticipant).toHaveBeenCalledWith('room-1', 'user-2', 'Disruptive', 'user-1');
    });

    it('GET restrictions', async () => {
      vi.mocked(getUser).mockResolvedValueOnce({ id: 'user-1' } as any);
      vi.mocked(sprintService.resolveRoom).mockResolvedValueOnce({ id: 'room-1' } as any);
      vi.mocked(roomGovernanceService.getRestrictions).mockResolvedValueOnce([]);

      const req = new NextRequest('http://localhost/api/studyroom/room-one/restrictions');
      const res = await getRestrictionsRoute(req, { params: Promise.resolve({ roomSlug: 'room-one' }) });
      expect(res.status).toBe(200);
    });

    it('POST ban participant', async () => {
      vi.mocked(getUser).mockResolvedValueOnce({ id: 'user-1' } as any);
      vi.mocked(sprintService.resolveRoom).mockResolvedValueOnce({ id: 'room-1' } as any);

      const req = new NextRequest('http://localhost/api/studyroom/room-one/restrictions', {
        method: 'POST',
        body: JSON.stringify({ userId: 'user-2', reason: 'Trolling', durationMinutes: 30 }),
      });
      const res = await banParticipantRoute(req, { params: Promise.resolve({ roomSlug: 'room-one' }) });
      expect(res.status).toBe(201);
      expect(roomGovernanceService.banParticipant).toHaveBeenCalledWith('room-1', 'user-2', 'Trolling', 30, 'user-1');
    });

    it('DELETE unban participant', async () => {
      vi.mocked(getUser).mockResolvedValueOnce({ id: 'user-1' } as any);
      vi.mocked(sprintService.resolveRoom).mockResolvedValueOnce({ id: 'room-1' } as any);

      const req = new NextRequest('http://localhost/api/studyroom/room-one/restrictions/user-2', { method: 'DELETE' });
      const res = await unbanParticipantRoute(req, { params: Promise.resolve({ roomSlug: 'room-one', userId: 'user-2' }) });
      expect(res.status).toBe(200);
      expect(roomGovernanceService.unbanParticipant).toHaveBeenCalledWith('room-1', 'user-2', 'user-1');
    });
  });

  describe('Ownership Transfers & Audit', () => {
    it('POST propose transfer', async () => {
      vi.mocked(getUser).mockResolvedValueOnce({ id: 'user-1' } as any);
      vi.mocked(sprintService.resolveRoom).mockResolvedValueOnce({ id: 'room-1' } as any);
      vi.mocked(roomGovernanceService.proposeOwnershipTransfer).mockResolvedValueOnce({
        id: 'trans-1',
        studyRoomId: 'room-1',
        senderId: 'user-1',
        recipientId: 'user-2',
        recipientName: 'User Two',
        status: 'PENDING',
        expectedRevision: 1,
        expiresAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
      });

      const req = new NextRequest('http://localhost/api/studyroom/room-one/ownership-transfers', {
        method: 'POST',
        body: JSON.stringify({ recipientUserId: 'user-2', expectedRevision: 1 }),
      });
      const res = await proposeTransferRoute(req, { params: Promise.resolve({ roomSlug: 'room-one' }) });
      expect(res.status).toBe(201);
      const json = await res.json();
      expect(json.transfer.id).toBe('trans-1');
    });

    it('POST accept transfer', async () => {
      vi.mocked(getUser).mockResolvedValueOnce({ id: 'user-2' } as any);
      vi.mocked(sprintService.resolveRoom).mockResolvedValueOnce({ id: 'room-1' } as any);

      const req = new NextRequest('http://localhost/api/studyroom/room-one/ownership-transfers/trans-1/accept', { method: 'POST' });
      const res = await acceptTransferRoute(req, { params: Promise.resolve({ roomSlug: 'room-one', id: 'trans-1' }) });
      expect(res.status).toBe(200);
      expect(roomGovernanceService.acceptOwnershipTransfer).toHaveBeenCalledWith('room-1', 'trans-1', 'user-2');
    });

    it('DELETE cancel transfer', async () => {
      vi.mocked(getUser).mockResolvedValueOnce({ id: 'user-1' } as any);
      vi.mocked(sprintService.resolveRoom).mockResolvedValueOnce({ id: 'room-1' } as any);

      const req = new NextRequest('http://localhost/api/studyroom/room-one/ownership-transfers/trans-1', { method: 'DELETE' });
      const res = await cancelTransferRoute(req, { params: Promise.resolve({ roomSlug: 'room-one', id: 'trans-1' }) });
      expect(res.status).toBe(200);
      expect(roomGovernanceService.cancelOwnershipTransfer).toHaveBeenCalledWith('room-1', 'trans-1', 'user-1');
    });

    it('GET audit logs', async () => {
      vi.mocked(getUser).mockResolvedValueOnce({ id: 'user-1' } as any);
      vi.mocked(sprintService.resolveRoom).mockResolvedValueOnce({ id: 'room-1' } as any);
      vi.mocked(roomGovernanceService.getAuditLogs).mockResolvedValueOnce({ entries: [], nextCursor: null });

      const req = new NextRequest('http://localhost/api/studyroom/room-one/audit');
      const res = await getAuditRoute(req, { params: Promise.resolve({ roomSlug: 'room-one' }) });
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.entries).toEqual([]);
    });
  });
});
