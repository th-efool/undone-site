import { describe, expect, it } from 'vitest';
import { authReturnTo, safeReturnTo } from '../returnTo';

describe('authentication return paths', () => {
  it('accepts current-domain Auth.js callbacks and keeps the complete learning query', () => {
    expect(authReturnTo(undefined, 'https://www.undone.one/quest/new?q=learn%20rendering', 'https://www.undone.one')).toBe('/quest/new?q=learn%20rendering');
    expect(authReturnTo(undefined, '/quest/draft/owned', 'https://www.undone.one')).toBe('/quest/draft/owned');
    expect(authReturnTo('/quest/new?q=notes', 'https://sidequesthq.in/home', 'https://www.undone.one')).toBe('/quest/new?q=notes');
  });
  it.each(['https://sidequesthq.in/home', '//evil.test/home', 'https://www.undone.one.evil.test/home', '/auth', '/%61uth/', '/api/auth/signin'])('rejects foreign or recursive callback: %s', callback => {
    expect(authReturnTo(undefined, callback, 'https://www.undone.one')).toBe('/home');
  });
  it.each(['/auth/', '/%61uth', '/api/auth/callback/github'])('blocks internal authentication return loops: %s', value => {
    expect(safeReturnTo(value)).toBe('/home');
  });
});
