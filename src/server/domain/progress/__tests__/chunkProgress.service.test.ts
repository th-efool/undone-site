import { describe, it, expect } from 'vitest';
import { ChunkProgressService } from '../chunkProgress.service';

describe('ChunkProgressService', () => {
  describe('isEligibleForAutoCompletion', () => {
    it('returns false if totalSeconds is 0 or less', () => {
      expect(ChunkProgressService.isEligibleForAutoCompletion(0, 0)).toBe(false);
      expect(ChunkProgressService.isEligibleForAutoCompletion(10, -5)).toBe(false);
    });

    it('returns true if the user watched at least 85% of the video', () => {
      expect(ChunkProgressService.isEligibleForAutoCompletion(85, 100)).toBe(true);
      expect(ChunkProgressService.isEligibleForAutoCompletion(90, 100)).toBe(true);
      expect(ChunkProgressService.isEligibleForAutoCompletion(99, 100)).toBe(true);
    });

    it('returns false if the user watched less than 85% and remaining is greater than threshold', () => {
      expect(ChunkProgressService.isEligibleForAutoCompletion(84, 100)).toBe(false);
      expect(ChunkProgressService.isEligibleForAutoCompletion(50, 100)).toBe(false);
    });

    it('correctly evaluates the scrub exploit (scrub to 99% but watched 1s)', () => {
      // The scrub exploit test case: user scrubs to 99%, but only actually watched 1 second.
      // `currentTime` parameter (which represents watchedSeconds in the record logic) is 1.
      const currentTime = 1;
      const totalSeconds = 100;
      
      // Because remainingSeconds = 100 - 1 = 99 (not based on playhead at 99s)
      // It should correctly return false.
      expect(ChunkProgressService.isEligibleForAutoCompletion(currentTime, totalSeconds)).toBe(false);
    });

    it('handles auto-completion when actually watched near the end', () => {
      const currentTime = 99; // Actually watched 99 seconds
      const totalSeconds = 100;
      expect(ChunkProgressService.isEligibleForAutoCompletion(currentTime, totalSeconds)).toBe(true);
    });
  });

  describe('computeStatus', () => {
    it('returns forceStatus if provided', () => {
      expect(ChunkProgressService.computeStatus('NOT_STARTED', 0, 100, 'SKIPPED')).toBe('SKIPPED');
    });

    it('keeps COMPLETED status if already completed', () => {
      expect(ChunkProgressService.computeStatus('COMPLETED', 1, 100)).toBe('COMPLETED');
    });

    it('returns COMPLETED if eligible for auto completion', () => {
      expect(ChunkProgressService.computeStatus('IN_PROGRESS', 85, 100)).toBe('COMPLETED');
    });

    it('returns IN_PROGRESS if watched >= 3 seconds but not eligible for auto complete', () => {
      expect(ChunkProgressService.computeStatus('NOT_STARTED', 5, 100)).toBe('IN_PROGRESS');
      expect(ChunkProgressService.computeStatus('IN_PROGRESS', 50, 100)).toBe('IN_PROGRESS');
    });

    it('returns currentStatus or NOT_STARTED if watched < 3 seconds', () => {
      expect(ChunkProgressService.computeStatus(null, 2, 100)).toBe('NOT_STARTED');
      expect(ChunkProgressService.computeStatus('NOT_STARTED', 2, 100)).toBe('NOT_STARTED');
    });
    
    it('does not complete if scrubbed to end but watched less than 3 seconds (returns NOT_STARTED)', () => {
      // Scrub to 99%, but watched 2s
      expect(ChunkProgressService.computeStatus('NOT_STARTED', 2, 100)).toBe('NOT_STARTED');
    });
    
    it('does not complete if scrubbed to end but watched 10 seconds (returns IN_PROGRESS)', () => {
      // Scrub to 99%, but watched 10s
      expect(ChunkProgressService.computeStatus('NOT_STARTED', 10, 100)).toBe('IN_PROGRESS');
    });
  });
});
