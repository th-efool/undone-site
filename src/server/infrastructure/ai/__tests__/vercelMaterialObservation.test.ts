import { afterEach, describe, expect, it, vi } from 'vitest';
vi.mock('server-only', () => ({}));
import { MockLanguageModelV4 } from 'ai/test';
import { modelOutput } from '@/src/shared/cohort-creation/__tests__/fixtures';
import { youtubeVideoMetadataSchema } from '@/src/shared/cohort-creation/youtube';
import { validateVideoObservation, videoObservationCoverage } from '@/src/server/domain/cohort-creation/material-observation';
import { VercelMaterialObservation } from '../vercelMaterialObservation';

const video = youtubeVideoMetadataSchema.parse({ videoId: 'dQw4w9WgXcQ', url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
  title: 'Lighting lesson', description: 'Provider metadata', channelId: 'channel', channelTitle: 'Teacher',
  durationSeconds: 120, etag: 'etag', privacy: 'public', publishedAt: '2026-01-01T00:00:00Z' });
const proposal = { canObserve: true, observations: [{ startSeconds: 10, endSeconds: 50, text: 'The instructor demonstrates a lighting setup.' },
  { startSeconds: 60, endSeconds: 100, text: 'Reflectance changes alter the observed material response.' }], limitations: ['Fine text is not legible.'] };
const supportedUrls = { 'video/*': [/^https:\/\/www\.youtube\.com\/watch\?v=/] };
afterEach(() => vi.unstubAllGlobals());
describe('bounded Vercel video observation', () => {
  it('sends one native file URL through the SDK without application downloads or tool loops', async () => {
    const fetch = vi.fn(() => { throw new Error('Unexpected download'); }); vi.stubGlobal('fetch', fetch);
    const model = new MockLanguageModelV4({ provider: 'google.generative-ai', supportedUrls, doGenerate: modelOutput(proposal) });
    const release = vi.fn(async () => {}); const beforeCall = vi.fn(async () => release);
    expect(await new VercelMaterialObservation(model, { beforeCall }).observeVideo(video, new AbortController().signal)).toEqual(proposal);
    const call = model.doGenerateCalls[0]; expect(call.responseFormat?.type).toBe('json'); expect(call.maxOutputTokens).toBe(12_000);
    expect(call.responseFormat).toMatchObject({ schema: { properties: { observations: { items: { properties: {
      startSeconds: { maximum: video.durationSeconds }, endSeconds: { maximum: video.durationSeconds },
    } } } } } });
    const files = call.prompt.flatMap(message => message.role === 'user' ? message.content.filter(part => part.type === 'file') : []);
    expect(files).toHaveLength(1); expect(files[0]).toMatchObject({ type: 'file', mediaType: 'video/mp4', data: new URL(video.url) });
    expect(fetch).not.toHaveBeenCalled(); expect(beforeCall).toHaveBeenCalledWith(video.videoId); expect(release).toHaveBeenCalledOnce();
  });
  it('derives honest estimated gaps and never claims exhaustive or transcript coverage', () => {
    expect(videoObservationCoverage(proposal, video)).toEqual({ kind: 'model_observation', exhaustive: false, timestampsEstimated: true,
      unobservedRanges: [{ startSeconds: 0, endSeconds: 10 }, { startSeconds: 50, endSeconds: 60 }, { startSeconds: 100, endSeconds: 120 }], limitations: proposal.limitations });
    expect(videoObservationCoverage({ ...proposal, observations: [{ startSeconds: 0, endSeconds: 120, text: 'Observed lesson' }] }, video).exhaustive).toBe(false);
  });
  it('repairs malformed schema once with a separate reservation and refuses repeated invalid output', async () => {
    const release = vi.fn(async () => {}); const beforeCall = vi.fn(async () => release);
    const model = new MockLanguageModelV4({ supportedUrls, doGenerate: [modelOutput({ wrong: true }), modelOutput(proposal)] });
    await new VercelMaterialObservation(model, { beforeCall }).observeVideo(video, new AbortController().signal);
    expect(beforeCall).toHaveBeenCalledTimes(2); expect(release).toHaveBeenCalledTimes(2);
    const invalid = new MockLanguageModelV4({ supportedUrls, doGenerate: modelOutput({ wrong: true }) });
    await expect(new VercelMaterialObservation(invalid, { beforeCall }).observeVideo(video, new AbortController().signal)).rejects.toMatchObject({ detail: { code: 'AI_INVALID_OUTPUT' } });
    expect(invalid.doGenerateCalls).toHaveLength(2);
  });
  it('rejects impossible, overlapping and out-of-duration ranges after schema validation', () => {
    for (const observations of [[], [{ startSeconds: 50, endSeconds: 20, text: 'bad' }],
      [{ startSeconds: 0, endSeconds: 121, text: 'bad' }],
      [{ startSeconds: 0, endSeconds: 80, text: 'first' }, { startSeconds: 60, endSeconds: 100, text: 'overlap' }]]) {
      expect(() => validateVideoObservation({ ...proposal, observations }, video)).toThrow();
    }
    expect(() => validateVideoObservation({ canObserve: false, observations: [], limitations: ['Unavailable'] }, video)).toThrow('could not observe');
    expect(() => validateVideoObservation({ ...proposal, canObserve: false }, video)).toThrow('inconsistent');
  });
  it.each([
    [{ startSeconds: 0, endSeconds: 80, text: 'First' }, { startSeconds: 60, endSeconds: 100, text: 'Overlap' }],
    [{ startSeconds: 0, endSeconds: 121, text: 'Outside duration' }],
    [{ startSeconds: 50, endSeconds: 20, text: 'Reversed interval' }],
  ])('repairs invalid intervals once without accepting or modifying the first output: %j', async (...observations) => {
    const release = vi.fn(async () => {}); const beforeCall = vi.fn(async () => release);
    const model = new MockLanguageModelV4({ supportedUrls, doGenerate: [modelOutput({ ...proposal, observations }), modelOutput(proposal)] });
    expect(await new VercelMaterialObservation(model, { beforeCall }).observeVideo(video, new AbortController().signal)).toEqual(proposal);
    expect(beforeCall).toHaveBeenCalledTimes(2); expect(release).toHaveBeenCalledTimes(2);
    const prompt = model.doGenerateCalls[1].prompt.flatMap(message => message.role === 'user' ? message.content.filter(part => part.type === 'text') : []);
    expect(JSON.stringify(prompt)).toContain('correction');
    expect(JSON.stringify(prompt)).toContain('numeric seconds');
  });
  it('exhausts semantic repair after two calls and never retries an inaccessible video', async () => {
    const invalid = new MockLanguageModelV4({ supportedUrls, doGenerate: modelOutput({ ...proposal, observations: [{ startSeconds: 0, endSeconds: 121, text: 'Invalid' }] }) });
    const release = vi.fn(async () => {}); const beforeCall = vi.fn(async () => release);
    await expect(new VercelMaterialObservation(invalid, { beforeCall }).observeVideo(video, new AbortController().signal)).rejects.toMatchObject({ detail: { code: 'AI_INVALID_OUTPUT' } });
    expect(invalid.doGenerateCalls).toHaveLength(2); expect(release).toHaveBeenCalledTimes(2);
    const inaccessible = new MockLanguageModelV4({ supportedUrls, doGenerate: modelOutput({ canObserve: false, observations: [], limitations: ['Unavailable'] }) });
    await expect(new VercelMaterialObservation(inaccessible, { beforeCall }).observeVideo(video, new AbortController().signal)).rejects.toMatchObject({ detail: { code: 'DATA_UNAVAILABLE' } });
    expect(inaccessible.doGenerateCalls).toHaveLength(1);
  });
  it('does not reserve a repair call after cancellation', async () => {
    const stopped = new AbortController();
    const release = vi.fn(async () => { stopped.abort(new Error('Canceled between attempts')); });
    const beforeCall = vi.fn(async () => release);
    const model = new MockLanguageModelV4({ supportedUrls, doGenerate: modelOutput({ ...proposal, observations: [] }) });
    await expect(new VercelMaterialObservation(model, { beforeCall }).observeVideo(video, stopped.signal)).rejects.toThrow('Canceled between attempts');
    expect(model.doGenerateCalls).toHaveLength(1); expect(beforeCall).toHaveBeenCalledOnce();
  });
  it('does not silently accept or repair token-truncated observations', async () => {
    const model = new MockLanguageModelV4({ supportedUrls, doGenerate: { ...modelOutput(proposal), finishReason: { unified: 'length', raw: 'MAX_TOKENS' } } });
    await expect(new VercelMaterialObservation(model, { beforeCall: async () => {} }).observeVideo(video, new AbortController().signal)).rejects.toMatchObject({ detail: { code: 'AI_INVALID_OUTPUT', retryable: false } });
    expect(model.doGenerateCalls).toHaveLength(1);
  });
  it('rejects unsupported model capabilities and forged URLs before reservation or I/O', async () => {
    const beforeCall = vi.fn(); const model = new MockLanguageModelV4({ doGenerate: modelOutput(proposal) });
    await expect(new VercelMaterialObservation(model, { beforeCall }).observeVideo(video, new AbortController().signal)).rejects.toThrow('does not accept native');
    await expect(new VercelMaterialObservation(model, { beforeCall }).observeVideo({ ...video, url: 'https://attacker.example/video' }, new AbortController().signal)).rejects.toThrow('Canonical');
    expect(beforeCall).not.toHaveBeenCalled(); expect(model.doGenerateCalls).toHaveLength(0);
  });
  it('preserves reservation failure, aborts without provider work and sanitizes provider failures', async () => {
    const model = new MockLanguageModelV4({ supportedUrls, doGenerate: async () => { throw new Error('private-provider-payload'); } });
    const failure = new Error('lease lost');
    await expect(new VercelMaterialObservation(model, { beforeCall: async () => { throw failure; } }).observeVideo(video, new AbortController().signal)).rejects.toBe(failure);
    const stopped = new AbortController(); stopped.abort(new Error('stop'));
    await expect(new VercelMaterialObservation(model, { beforeCall: async () => {} }).observeVideo(video, stopped.signal)).rejects.toThrow('stop');
    expect(model.doGenerateCalls).toHaveLength(0);
    await expect(new VercelMaterialObservation(model, { beforeCall: async () => {} }).observeVideo(video, new AbortController().signal)).rejects.toMatchObject({ detail: { code: 'AI_UNAVAILABLE', message: 'Video observation is unavailable. Retry or supply authorized transcript/text material.' } });
  });
  it('extracts author chapters from description for long videos without calling model generateText', async () => {
    const longVideo = {
      ...video,
      durationSeconds: 14500,
      description: '00:00 - Intro\n01:00 - Chapter 1\n02:00 - Chapter 2\n03:00 - Conclusion',
    };
    const model = new MockLanguageModelV4({ supportedUrls, doGenerate: modelOutput(proposal) });
    const release = vi.fn(async () => {});
    const beforeCall = vi.fn(async () => release);
    const result = await new VercelMaterialObservation(model, { beforeCall }).observeVideo(longVideo, new AbortController().signal);
    expect(result.canObserve).toBe(true);
    expect(result.observations).toHaveLength(4);
    expect(result.observations[0]).toEqual({ startSeconds: 0, endSeconds: 60, text: 'Intro' });
    expect(model.doGenerateCalls).toHaveLength(0);
    expect(beforeCall).toHaveBeenCalledWith(longVideo.videoId);
    expect(release).toHaveBeenCalledOnce();
  });
});
