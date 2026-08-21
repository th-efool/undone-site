import { describe, it, expect, vi } from 'vitest';

vi.mock('@/src/server/database/mongo/models/UserChunkProgress', () => ({
  UserChunkProgress: {}
}));
vi.mock('@/src/server/infrastructure/db/mongodb/client', () => ({
  connectToMongoDB: vi.fn()
}));

import { ChunkProgressService } from '../chunkProgress.service';

describe('ChunkProgressService', () => {
  describe('isEligibleForAutoCompletion', () => {
    it('uses the threshold Math.min(15, totalSeconds * 0.15) for auto-completion', () => {
      // 85% rule triggers when watched >= 0.85 * total
      expect(ChunkProgressService.isEligibleForAutoCompletion(85, 100)).toBe(true);
      expect(ChunkProgressService.isEligibleForAutoCompletion(84, 100)).toBe(false);

      // For totalSeconds = 60, effective threshold = Math.min(15, 60 * 0.15) = 9
      expect(ChunkProgressService.isEligibleForAutoCompletion(51, 60)).toBe(true); // 85% watched, 9s remaining
      expect(ChunkProgressService.isEligibleForAutoCompletion(50, 60)).toBe(false); // 83.3% watched, 10s remaining

      // For totalSeconds = 200, effective threshold = Math.min(15, 30) = 15
      expect(ChunkProgressService.isEligibleForAutoCompletion(170, 200)).toBe(true); // 85% watched, 30s remaining
      
      // Even if remaining <= 15, we must also meet percent >= 0.50.
      // But because threshold <= total * 0.15, remaining <= threshold ALWAYS implies percent >= 0.85
      // Let's test a short video: total = 10, threshold = Math.min(15, 1.5) = 1.5
      expect(ChunkProgressService.isEligibleForAutoCompletion(8.5, 10)).toBe(true);
      expect(ChunkProgressService.isEligibleForAutoCompletion(8, 10)).toBe(false);
    });
  });
});
