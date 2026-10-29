import { LiveYoutubeTranscriptProvider, normalizeTranscriptPayload } from '@/src/server/domain/cohort-builder/youtube-transcript-live';

export const maxDuration = 30;

/**
 * Stateless transcript proxy. Returns `{ segments, durationMs }` when the configured transcript
 * provider has captions, otherwise 404 so the client falls back to metadata-only extraction.
 */
export async function GET(request: Request) {
  const videoId = new URL(request.url).searchParams.get('videoId') ?? '';
  if (!/^[A-Za-z0-9_-]{11}$/.test(videoId)) return Response.json({ error: 'Invalid video id' }, { status: 400 });
  if (!process.env.INTERACTION_YOUTUBE_TRANSCRIPT_ENDPOINT) return Response.json({ error: 'Transcripts unavailable' }, { status: 404 });

  const track = { id: 'default', language: 'en', kind: 'manual' as const, translated: false as const };
  try {
    const provider = new LiveYoutubeTranscriptProvider();
    const stream = await provider.open({ videoId, track }, AbortSignal.timeout(20_000));
    const chunks: Uint8Array[] = [];
    try { for await (const chunk of stream.bytes) chunks.push(chunk); } finally { stream.close(); }
    const raw = JSON.parse(Buffer.concat(chunks).toString('utf8'));
    const normalized = normalizeTranscriptPayload(raw, { providerId: provider.id, providerVersion: provider.version, videoId, track });
    return Response.json(
      { segments: normalized.segments, durationMs: normalized.video.durationMs },
      { headers: { 'Cache-Control': 'public, s-maxage=86400, stale-while-revalidate=604800' } },
    );
  } catch {
    return Response.json({ error: 'Transcript unavailable' }, { status: 404 });
  }
}
