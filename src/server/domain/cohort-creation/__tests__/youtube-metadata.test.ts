import { describe, expect, it, vi } from 'vitest';
vi.mock('server-only', () => ({}));
import { YoutubeMetadataReader } from '../materials/youtube-metadata';
import { youtubeSourceUrl } from '../materials/youtube-url';

const id = 'dQw4w9WgXcQ'; const playlistId = 'PLlearningMaterials';
const videoUrl = `https://www.youtube.com/watch?v=${id}`;
function video(videoId = id) { return { id: videoId, etag: 'real-provider-etag',
  snippet: { title: 'Lighting lesson', description: 'Actual provider description', channelId: 'channel', channelTitle: 'Teacher', publishedAt: '2026-01-01T00:00:00Z', liveBroadcastContent: 'none' },
  contentDetails: { duration: 'PT1H2M3S' }, status: { privacyStatus: 'public', uploadStatus: 'processed' } }; }
function reader(body: unknown) {
  const fetcher = vi.fn<typeof fetch>(async () => Response.json(body));
  return { fetcher, service: new YoutubeMetadataReader('test-secret', fetcher) };
}
describe('strict YouTube source identity', () => {
  it.each([`https://youtu.be/${id}?v=AAAAAAAAAAA`, `https://m.youtube.com/watch?v=${id}&list=${playlistId}`, `https://youtube.com/shorts/${id}`, `https://www.youtube.com/embed/${id}`])('canonicalizes a supported URL: %s', url => {
    expect(youtubeSourceUrl(url)).toEqual({ kind: 'youtube_video', videoId: id, url: videoUrl });
  });
  it('identifies an explicit playlist without mixing it with a watch URL', () => {
    expect(youtubeSourceUrl(`https://youtube.com/playlist?list=${playlistId}`)).toEqual({ kind: 'youtube_playlist', playlistId, url: `https://www.youtube.com/playlist?list=${playlistId}` });
  });
  it.each([`http://youtube.com/watch?v=${id}`, `https://youtube.com.attacker.com/watch?v=${id}`, `https://notyoutube.com/watch?v=${id}`, `https://user:pass@youtube.com/watch?v=${id}`, `https://youtu.be/${id}/extra`, `https://youtube.com/watch?v=${id}&v=AAAAAAAAAAA`, 'https://youtube.com/watch?v=bad', 'https://youtube.com/playlist?list=bad', `https://youtube.com/watch?v=${id}\\junk`])('rejects unsupported/spoofed identity: %s', url => {
    expect(() => youtubeSourceUrl(url)).toThrow('public HTTPS YouTube');
  });
});
describe('bounded public YouTube metadata', () => {
  it('reads actual metadata without a fake transcript, default duration or exposed key', async () => {
    const f = reader({ items: [video()] }); const result = await f.service.read(videoUrl);
    expect(result.units[0]).toMatchObject({ videoId: id, durationSeconds: 3723, title: 'Lighting lesson', etag: 'real-provider-etag' });
    expect(result.coverage).toBe('complete_metadata'); expect(result).not.toHaveProperty('extraction');
    expect(JSON.stringify(result)).not.toContain('test-secret');
    const [url, options] = f.fetcher.mock.calls[0];
    expect(String(url)).toContain('https://www.googleapis.com/youtube/v3/videos?'); expect(String(url)).not.toContain('test-secret');
    expect(options).toMatchObject({ redirect: 'error', credentials: 'omit', headers: { 'X-Goog-Api-Key': 'test-secret' } });
  });
  it('paginates playlists and restores playlist order from unordered video responses', async () => {
    const ids = Array.from({ length: 51 }, (_, i) => `v${String(i).padStart(10, '0')}`);
    const fetcher = vi.fn<typeof fetch>(async input => {
      const url = new URL(String(input));
      if (url.pathname.endsWith('playlistItems')) {
        const offset = url.searchParams.has('pageToken') ? 50 : 0;
        return Response.json({ items: ids.slice(offset, offset + 50).map((videoId, index) => ({ contentDetails: { videoId }, snippet: { position: offset + index } })),
          pageInfo: { totalResults: 51 }, ...(offset ? {} : { nextPageToken: 'next-page' }) });
      }
      return Response.json({ items: url.searchParams.get('id')!.split(',').reverse().map(video) });
    });
    const result = await new YoutubeMetadataReader('test', fetcher).read(`https://youtube.com/playlist?list=${playlistId}`);
    expect(result.units.map(unit => unit.videoId)).toEqual(ids); expect(fetcher).toHaveBeenCalledTimes(4);
  });
  it.each(['private', 'unlisted'])('rejects %s metadata rather than promising provider access', async privacy => {
    const item = video(); item.status.privacyStatus = privacy;
    await expect(reader({ items: [item] }).service.read(videoUrl)).rejects.toThrow('private, unlisted or live');
  });
  it('rejects unavailable/live/incomplete/malformed metadata without guessed values', async () => {
    const live = video(); live.snippet.liveBroadcastContent = 'live';
    const missingDuration = video(); missingDuration.contentDetails.duration = '';
    for (const body of [{ items: [] }, { items: [live] }, { items: [{ id }] }, { items: [missingDuration] }, { items: [video('AAAAAAAAAAA')] }]) {
      await expect(reader(body).service.read(videoUrl)).rejects.toThrow();
    }
    const oversizedTitle = video(); oversizedTitle.snippet.title = 'x'.repeat(1001);
    await expect(reader({ items: [oversizedTitle] }).service.read(videoUrl)).rejects.toThrow('Nothing was truncated');
  });
  it('rejects oversized, duplicate, missing or looping playlist pages explicitly', async () => {
    const item = { contentDetails: { videoId: id }, snippet: { position: 0 } };
    for (const body of [
      { items: [item], pageInfo: { totalResults: 101 } },
      { items: [item, { ...item, snippet: { position: 1 } }], pageInfo: { totalResults: 2 } },
      { items: [item], pageInfo: { totalResults: 2 } },
    ]) await expect(reader(body).service.read(`https://youtube.com/playlist?list=${playlistId}`)).rejects.toThrow();
    let page = 0;
    const fetcher = vi.fn<typeof fetch>(async () => Response.json({ items: [{ contentDetails: { videoId: page ? 'AAAAAAAAAAA' : id }, snippet: { position: page++ } }], pageInfo: { totalResults: 3 }, nextPageToken: 'same' }));
    await expect(new YoutubeMetadataReader('test', fetcher).read(`https://youtube.com/playlist?list=${playlistId}`)).rejects.toThrow('pagination');
    expect(fetcher).toHaveBeenCalledTimes(2);
  });
  it('sanitizes quota/network failures and enforces the response byte ceiling', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValueOnce(Response.json({ error: 'private provider payload' }, { status: 403 }))
      .mockRejectedValueOnce(new Error('test-secret private request'))
      .mockResolvedValueOnce(new Response('x', { headers: { 'Content-Type': 'application/json', 'Content-Length': String(2 * 1024 * 1024 + 1) } }))
      .mockResolvedValueOnce(new Response('x'.repeat(2 * 1024 * 1024 + 1), { headers: { 'Content-Type': 'application/json' } }));
    const service = new YoutubeMetadataReader('test-secret', fetcher);
    await expect(service.read(videoUrl)).rejects.toThrow('access or quota');
    await expect(service.read(videoUrl)).rejects.toThrow('could not be reached');
    await expect(service.read(videoUrl)).rejects.toMatchObject({ code: 'LIMIT_EXCEEDED' });
    await expect(service.read(videoUrl)).rejects.toMatchObject({ code: 'LIMIT_EXCEEDED' });
  });
  it('does no I/O without configuration or after cancellation and cancels pending body reads', async () => {
    const f = reader({ items: [video()] });
    await expect(new YoutubeMetadataReader('', f.fetcher).read(videoUrl)).rejects.toThrow('not configured'); expect(f.fetcher).not.toHaveBeenCalled();
    const stopped = new AbortController(); stopped.abort();
    await expect(f.service.read(videoUrl, stopped.signal)).rejects.toThrow(); expect(f.fetcher).not.toHaveBeenCalled();
    const controller = new AbortController(); const cancel = vi.fn();
    const body = new ReadableStream<Uint8Array>({ cancel });
    f.fetcher.mockResolvedValueOnce(new Response(body, { headers: { 'Content-Type': 'application/json' } }));
    const work = f.service.read(videoUrl, controller.signal);
    await vi.waitFor(() => expect(body.locked).toBe(true)); controller.abort(new Error('stop'));
    await expect(work).rejects.toThrow('stop'); expect(cancel).toHaveBeenCalledOnce(); expect(body.locked).toBe(false);
  });
});
