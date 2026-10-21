import { NextResponse } from 'next/server';
import { studyRoomMetricsService } from '@/src/server/domain/studyroom/studyroom-metrics.service';

export const MAX_STUDYROOM_PAYLOAD_BYTES = 32 * 1024; // 32KB

/**
 * Validates request origin on mutating operations (POST, PUT, PATCH, DELETE)
 * to prevent Cross-Site Request Forgery (CSRF).
 */
export function validateMutationOrigin(request: Request): { valid: boolean; errorResponse?: Response } {
  const origin = request.headers.get('origin');
  if (!origin) {
    // If no origin header is provided (e.g. server-to-server or same-origin non-CORS GET),
    // allow if sec-fetch-site is same-origin or not cross-site
    const secFetchSite = request.headers.get('sec-fetch-site');
    if (secFetchSite === 'cross-site') {
      studyRoomMetricsService.recordAuthorizationFailure('invalid_origin');
      return {
        valid: false,
        errorResponse: NextResponse.json(
          { error: 'Cross-site mutation rejected', code: 'INVALID_ORIGIN' },
          { status: 403, headers: { 'Cache-Control': 'private, no-store' } }
        ),
      };
    }
    return { valid: true };
  }

  let requestOrigin: string;
  try {
    requestOrigin = new URL(request.url).origin;
  } catch {
    studyRoomMetricsService.recordAuthorizationFailure('invalid_origin');
    return {
      valid: false,
      errorResponse: NextResponse.json(
        { error: 'Invalid request URL', code: 'INVALID_ORIGIN' },
        { status: 403, headers: { 'Cache-Control': 'private, no-store' } }
      ),
    };
  }

  if (origin !== requestOrigin) {
    // Check if both are localhost in dev/test environment
    const isLocalOrigin = origin.startsWith('http://localhost') || origin.startsWith('http://127.0.0.1');
    const isLocalRequest = requestOrigin.startsWith('http://localhost') || requestOrigin.startsWith('http://127.0.0.1');

    if (isLocalOrigin && isLocalRequest) {
      return { valid: true };
    }

    studyRoomMetricsService.recordAuthorizationFailure('invalid_origin');
    return {
      valid: false,
      errorResponse: NextResponse.json(
        { error: 'Invalid mutation origin', code: 'INVALID_ORIGIN' },
        { status: 403, headers: { 'Cache-Control': 'private, no-store' } }
      ),
    };
  }

  return { valid: true };
}

/**
 * Parses JSON request body enforcing a strict payload size limit (default 32KB).
 */
export async function parseJsonWithLimit<T = unknown>(
  request: Request,
  maxBytes: number = MAX_STUDYROOM_PAYLOAD_BYTES
): Promise<{ data?: T; errorResponse?: Response }> {
  try {
    const text = await request.text();
    if (text.length > maxBytes) {
      return {
        errorResponse: NextResponse.json(
          { error: `Payload exceeds limit of ${maxBytes} bytes`, code: 'INPUT_TOO_LARGE' },
          { status: 413, headers: { 'Cache-Control': 'private, no-store' } }
        ),
      };
    }

    if (!text.trim()) {
      return { data: {} as T };
    }

    const data = JSON.parse(text) as T;
    return { data };
  } catch {
    return {
      errorResponse: NextResponse.json(
        { error: 'Invalid JSON payload', code: 'INVALID_JSON' },
        { status: 400, headers: { 'Cache-Control': 'private, no-store' } }
      ),
    };
  }
}

/**
 * Helper to validate bounded string inputs.
 */
export function validateBoundedString(
  value: unknown,
  fieldName: string,
  maxLen: number,
  required = true
): { valid: boolean; value: string; errorResponse?: Response } {
  if (value === undefined || value === null || value === '') {
    if (required) {
      return {
        valid: false,
        value: '',
        errorResponse: NextResponse.json(
          { error: `${fieldName} is required`, code: 'INVALID_INPUT' },
          { status: 400, headers: { 'Cache-Control': 'private, no-store' } }
        ),
      };
    }
    return { valid: true, value: '' };
  }

  if (typeof value !== 'string') {
    return {
      valid: false,
      value: '',
      errorResponse: NextResponse.json(
        { error: `${fieldName} must be a string`, code: 'INVALID_INPUT' },
        { status: 400, headers: { 'Cache-Control': 'private, no-store' } }
      ),
    };
  }

  const trimmed = value.trim();
  if (trimmed.length > maxLen) {
    return {
      valid: false,
      value: trimmed,
      errorResponse: NextResponse.json(
        { error: `${fieldName} exceeds maximum length of ${maxLen} characters`, code: 'INPUT_TOO_LONG' },
        { status: 400, headers: { 'Cache-Control': 'private, no-store' } }
      ),
    };
  }

  return { valid: true, value: trimmed };
}
