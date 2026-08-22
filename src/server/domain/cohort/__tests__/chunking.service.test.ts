import { describe, it, expect } from 'vitest';
import { chunkingService } from '../chunking.service';

describe('ChunkingService', () => {
  describe('heuristicSemanticChunking', () => {
    it('returns a single chunk for empty text', () => {
      const result = chunkingService.heuristicSemanticChunking('', 120, 'My Lesson');
      expect(result).toHaveLength(1);
      expect(result[0].start).toBe(0);
      expect(result[0].end).toBe(120);
    });

    it('chunks long paragraph-separated text proportionally', () => {
      const paragraph1 = 'Introduction to systems engineering. '.repeat(40);
      const paragraph2 = 'Advanced memory management and borrowing in Rust. '.repeat(40);
      const fullText = `${paragraph1}\n\n${paragraph2}`;

      const result = chunkingService.heuristicSemanticChunking(fullText, 300, 'Rust Memory');
      expect(result.length).toBeGreaterThanOrEqual(2);
      expect(result[0].start).toBe(0);
      expect(result[result.length - 1].end).toBe(300);
      expect(result[0].title).toContain('Rust Memory');
    });
  });

  describe('disabledChunking and fixedIntervalChunking', () => {
    it('disabledChunking creates 1 full interval', () => {
      const intervals = chunkingService.disabledChunking(500);
      expect(intervals).toEqual([{ start: 0, end: 500 }]);
    });

    it('fixedIntervalChunking splits at 300s intervals', () => {
      const intervals = chunkingService.fixedIntervalChunking(750);
      expect(intervals).toEqual([
        { start: 0, end: 300 },
        { start: 300, end: 600 },
        { start: 600, end: 750 },
      ]);
    });
  });

  describe('applyChunkOverlap', () => {
    it('applies padding and slices proportional text with overlap', () => {
      const text = 'abcdefghijklmnopqrstuvwxyz';
      const intervals = [
        { start: 0, end: 50 },
        { start: 50, end: 100 },
      ];
      const slices = chunkingService.applyChunkOverlap(intervals, 100, text);
      expect(slices).toHaveLength(2);
      expect(slices[0].length).toBeGreaterThan(0);
      expect(slices[1].length).toBeGreaterThan(0);
    });
  });
});
