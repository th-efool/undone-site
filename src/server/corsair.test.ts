import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ config: vi.fn(), create: vi.fn(), pool: vi.fn(), next: vi.fn() }));
vi.mock('dotenv/config', () => ({}));
vi.mock('./corsair-config', () => ({ readCorsairConfig: mocks.config }));
vi.mock('corsair', () => ({ createCorsair: mocks.create, toNextJsHandler: mocks.next }));
vi.mock('@corsair-dev/github', () => ({ github: () => ({}) }));
vi.mock('@corsair-dev/notion', () => ({ notion: () => ({}) }));
vi.mock('pg', () => ({ Pool: class { constructor() { mocks.pool(); } } }));

beforeEach(() => { vi.resetModules(); vi.clearAllMocks();
  mocks.config.mockReturnValue({ connectionString: 'fixture', kek: 'fixture', hub: {} });
  mocks.create.mockReturnValue({ fixture: true });
});
describe('lazy Corsair runtime', () => {
  it('does not read credentials or open a pool on import; reuses one runtime on use', async () => {
    const { getCorsair } = await import('./corsair');
    expect(mocks.config).not.toHaveBeenCalled();
    expect(mocks.pool).not.toHaveBeenCalled();
    expect(getCorsair()).toBe(getCorsair());
    expect(mocks.config).toHaveBeenCalledOnce();
    expect(mocks.create).toHaveBeenCalledOnce();
    expect(mocks.pool).toHaveBeenCalledOnce();
  });
  it('does not cache failed configuration or open a pool with invalid credentials', async () => {
    mocks.config.mockImplementationOnce(() => { throw new Error('invalid configuration'); });
    const { getCorsair } = await import('./corsair');
    expect(() => getCorsair()).toThrow('invalid configuration');
    expect(mocks.pool).not.toHaveBeenCalled();
    expect(getCorsair()).toEqual({ fixture: true });
  });
  it('keeps route discovery safe and returns generic 503 until configuration is restored', async () => {
    mocks.config.mockImplementationOnce(() => { throw new Error('secret detail'); });
    const request = new Request('https://fixture.test/api/corsair');
    const route = await import('../app/api/corsair/[[...path]]/route');
    expect(mocks.config).not.toHaveBeenCalled();
    const unavailable = await route.GET(request);
    expect(unavailable.status).toBe(503);
    expect(await unavailable.text()).not.toContain('secret detail');
    const GET = vi.fn(async () => new Response('ready'));
    const POST = vi.fn(async () => new Response('post'));
    const OPTIONS = vi.fn(async () => new Response(null, { status: 204 }));
    mocks.next.mockReturnValue({ GET, POST, OPTIONS });
    expect(await (await route.GET(request)).text()).toBe('ready');
    await route.POST(request); await route.OPTIONS(request);
    expect(GET).toHaveBeenCalledWith(request);
    expect(POST).toHaveBeenCalledWith(request);
    expect(OPTIONS).toHaveBeenCalledWith(request);
    expect(mocks.next).toHaveBeenCalledOnce();
  });
});
