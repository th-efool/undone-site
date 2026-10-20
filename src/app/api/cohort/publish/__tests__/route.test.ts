import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('server-only', () => ({}));
vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
  revalidateTag: vi.fn(),
}));

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  findById: vi.fn(),
  findByEmail: vi.fn(),
  publishCohort: vi.fn(),
}));

vi.mock('@/src/server/infrastructure/auth/auth.config', () => ({
  auth: mocks.auth,
}));

vi.mock('@/src/server/infrastructure/db/postgres/repositories/user.repo', () => ({
  userRepo: {
    findById: mocks.findById,
    findByEmail: mocks.findByEmail,
  },
}));

vi.mock('@/src/server/domain/cohort/cohort.service', () => ({
  CohortService: {
    publishCohort: mocks.publishCohort,
  },
}));

import { POST } from '../route';

const validPayload = {
  draft: {
    title: 'Valid Cohort Title',
    sources: [],
  },
  curriculum: {
    seasons: [
      {
        title: 'Season 1',
        lessons: [
          {
            title: 'Lesson 1',
            videoUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
          },
        ],
      },
    ],
  },
};

describe('POST /api/cohort/publish', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('returns 401 immediately when session is null, without parsing invalid body', async () => {
    mocks.auth.mockResolvedValue(null);

    const req = new NextRequest('http://localhost/api/cohort/publish', {
      method: 'POST',
      body: 'INVALID_JSON_BODY{{{',
    });

    const jsonSpy = vi.spyOn(req, 'json');
    const response = await POST(req);

    expect(response.status).toBe(401);
    expect(jsonSpy).not.toHaveBeenCalled();
    expect(mocks.findById).not.toHaveBeenCalled();
    expect(mocks.findByEmail).not.toHaveBeenCalled();

    const data = await response.json();
    expect(data).toEqual({
      code: 'unauthorized',
      title: 'Unauthorized',
      message: 'You must be logged in to publish a cohort.',
    });
  });

  it('returns 401 immediately when session has no user id or email, without parsing body', async () => {
    mocks.auth.mockResolvedValue({ user: {} });

    const req = new NextRequest('http://localhost/api/cohort/publish', {
      method: 'POST',
      body: 'INVALID_JSON_BODY{{{',
    });

    const jsonSpy = vi.spyOn(req, 'json');
    const response = await POST(req);

    expect(response.status).toBe(401);
    expect(jsonSpy).not.toHaveBeenCalled();
    expect(mocks.findById).not.toHaveBeenCalled();
  });

  it('returns 401 when creator is not found in database by id', async () => {
    mocks.auth.mockResolvedValue({ user: { id: 'non-existent-user-id' } });
    mocks.findById.mockResolvedValue(null);

    const req = new NextRequest('http://localhost/api/cohort/publish', {
      method: 'POST',
      body: JSON.stringify(validPayload),
    });

    const response = await POST(req);

    expect(response.status).toBe(401);
    expect(mocks.findById).toHaveBeenCalledWith('non-existent-user-id');
    const data = await response.json();
    expect(data).toEqual({
      code: 'unauthorized',
      title: 'Unauthorized',
      message: 'You must be logged in to publish a cohort.',
    });
  });

  it('returns 401 when creator is not found in database by email', async () => {
    mocks.auth.mockResolvedValue({ user: { email: 'unknown@example.com' } });
    mocks.findByEmail.mockResolvedValue(null);

    const req = new NextRequest('http://localhost/api/cohort/publish', {
      method: 'POST',
      body: JSON.stringify(validPayload),
    });

    const response = await POST(req);

    expect(response.status).toBe(401);
    expect(mocks.findByEmail).toHaveBeenCalledWith('unknown@example.com');
    const data = await response.json();
    expect(data.code).toBe('unauthorized');
  });

  it('returns 400 when authenticated user supplies invalid payload', async () => {
    mocks.auth.mockResolvedValue({ user: { id: 'valid-user-id' } });
    mocks.findById.mockResolvedValue({ id: 'valid-user-id' });

    const req = new NextRequest('http://localhost/api/cohort/publish', {
      method: 'POST',
      body: JSON.stringify({ draft: { title: '' }, curriculum: { seasons: [] } }),
    });

    const response = await POST(req);

    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.code).toBe('invalid_payload');
    expect(mocks.publishCohort).not.toHaveBeenCalled();
    // Fast-fails before calling userRepo when schema is invalid
    expect(mocks.findById).not.toHaveBeenCalled();
  });

  it('returns 400 when authenticated user supplies empty or malformed json body', async () => {
    mocks.auth.mockResolvedValue({ user: { id: 'valid-user-id' } });

    const req = new NextRequest('http://localhost/api/cohort/publish', {
      method: 'POST',
      body: 'invalid-non-json',
    });

    const response = await POST(req);

    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.code).toBe('invalid_payload');
    expect(data.message).toBe('Payload is missing.');
    expect(mocks.findById).not.toHaveBeenCalled();
    expect(mocks.publishCohort).not.toHaveBeenCalled();
  });

  it('publishes cohort successfully when authenticated with valid user and payload', async () => {
    mocks.auth.mockResolvedValue({ user: { id: 'user-123' } });
    mocks.findById.mockResolvedValue({ id: 'user-123', name: 'Author' });
    mocks.publishCohort.mockResolvedValue({
      id: 'cohort-abc',
      title: 'Valid Cohort Title',
      publishedAt: new Date('2026-01-01T00:00:00.000Z'),
      visibility: 'PUBLIC',
      coverImage: '/images/cover.webp',
    });

    const req = new NextRequest('http://localhost/api/cohort/publish', {
      method: 'POST',
      body: JSON.stringify(validPayload),
    });

    const response = await POST(req);

    expect(response.status).toBe(200);
    expect(mocks.findById).toHaveBeenCalledWith('user-123');
    expect(mocks.publishCohort).toHaveBeenCalled();
    const data = await response.json();
    expect(data.cohortId).toBe('cohort-abc');
  });
});
