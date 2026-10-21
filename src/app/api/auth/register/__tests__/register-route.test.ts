import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { POST } from '../route';
import { userRepo } from '@/src/server/infrastructure/db/postgres/repositories/user.repo';

vi.mock('@/src/server/infrastructure/db/postgres/repositories/user.repo', () => ({
  userRepo: {
    findByEmail: vi.fn(),
    findByUsername: vi.fn(),
    create: vi.fn(),
  },
}));

describe('POST /api/auth/register', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('rejects invalid or missing email', async () => {
    const req = new NextRequest('http://localhost/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({ email: 'notanemail', password: 'password123' }),
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toContain('valid email');
  });

  it('rejects short passwords', async () => {
    const req = new NextRequest('http://localhost/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({ email: 'user@example.com', password: '123' }),
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toContain('at least 6 characters');
  });

  it('rejects existing email with 409', async () => {
    vi.mocked(userRepo.findByEmail).mockResolvedValueOnce({
      id: 'existing-id',
      email: 'user@example.com',
      username: 'user1',
    } as any);

    const req = new NextRequest('http://localhost/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({ email: 'user@example.com', password: 'password123' }),
    });
    const res = await POST(req);
    expect(res.status).toBe(409);
    const data = await res.json();
    expect(data.error).toContain('already exists');
  });

  it('creates user with hashed password successfully', async () => {
    vi.mocked(userRepo.findByEmail).mockResolvedValueOnce(null);
    vi.mocked(userRepo.findByUsername).mockResolvedValueOnce(null);
    vi.mocked(userRepo.create).mockImplementationOnce(async (data: any) => ({
      id: 'new-user-id',
      email: data.email,
      username: data.username,
      name: data.name,
      passwordHash: data.passwordHash,
    } as any));

    const req = new NextRequest('http://localhost/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({
        name: 'New User',
        email: 'newuser@example.com',
        username: 'new_user',
        password: 'SecurePassword123!',
      }),
    });
    const res = await POST(req);
    expect(res.status).toBe(201);
    const data = await res.json();
    expect(data.ok).toBe(true);
    expect(data.user.email).toBe('newuser@example.com');
    expect(data.user.username).toBe('new_user');

    expect(userRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        email: 'newuser@example.com',
        username: 'new_user',
        name: 'New User',
        passwordHash: expect.stringMatching(/^[0-9a-f]+:[0-9a-f]+$/),
      })
    );
  });
});
