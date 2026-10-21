const REDACTION_PATTERNS = [
  /Bearer\s+[A-Za-z0-9\-._~+/]+=*/gi,
  /eyJ[A-Za-z0-9\-_]+\.[A-Za-z0-9\-_]+\.[A-Za-z0-9\-_]+/g,
  /(?:password|secret|apikey|token|auth)=([^&\s]+)/gi,
];

export function redactSensitive(input: string): string {
  if (!input) return input;
  let result = input;
  for (const pattern of REDACTION_PATTERNS) {
    result = result.replace(pattern, '[REDACTED_SECRET]');
  }
  return result;
}

export function sanitizeLogMeta(meta: Record<string, unknown>): Record<string, unknown> {
  const sanitized: Record<string, unknown> = {};

  for (const [key, val] of Object.entries(meta)) {
    if (val === undefined || val === null) {
      sanitized[key] = val;
      continue;
    }

    const lowerKey = key.toLowerCase();
    if (
      lowerKey.includes('token') ||
      lowerKey.includes('secret') ||
      lowerKey.includes('password') ||
      lowerKey.includes('auth') ||
      lowerKey.includes('signature')
    ) {
      sanitized[key] = '[REDACTED]';
    } else if (typeof val === 'string') {
      const redacted = redactSensitive(val);
      sanitized[key] = redacted.length > 200 ? `${redacted.slice(0, 200)}...[TRUNCATED]` : redacted;
    } else if (typeof val === 'object' && !Array.isArray(val)) {
      sanitized[key] = sanitizeLogMeta(val as Record<string, unknown>);
    } else {
      sanitized[key] = val;
    }
  }

  return sanitized;
}

export interface LogEntry {
  timestamp: string;
  level: 'info' | 'warn' | 'error';
  event: string;
  requestId?: string;
  userId?: string;
  channelId?: string;
  scopeType?: string;
  revision?: number;
  latencyMs?: number;
  errorClass?: string;
  errorMessage?: string;
  meta?: Record<string, unknown>;
}

export const messagingLogger = {
  info(event: string, meta: Record<string, unknown> = {}): void {
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level: 'info',
      event,
      requestId: meta.requestId as string | undefined,
      userId: meta.userId as string | undefined,
      channelId: meta.channelId as string | undefined,
      scopeType: meta.scopeType as string | undefined,
      revision: meta.revision as number | undefined,
      latencyMs: meta.latencyMs as number | undefined,
      meta: sanitizeLogMeta(meta),
    };
    console.log(JSON.stringify(entry));
  },

  warn(event: string, meta: Record<string, unknown> = {}): void {
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level: 'warn',
      event,
      requestId: meta.requestId as string | undefined,
      userId: meta.userId as string | undefined,
      channelId: meta.channelId as string | undefined,
      scopeType: meta.scopeType as string | undefined,
      revision: meta.revision as number | undefined,
      latencyMs: meta.latencyMs as number | undefined,
      meta: sanitizeLogMeta(meta),
    };
    console.warn(JSON.stringify(entry));
  },

  error(event: string, err: unknown, meta: Record<string, unknown> = {}): void {
    const errorObj = err instanceof Error ? err : new Error(String(err));
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level: 'error',
      event,
      requestId: meta.requestId as string | undefined,
      userId: meta.userId as string | undefined,
      channelId: meta.channelId as string | undefined,
      scopeType: meta.scopeType as string | undefined,
      errorClass: errorObj.name,
      errorMessage: redactSensitive(errorObj.message),
      latencyMs: meta.latencyMs as number | undefined,
      meta: sanitizeLogMeta(meta),
    };
    console.error(JSON.stringify(entry));
  },
};
