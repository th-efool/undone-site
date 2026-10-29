import { sha256 } from '@/src/shared/cohort-builder/hash';
import { formatYoutubeTimestamp } from '@/src/shared/cohort-builder/youtube-transcript';
import type { ClientSourceExtraction } from '@/src/shared/cohort-builder/contracts';

export interface TranscriptSegment {
  startMs: number;
  endMs: number;
  text: string;
}

export interface YoutubeVideoInput {
  videoId: string;
  title: string;
  description: string;
  durationMs: number;
  transcript?: TranscriptSegment[];
}

interface Window {
  startMs: number;
  endMs: number;
  body: string;
}

const WINDOW_MS = 90_000;
const WINDOW_CHARS = 2_000;
const DESCRIPTION_CHARS = 1_500;

export function parseTimestampMs(str: string): number | null {
  const parts = str.split(':').map((p) => parseInt(p, 10));
  if (parts.some((n) => isNaN(n)) || parts.length < 2 || parts.length > 3) return null;
  const [h, m, s] = parts.length === 3 ? parts : [0, parts[0], parts[1]];
  return (h * 3600 + m * 60 + s) * 1000;
}

/** Chapter intervals from "MM:SS Title" lines in the description; continuous and covering the full duration. */
export function extractChaptersFromDescription(
  description: string,
  totalDurationMs: number
): Array<{ startMs: number; endMs: number; title: string }> {
  const timeRegex = /(?:^|\s|\(|\[)(\d{1,2}:\d{2}(?::\d{2})?)(?:\)|\])?\s*[-–—:]?\s*(.+)$/i;
  const byStart = new Map<number, string>();
  for (const line of description.split(/[\r\n]+/)) {
    const match = line.trim().match(timeRegex);
    const ms = match ? parseTimestampMs(match[1]) : null;
    const title = match?.[2]?.trim();
    if (ms !== null && title && ms < totalDurationMs && !byStart.has(ms)) byStart.set(ms, title);
  }
  if (byStart.size < 2) return [];

  const starts = [...byStart.entries()].sort((a, b) => a[0] - b[0]);
  if (starts[0][0] > 0) starts.unshift([0, 'Introduction']);
  return starts.map(([startMs, title], i) => ({
    startMs,
    endMs: i + 1 < starts.length ? starts[i + 1][0] : Math.max(startMs + 60_000, totalDurationMs),
    title,
  }));
}

/** Group caption cues into ~90 s / 2 000 char windows. */
function windowsFromTranscript(segments: TranscriptSegment[]): Window[] {
  const windows: Window[] = [];
  let current: Window | null = null;
  for (const seg of [...segments].sort((a, b) => a.startMs - b.startMs)) {
    if (current && (seg.startMs - current.startMs >= WINDOW_MS || current.body.length + seg.text.length > WINDOW_CHARS)) {
      windows.push(current);
      current = null;
    }
    if (!current) current = { startMs: seg.startMs, endMs: seg.endMs, body: '' };
    current.body += (current.body ? ' ' : '') + seg.text;
    current.endMs = Math.max(current.endMs, seg.endMs);
  }
  if (current) windows.push(current);
  return windows;
}

/** Metadata-only windows: real chapters when present, otherwise one honest window with title + description. */
function windowsFromMetadata(video: YoutubeVideoInput, durationMs: number): { windows: Window[]; chapters: boolean } {
  const chapters = extractChaptersFromDescription(video.description, durationMs);
  if (chapters.length) {
    return { windows: chapters.map((c) => ({ startMs: c.startMs, endMs: c.endMs, body: c.title })), chapters: true };
  }
  const description = video.description.trim().slice(0, DESCRIPTION_CHARS);
  return {
    windows: [{ startMs: 0, endMs: durationMs, body: description ? `${video.title}\n${description}` : video.title }],
    chapters: false,
  };
}

export function buildYoutubeClientExtraction(video: YoutubeVideoInput): ClientSourceExtraction {
  const hasTranscript = !!video.transcript?.length;
  const lastCueEnd = hasTranscript ? Math.max(...video.transcript!.map((s) => s.endMs)) : 0;
  const durationMs = Math.max(video.durationMs || 0, lastCueEnd, 1_000);

  const meta = hasTranscript ? null : windowsFromMetadata(video, durationMs);
  const windows = hasTranscript ? windowsFromTranscript(video.transcript!) : meta!.windows;

  let text = '';
  const locations: ClientSourceExtraction['locations'] = windows.map((w, i) => {
    if (text) text += '\n\n';
    const start = text.length;
    text += `[${formatYoutubeTimestamp(w.startMs)} - ${formatYoutubeTimestamp(w.endMs)}] ${w.body}`;
    return { start, end: text.length, startMs: w.startMs, endMs: w.endMs, segmentId: `seg-${i + 1}` };
  });

  const checksum = sha256(text);
  return {
    text,
    locations,
    checksum,
    provenance: {
      parserVersion: 'youtube-client-v2',
      rawChecksum: checksum,
      scope: hasTranscript ? 'transcript_only' : 'video_observation',
      videoId: video.videoId,
      videoTitle: video.title.slice(0, 500),
      videoDurationMs: durationMs,
      ...(hasTranscript ? {} : {
        estimatedIntervals: !meta!.chapters,
        limitations: ['No transcript available; built from video title, description and chapters only.'],
      }),
    },
  };
}

export function extractYoutubeVideoId(rawUrl: string): string | null {
  try {
    const url = new URL(rawUrl.startsWith('http') ? rawUrl : `https://${rawUrl}`);
    const id = url.hostname === 'youtu.be'
      ? url.pathname.slice(1).split('/')[0]
      : url.searchParams.get('v') ?? url.pathname.split('/').filter(Boolean).pop();
    return id && /^[A-Za-z0-9_-]{11}$/.test(id) ? id : null;
  } catch {
    return null;
  }
}

/** Real transcript when the server has one, else metadata-only. Never throws on a missing transcript. */
export async function extractYoutubeClient(
  url: string,
  options: { durationMs?: number; description?: string; title?: string; videoId?: string } = {}
): Promise<ClientSourceExtraction> {
  const videoId = options.videoId ?? extractYoutubeVideoId(url) ?? 'unknown_video';
  let transcript: TranscriptSegment[] | undefined;
  let durationMs = options.durationMs;
  try {
    const res = await fetch(`/api/import/youtube/transcript?videoId=${videoId}`);
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data.segments) && data.segments.length) {
        transcript = data.segments;
        durationMs = durationMs || data.durationMs;
      }
    }
  } catch { /* metadata-only fallback */ }

  return buildYoutubeClientExtraction({
    videoId,
    title: options.title || 'YouTube Video',
    description: options.description || '',
    durationMs: durationMs || 0,
    transcript,
  });
}
