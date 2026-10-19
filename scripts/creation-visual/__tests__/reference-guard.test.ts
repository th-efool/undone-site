import { describe, expect, it } from 'vitest';
import { resolve } from 'node:path';
import {
  computeReferenceHashes,
  assertReferenceIntegrity,
  validateCaptureOutputPath,
  REFERENCE_DIR,
  BEFORE_AFTER_DIR,
} from '../reference-guard.mjs';

describe('Checkpoint 3: Canonical Design Reference Protection', () => {
  const commit = 'testcommit123';

  describe('validateCaptureOutputPath', () => {
    it('allows output paths strictly within captures/${commit}/', () => {
      const target = resolve(BEFORE_AFTER_DIR, 'captures', commit, 'after-2.png');
      const validated = validateCaptureOutputPath(target, commit);
      expect(validated).toBe(target);
    });

    it('rejects output paths resolving inside plans/before-after/reference/', () => {
      const target = resolve(REFERENCE_DIR, 'after-2.png');
      expect(() => validateCaptureOutputPath(target, commit)).toThrow(
        'CANNOT_OVERWRITE_CANONICAL_REFERENCE'
      );
    });

    it('rejects output paths resolving directly in plans/before-after/ root', () => {
      const target = resolve(BEFORE_AFTER_DIR, 'after-2.png');
      expect(() => validateCaptureOutputPath(target, commit)).toThrow(
        'CANNOT_OVERWRITE_CANONICAL_REFERENCE'
      );
    });

    it('rejects mobile output paths resolving directly in plans/before-after/ root', () => {
      const target = resolve(BEFORE_AFTER_DIR, 'mobile-2.png');
      expect(() => validateCaptureOutputPath(target, commit)).toThrow(
        'CANNOT_OVERWRITE_CANONICAL_REFERENCE'
      );
    });
  });

  describe('Reference integrity assertion', () => {
    it('computes hashes for all canonical references and passes integrity check when unmodified', () => {
      const hashes = computeReferenceHashes();
      if (hashes.size === 0) return;
      expect(hashes.size).toBeGreaterThanOrEqual(40);
      expect(hashes.has('after-2.png')).toBe(true);
      expect(hashes.has('after-10.png')).toBe(true);

      // Must not throw when hashes match
      expect(() => assertReferenceIntegrity(hashes)).not.toThrow();
    });

    it('throws CANONICAL_REFERENCE_MUTATED if a reference hash is mutated', () => {
      const hashes = computeReferenceHashes();
      if (hashes.size === 0) return;
      const tamperedHashes = new Map(hashes);
      tamperedHashes.set('after-2.png', 'tamperedhash1234567890abcdef');

      expect(() => assertReferenceIntegrity(tamperedHashes)).toThrow(
        'CANONICAL_REFERENCE_MUTATED'
      );
    });

    it('throws CANONICAL_REFERENCE_MUTATED if a reference file is missing from expected map', () => {
      const hashes = computeReferenceHashes();
      if (hashes.size === 0) return;
      const missingFileMap = new Map(hashes);
      missingFileMap.delete('after-2.png');

      expect(() => assertReferenceIntegrity(missingFileMap)).toThrow(
        'CANONICAL_REFERENCE_MUTATED'
      );
    });
  });
});
