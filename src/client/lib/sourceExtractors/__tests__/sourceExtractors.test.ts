import { describe, it, expect } from 'vitest';
import {
  formatTimestamp,
  parseTimestampMs,
  extractChaptersFromDescription,
  buildYoutubeClientExtraction,
} from '../youtubeClientExtractor';
import { parseGithubUrl } from '../githubClientExtractor';
import { parseIsoDurationMs } from '@/src/app/api/import/youtube/metadata/route';
import { clientSourceExtractionSchema } from '@/src/shared/cohort-builder/contracts';

describe('sourceExtractors', () => {
  describe('youtubeClientExtractor', () => {
    it('parseIsoDurationMs parses ISO 8601 durations correctly', () => {
      expect(parseIsoDurationMs('PT1H2M3S')).toBe((3600 + 120 + 3) * 1000);
      expect(parseIsoDurationMs('PT15M33S')).toBe((15 * 60 + 33) * 1000);
      expect(parseIsoDurationMs('PT45S')).toBe(45 * 1000);
      expect(parseIsoDurationMs('PT2H')).toBe(7200 * 1000);
      expect(parseIsoDurationMs('')).toBe(0);
      expect(parseIsoDurationMs(undefined)).toBe(0);
    });

    it('formatTimestamp formats seconds and hours correctly', () => {
      expect(formatTimestamp(0)).toBe('00:00');
      expect(formatTimestamp(65000)).toBe('01:05');
      expect(formatTimestamp(3661000)).toBe('1:01:01');
    });

    it('parseTimestampMs parses string timestamps into ms', () => {
      expect(parseTimestampMs('01:30')).toBe(90000);
      expect(parseTimestampMs('1:02:03')).toBe(3723000);
      expect(parseTimestampMs('invalid')).toBeNull();
    });

    it('extractChaptersFromDescription extracts timestamps and guarantees continuous coverage', () => {
      const desc = `
Course Overview:
00:00 Intro & Setup
02:15 Architecture
08:45 Implementation
15:30 Final Thoughts
      `;
      const chapters = extractChaptersFromDescription(desc, 1200000); // 20 mins
      expect(chapters).toHaveLength(4);
      expect(chapters[0].startMs).toBe(0);
      expect(chapters[0].endMs).toBe(135000); // 02:15
      expect(chapters[1].startMs).toBe(135000);
      expect(chapters[1].endMs).toBe(525000); // 08:45
      expect(chapters[3].endMs).toBe(1200000); // extends to totalDuration
    });

    it('buildYoutubeClientExtraction generates schema-valid extraction with no description chapters', () => {
      const extraction = buildYoutubeClientExtraction({
        videoId: 'abc1234',
        title: 'Complete Venture Capital Guide',
        description: 'No timestamps here, just a general overview of the video.',
        durationMs: 600000, // 10 minutes
      });

      // Validates against authoritative clientSourceExtractionSchema
      const validated = clientSourceExtractionSchema.parse(extraction);
      expect(validated.text).toBeTruthy();
      expect(validated.locations.length).toBeGreaterThanOrEqual(2);
      expect(validated.provenance?.videoId).toBe('abc1234');
      expect(validated.checksum).toBeTruthy();
    });
  });

  describe('githubClientExtractor', () => {
    it('parseGithubUrl parses varied GitHub repository URLs', () => {
      expect(parseGithubUrl('https://github.com/facebook/react')).toEqual({
        owner: 'facebook',
        repo: 'react',
        ref: 'main',
      });
      expect(parseGithubUrl('https://github.com/vercel/next.js/tree/canary')).toEqual({
        owner: 'vercel',
        repo: 'next.js',
        ref: 'canary',
      });
      expect(parseGithubUrl('torvalds/linux')).toEqual({
        owner: 'torvalds',
        repo: 'linux',
        ref: 'main',
      });
      expect(parseGithubUrl('not-a-url')).toBeNull();
    });
  });
});
