import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { encode } from 'next-auth/jwt';
import { configureRequestOriginAuth } from '../auth.environment';
import { getGuestAccount } from '../guestAccount';

const state = vi.hoisted(() => ({ headers: new Headers(), findUnique: vi.fn(), upsert: vi.fn() }));
vi.mock('server-only', () => ({}));
vi.mock('next/headers', () => ({ headers: async () => state.headers }));
vi.mock('@/src/server/infrastructure/db/postgres/client', () => ({ prisma: { user: { findUnique: state.findUnique, upsert: state.upsert } } }));

let config: typeof import('../auth.config');
beforeAll(async () => {
  vi.stubEnv('AUTH_URL', 'https://www.sidequesthq.in');
  vi.stubEnv('NEXTAUTH_URL', 'https://www.sidequesthq.in');
  vi.stubEnv('AUTH_SECRET', 'test-auth-secret-with-at-least-32-characters');
  config = await import('../auth.config');
});
beforeEach(() => { vi.clearAllMocks(); state.headers = new Headers({ host: 'www.undone.one', 'x-forwarded-proto': 'https' }); });
afterAll(() => vi.unstubAllEnvs());

describe('request-origin auth and database-backed sessions', () => {
  it('removes stale fixed origins without changing secrets or provider configuration', () => {
    const env = { AUTH_URL: 'https://sidequesthq.in', NEXTAUTH_URL: 'https://sidequesthq.in', AUTH_SECRET: 'kept', AUTH_GITHUB_ID: 'kept' };
    configureRequestOriginAuth(env);
    expect(env).toEqual({ AUTH_SECRET: 'kept', AUTH_GITHUB_ID: 'kept' });
    expect(process.env.AUTH_URL).toBeUndefined(); expect(process.env.NEXTAUTH_URL).toBeUndefined();
  });
  it.each(['https://undone.one', 'https://www.undone.one', 'https://www.sidequesthq.in', 'http://localhost:3000'])('keeps actual provider callbacks on %s', async origin => {
    const response = await config.handlers.GET(new NextRequest(`${origin}/api/auth/providers`));
    expect(response.status).toBe(200);
    const providers = await response.json();
    expect(providers.github.callbackUrl).toBe(`${origin}/api/auth/callback/github`);
    expect(providers.credentials.signinUrl).toBe(`${origin}/api/auth/signin/credentials`);
  });
  it('recognizes an existing secure session and database owner on creation entry', async () => {
    const id = '22222222-2222-4222-8222-222222222222';
    const cookie = '__Secure-authjs.session-token';
    const token = await encode({ token: { sub: id, name: 'Existing learner', email: 'learner@example.test' }, salt: cookie,
      secret: process.env.AUTH_SECRET! });
    state.headers.set('cookie', `${cookie}=${token}`);
    state.findUnique.mockResolvedValue({ id });
    const { getCreationOwner } = await import('../getCreationOwner');
    expect(await getCreationOwner()).toBe(id);
    expect(state.findUnique).toHaveBeenCalledWith({ where: { id }, select: { id: true } });
  });
  it('does not grant draft ownership to a stale mock session', async () => {
    const cookie = '__Secure-authjs.session-token';
    const token = await encode({ token: { sub: 'guest-explorer-dev-id' }, salt: cookie, secret: process.env.AUTH_SECRET! });
    state.headers.set('cookie', `${cookie}=${token}`); state.findUnique.mockResolvedValue(null);
    const { getCreationOwner } = await import('../getCreationOwner');
    expect(await getCreationOwner()).toBeNull();
  });
  it('keeps an existing real guest account and provisions missing guests idempotently', async () => {
    const user = { id: 'real-guest-id', name: 'Guest Explorer', email: 'guest@undone.com', username: 'guest' };
    state.findUnique.mockResolvedValueOnce(user).mockResolvedValueOnce(null);
    state.upsert.mockResolvedValue({ ...user, username: 'guest-undone' });
    expect(await getGuestAccount(user.email, state)).toBe(user);
    expect(state.upsert).not.toHaveBeenCalled();
    expect((await getGuestAccount(user.email, state))?.id).toBe(user.id);
    expect(state.upsert).toHaveBeenCalledWith({ where: { email: user.email }, update: {},
      create: { email: user.email, name: 'Guest Explorer', username: 'guest-undone' } });
  });
  it('never creates a mock account after SQL failure and rejects arbitrary credentials', async () => {
    expect(await getGuestAccount('other@example.test', state)).toBeNull();
    expect(state.findUnique).not.toHaveBeenCalled();
    state.findUnique.mockRejectedValue(new Error('SQL unavailable'));
    await expect(getGuestAccount('guest@undone.com', state)).rejects.toThrow('SQL unavailable');
    expect(state.upsert).not.toHaveBeenCalled();
  });
  it.each([true, false])('actual guest callback stays on the current domain; database available=%s', async available => {
    const origin = 'https://www.undone.one';
    const csrf = await config.handlers.GET(new NextRequest(`${origin}/api/auth/csrf`));
    const { csrfToken } = await csrf.json();
    const cookie = csrf.headers.getSetCookie().map(value => value.split(';')[0]).join('; ');
    if (available) state.findUnique.mockResolvedValue({ id: 'real-user', email: 'guest@undone.com', name: 'Guest Explorer', username: 'guest' });
    else state.findUnique.mockRejectedValue(new Error('SQL unavailable'));
    const warning = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    try {
      const response = await config.handlers.POST(new NextRequest(`${origin}/api/auth/callback/credentials`, {
        method: 'POST', headers: { cookie, 'content-type': 'application/x-www-form-urlencoded', 'x-auth-return-redirect': '1' },
        body: new URLSearchParams({ csrfToken, email: 'guest@undone.com', callbackUrl: `${origin}/quest/new?q=rendering` }),
      }));
      const body = await response.json();
      expect(new URL(body.url).origin).toBe(origin);
      if (available) {
        expect(body.url).toBe(`${origin}/quest/new?q=rendering`);
        expect(response.headers.getSetCookie().some(value => value.startsWith('__Secure-authjs.session-token='))).toBe(true);
      } else {
        expect(body.url).toContain('error=CredentialsSignin');
        expect(response.headers.getSetCookie().some(value => value.startsWith('__Secure-authjs.session-token='))).toBe(false);
      }
    } finally { warning.mockRestore(); }
  });
  it('sends GitHub the current app callback URI instead of the legacy domain', async () => {
    const origin = 'https://www.undone.one';
    const csrf = await config.handlers.GET(new NextRequest(`${origin}/api/auth/csrf`));
    const { csrfToken } = await csrf.json();
    const cookie = csrf.headers.getSetCookie().map(value => value.split(';')[0]).join('; ');
    const response = await config.handlers.POST(new NextRequest(`${origin}/api/auth/signin/github`, {
      method: 'POST', headers: { cookie, 'content-type': 'application/x-www-form-urlencoded', 'x-auth-return-redirect': '1' },
      body: new URLSearchParams({ csrfToken, callbackUrl: `${origin}/quest/new?q=rendering` }),
    }));
    const { url } = await response.json();
    expect(new URL(url).hostname).toBe('github.com');
    expect(new URL(url).searchParams.get('redirect_uri')).toBe(`${origin}/api/auth/callback/github`);
  });
});
