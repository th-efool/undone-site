/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('server-only', () => ({}));

import { GET as getUsernameCheck, PATCH as patchUsername } from '../username/route';
import { GET as getProfile, PATCH as patchProfile } from '../profile/route';
import { getUser } from '@/src/server/infrastructure/auth/getUser';
import { isSharedGuestAccount } from '@/src/server/infrastructure/auth/guestAccount';
import { usernameService } from '@/src/server/domain/user/username.service';
import { prisma } from '@/src/server/infrastructure/db/postgres/client';
import { userRepo } from '@/src/server/infrastructure/db/postgres/repositories/user.repo';

vi.mock('@/src/server/infrastructure/auth/getUser', () => ({
  getUser: vi.fn(),
}));

vi.mock('@/src/server/infrastructure/auth/guestAccount', () => ({
  isSharedGuestAccount: vi.fn(),
}));

vi.mock('@/src/server/domain/user/username.service', () => ({
  usernameService: {
    checkAvailability: vi.fn(),
    claimUsername: vi.fn(),
  },
  UsernameValidationError: class UsernameValidationError extends Error {
    readonly status = 400;
  },
  UsernameConflictError: class UsernameConflictError extends Error {
    readonly status = 409;
  },
}));

vi.mock('@/src/server/infrastructure/db/postgres/client', () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
    },
  },
}));

vi.mock('@/src/server/infrastructure/db/postgres/repositories/user.repo', () => ({
  userRepo: {
    update: vi.fn(),
  },
}));

describe('User API Routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(isSharedGuestAccount).mockReturnValue(false);
  });

  describe('GET /api/user/username', () => {
    it('returns 400 if username param is missing', async () => {
      const req = new NextRequest('http://localhost:3000/api/user/username');
      const res = await getUsernameCheck(req);
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toMatch(/is required/);
    });

    it('returns availability result for valid query', async () => {
      vi.mocked(getUser).mockResolvedValueOnce({ id: 'user-1' } as any);
      vi.mocked(usernameService.checkAvailability).mockResolvedValueOnce({
        available: true,
        valid: true,
        normalized: 'cool_dev',
        cleanHandle: 'cool_dev',
      });

      const req = new NextRequest('http://localhost:3000/api/user/username?username=cool_dev');
      const res = await getUsernameCheck(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.available).toBe(true);
      expect(usernameService.checkAvailability).toHaveBeenCalledWith('cool_dev', 'user-1');
    });
  });

  describe('PATCH /api/user/username', () => {
    it('returns 401 when unauthenticated', async () => {
      vi.mocked(getUser).mockResolvedValueOnce(null);

      const req = new NextRequest('http://localhost:3000/api/user/username', {
        method: 'PATCH',
        body: JSON.stringify({ username: 'alpha' }),
      });
      const res = await patchUsername(req);
      expect(res.status).toBe(401);
    });

    it('returns 403 for guest accounts', async () => {
      vi.mocked(getUser).mockResolvedValueOnce({ id: 'guest-1' } as any);
      vi.mocked(isSharedGuestAccount).mockReturnValueOnce(true);

      const req = new NextRequest('http://localhost:3000/api/user/username', {
        method: 'PATCH',
        body: JSON.stringify({ username: 'guest_pro' }),
      });
      const res = await patchUsername(req);
      expect(res.status).toBe(403);
    });

    it('successfully claims username', async () => {
      vi.mocked(getUser).mockResolvedValueOnce({ id: 'user-1' } as any);
      vi.mocked(usernameService.claimUsername).mockResolvedValueOnce({
        id: 'user-1',
        name: 'User 1',
        username: 'user_alpha',
        image: null,
        bio: 'Hello world',
      } as any);

      const req = new NextRequest('http://localhost:3000/api/user/username', {
        method: 'PATCH',
        body: JSON.stringify({ username: 'user_alpha' }),
      });
      const res = await patchUsername(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.user.username).toBe('user_alpha');
    });
  });

  describe('GET & PATCH /api/user/profile', () => {
    it('GET returns current profile', async () => {
      vi.mocked(getUser).mockResolvedValueOnce({ id: 'user-1' } as any);
      vi.mocked(prisma.user.findUnique).mockResolvedValueOnce({
        id: 'user-1',
        name: 'Alpha',
        username: 'alpha_pro',
        email: 'alpha@example.com',
        image: null,
        bio: 'Dev bio',
        role: 'EXPLORER',
        createdAt: new Date(),
      } as any);

      const res = await getProfile();
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.username).toBe('alpha_pro');
    });

    it('PATCH updates profile fields', async () => {
      vi.mocked(getUser).mockResolvedValueOnce({ id: 'user-1' } as any);
      vi.mocked(userRepo.update).mockResolvedValueOnce({
        id: 'user-1',
        name: 'Alpha Updated',
        username: 'alpha_pro',
        bio: 'New bio',
        image: 'https://example.com/avatar.png',
      } as any);

      const req = new NextRequest('http://localhost:3000/api/user/profile', {
        method: 'PATCH',
        body: JSON.stringify({ name: 'Alpha Updated', bio: 'New bio' }),
      });
      const res = await patchProfile(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.user.name).toBe('Alpha Updated');
    });
  });
});
