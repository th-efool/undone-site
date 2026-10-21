/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('server-only', () => ({}));

import {
  validateUsername,
  usernameService,
  UsernameValidationError,
  UsernameConflictError,
  RESERVED_USERNAMES,
} from '../username.service';
import { prisma } from '@/src/server/infrastructure/db/postgres/client';
import { userRepo } from '@/src/server/infrastructure/db/postgres/repositories/user.repo';

vi.mock('@/src/server/infrastructure/db/postgres/client', () => ({
  prisma: {
    user: {
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
    },
  },
}));

vi.mock('@/src/server/infrastructure/db/postgres/repositories/user.repo', () => ({
  userRepo: {
    findById: vi.fn(),
    findByUsername: vi.fn(),
    updateUsername: vi.fn(),
    update: vi.fn(),
  },
}));

describe('Username Validation & Service Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('validateUsername', () => {
    it('accepts valid usernames', () => {
      const valid = ['john_doe', 'alice123', 'cool_dev_99', 'bob', 'Aarav_Dev'];
      for (const handle of valid) {
        const res = validateUsername(handle);
        expect(res.valid).toBe(true);
        expect(res.normalized).toBe(handle.toLowerCase().replace(/^@+/, ''));
        expect(res.cleanHandle).toBe(handle.replace(/^@+/, ''));
      }
    });

    it('strips leading @ prefix cleanly', () => {
      const res = validateUsername('@super_coder');
      expect(res.valid).toBe(true);
      expect(res.cleanHandle).toBe('super_coder');
      expect(res.normalized).toBe('super_coder');
    });

    it('rejects handles shorter than 3 characters', () => {
      const res = validateUsername('ab');
      expect(res.valid).toBe(false);
      expect(res.error).toMatch(/at least 3 characters/);
    });

    it('rejects handles longer than 30 characters', () => {
      const res = validateUsername('a'.repeat(31));
      expect(res.valid).toBe(false);
      expect(res.error).toMatch(/cannot exceed 30 characters/);
    });

    it('rejects illegal characters like spaces, dashes, or punctuation', () => {
      const invalids = ['john doe', 'john-doe', 'john.doe', 'john@doe', 'alice!'];
      for (const handle of invalids) {
        const res = validateUsername(handle);
        expect(res.valid).toBe(false);
        expect(res.error).toMatch(/letters, numbers, and underscores/);
      }
    });

    it('rejects reserved system usernames', () => {
      const reserved = ['admin', 'ADMIN', 'api', 'auth', 'support', 'undone', 'system', 'root'];
      for (const handle of reserved) {
        const res = validateUsername(handle);
        expect(res.valid).toBe(false);
        expect(res.error).toMatch(/reserved username/);
      }
    });
  });

  describe('usernameService.checkAvailability', () => {
    it('returns invalid if format validation fails', async () => {
      const res = await usernameService.checkAvailability('hi!');
      expect(res.available).toBe(false);
      expect(res.valid).toBe(false);
      expect(res.error).toBeDefined();
    });

    it('returns available: true if username is unassigned', async () => {
      vi.mocked(prisma.user.findFirst).mockResolvedValueOnce(null);

      const res = await usernameService.checkAvailability('new_adventurer');
      expect(res.available).toBe(true);
      expect(res.valid).toBe(true);
      expect(prisma.user.findFirst).toHaveBeenCalledWith({
        where: {
          username: { equals: 'new_adventurer', mode: 'insensitive' },
          id: undefined,
        },
        select: { id: true, username: true },
      });
    });

    it('returns available: false if username is already taken', async () => {
      vi.mocked(prisma.user.findFirst).mockResolvedValueOnce({
        id: 'other-user',
        username: 'existing_user',
      } as any);

      const res = await usernameService.checkAvailability('existing_user');
      expect(res.available).toBe(false);
      expect(res.valid).toBe(true);
      expect(res.error).toMatch(/already taken/);
    });
  });

  describe('usernameService.claimUsername', () => {
    it('throws validation error if format is invalid', async () => {
      await expect(usernameService.claimUsername('u1', 'a')).rejects.toThrow(UsernameValidationError);
    });

    it('throws validation error if user does not exist', async () => {
      vi.mocked(userRepo.findById).mockResolvedValueOnce(null);

      await expect(usernameService.claimUsername('nonexistent', 'valid_handle')).rejects.toThrow(
        UsernameValidationError
      );
    });

    it('throws conflict error if username is taken by someone else', async () => {
      vi.mocked(userRepo.findById).mockResolvedValueOnce({
        id: 'u1',
        username: 'old_handle',
      } as any);

      vi.mocked(prisma.user.findFirst).mockResolvedValueOnce({
        id: 'u2',
        username: 'claimed_handle',
      } as any);

      await expect(usernameService.claimUsername('u1', 'claimed_handle')).rejects.toThrow(
        UsernameConflictError
      );
    });

    it('successfully claims a new available username', async () => {
      vi.mocked(userRepo.findById).mockResolvedValueOnce({
        id: 'u1',
        username: 'old_handle',
      } as any);

      vi.mocked(prisma.user.findFirst).mockResolvedValueOnce(null);
      vi.mocked(userRepo.updateUsername).mockResolvedValueOnce({
        id: 'u1',
        username: 'new_handle',
        name: 'Alpha',
      } as any);

      const updated = await usernameService.claimUsername('u1', 'new_handle');
      expect(updated.username).toBe('new_handle');
      expect(userRepo.updateUsername).toHaveBeenCalledWith('u1', 'new_handle');
    });

    it('allows casing updates for the user who already owns the handle', async () => {
      vi.mocked(userRepo.findById).mockResolvedValueOnce({
        id: 'u1',
        username: 'alpha_user',
      } as any);

      vi.mocked(userRepo.updateUsername).mockResolvedValueOnce({
        id: 'u1',
        username: 'Alpha_User',
      } as any);

      const updated = await usernameService.claimUsername('u1', 'Alpha_User');
      expect(userRepo.updateUsername).toHaveBeenCalledWith('u1', 'Alpha_User');
    });
  });
});
