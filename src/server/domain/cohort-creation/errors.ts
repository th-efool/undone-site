import type { CreationError } from '@/src/shared/cohort-creation/contracts';

export class CreationFailure extends Error {
  constructor(readonly detail: CreationError) {
    super(detail.message);
    this.name = 'CreationFailure';
  }
}

export function creationFailure(code: CreationError['code'], message: string, retryable = true) {
  return new CreationFailure({ code, message, retryable });
}
