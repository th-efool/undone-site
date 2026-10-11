import { afterEach, describe, expect, it, vi } from 'vitest';
import { draftApi, DraftApiError } from '../services/draftApi';
import { initialSnapshot } from '@/src/shared/cohort-creation/flow';
import { draftId } from '@/src/shared/cohort-creation/__tests__/fixtures';
import { CREATION_REQUEST_TIMEOUT_MS } from '../services/creationTransport';
afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); vi.unstubAllEnvs(); });
describe('durable draft transport', () => {
  it('bounds a stalled fetch without retrying a mutation', async () => {
    vi.useFakeTimers();
    const fetcher = vi.fn((_url: string, init: RequestInit) => new Promise<Response>((_resolve, reject) => {
      init.signal!.addEventListener('abort', () => reject(init.signal!.reason), { once: true });
    }));
    vi.stubGlobal('fetch', fetcher);
    const pending = expect(draftApi.command(draftId, 0, { type: 'create_own' })).rejects.toMatchObject({ status: 408 });
    await vi.advanceTimersByTimeAsync(CREATION_REQUEST_TIMEOUT_MS); await pending;
    expect(fetcher).toHaveBeenCalledOnce();
  });
  it('also bounds reading a response body', async () => {
    vi.useFakeTimers();
    vi.stubGlobal('fetch', vi.fn(async (_url, init: RequestInit) => ({ status: 200, ok: true,
      json: () => new Promise((_resolve, reject) => init.signal!.addEventListener('abort', () => reject(init.signal!.reason), { once: true })),
    })));
    const pending = expect(draftApi.load(draftId)).rejects.toMatchObject({ status: 408 });
    await vi.advanceTimersByTimeAsync(CREATION_REQUEST_TIMEOUT_MS); await pending;
  });
  it('classifies proxy errors and malformed success responses without exposing HTML', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(new Response('<html>proxy details</html>', { status: 503 }))
      .mockResolvedValueOnce(new Response('<html>unexpected success</html>')));
    await expect(draftApi.load(draftId)).rejects.toMatchObject({ status: 503, message: 'Draft could not be saved or loaded. Try again.' });
    await expect(draftApi.load(draftId)).rejects.toMatchObject({ status: 502 });
  });
  it('preserves actionable server limits and retry timing', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => Response.json({ message: 'The generation budget is exhausted.' }, { status: 429, headers: { 'Retry-After': '60' } })));
    await expect(draftApi.load(draftId)).rejects.toMatchObject({ status: 429, retryAfterSeconds: 60, message: 'The generation budget is exhausted. Try again in 60 seconds.' });
  });
  it('uses configured API origin/credentials and respects caller cancellation', async () => {
    vi.stubEnv('NEXT_PUBLIC_API_ORIGIN', 'https://example.com');
    const controller = new AbortController();
    const fetcher = vi.fn(async (_url, init: RequestInit) => { controller.abort(); throw init.signal!.reason; });
    vi.stubGlobal('fetch', fetcher);
    await expect(draftApi.load(draftId, controller.signal)).rejects.toMatchObject({ name: 'AbortError' });
    expect(fetcher.mock.calls[0][0]).toBe(`https://example.com/api/cohort-creation/drafts/${draftId}`);
    expect(fetcher.mock.calls[0][1].credentials).toBe('include');
  });
  it('loads a validated server snapshot without session storage', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => Response.json(initialSnapshot(draftId))));
    expect(await draftApi.load(draftId)).toEqual(initialSnapshot(draftId));
  });
  it('preserves the canonical server snapshot on revision conflict', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => Response.json({ current: initialSnapshot(draftId) }, { status: 409 })));
    try { await draftApi.command(draftId, 99, { type: 'create_own' }); } catch (error) {
      expect(error).toBeInstanceOf(DraftApiError);
      expect((error as DraftApiError).current).toEqual(initialSnapshot(draftId));
      return;
    }
    throw new Error('Expected conflict');
  });
});
