import type { CreationError } from '@/src/shared/cohort-creation/contracts';

export class CreationFailure extends Error {
  constructor(readonly detail: CreationError) {
    super(detail.message);
    this.name = 'CreationFailure';
  }
}

/** A provider minimum delay, persisted by the job repository rather than slept in a worker. */
export class ProviderBackoff extends CreationFailure {
  constructor(readonly retryAfterMs: number) {
    super({ code: 'RATE_LIMITED', message: 'The source provider is busy. Retry the selected source later.', retryable: true });
    if (!Number.isSafeInteger(retryAfterMs) || retryAfterMs < 0) throw new Error('Invalid provider retry delay');
  }
}

export function creationFailure(code: CreationError['code'], message: string, retryable = true) {
  return new CreationFailure({ code, message, retryable });
}
