import { describe, expect, it } from 'vitest';
import { buildCohortSeo, cohortSeoSchema, toIsoDuration } from '../seo';

describe('Cohort SEO builder and schema', () => {
  it('converts minutes to ISO-8601 duration correctly', () => {
    expect(toIsoDuration(0)).toBe('PT1M');
    expect(toIsoDuration(45)).toBe('PT45M');
    expect(toIsoDuration(60)).toBe('PT1H');
    expect(toIsoDuration(90)).toBe('PT1H30M');
    expect(toIsoDuration(125)).toBe('PT2H5M');
    expect(toIsoDuration(90)).toMatch(/^PT(\d+H)?(\d+M)?$/);
  });

  it('builds valid SEO schema from empty workspace (early pipeline stage)', () => {
    const ws = {
      title: 'Draft',
      intent: 'I want to learn systems programming with Rust from scratch',
      sources: [],
      understanding: [],
      chunks: [],
      analyses: [],
      lessons: [],
      dailyMinutes: 20,
      audience: 'Beginners',
    };

    const seo = buildCohortSeo(ws);
    expect(cohortSeoSchema.parse(seo)).toBeDefined();
    expect(seo.metaTitle.length).toBeLessThanOrEqual(60);
    expect(seo.metaDescription.length).toBeLessThanOrEqual(160);
    expect(seo.keywords.length).toBeLessThanOrEqual(16);
    expect(seo.concepts).toEqual([]);
    expect(seo.outline).toEqual([]);
    expect(seo.timeRequired).toBeUndefined();
    expect(seo.primaryKeyword.toLowerCase()).not.toContain('i want to learn');
  });

  it('is deterministic: same workspace input produces identical deep-equal SEO output', () => {
    const ws = {
      title: 'Distributed Systems',
      intent: 'Learn raft consensus and leader election in distributed systems',
      sources: [
        {
          id: 'src-1',
          version: 0,
          label: 'MIT 6.824 Lecture 1',
          kind: 'youtube' as const,
          state: 'ready' as const,
          text: 'Raft consensus algorithm ensures state machine replication.',
          checksum: 'a'.repeat(64),
          provenance: { videoId: 'dQw4w9WgXcQ' },
          locations: [{ start: 0, end: 50, startMs: 0 }],
        },
      ],
      understanding: [
        {
          sourceId: 'src-1',
          sourceVersion: 0,
          topics: ['Raft Consensus', 'Leader Election', 'Fault Tolerance', 'Quorum Intersections'],
        },
      ],
      chunks: [
        {
          id: 'chk-1',
          sourceId: 'src-1',
          sourceVersion: 0,
          start: 0,
          end: 50,
          text: 'Raft consensus algorithm ensures state machine replication across network partitions.',
          checksum: 'a'.repeat(64),
        },
      ],
      analyses: [
        {
          chunkId: 'chk-1',
          summary: 'Overview of Raft state machines',
          question: 'How do leader heartbeats work?',
        },
      ],
      lessons: [
        {
          id: 'les-1',
          version: 0,
          title: 'Introduction to Raft Consensus',
          objective: 'Understand the election timeout',
          sourceChunkIds: ['chk-1'],
          pinned: false,
        },
      ],
      dailyMinutes: 30,
      audience: 'Backend Engineers',
    };

    const run1 = buildCohortSeo(ws as any);
    const run2 = buildCohortSeo(ws as any);
    expect(run1).toEqual(run2);
    expect(cohortSeoSchema.parse(run1)).toBeDefined();

    expect(run1.metaTitle.length).toBeLessThanOrEqual(60);
    expect(run1.metaDescription.length).toBeLessThanOrEqual(160);
    expect(run1.primaryKeyword).toBe('Raft Consensus');
    expect(run1.keywords).toContain('Raft Consensus');
    expect(run1.keywords).toContain('Leader Election');
    expect(run1.concepts).toEqual(['Raft Consensus', 'Leader Election', 'Fault Tolerance', 'Quorum Intersections']);
    expect(run1.teaches).toContain('Understand Raft Consensus');
    expect(run1.keyMoments).toHaveLength(1);
    expect(run1.keyMoments[0]).toMatchObject({
      startSeconds: 0,
      videoId: 'dQw4w9WgXcQ',
    });
    expect(run1.faq.length).toBeGreaterThanOrEqual(2);
    expect(run1.timeRequired).toMatch(/^PT(\d+H)?(\d+M)?$/);
  });
});
