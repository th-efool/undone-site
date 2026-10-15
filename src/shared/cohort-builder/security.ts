/**
 * Security utilities for the Cohort Builder.
 * Ensures untrusted links, schemes, and references are safely normalized before rendering.
 */

const FORBIDDEN_PROTOCOLS = /^(javascript|data|vbscript|file):/i;
const CONTROL_CHARS = /[\u0000-\u001f\u007f]/;

/**
 * Validates and sanitizes a link URL before it is used in `<a href="...">`.
 * Only allows clean relative paths (starting with `/` but not `//` or `/\`)
 * and absolute `http:` / `https:` URLs.
 * Replaces dangerous schemes (javascript:, data:, vbscript:) with '#'.
 */
export function sanitizeHref(input: unknown): string {
  if (typeof input !== 'string') return '#';
  const trimmed = input.trim();
  if (!trimmed || CONTROL_CHARS.test(trimmed)) return '#';

  // Prevent protocol-relative URLs (e.g. //evil.com) and backslash traversal (/\evil.com)
  if (trimmed.startsWith('//') || trimmed.startsWith('/\\') || trimmed.startsWith('\\')) {
    return '#';
  }

  // Safe relative paths starting with /
  if (trimmed.startsWith('/') && !trimmed.startsWith('/javascript:')) {
    return trimmed;
  }

  // Check for dangerous schemes
  if (FORBIDDEN_PROTOCOLS.test(trimmed)) {
    return '#';
  }

  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
      return parsed.href;
    }
  } catch {
    // Malformed URL
    return '#';
  }

  return '#';
}
