/**
 * Utility functions for pruning transcripts and estimating token savings for LLM prompts.
 */

const SUBTITLE_TAG_REGEX = /<\/?(?:font|b|i|u|c|v|span|strong|em)(?:[\s.][^>]*)?>/gi;
const TIMESTAMP_ARROW_REGEX = /(?:\d{1,2}:)?\d{2}:\d{2}[,\.]\d{3}\s*-->\s*(?:\d{1,2}:)?\d{2}:\d{2}[,\.]\d{3}/;
const WEBVTT_HEADER_REGEX = /^WEBVTT(?:\s+.*)?$/i;
const SEQUENTIAL_INDEX_REGEX = /^\d+$/;

export interface TokenSavingsEstimate {
  originalChars: number;
  prunedChars: number;
  charSavingsPct: number;
  estimatedTokenSavings: number;
}

/**
 * Prunes noisy subtitle cues, formatting tags, and redundant whitespace from video transcripts.
 *
 * Operations performed:
 * 1. Returns '' if text is empty or non-string.
 * 2. Normalizes CRLF to LF (\r\n -> \n).
 * 3. Strips SRT / WebVTT sequential index numbers and timestamp arrows.
 * 4. Strips HTML-like subtitle formatting tags (<font ...>, </font>, <b>, </b>, <i>, </i>).
 * 5. Replaces consecutive horizontal whitespace ([ \t]+) with a single space.
 * 6. Trims each line.
 * 7. Collapses 3+ consecutive newlines into 2 (\n\n).
 * 8. Returns final trimmed string.
 */
export function pruneTranscriptWhitespace(text: string): string {
  if (!text || typeof text !== 'string') {
    return '';
  }

  // Normalize CRLF and CR to LF
  const normalized = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const rawLines = normalized.split('\n');
  const processedLines: string[] = [];

  for (const rawLine of rawLines) {
    const trimmed = rawLine.trim();

    // Preserve empty lines for paragraph break structure
    if (trimmed.length === 0) {
      processedLines.push('');
      continue;
    }

    // Strip WebVTT headers
    if (WEBVTT_HEADER_REGEX.test(trimmed)) {
      continue;
    }

    // Strip numeric sequential indices (e.g. SRT cue counter "1", "42")
    if (SEQUENTIAL_INDEX_REGEX.test(trimmed)) {
      continue;
    }

    // Strip timestamp arrow lines (e.g. "00:01:23,456 --> 00:01:26,789")
    if (TIMESTAMP_ARROW_REGEX.test(trimmed)) {
      continue;
    }

    // Strip HTML-like subtitle formatting tags
    const withoutTags = trimmed.replace(SUBTITLE_TAG_REGEX, '');

    // Replace consecutive horizontal whitespace with a single space
    const collapsed = withoutTags.replace(/[ \t]+/g, ' ').trim();

    // If tag stripping leaves the line completely empty, omit it unless it was intentionally empty
    if (collapsed.length > 0) {
      processedLines.push(collapsed);
    }
  }

  // Join lines, collapse 3+ consecutive newlines into 2, and trim ends
  const joined = processedLines.join('\n');
  const collapsedNewlines = joined.replace(/\n{3,}/g, '\n\n');

  return collapsedNewlines.trim();
}

/**
 * Estimates character and token savings from transcript pruning.
 * Tokens are approximated using the standard ~4 chars per token rule of thumb (Math.ceil(chars / 4)).
 */
export function estimateTokenSavings(original: string, pruned: string): TokenSavingsEstimate {
  const originalChars = typeof original === 'string' ? original.length : 0;
  const prunedChars = typeof pruned === 'string' ? pruned.length : 0;
  const charDiff = Math.max(0, originalChars - prunedChars);
  const charSavingsPct = originalChars > 0 ? Number(((charDiff / originalChars) * 100).toFixed(2)) : 0;
  const originalTokens = Math.ceil(originalChars / 4);
  const prunedTokens = Math.ceil(prunedChars / 4);
  const estimatedTokenSavings = Math.max(0, originalTokens - prunedTokens);

  return {
    originalChars,
    prunedChars,
    charSavingsPct,
    estimatedTokenSavings,
  };
}
