import type { CreationSnapshot } from '@/src/shared/cohort-creation/contracts';
import { applyCommand, applyEvent, creationCommandSchema, type CreationCommand } from '@/src/shared/cohort-creation/flow';
import type { DraftRepository } from '@/src/server/infrastructure/db/postgres/repositories/creationDraft.repo';
import type { RecommendationService } from './recommendation.service';
import { CreationFailure } from './errors';

export class DraftConflict extends Error {
  constructor(readonly current: CreationSnapshot) { super('Draft changed. Reload before retrying your edit.'); }
}
export class DraftNotFound extends Error {}
export class DraftService {
  constructor(private readonly repo: DraftRepository, private readonly recommendations: () => Pick<RecommendationService, 'recommend'>) {}
  async load(owner: string, id: string) {
    const state = await this.repo.load(owner, id);
    if (!state) throw new DraftNotFound();
    return state;
  }
  async create(owner: string, id: string) {
    const state = await this.repo.create(owner, id);
    if (!state) throw new DraftNotFound();
    return state;
  }
  private async commit(owner: string, previous: CreationSnapshot, next: CreationSnapshot) {
    if (next === previous) return previous;
    if (!await this.repo.swap(owner, previous.draftId, previous.revision, next)) throw new DraftConflict(await this.load(owner, previous.draftId));
    return next;
  }
  async command(owner: string, id: string, baseRevision: number, input: CreationCommand, signal: AbortSignal) {
    const previous = await this.load(owner, id);
    if (previous.revision !== baseRevision) throw new DraftConflict(previous);
    const command = creationCommandSchema.parse(input);
    const next = await this.commit(owner, previous, applyCommand(previous, command));
    if (command.type !== 'request_recommendations') return next;
    let completed: CreationSnapshot;
    try {
      const result = await this.recommendations().recommend({ requestId: command.requestId, query: next.query, inputRevision: next.inputRevision }, signal);
      signal.throwIfAborted();
      completed = applyEvent(next, { type: 'recommendations_received', result });
    } catch (error) {
      completed = applyEvent(next, signal.aborted
        ? { type: 'operation_cancelled', requestId: command.requestId }
        : { type: 'operation_failed', requestId: command.requestId, error: error instanceof CreationFailure ? error.detail : {
          code: 'AI_UNAVAILABLE', message: 'Recommendations could not be loaded. Try again.', retryable: true,
        } });
    }
    return this.commit(owner, next, completed);
  }
}
