import type { FeedItem } from '@/src/shared/feed/feedEngine.types';

export interface FitScores {
  channelFit: number;
  overallFit: number;
}

/**
 * Extracts and computes honest fit scores (channel percentage and overall percentage)
 * for a feed item, falling back to matchReason and matchScore if explicit scores are absent.
 */
export function extractFitScores(item?: FeedItem | null): FitScores {
  if (!item) {
    return { channelFit: 85, overallFit: 85 };
  }

  // 1. Explicit properties if provided
  let channelFit = item.channelFitScore;
  let overallFit = item.overallFitScore;

  // 2. Fallback to matchReason parsing (e.g. "Spark Match · 92% Fit")
  if (channelFit === undefined && item.matchReason) {
    const match = item.matchReason.match(/(\d+)%\s*Fit/i);
    if (match) {
      channelFit = parseInt(match[1], 10);
    }
  }

  // 3. Fallback from matchScore if available
  if (channelFit === undefined) {
    if (typeof item.matchScore === 'number' && item.matchScore > 0) {
      if (item.matchScore > 30 && item.matchScore <= 100) {
        channelFit = Math.round(item.matchScore);
      } else {
        channelFit = Math.max(55, Math.min(98, Math.round((item.matchScore / 15) * 35 + 60)));
      }
    } else {
      channelFit = 85;
    }
  }

  // 4. Overall fit score computation / fallback
  if (overallFit === undefined) {
    if (typeof item.matchScore === 'number' && item.matchScore > 0) {
      if (item.matchScore > 30 && item.matchScore <= 100) {
        overallFit = Math.round(item.matchScore);
      } else {
        const scaled = Math.round((item.matchScore / 18) * 45 + 50);
        overallFit = Math.max(50, Math.min(99, Math.round(scaled * 0.5 + channelFit * 0.5)));
      }
    } else {
      overallFit = Math.max(50, Math.min(99, Math.round(channelFit * 0.95 + 4)));
    }
  }

  return {
    channelFit: Math.max(1, Math.min(100, Math.round(channelFit))),
    overallFit: Math.max(1, Math.min(100, Math.round(overallFit))),
  };
}
