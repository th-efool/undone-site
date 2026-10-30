import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('server-only', () => ({}));

const f = vi.hoisted(() => ({
  auth: vi.fn(),
  lessons: vi.fn(),
  progress: vi.fn(),
}));

vi.mock('@/src/server/infrastructure/auth/auth.config', () => ({ auth: f.auth }));
vi.mock('@/src/server/infrastructure/db/postgres/client', () => ({
  prisma: { lesson: { findMany: f.lessons } },
}));
vi.mock('@/src/server/domain/progress/chunkProgress.service', () => ({
  ChunkProgressService: { getUserProgressMap: f.progress },
}));
vi.mock('@/src/server/infrastructure/db/mongodb/client', () => ({ connectToMongoDB: vi.fn().mockResolvedValue(undefined) }));
vi.mock('@/src/server/database/mongo/models/UserCohortConfig', () => ({
  UserCohortConfig: { find: () => ({ lean: () => ({ exec: () => Promise.resolve([]) }) }) },
}));
vi.mock('@/src/server/database/mongo/models/UserChannelConfig', () => ({
  UserChannelConfig: { findOne: () => ({ lean: () => ({ exec: () => Promise.resolve(null) }) }) },
}));
vi.mock('@/src/server/database/mongo/models/CohortTranscript', () => ({
  CohortTranscript: { find: () => ({ lean: () => ({ exec: () => Promise.resolve([]) }) }) },
}));
vi.mock('@/src/server/database/mongo/models/Chunk', () => ({
  Chunk: { find: () => ({ lean: () => ({ exec: () => Promise.resolve([]) }) }) },
}));

// Note: generateFeed is NOT mocked here; we use the real engine!
import { GET } from '../route';

describe('POST / GET feed with real feedEngine (FH-03 Integration)', () => {
  const sampleLessons = [
    {
      id: 'lesson-1',
      title: 'Intro Lesson',
      order: 1,
      thumbnailUrl: '/thumb1.webp',
      videoId: 'vid1',
      lessonType: 'VIDEO',
      seasonId: 'season-1',
      season: {
        title: 'Season 1',
        order: 1,
        cohortId: 'cohort-1',
        cohort: { title: 'Cohort 1', coverImage: '/cover1.webp' },
      },
      chunks: [
        { id: 'c1', title: 'Part 1', durationSeconds: 60, startSeconds: 0, endSeconds: 60, order: 1 },
        { id: 'c2', title: 'Part 2', durationSeconds: 60, startSeconds: 60, endSeconds: 120, order: 2 },
      ],
    },
  ];

  beforeEach(() => {
    vi.resetAllMocks();
    f.auth.mockResolvedValue({ user: { id: 'user-1' } });
    f.lessons.mockResolvedValue(sampleLessons);
    f.progress.mockResolvedValue(new Map());
  });

  it('honors explicit chunk replay when chunk 1 was completed and requested', async () => {
    f.progress.mockResolvedValue(
      new Map([
        [
          'c1',
          {
            chunkId: 'c1',
            lessonId: 'lesson-1',
            cohortId: 'cohort-1',
            status: 'COMPLETED',
            watchedSeconds: 60,
            totalSeconds: 60,
          },
        ],
      ])
    );

    const req = new NextRequest('http://localhost/api/feed?chunk=c1&cohort=cohort-1&lesson=lesson-1');
    const res = await GET(req);
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data.items.length).toBeGreaterThanOrEqual(1);
    expect(data.items[0].chunkId).toBe('c1');
  });

  it('honors explicit non-frontier chunk 2 when chunk 1 is incomplete', async () => {
    const req = new NextRequest('http://localhost/api/feed?chunk=c2&cohort=cohort-1&lesson=lesson-1');
    const res = await GET(req);
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data.items.length).toBeGreaterThanOrEqual(1);
    expect(data.items[0].chunkId).toBe('c2');
  });

  it('returns empty feed when all chunks are completed without explicit chunk selection', async () => {
    f.progress.mockResolvedValue(
      new Map([
        ['c1', { chunkId: 'c1', lessonId: 'lesson-1', cohortId: 'cohort-1', status: 'COMPLETED', watchedSeconds: 60, totalSeconds: 60 }],
        ['c2', { chunkId: 'c2', lessonId: 'lesson-1', cohortId: 'cohort-1', status: 'COMPLETED', watchedSeconds: 60, totalSeconds: 60 }],
      ])
    );

    const req = new NextRequest('http://localhost/api/feed?cohort=cohort-1');
    const res = await GET(req);
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data.items).toHaveLength(0);
  });
});
