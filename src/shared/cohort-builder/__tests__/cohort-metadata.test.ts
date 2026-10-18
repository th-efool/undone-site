import { describe, expect, it } from 'vitest';
import { createHash } from 'node:crypto';
import { cohortWorkspaceSchema } from '../contracts';
import { deriveCohortTitle, deriveCohortDescription, deriveChunkVideoInterval, extractSourceConceptTopics } from '../cohort-metadata';
import { splitSource } from '@/src/server/domain/cohort-builder/text-pipeline';
import { projectCohortToLearnerDelivery } from '../delivery';

function videoSource(texts = ['Replication copies data. Quorums overlap.', 'Leader election selects a coordinator.', 'Retries recover failures.', 'Partitions interrupt requests.', 'Recovery restores availability.']) {
  let text = '';
  const locations = texts.map((value, index) => {
    if (text) text += '\n\n';
    const start = text.length;
    text += value;
    return { start, end: text.length, startMs: index * 30_000, endMs: (index + 1) * 30_000 };
  });
  return cohortWorkspaceSchema.parse({ schemaVersion: 1, title: 'Draft Curriculum', intent: 'i want to learn distributed systems from scratch', audience: 'Engineers', dailyMinutes: 25, lessons: [],
    sources: [{ id: 'video', version: 0, label: 'Distributed systems | Replication and Consensus', text, locations, state: 'ready', checksum: null,
      input: { kind: 'youtube', url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', mode: 'video_observation' } }] });
}

describe('cohort metadata and timestamped chunk projection', () => {
  it('cleans default titles and extracts concise concepts instead of sentence fragments', () => {
    const state = videoSource();
    expect(deriveCohortTitle(state)).toBe('Distributed Systems');
    expect(deriveCohortTitle({ ...state, title: 'My authored title' })).toBe('My authored title');
    const topics = extractSourceConceptTopics(state.sources[0]);
    expect(topics).toContain('Replication');
    expect(topics).toContain('Consensus');
    expect(topics.every(topic => topic.length <= 60 && topic.split(/\s+/).length <= 5)).toBe(true);
    expect(deriveCohortDescription(state)).not.toContain('i want to learn');
  });

  it('groups full timed observations into minute-sized chunks, retaining the final remainder and every character', () => {
    const state = videoSource();
    const source = state.sources[0];
    const chunks = splitSource(source);
    expect(chunks).toHaveLength(3);
    expect(chunks.map(chunk => chunk.text).join('').replace(/\s/g, '')).toBe(source.text.replace(/\s/g, ''));
    for (const chunk of chunks) {
      expect(source.text.slice(chunk.start, chunk.end)).toBe(chunk.text);
      expect(chunk.checksum).toBe(createHash('sha256').update(chunk.text).digest('hex'));
    }
    expect(chunks.map((chunk, index) => deriveChunkVideoInterval(chunk, source, index, chunks.length))).toMatchObject([
      { startSeconds: 0, endSeconds: 75, overlapSeconds: 15 },
      { startSeconds: 60, endSeconds: 135, overlapSeconds: 15 },
      { startSeconds: 120, endSeconds: 150, overlapSeconds: 0 },
    ]);
    const lessons = chunks.map(chunk => ({ id: `lesson:${chunk.id}`, version: 0, title: 'Lesson', objective: 'Understand systems', sourceChunkIds: [chunk.id], pinned: false }));
    const delivery = projectCohortToLearnerDelivery({ ...state, chunks, lessons }, { workspaceId: 'workspace', workspaceRevision: 1, cohortId: 'cohort', contentHash: 'a'.repeat(64), mode: 'public_publish' });
    expect(delivery.seasons.flatMap(season => season.lessons).flatMap(lesson => lesson.chunks).map(chunk => [chunk.startSeconds, chunk.endSeconds])).toEqual([[0, 75], [60, 135], [120, 150]]);
  });

  it('preserves untimed prefix/suffix and limits oversized Unicode observations without splitting surrogate pairs', () => {
    const state = videoSource(['界'.repeat(9000) + '😀', 'Final segment.']);
    const source = state.sources[0];
    const prefix = 'Retained preface. ';
    const adjusted = { ...source, text: prefix + source.text + ' Retained ending.', locations: source.locations!.map(location => ({ ...location, start: location.start + prefix.length, end: location.end + prefix.length })) };
    const chunks = splitSource(adjusted);
    expect(chunks.map(chunk => chunk.text).join('').replace(/\s/g, '')).toBe(adjusted.text.replace(/\s/g, ''));
    expect(chunks.every(chunk => Buffer.byteLength(chunk.text) <= 24 * 1024 && !chunk.text.includes('\uFFFD'))).toBe(true);
  });

  it('does not invent five-minute playback times when video timing is absent', () => {
    const state = videoSource();
    const chunks = splitSource(state.sources[0]);
    expect(deriveChunkVideoInterval(chunks[0], { ...state.sources[0], locations: [] }, 0, chunks.length)).toMatchObject({ startSeconds: 0, endSeconds: 0, hasTiming: false });
  });
});
