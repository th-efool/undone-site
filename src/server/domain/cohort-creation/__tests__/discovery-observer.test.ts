import { describe, expect, it, vi } from 'vitest';
vi.mock('server-only', () => ({}));
import { DiscoverySourceObserver } from '../discovery-observer';
import type { WebTransport } from '../materials/web-fetch';

const citation = { id: 'grounded-one', url: 'https://docs.example.org/lesson', title: 'Unverified provider title' };
function fixture(body = '<html><title>Actual page title</title><body>Lesson</body></html>') {
  const close = vi.fn(); const resolve = vi.fn<WebTransport['resolve']>(async () => [{ address: '93.184.216.34', family: 4 }]);
  const open = vi.fn<WebTransport['open']>(async () => ({ status: 200, headers: { 'content-type': 'text/html' },
    bytes: (async function* () { yield Buffer.from(body); })(), close }));
  const youtube = { read: vi.fn() }; const github = { getRepository: vi.fn() };
  return { close, resolve, open, youtube, github, observer: new DiscoverySourceObserver(youtube, github, { resolve, open }) };
}
describe('observed grounded discovery candidates', () => {
  it('uses actual inert HTML metadata rather than model titles and never claims content retention', async () => {
    const f = fixture('<title>Actual title</title><script>throw new Error("execute")</script><body>Lesson</body>');
    const result = await f.observer.observe(citation, new AbortController().signal);
    expect(result.title).toBe('Actual title'); expect(result.citationIds).toEqual([citation.id]);
    expect(result.observation).toEqual({ method: 'public_http', requestedUrl: citation.url, redirects: [], titleOrigin: 'observed', contentRetained: false });
    expect(f.close).toHaveBeenCalled(); expect(f.open.mock.calls[0][1]).toEqual({ address: '93.184.216.34', family: 4 });
  });
  it('resolves grounding redirects through DNS-pinned transport and preserves actual destinations', async () => {
    const f = fixture(); const original = 'https://vertexaisearch.cloud.google.com/grounding-api-redirect/fixture';
    f.open.mockResolvedValueOnce({ status: 302, headers: { location: citation.url }, bytes: (async function* () {})(), close: f.close });
    const result = await f.observer.observe({ ...citation, url: original }, new AbortController().signal);
    expect(result.url).toBe(citation.url); expect(result.observation.requestedUrl).toBe(original);
    expect(result.observation.redirects).toEqual([citation.url]); expect(f.resolve).toHaveBeenCalledTimes(2); expect(f.open).toHaveBeenCalledTimes(2);
  });
  it('rejects redirects into private addresses and closes responses without opening that destination', async () => {
    const f = fixture(); f.resolve.mockResolvedValueOnce([{ address: '93.184.216.34', family: 4 }]).mockResolvedValueOnce([{ address: '127.0.0.1', family: 4 }]);
    f.open.mockResolvedValueOnce({ status: 302, headers: { location: 'https://private.example.org/secret' }, bytes: (async function* () {})(), close: f.close });
    await expect(f.observer.observe(citation, new AbortController().signal)).rejects.toThrow('unsupported address');
    expect(f.open).toHaveBeenCalledOnce(); expect(f.close).toHaveBeenCalled();
  });
  it('labels missing page titles as application metadata and fails oversized bodies without partial candidates', async () => {
    const f = fixture('Actual plain text'); f.open.mockResolvedValueOnce({ status: 200, headers: { 'content-type': 'text/plain' },
      bytes: (async function* () { yield Buffer.from('Actual plain text'); })(), close: f.close });
    expect(await f.observer.observe(citation, new AbortController().signal)).toMatchObject({ title: 'docs.example.org/lesson', observation: { titleOrigin: 'application' } });
    const large = fixture('x'.repeat(2 * 1024 * 1024 + 1));
    await expect(large.observer.observe(citation, new AbortController().signal)).rejects.toMatchObject({ code: 'LIMIT_EXCEEDED' }); expect(large.close).toHaveBeenCalled();
  });
  it('uses public GitHub metadata, checks identity/privacy and never downloads repository HTML', async () => {
    const f = fixture(); f.github.getRepository.mockResolvedValue({ owner: { login: 'Example' }, name: 'Lessons', private: false });
    const source = { ...citation, url: 'https://github.com/Example/Lessons' };
    expect(await f.observer.observe(source, new AbortController().signal)).toMatchObject({ kind: 'github', title: 'Example/Lessons', observation: { method: 'github_api' } });
    expect(f.open).not.toHaveBeenCalled();
    f.github.getRepository.mockResolvedValue({ owner: { login: 'Other' }, name: 'Lessons', private: false });
    await expect(f.observer.observe(source, new AbortController().signal)).rejects.toThrow('different discovery metadata');
    f.github.getRepository.mockResolvedValue({ owner: { login: 'Example' }, name: 'Lessons', private: true });
    await expect(f.observer.observe(source, new AbortController().signal)).rejects.toThrow();
  });
  it('uses authoritative public YouTube metadata and does not read arbitrary video-page URLs', async () => {
    const f = fixture(); const videoId = 'dQw4w9WgXcQ'; const url = `https://www.youtube.com/watch?v=${videoId}`;
    f.youtube.read.mockResolvedValue({ schemaVersion: 1, sourceUrl: url, fetchedAt: new Date().toISOString(), kind: 'youtube_video', playlistId: null,
      coverage: 'complete_metadata', units: [{ videoId, url, title: 'Real video title', description: '', channelId: 'channel', channelTitle: 'Creator',
        durationSeconds: 120, etag: 'fixture', privacy: 'public', publishedAt: new Date().toISOString() }] });
    expect(await f.observer.observe({ ...citation, url: `https://youtu.be/${videoId}` }, new AbortController().signal))
      .toMatchObject({ url, kind: 'youtube_video', title: 'Real video title', observation: { method: 'youtube_api', contentRetained: false } });
    expect(f.open).not.toHaveBeenCalled();
  });
  it('cancels before I/O and refuses explicit Notion access through public discovery', async () => {
    const f = fixture(); const controller = new AbortController(); controller.abort();
    await expect(f.observer.observe(citation, controller.signal)).rejects.toThrow(); expect(f.open).not.toHaveBeenCalled();
    await expect(f.observer.observe({ ...citation, url: 'https://www.notion.so/11111111111141118111111111111111' }, new AbortController().signal)).rejects.toThrow('explicit connected');
    expect(f.close).toHaveBeenCalled();
  });
});
