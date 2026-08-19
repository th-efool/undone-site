/**
 * Security validation and input sanitization utilities for Cohort Creation Wizard.
 */

/**
 * Strips HTML/script tags, trims whitespace, and clips string to optional maxLength.
 */
export function sanitizeInputString(value: string, maxLength?: number): string {
  if (typeof value !== 'string') {
    return '';
  }
  let sanitized = value.replace(/<[^>]*>?/gm, '').trim();
  if (typeof maxLength === 'number' && maxLength > 0 && sanitized.length > maxLength) {
    sanitized = sanitized.slice(0, maxLength);
  }
  return sanitized;
}

/**
 * Validates and sanitizes a URL.
 * Forces http:// or https:// protocol.
 * Rejects javascript:, data:, file:, vbscript: schemes.
 * Clips URL to max 500 characters.
 */
export function validateUrlSecurity(url: string): { valid: boolean; sanitizedUrl: string; error?: string } {
  if (!url || typeof url !== 'string') {
    return { valid: false, sanitizedUrl: '', error: 'URL is required.' };
  }

  let sanitizedUrl = sanitizeInputString(url, 500);
  if (!sanitizedUrl) {
    return { valid: false, sanitizedUrl: '', error: 'URL cannot be empty.' };
  }

  const lower = sanitizedUrl.toLowerCase();
  if (
    lower.startsWith('javascript:') ||
    lower.startsWith('data:') ||
    lower.startsWith('file:') ||
    lower.startsWith('vbscript:')
  ) {
    return { valid: false, sanitizedUrl: '', error: 'Malicious or unsupported URL scheme detected.' };
  }

  if (!/^https?:\/\//i.test(sanitizedUrl)) {
    // If it starts with another scheme like ftp:, chrome:, etc.
    if (/^[a-z0-9+.-]+:/i.test(sanitizedUrl)) {
      return { valid: false, sanitizedUrl: '', error: 'URL must use http:// or https:// protocol.' };
    }
    // Force https:// prefix if no protocol specified
    sanitizedUrl = `https://${sanitizedUrl}`;
  }

  try {
    const parsed = new URL(sanitizedUrl);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return { valid: false, sanitizedUrl: '', error: 'URL must use http:// or https:// protocol.' };
    }
    return { valid: true, sanitizedUrl: parsed.toString() };
  } catch {
    return { valid: false, sanitizedUrl: '', error: 'Invalid URL format.' };
  }
}

/**
 * Performs full security validation and sanitization on a Cohort Draft payload.
 * Validates required fields, clips string lengths, sanitizes URLs and list items.
 */
export function validateCohortDraftSecurity(draft: any): {
  valid: boolean;
  sanitizedDraft: any;
  errors: string[];
} {
  const errors: string[] = [];

  if (!draft || typeof draft !== 'object') {
    return {
      valid: false,
      sanitizedDraft: draft,
      errors: ['Invalid draft payload provided.'],
    };
  }

  const title = sanitizeInputString(draft.title ?? '', 100);
  if (!title) {
    errors.push('Cohort title is required (max 100 characters).');
  }

  const subtitle = sanitizeInputString(draft.subtitle ?? '', 200);
  const description = sanitizeInputString(draft.description ?? '', 2000);
  if (!description) {
    errors.push('Cohort description is required (max 2000 characters).');
  }

  const primaryTopic = sanitizeInputString(draft.primaryTopic ?? '', 100);

  let coverImage = draft.coverImage ? draft.coverImage.trim() : '';
  if (coverImage) {
    const urlValidation = validateUrlSecurity(coverImage);
    if (!urlValidation.valid) {
      errors.push(`Cover image URL error: ${urlValidation.error}`);
    } else {
      coverImage = urlValidation.sanitizedUrl;
    }
  }

  const categories = Array.isArray(draft.categories)
    ? draft.categories.map((cat: any) => sanitizeInputString(String(cat), 50)).filter(Boolean)
    : [];

  const tags = Array.isArray(draft.tags)
    ? draft.tags.map((tag: any) => sanitizeInputString(String(tag), 30)).filter(Boolean)
    : [];

  const requirements = Array.isArray(draft.requirements)
    ? draft.requirements.map((req: any) => sanitizeInputString(String(req), 200)).filter(Boolean)
    : [];

  const learningOutcomes = Array.isArray(draft.learningOutcomes)
    ? draft.learningOutcomes.map((out: any) => sanitizeInputString(String(out), 200)).filter(Boolean)
    : [];

  const sources = Array.isArray(draft.sources)
    ? draft.sources.map((source: any) => {
        const sanitizedTitle = sanitizeInputString(source.title ?? '', 150);
        const sanitizedUrlInput = source.url ?? '';
        let finalUrl = sanitizedUrlInput;

        if (sanitizedUrlInput) {
          const urlVal = validateUrlSecurity(sanitizedUrlInput);
          if (!urlVal.valid) {
            errors.push(`Source "${sanitizedTitle || source.id || 'Unknown'}" URL error: ${urlVal.error}`);
          } else {
            finalUrl = urlVal.sanitizedUrl;
          }
        }

        return {
          ...source,
          title: sanitizedTitle,
          url: finalUrl,
        };
      })
    : [];

  const sanitizedDraft = {
    ...draft,
    title,
    subtitle,
    description,
    primaryTopic,
    coverImage,
    categories,
    tags,
    requirements,
    learningOutcomes,
    sources,
  };

  return {
    valid: errors.length === 0,
    sanitizedDraft,
    errors,
  };
}
