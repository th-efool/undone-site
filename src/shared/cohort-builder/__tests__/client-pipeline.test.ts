import { describe, it, expect } from 'vitest';
import {
  byteLengthUtf8,
  sourceFingerprint,
  splitSource,
  runDeterministicPipeline,
  canRunDeterministicPipeline,
} from '../client-pipeline';
import {
  sourceFingerprint as serverSourceFingerprint,
  splitSource as serverSplitSource,
} from '@/src/server/domain/cohort-builder/text-pipeline';
import { initialCohort } from '../intake';
import type { CohortWorkspace } from '../contracts';

describe('client-pipeline deterministic functions', () => {
  it('byteLengthUtf8 matches Buffer.byteLength on ASCII and Unicode', () => {
    const samples = [
      '',
      'Hello world',
      'こんにちは世界 🌟🚀',
      'Special chars: \n\r\t™©®—…',
      'a'.repeat(5000),
    ];
    for (const sample of samples) {
      expect(byteLengthUtf8(sample)).toBe(Buffer.byteLength(sample, 'utf8'));
    }
  });

  it('sourceFingerprint matches server sourceFingerprint exactly', () => {
    const ws = initialCohort('Learn Deep Learning');
    ws.sources = [
      {
        id: 'src-1',
        version: 0,
        label: 'Source 1',
        text: 'First source text with some content.',
        checksum: null,
        state: 'ready',
        locations: [{ start: 0, end: 36 }],
      },
      {
        id: 'src-2',
        version: 1,
        label: 'Source 2',
        text: 'Second source text with additional detail.',
        checksum: null,
        state: 'ready',
        locations: [{ start: 0, end: 42 }],
      },
    ];

    expect(sourceFingerprint(ws)).toBe(serverSourceFingerprint(ws));
  });

  it('splitSource on text produces identical chunks to server splitSource', () => {
    const source: CohortWorkspace['sources'][number] = {
      id: 'src-text',
      version: 0,
      label: 'Sample Article',
      text: 'First sentence here. Second sentence follows. Third sentence wraps up the introduction! And here is question number four? Finally, the end.',
      checksum: null,
      state: 'ready',
      locations: [{ start: 0, end: 140 }],
    };

    const clientChunks = splitSource(source);
    const serverChunks = serverSplitSource(source);

    expect(clientChunks).toEqual(serverChunks);
  });

  it('splitSource on timed video produces identical chunks to server splitSource', () => {
    const text = 'Segment 1 introduction. Segment 2 deeper dive into the architecture. Segment 3 conclusion.';
    const source: CohortWorkspace['sources'][number] = {
      id: 'src-video',
      version: 0,
      label: 'Intro Video',
      text,
      checksum: null,
      state: 'ready',
      locations: [
        { start: 0, end: 23, startMs: 0, endMs: 30000 },
        { start: 24, end: 68, startMs: 30000, endMs: 65000 },
        { start: 69, end: 91, startMs: 65000, endMs: 90000 },
      ],
      provenance: {
        parserVersion: 'v1',
        rawChecksum: 'a'.repeat(64),
        scope: 'video_observation',
        videoId: 'abc1234',
        videoTitle: 'Architecture Overview',
      },
    };

    const clientChunks = splitSource(source);
    const serverChunks = serverSplitSource(source);

    expect(clientChunks).toEqual(serverChunks);
  });

  it('runDeterministicPipeline completes synchronously in <15ms and produces a ready curriculum', () => {
    const ws = initialCohort('Full Stack TypeScript');
    ws.sources = [
      {
        id: 'src-1',
        version: 0,
        label: 'Module 1: React Fundamentals',
        text: 'React is a library for web and native user interfaces. Components let you split the UI into independent pieces.',
        checksum: null,
        state: 'ready',
        locations: [{ start: 0, end: 112 }],
      },
      {
        id: 'src-2',
        version: 0,
        label: 'Module 2: Serverless Next.js',
        text: 'Next.js enables full-stack React applications with server components and edge rendering. Fast deployments on Vercel.',
        checksum: null,
        state: 'ready',
        locations: [{ start: 0, end: 119 }],
      },
    ];

    expect(canRunDeterministicPipeline(ws)).toBe(true);

    const start = performance.now();
    const result = runDeterministicPipeline(ws);
    const duration = performance.now() - start;

    expect(duration).toBeLessThan(50); // Well under budget
    expect(result.processing.status).toBe('ready');
    expect(result.processing.stage).toBe('done');
    expect(result.journey?.step).toBe('ready');
    expect(result.chunks.length).toBeGreaterThan(0);
    expect(result.lessons.length).toBeGreaterThan(0);
    expect(result.understanding.length).toBe(2);
    expect(result.seo).toBeDefined();
    expect(result.title).toBeTruthy();
    expect(result.description).toBeTruthy();
  });
});
