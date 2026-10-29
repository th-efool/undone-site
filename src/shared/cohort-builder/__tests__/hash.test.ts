import { describe, it, expect } from 'vitest';
import { createHash } from 'node:crypto';
import { sha256 } from '../hash';

describe('isomorphic sha256', () => {
  it('matches node:crypto on empty string', () => {
    const input = '';
    const nodeHash = createHash('sha256').update(input).digest('hex');
    expect(sha256(input)).toBe(nodeHash);
  });

  it('matches node:crypto on ASCII strings', () => {
    const inputs = [
      'hello world',
      'The quick brown fox jumps over the lazy dog',
      'https://www.youtube.com/playlist?list=PLDgXh7TPE6u8-yC2JkRhfw3Jop16WVQTO',
      JSON.stringify({ a: 1, b: 'two', c: [3, 4, 5] }),
    ];
    for (const input of inputs) {
      const nodeHash = createHash('sha256').update(input).digest('hex');
      expect(sha256(input)).toBe(nodeHash);
    }
  });

  it('matches node:crypto on multi-byte UTF-8, emojis, and symbols', () => {
    const inputs = [
      'こんにちは世界 🚀🔥',
      'café crème résumé ñoño',
      '💡 Understanding your intent and finding cohorts…',
      '∀x ∈ ℝ: x² ≥ 0 ∑ ∏',
    ];
    for (const input of inputs) {
      const nodeHash = createHash('sha256').update(input).digest('hex');
      expect(sha256(input)).toBe(nodeHash);
    }
  });

  it('matches node:crypto on large text blocks (>64KB, crossing 512-bit block boundaries)', () => {
    const large = 'Repeated content with Unicode 🌟 and spaces. '.repeat(2000);
    const nodeHash = createHash('sha256').update(large).digest('hex');
    expect(sha256(large)).toBe(nodeHash);
  });
});
