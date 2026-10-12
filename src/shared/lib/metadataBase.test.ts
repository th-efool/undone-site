import { describe, expect, it } from 'vitest';
import { resolveMetadataBase } from './metadataBase';

describe('layout metadata base', () => {
  it.each([undefined, '', 'https://[SENSITIVE]', 'not a URL', 'ftp://example.com', 'https://user:password@example.com'])('uses the existing fallback for invalid optional configuration: %s', value => {
    expect(resolveMetadataBase(value).href).toBe('https://undone.in/');
  });
  it.each(['https://www.undone.one', 'https://example.com/base/', 'http://localhost:3000'])('preserves valid configured HTTP URLs: %s', value => {
    expect(resolveMetadataBase(value).href).toBe(new URL(value).href);
  });
});
