import { afterEach, describe, expect, it, vi } from 'vitest';
vi.mock('server-only', () => ({}));
import { NotionApi } from '../materials/notion-api';
import { ProviderBackoff } from '../errors';

const id = '11111111-1111-4111-8111-111111111111';
afterEach(() => vi.useRealTimers());
describe('bounded Notion transport', () => {
  it('uses fixed endpoints, installed API version, owned bearer token and explicit pagination', async () => {
    const request = vi.fn<typeof fetch>(async () => Response.json({ ok: true }));
    const provider = new NotionApi('fixture-owned-token', request);
    await provider.getChildren(id, 'cursor/value', new AbortController().signal);
    const [address, options] = request.mock.calls[0]; const url = new URL(String(address));
    expect(url.origin).toBe('https://api.notion.com'); expect(url.pathname).toBe(`/v1/blocks/${id}/children`);
    expect(url.searchParams.get('start_cursor')).toBe('cursor/value'); expect(url.searchParams.get('page_size')).toBe('100');
    expect(options).toMatchObject({ redirect: 'error', credentials: 'omit', headers: { Authorization: 'Bearer fixture-owned-token', 'Notion-Version': '2022-06-28' } });
    expect(() => new NotionApi('token\r\nInjected: true', request)).toThrow();
  });
  it('paces sequential requests and cancels before a waiting request is sent', async () => {
    vi.useFakeTimers();
    const request = vi.fn<typeof fetch>(async () => Response.json({ ok: true }));
    const provider = new NotionApi('fixture', request);
    await provider.getPage(id, new AbortController().signal);
    const second = provider.getChildren(id, null, new AbortController().signal);
    await vi.advanceTimersByTimeAsync(349); expect(request).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1); await second; expect(request).toHaveBeenCalledTimes(2);
    const controller = new AbortController(); const third = provider.getPage(id, controller.signal);
    const rejection = expect(third).rejects.toThrow('Stop'); controller.abort(new Error('Stop'));
    await rejection; expect(request).toHaveBeenCalledTimes(2);
  });
  it.each([401, 403, 404, 429, 500])('sanitizes provider error %i and closes its body', async status => {
    const request = vi.fn<typeof fetch>(async () => Response.json({ message: 'private provider error', token: 'secret' }, { status }));
    const work = new NotionApi('fixture', request).getPage(id, new AbortController().signal);
    await expect(work).rejects.toMatchObject(status === 429 ? { detail: { code: 'RATE_LIMITED' }, retryAfterMs: 60_000 } : { code: status >= 500 ? 'UNAVAILABLE' : 'INVALID_INPUT' });
    await expect(work).rejects.not.toThrow('private provider error');
  });
  it('propagates provider minimum delays, including values beyond a job deadline, without sleeping or retrying in transport', async () => {
    for (const [status, header, delay] of [[429, '90', 90_000], [529, '600', 600_000], [503, '120', 120_000], [429, 'invalid', 60_000],
      [429, '999999999999999999999999', Number.MAX_SAFE_INTEGER]] as const) {
      const request = vi.fn<typeof fetch>(async () => Response.json({ private: true }, { status, headers: { 'Retry-After': header } }));
      await expect(new NotionApi('fixture', request).getPage(id, new AbortController().signal)).rejects.toMatchObject({ retryAfterMs: delay });
      expect(request).toHaveBeenCalledOnce();
    }
  });
  it('honors HTTP-date Retry-After and never retries forbidden source access', async () => {
    vi.useFakeTimers(); vi.setSystemTime(new Date('2026-10-10T00:00:00Z'));
    const request = vi.fn<typeof fetch>(async () => Response.json({}, { status: 429, headers: { 'Retry-After': 'Sat, 10 Oct 2026 00:02:00 GMT' } }));
    await expect(new NotionApi('fixture', request).getPage(id, new AbortController().signal)).rejects.toMatchObject({ retryAfterMs: 120_000 });
    const forbidden = vi.fn<typeof fetch>(async () => Response.json({ code: 'public_api_request_blocked' }, { status: 403, headers: { 'Retry-After': '90' } }));
    const work = new NotionApi('fixture', forbidden).getPage(id, new AbortController().signal);
    await expect(work).rejects.not.toBeInstanceOf(ProviderBackoff);
    await expect(work).rejects.toMatchObject({ code: 'INVALID_INPUT' });
  });
  it('rejects unsupported, malformed, incomplete and oversized responses', async () => {
    for (const response of [new Response('<html>private</html>', { headers: { 'Content-Type': 'text/html' } }),
      new Response('{', { headers: { 'Content-Type': 'application/json' } }),
      new Response('{}', { headers: { 'Content-Type': 'application/json', 'Content-Length': '100' } }),
      new Response('{}', { headers: { 'Content-Type': 'application/json', 'Content-Length': String(4 * 1024 * 1024 + 1) } }),
      new Response(new Uint8Array(4 * 1024 * 1024 + 1), { headers: { 'Content-Type': 'application/json' } })]) {
      const request = vi.fn<typeof fetch>(async () => response);
      await expect(new NotionApi('fixture', request).getPage(id, new AbortController().signal)).rejects.toThrow();
    }
  });
  it('cancels stalled streaming reads and never starts already aborted requests', async () => {
    const cancel = vi.fn(); const body = new ReadableStream<Uint8Array>({ cancel });
    const request = vi.fn<typeof fetch>(async () => new Response(body, { headers: { 'Content-Type': 'application/json' } }));
    const provider = new NotionApi('fixture', request); const controller = new AbortController();
    const work = provider.getPage(id, controller.signal); const rejection = expect(work).rejects.toThrow('Stop');
    await vi.waitFor(() => expect(body.locked).toBe(true)); controller.abort(new Error('Stop')); await rejection;
    expect(cancel).toHaveBeenCalled();
    await expect(provider.getPage(id, controller.signal)).rejects.toThrow('Stop'); expect(request).toHaveBeenCalledOnce();
  });
  it('rejects invalid page IDs and cursors before any network request', async () => {
    const request = vi.fn<typeof fetch>(); const provider = new NotionApi('fixture', request);
    expect(() => provider.getPage('../private', new AbortController().signal)).toThrow();
    await expect(provider.getChildren(id, 'bad\r\ncursor', new AbortController().signal)).rejects.toThrow();
    expect(request).not.toHaveBeenCalled();
  });
});
