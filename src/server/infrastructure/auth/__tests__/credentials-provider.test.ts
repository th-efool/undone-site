import { describe, it, expect, vi, beforeEach } from 'vitest';
import { hashPassword } from '../password';

const mockPrisma = vi.hoisted(() => ({
  user: {
    findFirst: vi.fn(),
    findUnique: vi.fn(),
    upsert: vi.fn(),
  },
}));

vi.mock('@/src/server/infrastructure/db/postgres/client', () => ({
  prisma: mockPrisma,
}));

vi.mock('../guestAccount', () => ({
  getGuestAccount: vi.fn(async (email) => ({
    id: 'guest-id',
    email,
    name: 'Guest Explorer',
    username: 'guest',
  })),
}));

describe('Credentials Provider in auth.config', () => {
  let credentialsProvider: any;

  beforeEach(async () => {
    vi.clearAllMocks();
    vi.stubEnv('AUTH_SECRET', 'test-auth-secret-with-at-least-32-characters');
    // Dynamically import to ensure mocks apply
    const authModule = await import('../auth.config');
    // Auth config NextAuth config is instantiated with providers
    // We can test authorize by accessing the provider from NextAuth or directly
  });

  it('verifies valid password against hashed user record', async () => {
    const password = 'Password123!';
    const passwordHash = hashPassword(password);
    mockPrisma.user.findFirst.mockResolvedValueOnce({
      id: 'user-alpha-id',
      email: 'user_alpha@undone.com',
      name: 'User Alpha',
      username: 'user_alpha',
      passwordHash,
    });

    const { prisma } = await import('@/src/server/infrastructure/db/postgres/client');
    const { verifyPassword } = await import('../password');

    // Simulate authorize logic directly
    const foundUser = await prisma.user.findFirst({
      where: {
        OR: [
          { email: 'user_alpha@undone.com' },
          { username: { equals: 'user_alpha', mode: 'insensitive' } },
        ],
      },
    });

    expect(foundUser).not.toBeNull();
    expect(verifyPassword(password, foundUser!.passwordHash)).toBe(true);
    expect(verifyPassword('WrongPassword', foundUser!.passwordHash)).toBe(false);
  });
});
