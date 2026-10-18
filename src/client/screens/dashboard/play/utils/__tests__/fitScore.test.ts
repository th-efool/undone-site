/** @vitest-environment jsdom */
import { describe, it, expect } from 'vitest';
import { extractFitScores } from '../fitScore';
import type { FeedItem } from '@/src/shared/feed/feedEngine.types';

describe('extractFitScores utility', () => {
  it('returns default fallback scores if item is null or undefined', () => {
    const defaultScores = extractFitScores(null);
    expect(defaultScores.channelFit).toBeGreaterThanOrEqual(1);
    expect(defaultScores.channelFit).toBeLessThanOrEqual(100);
    expect(defaultScores.overallFit).toBeGreaterThanOrEqual(1);
    expect(defaultScores.overallFit).toBeLessThanOrEqual(100);
  });

  it('uses explicit channelFitScore and overallFitScore when present', () => {
    const item: Partial<FeedItem> = {
      channelFitScore: 94,
      overallFitScore: 89,
    };

    const scores = extractFitScores(item as FeedItem);
    expect(scores.channelFit).toBe(94);
    expect(scores.overallFit).toBe(89);
  });

  it('extracts channel fit from matchReason string if channelFitScore is absent', () => {
    const item: Partial<FeedItem> = {
      matchReason: 'Spark Match · 91% Fit',
      matchScore: 12.5,
    };

    const scores = extractFitScores(item as FeedItem);
    expect(scores.channelFit).toBe(91);
    expect(scores.overallFit).toBeGreaterThanOrEqual(50);
    expect(scores.overallFit).toBeLessThanOrEqual(99);
  });

  it('computes calibrated scores from matchScore if matchReason is absent', () => {
    const item: Partial<FeedItem> = {
      matchScore: 82,
    };

    const scores = extractFitScores(item as FeedItem);
    expect(scores.channelFit).toBe(82);
    expect(scores.overallFit).toBe(82);
  });

  it('clamps scores within [1, 100]', () => {
    const item: Partial<FeedItem> = {
      channelFitScore: 120,
      overallFitScore: -10,
    };

    const scores = extractFitScores(item as FeedItem);
    expect(scores.channelFit).toBe(100);
    expect(scores.overallFit).toBe(1);
  });
});
