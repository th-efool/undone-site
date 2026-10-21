import 'server-only';
import { prisma } from '@/src/server/infrastructure/db/postgres/client';
import { userRepo } from '@/src/server/infrastructure/db/postgres/repositories/user.repo';

export const RESERVED_USERNAMES = new Set([
  'admin',
  'administrator',
  'system',
  'api',
  'auth',
  'support',
  'undone',
  'sidequesthq',
  'null',
  'undefined',
  'root',
  'bot',
  'moderator',
  'mod',
  'help',
  'terms',
  'privacy',
  'about',
  'login',
  'signup',
  'explore',
  'studyroom',
  'cohort',
  'channel',
  'dashboard',
  'settings',
  'message',
  'messages',
  'profile',
]);

export class UsernameValidationError extends Error {
  readonly status = 400;
  constructor(message: string) {
    super(message);
    this.name = 'UsernameValidationError';
  }
}

export class UsernameConflictError extends Error {
  readonly status = 409;
  constructor(message: string) {
    super(message);
    this.name = 'UsernameConflictError';
  }
}

export interface UsernameValidationResult {
  valid: boolean;
  error?: string;
  normalized: string;
  cleanHandle: string;
}

export function validateUsername(rawUsername: unknown): UsernameValidationResult {
  if (typeof rawUsername !== 'string') {
    return { valid: false, error: 'Username must be a valid text string', normalized: '', cleanHandle: '' };
  }

  // Strip optional leading '@' prefix
  const cleanHandle = rawUsername.trim().replace(/^@+/, '');

  if (cleanHandle.length < 3) {
    return {
      valid: false,
      error: 'Username must be at least 3 characters long',
      normalized: cleanHandle.toLowerCase(),
      cleanHandle,
    };
  }

  if (cleanHandle.length > 30) {
    return {
      valid: false,
      error: 'Username cannot exceed 30 characters',
      normalized: cleanHandle.toLowerCase(),
      cleanHandle,
    };
  }

  if (!/^[a-zA-Z0-9_]+$/.test(cleanHandle)) {
    return {
      valid: false,
      error: 'Username can only contain letters, numbers, and underscores (no spaces or special symbols)',
      normalized: cleanHandle.toLowerCase(),
      cleanHandle,
    };
  }

  const normalized = cleanHandle.toLowerCase();
  if (RESERVED_USERNAMES.has(normalized)) {
    return {
      valid: false,
      error: `'${cleanHandle}' is a reserved username and cannot be claimed`,
      normalized,
      cleanHandle,
    };
  }

  return {
    valid: true,
    normalized,
    cleanHandle,
  };
}

export const usernameService = {
  /**
   * Check whether a requested username is available to be claimed
   */
  async checkAvailability(
    rawUsername: string,
    excludeUserId?: string
  ): Promise<{
    available: boolean;
    valid: boolean;
    error?: string;
    normalized: string;
    cleanHandle: string;
  }> {
    const validation = validateUsername(rawUsername);
    if (!validation.valid) {
      return {
        available: false,
        valid: false,
        error: validation.error,
        normalized: validation.normalized,
        cleanHandle: validation.cleanHandle,
      };
    }

    const existing = await prisma.user.findFirst({
      where: {
        username: {
          equals: validation.cleanHandle,
          mode: 'insensitive',
        },
        id: excludeUserId ? { not: excludeUserId } : undefined,
      },
      select: { id: true, username: true },
    });

    if (existing) {
      return {
        available: false,
        valid: true,
        error: `Username '@${validation.cleanHandle}' is already taken`,
        normalized: validation.normalized,
        cleanHandle: validation.cleanHandle,
      };
    }

    return {
      available: true,
      valid: true,
      normalized: validation.normalized,
      cleanHandle: validation.cleanHandle,
    };
  },

  /**
   * Atomically claims or updates a user's username
   */
  async claimUsername(userId: string, requestedUsername: string) {
    if (!userId) {
      throw new UsernameValidationError('User ID is required to claim a username');
    }

    const validation = validateUsername(requestedUsername);
    if (!validation.valid) {
      throw new UsernameValidationError(validation.error!);
    }

    // Check if user already owns this username (case-insensitive)
    const currentUser = await userRepo.findById(userId);
    if (!currentUser) {
      throw new UsernameValidationError('User not found');
    }

    if (currentUser.username?.toLowerCase() === validation.normalized) {
      // User is claiming the same username (e.g. casing update)
      if (currentUser.username !== validation.cleanHandle) {
        return userRepo.updateUsername(userId, validation.cleanHandle);
      }
      return currentUser;
    }

    // Check for conflicts with other users
    const availability = await this.checkAvailability(requestedUsername, userId);
    if (!availability.available) {
      throw new UsernameConflictError(availability.error || 'Username is not available');
    }

    // Persist username
    try {
      return await userRepo.updateUsername(userId, validation.cleanHandle);
    } catch (err: any) {
      if (err.code === 'P2002') {
        throw new UsernameConflictError(`Username '@${validation.cleanHandle}' was just claimed by another user`);
      }
      throw err;
    }
  },

  /**
   * Resolve a user by their username (case-insensitive)
   */
  async resolveByUsername(username: string) {
    const clean = username.trim().replace(/^@+/, '');
    if (!clean) return null;
    return prisma.user.findFirst({
      where: {
        username: {
          equals: clean,
          mode: 'insensitive',
        },
      },
      select: {
        id: true,
        name: true,
        username: true,
        image: true,
        bio: true,
      },
    });
  },
};
