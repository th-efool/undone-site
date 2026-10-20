import { MessagingValidationError } from './contracts';

export const MAX_MESSAGE_CONTENT_LENGTH = 4000;

const DANGEROUS_CONTROL_CHARS = /[\u0000-\u0008\u000B-\u000C\u000E-\u001F\u007F-\u009F]/g;
const DISALLOWED_URI_SCHEMES = /^(javascript|data|vbscript|file):/i;

export function sanitizeMessageContent(content: string): string {
  if (!content || typeof content !== 'string') {
    throw new MessagingValidationError('Message content cannot be empty');
  }

  // Strip null bytes and non-printable control characters (except newline, tab, carriage return)
  const cleaned = content.replace(DANGEROUS_CONTROL_CHARS, '').trim();

  if (!cleaned) {
    throw new MessagingValidationError('Message content cannot be empty');
  }

  if (cleaned.length > MAX_MESSAGE_CONTENT_LENGTH) {
    throw new MessagingValidationError(
      `Message content exceeds maximum allowed length of ${MAX_MESSAGE_CONTENT_LENGTH} characters (provided: ${cleaned.length})`
    );
  }

  return cleaned;
}

export function validateSafeUrl(rawUrl: string): string {
  if (!rawUrl || typeof rawUrl !== 'string') {
    throw new MessagingValidationError('Invalid URL');
  }

  const trimmed = rawUrl.trim();
  if (DISALLOWED_URI_SCHEMES.test(trimmed)) {
    throw new MessagingValidationError('Disallowed URI scheme');
  }

  try {
    const parsed = new URL(trimmed);
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      throw new MessagingValidationError('Only HTTP and HTTPS links are permitted');
    }
    return parsed.toString();
  } catch {
    throw new MessagingValidationError('Malformed URL');
  }
}
