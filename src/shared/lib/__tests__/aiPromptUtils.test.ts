import { describe, expect, it } from 'vitest';
import {
  pruneTranscriptWhitespace,
  estimateTokenSavings,
} from '../aiPromptUtils';

describe('aiPromptUtils', () => {
  describe('pruneTranscriptWhitespace', () => {
    it('handles empty or non-string inputs gracefully', () => {
      expect(pruneTranscriptWhitespace('')).toBe('');
      expect(pruneTranscriptWhitespace('   ')).toBe('');
      expect(pruneTranscriptWhitespace(null as unknown as string)).toBe('');
      expect(pruneTranscriptWhitespace(undefined as unknown as string)).toBe('');
      expect(pruneTranscriptWhitespace(123 as unknown as string)).toBe('');
    });

    it('preserves single-word strings while trimming surrounding padding', () => {
      expect(pruneTranscriptWhitespace('Hello')).toBe('Hello');
      expect(pruneTranscriptWhitespace('   Hello   ')).toBe('Hello');
      expect(pruneTranscriptWhitespace('\n\n  Architecture \n\n')).toBe('Architecture');
    });

    it('collapses multiple horizontal spaces and tabs on single and multiple lines', () => {
      const input = 'This   is    a   sentence   with\t\tmultiple    spaces   and\ttabs.';
      expect(pruneTranscriptWhitespace(input)).toBe(
        'This is a sentence with multiple spaces and tabs.'
      );

      const multiLine = 'Line   one   here.\nLine\t\ttwo   with  spaces.';
      expect(pruneTranscriptWhitespace(multiLine)).toBe(
        'Line one here.\nLine two with spaces.'
      );
    });

    it('normalizes CRLF and CR line endings to standard LF', () => {
      const crlfInput = 'First line.\r\nSecond line.\r\nThird line.';
      expect(pruneTranscriptWhitespace(crlfInput)).toBe(
        'First line.\nSecond line.\nThird line.'
      );

      const crInput = 'First line.\rSecond line.\rThird line.';
      expect(pruneTranscriptWhitespace(crInput)).toBe(
        'First line.\nSecond line.\nThird line.'
      );
    });

    it('strips SRT subtitle numeric indices and timestamp arrows', () => {
      const srtInput = `
1
00:01:23,456 --> 00:01:26,789
Welcome to the distributed systems lecture.

2
00:01:27,000 --> 00:01:30,500
Today we examine Raft consensus and leader election.

3
00:01:31,100 --> 00:01:35,200
Let us begin by discussing split-brain scenarios.
`;
      const expected =
        'Welcome to the distributed systems lecture.\n\n' +
        'Today we examine Raft consensus and leader election.\n\n' +
        'Let us begin by discussing split-brain scenarios.';

      expect(pruneTranscriptWhitespace(srtInput)).toBe(expected);
    });

    it('strips WebVTT header and WebVTT timestamps with dot decimal format and cue parameters', () => {
      const webVttInput = `
WEBVTT - Distributed Systems Lecture

00:01:23.456 --> 00:01:26.789 align:start size:50%
First cue of WebVTT transcript.

01:27.000 --> 01:30.000
Second cue without hour digits.
`;
      const expected =
        'First cue of WebVTT transcript.\n\n' +
        'Second cue without hour digits.';

      expect(pruneTranscriptWhitespace(webVttInput)).toBe(expected);
    });

    it('strips HTML-like subtitle formatting tags (<font ...>, <i>, <b>, <u>)', () => {
      const taggedInput =
        '<font color="#ffffff">Welcome to</font> <i>Undone</i>. ' +
        '<b>Important concept:</b> memory <u>safety</u> in <font face="Courier">Rust</font>.';

      expect(pruneTranscriptWhitespace(taggedInput)).toBe(
        'Welcome to Undone. Important concept: memory safety in Rust.'
      );
    });

    it('preserves code brackets and inequality comparisons without treating them as subtitle tags', () => {
      const codeSnippet = 'Ensure that x < y and vector<int> elements are bounded.';
      expect(pruneTranscriptWhitespace(codeSnippet)).toBe(
        'Ensure that x < y and vector<int> elements are bounded.'
      );
    });

    it('preserves meaningful paragraph breaks while collapsing 3+ newlines to 2', () => {
      const spacedInput =
        'First section overview.\n\n\n\n\nSecond section with extra gaps.\n\n\nThird section.';
      const expected =
        'First section overview.\n\nSecond section with extra gaps.\n\nThird section.';

      expect(pruneTranscriptWhitespace(spacedInput)).toBe(expected);
    });

    it('handles realistic dirty transcript with mixed SRT, tags, tabs, and excess newlines', () => {
      const dirty = `
1
00:00:00,500 --> 00:00:03,800
   <font color="#ffff00">Welcome</font>   everyone!   \t

2
00:00:04,000 --> 00:00:07,500
Today we dive into <i>asynchronous programming</i>.




3
00:00:08,000 --> 00:00:12,000
<b>Key Takeaway:</b> Event loop handles I/O multiplexing.
`;
      const expected =
        'Welcome everyone!\n\n' +
        'Today we dive into asynchronous programming.\n\n' +
        'Key Takeaway: Event loop handles I/O multiplexing.';

      expect(pruneTranscriptWhitespace(dirty)).toBe(expected);
    });
  });

  describe('estimateTokenSavings', () => {
    it('accurately calculates char differences, percentages, and token savings', () => {
      // 100 chars -> Math.ceil(100/4) = 25 tokens
      // 60 chars  -> Math.ceil(60/4)  = 15 tokens
      const original = 'A'.repeat(100);
      const pruned = 'A'.repeat(60);

      const result = estimateTokenSavings(original, pruned);

      expect(result.originalChars).toBe(100);
      expect(result.prunedChars).toBe(60);
      expect(result.charSavingsPct).toBe(40);
      expect(result.estimatedTokenSavings).toBe(10);
    });

    it('handles identical original and pruned strings with zero savings', () => {
      const sample = 'Clean transcript already pruned.';
      const result = estimateTokenSavings(sample, sample);

      expect(result.originalChars).toBe(sample.length);
      expect(result.prunedChars).toBe(sample.length);
      expect(result.charSavingsPct).toBe(0);
      expect(result.estimatedTokenSavings).toBe(0);
    });

    it('handles empty strings safely', () => {
      const result = estimateTokenSavings('', '');

      expect(result.originalChars).toBe(0);
      expect(result.prunedChars).toBe(0);
      expect(result.charSavingsPct).toBe(0);
      expect(result.estimatedTokenSavings).toBe(0);
    });

    it('rounds percentage to two decimal places on non-clean divisions', () => {
      // 30 chars original, 20 chars pruned -> 10/30 = 33.33%
      const original = '123456789012345678901234567890';
      const pruned = '12345678901234567890';

      const result = estimateTokenSavings(original, pruned);

      expect(result.originalChars).toBe(30);
      expect(result.prunedChars).toBe(20);
      expect(result.charSavingsPct).toBe(33.33);
      expect(result.estimatedTokenSavings).toBe(Math.ceil(30 / 4) - Math.ceil(20 / 4)); // 8 - 5 = 3
    });
  });
});
