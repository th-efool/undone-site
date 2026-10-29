import { sha256 } from '@/src/shared/cohort-builder/hash';
import type { ClientSourceExtraction } from '@/src/shared/cohort-builder/contracts';

export interface YoutubeVideoInput {
  videoId: string;
  title: string;
  description: string;
  durationMs: number;
}

export function formatTimestamp(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  }
  return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
}

export function parseTimestampMs(str: string): number | null {
  const parts = str.split(':').map((p) => parseInt(p, 10));
  if (parts.some((n) => isNaN(n))) return null;
  if (parts.length === 2) {
    return (parts[0] * 60 + parts[1]) * 1000;
  }
  if (parts.length === 3) {
    return (parts[0] * 3600 + parts[1] * 60 + parts[2]) * 1000;
  }
  return null;
}

export function extractChaptersFromDescription(
  description: string,
  totalDurationMs: number
): Array<{ startMs: number; endMs: number; title: string }> {
  const lines = description.split(/[\r\n]+/);
  const parsed: Array<{ startMs: number; title: string }> = [];

  const timeRegex = /(?:^|\s|\(|\[)(\d{1,2}:\d{2}(?::\d{2})?)(?:\)|\])?\s*[-–—:]?\s*(.+)$/i;

  for (const line of lines) {
    const match = line.trim().match(timeRegex);
    if (match) {
      const ms = parseTimestampMs(match[1]);
      const title = match[2]?.trim();
      if (ms !== null && title && ms < totalDurationMs) {
        parsed.push({ startMs: ms, title });
      }
    }
  }

  if (parsed.length < 2) return [];

  // Sort by startMs ascending and remove duplicate timestamps
  const sorted = parsed.sort((a, b) => a.startMs - b.startMs);
  const unique: Array<{ startMs: number; title: string }> = [];
  for (const item of sorted) {
    if (!unique.some((u) => u.startMs === item.startMs)) {
      unique.push(item);
    }
  }

  // Ensure start at 0
  if (unique[0].startMs > 0) {
    unique.unshift({ startMs: 0, title: 'Introduction' });
  }

  // Build continuous time intervals [startMs, endMs]
  const intervals: Array<{ startMs: number; endMs: number; title: string }> = [];
  for (let i = 0; i < unique.length; i++) {
    const startMs = unique[i].startMs;
    const endMs = i + 1 < unique.length ? unique[i + 1].startMs : Math.max(startMs + 60_000, totalDurationMs);
    if (endMs > startMs) {
      intervals.push({ startMs, endMs, title: unique[i].title });
    }
  }

  return intervals;
}

export function buildYoutubeClientExtraction(video: YoutubeVideoInput): ClientSourceExtraction {
  const durationMs = Math.max(video.durationMs || 180_000, 60_000);
  let chapters = extractChaptersFromDescription(video.description || '', durationMs);

  // If no chapters parsed from description, partition into 2–4 minute continuous segments
  if (chapters.length === 0) {
    const targetSegmentMs = Math.max(60_000, Math.min(240_000, Math.floor(durationMs / 4)));
    const count = Math.max(1, Math.ceil(durationMs / targetSegmentMs));
    chapters = [];

    for (let i = 0; i < count; i++) {
      const startMs = i * targetSegmentMs;
      const endMs = i === count - 1 ? durationMs : Math.min((i + 1) * targetSegmentMs, durationMs);
      const partNum = i + 1;
      const title =
        partNum === 1
          ? 'Introduction and overview'
          : partNum === count
          ? 'Summary and next steps'
          : `Core concept: Part ${partNum}`;

      if (endMs > startMs) {
        chapters.push({ startMs, endMs, title });
      }
    }
  }

  let text = '';
  const locations: Array<{
    start: number;
    end: number;
    startMs: number;
    endMs: number;
    segmentId: string;
  }> = [];

  for (let i = 0; i < chapters.length; i++) {
    const chap = chapters[i];
    const timeLabel = `[${formatTimestamp(chap.startMs)} - ${formatTimestamp(chap.endMs)}]`;
    const segmentText = `${timeLabel} ${chap.title}`;

    if (text.length > 0) text += '\n\n';
    const start = text.length;
    text += segmentText;
    const end = text.length;

    locations.push({
      start,
      end,
      startMs: chap.startMs,
      endMs: chap.endMs,
      segmentId: `seg-${i + 1}`,
    });
  }

  const checksum = sha256(text);

  return {
    text,
    locations,
    checksum,
    provenance: {
      parserVersion: 'youtube-client-v1',
      rawChecksum: checksum,
      scope: 'video_observation',
      videoId: video.videoId,
      videoTitle: video.title,
      videoDurationMs: durationMs,
    },
  };
}
