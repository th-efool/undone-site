import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { GET as getSprint, POST as startSprint } from '../[roomSlug]/sprint/route';
import { POST as pauseSprint } from '../[roomSlug]/sprint/pause/route';
import { POST as resumeSprint } from '../[roomSlug]/sprint/resume/route';
import { GET as getEnv, PUT as updateEnv } from '../[roomSlug]/environment/route';
import { getUser } from '@/src/server/infrastructure/auth/getUser';
import { sprintService } from '@/src/server/domain/studyroom/sprint.service';
import { environmentService } from '@/src/server/domain/studyroom/environment.service';

vi.mock('@/src/server/infrastructure/auth/getUser', () => ({
  getUser: vi.fn(),
}));

vi.mock('@/src/server/infrastructure/auth/guestAccount', () => ({
  isSharedGuestAccount: vi.fn((user) => user?.id === 'guest-user'),
}));

vi.mock('@/src/server/domain/studyroom/sprint.service', () => ({
  sprintService: {
    resolveRoom: vi.fn(),
    getCurrentRoomSprint: vi.fn(),
    startSprint: vi.fn(),
    pauseSprint: vi.fn(),
    resumeSprint: vi.fn(),
  },
}));

vi.mock('@/src/server/domain/studyroom/environment.service', () => ({
  environmentService: {
    getRoomEnvironment: vi.fn(),
    updateRoomEnvironment: vi.fn(),
  },
}));

describe('Study Room Sprint & Environment API Routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('/api/studyroom/[roomSlug]/sprint', () => {
    it('returns 401 when unauthenticated', async () => {
      vi.mocked(getUser).mockResolvedValueOnce(null);
      const req = new NextRequest('http://localhost/api/studyroom/fireplace/sprint');
      const res = await getSprint(req, { params: Promise.resolve({ roomSlug: 'fireplace' }) });
      expect(res.status).toBe(401);
    });

    it('returns 403 for guest accounts', async () => {
      vi.mocked(getUser).mockResolvedValueOnce({ id: 'guest-user' } as any);
      const req = new NextRequest('http://localhost/api/studyroom/fireplace/sprint');
      const res = await getSprint(req, { params: Promise.resolve({ roomSlug: 'fireplace' }) });
      expect(res.status).toBe(403);
    });

    it('returns current sprint snapshot for valid room', async () => {
      vi.mocked(getUser).mockResolvedValueOnce({ id: 'user-1' } as any);
      vi.mocked(sprintService.resolveRoom).mockResolvedValueOnce({ id: 'room-1' } as any);
      vi.mocked(sprintService.getCurrentRoomSprint).mockResolvedValueOnce({
        id: 'sprint-1',
        status: 'ACTIVE',
        targetDurationSeconds: 1500,
        remainingSeconds: 1200,
      } as any);

      const req = new NextRequest('http://localhost/api/studyroom/fireplace/sprint');
      const res = await getSprint(req, { params: Promise.resolve({ roomSlug: 'fireplace' }) });
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.sprint.id).toBe('sprint-1');
    });

    it('starts sprint via POST', async () => {
      vi.mocked(getUser).mockResolvedValueOnce({ id: 'user-1' } as any);
      vi.mocked(sprintService.resolveRoom).mockResolvedValueOnce({ id: 'room-1' } as any);
      vi.mocked(sprintService.startSprint).mockResolvedValueOnce({
        id: 'sprint-new',
        status: 'ACTIVE',
      } as any);

      const req = new NextRequest('http://localhost/api/studyroom/fireplace/sprint', {
        method: 'POST',
        body: JSON.stringify({ targetDurationSeconds: 1500, title: 'Sprint Title' }),
      });
      const res = await startSprint(req, { params: Promise.resolve({ roomSlug: 'fireplace' }) });
      expect(res.status).toBe(201);
      const data = await res.json();
      expect(data.id).toBe('sprint-new');
    });
  });

  describe('/api/studyroom/[roomSlug]/environment', () => {
    it('reads shared room environment via GET', async () => {
      vi.mocked(getUser).mockResolvedValueOnce({ id: 'user-1' } as any);
      vi.mocked(sprintService.resolveRoom).mockResolvedValueOnce({ id: 'room-1' } as any);
      vi.mocked(environmentService.getRoomEnvironment).mockResolvedValueOnce({
        studyRoomId: 'room-1',
        sceneId: 'lofi-cafe',
        revision: 1,
      } as any);

      const req = new NextRequest('http://localhost/api/studyroom/fireplace/environment');
      const res = await getEnv(req, { params: Promise.resolve({ roomSlug: 'fireplace' }) });
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.sceneId).toBe('lofi-cafe');
    });

    it('updates shared room environment via PUT', async () => {
      vi.mocked(getUser).mockResolvedValueOnce({ id: 'user-1' } as any);
      vi.mocked(sprintService.resolveRoom).mockResolvedValueOnce({ id: 'room-1' } as any);
      vi.mocked(environmentService.updateRoomEnvironment).mockResolvedValueOnce({
        studyRoomId: 'room-1',
        sceneId: 'cyberpunk-rain',
        revision: 2,
      } as any);

      const req = new NextRequest('http://localhost/api/studyroom/fireplace/environment', {
        method: 'PUT',
        body: JSON.stringify({ sceneId: 'cyberpunk-rain', expectedRevision: 1 }),
      });
      const res = await updateEnv(req, { params: Promise.resolve({ roomSlug: 'fireplace' }) });
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.sceneId).toBe('cyberpunk-rain');
    });
  });
});
