/** @vitest-environment node */
import { describe, it, expect } from 'vitest';
import { formatClock, formatElapsed } from '../utils/formatTime';

describe('formatTime utilities', () => {
  describe('formatClock', () => {
    it('formats seconds into MM:SS correctly', () => {
      expect(formatClock(0)).toBe('00:00');
      expect(formatClock(5)).toBe('00:05');
      expect(formatClock(59)).toBe('00:59');
      expect(formatClock(60)).toBe('01:00');
      expect(formatClock(65)).toBe('01:05');
      expect(formatClock(25 * 60)).toBe('25:00');
    });

    it('supports durations greater than 59 minutes with >= 2 minute digits', () => {
      expect(formatClock(60 * 60)).toBe('60:00');
      expect(formatClock(120 * 60)).toBe('120:00');
    });

    it('handles negative or invalid values gracefully', () => {
      expect(formatClock(-10)).toBe('00:00');
      expect(formatClock(NaN)).toBe('00:00');
    });
  });

  describe('formatElapsed boundaries (per Section 4.8 & Section 6 Stage 2)', () => {
    it.each([
      { ms: 0, expected: 'Just joined' },
      { ms: 59_000, expected: 'Just joined' }, // 59 s
      { ms: 60_000, expected: '1m' }, // 60 s
      { ms: 59 * 60_000, expected: '59m' }, // 59 m
      { ms: 60 * 60_000, expected: '1h' }, // 60 m
      { ms: 61 * 60_000, expected: '1h 1m' }, // 61 m
      { ms: 120 * 60_000, expected: '2h' }, // 120 m (rem minutes === 0)
      { ms: 125 * 60_000, expected: '2h 5m' }, // 125 m
      { ms: NaN, expected: 'Just joined' }, // NaN
      { ms: -5000, expected: 'Just joined' }, // Negative
    ])('formats $ms ms as "$expected"', ({ ms, expected }) => {
      expect(formatElapsed(ms)).toBe(expected);
    });
  });
});
