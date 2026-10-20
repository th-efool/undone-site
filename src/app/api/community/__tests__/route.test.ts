import { describe, it, expect, vi, beforeEach } from 'vitest';
vi.mock('server-only', () => ({}));
import { GET } from '../route';
import { auth } from '@/src/server/infrastructure/auth/auth.config';
import { isSharedGuestAccount } from '@/src/server/infrastructure/auth/guestAccount';
import { communityRepo } from '@/src/server/infrastructure/db/postgres/repositories/community.repo';

vi.mock('@/src/server/infrastructure/auth/auth.config', () => ({
  auth: vi.fn(),
}));

vi.mock('@/src/server/infrastructure/auth/guestAccount', () => ({
  isSharedGuestAccount: vi.fn(),
}));

vi.mock('@/src/server/infrastructure/db/postgres/repositories/community.repo', () => ({
  communityRepo: {
    getUserEnrolledCommunities: vi.fn(),
  },
}));

describe('GET /api/community', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('returns 401 Unauthorized when unauthenticated', async () => {
    vi.mocked(auth).mockResolvedValue(null);

    const res = await GET();
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toBe('Unauthorized');
  });

  it('returns empty array [] with private no-store header for guest accounts', async () => {
    vi.mocked(auth).mockResolvedValue({
      user: { id: 'guest-1', email: 'guest@undone.local' },
    } as any);
    vi.mocked(isSharedGuestAccount).mockReturnValue(true);

    const res = await GET();
    expect(res.status).toBe(200);
    expect(res.headers.get('Cache-Control')).toBe('private, no-store');
    const body = await res.json();
    expect(body).toEqual([]);
    expect(communityRepo.getUserEnrolledCommunities).not.toHaveBeenCalled();
  });

  it('returns enrolled and created communities for authenticated user', async () => {
    vi.mocked(auth).mockResolvedValue({
      user: { id: 'user-123' },
    } as any);
    vi.mocked(isSharedGuestAccount).mockReturnValue(false);

    vi.mocked(communityRepo.getUserEnrolledCommunities).mockResolvedValue([
      {
        role: 'EXPLORER',
        cohort: {
          id: 'cohort-1',
          title: 'Full Stack Next.js',
          coverImage: '/images/cover1.jpg',
          isPublished: true,
          community: {
            id: 'comm-1',
            chatEnabled: true,
            channels: [
              { id: 'chan-gen', name: 'general' },
              { id: 'chan-help', name: 'help' },
            ],
          },
        },
      },
      {
        role: 'CREATOR',
        cohort: {
          id: 'cohort-2',
          title: 'Advanced AI Systems',
          coverImage: null,
          isPublished: true,
          community: {
            id: 'comm-2',
            chatEnabled: false,
            channels: [{ id: 'chan-ai', name: 'announcements' }],
          },
        },
      },
    ] as any);

    const res = await GET();
    expect(res.status).toBe(200);
    expect(res.headers.get('Cache-Control')).toBe('private, no-store');
    const body = await res.json();

    expect(body).toEqual([
      {
        cohortId: 'cohort-1',
        cohortTitle: 'Full Stack Next.js',
        coverImage: '/images/cover1.jpg',
        role: 'EXPLORER',
        communityId: 'comm-1',
        chatEnabled: true,
        channels: [
          { id: 'chan-gen', name: 'general' },
          { id: 'chan-help', name: 'help' },
        ],
      },
      {
        cohortId: 'cohort-2',
        cohortTitle: 'Advanced AI Systems',
        coverImage: null,
        role: 'CREATOR',
        communityId: 'comm-2',
        chatEnabled: false,
        channels: [{ id: 'chan-ai', name: 'announcements' }],
      },
    ]);
  });
});
