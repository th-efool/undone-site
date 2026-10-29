import { expect, it } from 'vitest';
import { detectSourceKind } from '../source-kind';

it('classifies urls', () => {
  expect(detectSourceKind('https://youtu.be/abc')).toBe('youtube');
  expect(detectSourceKind('https://www.youtube.com/playlist?list=PL1')).toBe('youtube');
  expect(detectSourceKind('https://x.notion.site/a')).toBe('notion');
  expect(detectSourceKind('https://github.com/a/b')).toBe('github');
  expect(detectSourceKind('https://a.com/f.pdf?x=1')).toBe('pdf');
  expect(detectSourceKind('https://a.com/post')).toBe('web');
  expect(detectSourceKind('https://notyoutube.com/x')).toBe('web');
});
