// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { renderHook, act, waitFor, cleanup } from '@testing-library/react';

const youtube = vi.hoisted(() => vi.fn());
const web = vi.hoisted(() => vi.fn());
vi.mock('@/src/client/lib/sourceExtractors/youtubeClientExtractor', () => ({ extractYoutubeClient: youtube }));
vi.mock('@/src/client/lib/sourceExtractors/webClientExtractor', () => ({ extractWebClient: web }));
vi.mock('@/src/client/lib/sourceExtractors/githubClientExtractor', () => ({ extractGithubClient: vi.fn() }));
vi.mock('@/src/client/lib/sourceExtractors/pdfClientExtractor', () => ({ extractPdfClient: vi.fn() }));

import { useComposerAttachments } from '../useComposerAttachments';

const ok = (text: string) => ({ text, locations: [{ start: 0, end: text.length }], checksum: 'a'.repeat(64) });

afterEach(() => { cleanup(); vi.restoreAllMocks(); youtube.mockReset(); web.mockReset(); });

describe('useComposerAttachments', () => {
  it('expands a YouTube playlist into one card per video', async () => {
    const videos = Array.from({ length: 7 }, (_, i) => ({ videoId: `vid${String(i).padStart(8, '0')}`, title: `V${i}`, description: '', durationMs: 60_000 }));
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => ({ isPlaylist: true, videos }) })));
    youtube.mockImplementation(async () => ok('video text'));

    const { result } = renderHook(() => useComposerAttachments());
    await act(async () => { await result.current.addLink('https://www.youtube.com/playlist?list=PLabc'); });

    await waitFor(() => expect(result.current.links.filter((l) => l.status === 'ready')).toHaveLength(7));
    expect(result.current.links.map((l) => l.url)[0]).toBe('https://www.youtube.com/watch?v=vid00000000');
    expect(result.current.getReadySources()).toHaveLength(7);
  });

  it('rejects material beyond the 3 MB text budget instead of failing later at intake', async () => {
    web.mockImplementation(async (url: string) => ({ title: url, ...ok('x'.repeat(2 * 1024 * 1024)) }));
    const { result } = renderHook(() => useComposerAttachments());
    await act(async () => { await result.current.addLink('https://a.com/1'); await result.current.addLink('https://a.com/2'); });

    await waitFor(() => expect(result.current.isExtracting).toBe(false));
    expect(result.current.links.map((l) => l.status).sort()).toEqual(['error', 'ready']);
    expect(result.current.errors.join()).toMatch(/Material limit/);
  });

  it('ignores duplicate URLs and reports isExtracting while work is pending', async () => {
    let release!: () => void;
    web.mockImplementation(() => new Promise((resolve) => { release = () => resolve({ title: 't', ...ok('hello') }); }));
    const { result } = renderHook(() => useComposerAttachments());
    await act(async () => { await result.current.addLink('https://a.com/p'); await result.current.addLink('https://a.com/p'); });
    expect(result.current.links).toHaveLength(1);
    expect(result.current.isExtracting).toBe(true);
    await act(async () => { release(); });
    await waitFor(() => expect(result.current.isExtracting).toBe(false));
  });
});
