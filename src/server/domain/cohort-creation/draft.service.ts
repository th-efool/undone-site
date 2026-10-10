import type { CreationSnapshot } from '@/src/shared/cohort-creation/contracts';
import { applyCommand, creationCommandSchema, type CreationCommand } from '@/src/shared/cohort-creation/flow';
import type { DraftRepository } from '@/src/server/infrastructure/db/postgres/repositories/creationDraft.repo';
import type { CreationJobRepository } from './durable-job';
import { webSourceUrl } from './materials/web-fetch';
import { youtubeSourceUrl } from './materials/youtube-url';
import { githubRepositoryUrl } from './materials/github';
import { githubRepositoryScope } from '@/src/shared/cohort-creation/github';

export class DraftConflict extends Error {
  constructor(readonly current: CreationSnapshot) { super('Draft changed. Reload before retrying your edit.'); }
}
export class DraftNotFound extends Error {}
export class DraftService {
  constructor(private readonly repo: DraftRepository, private readonly jobs: Pick<CreationJobRepository, 'enqueue' | 'cancel'>) {}
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
  async command(owner: string, id: string, baseRevision: number, input: CreationCommand) {
    const previous = await this.load(owner, id);
    const command = creationCommandSchema.parse(input);
    if (command.type === 'acquire_web') command.url = webSourceUrl(command.url).href;
    if (command.type === 'inspect_youtube') command.url = youtubeSourceUrl(command.url).url;
    if (command.type === 'acquire_github') command.selection.url = githubRepositoryUrl(command.selection.url).url;
    if (command.type === 'request_recommendations' && previous.query === command.query &&
      (previous.activeRequestId === command.requestId || previous.result?.requestId === command.requestId)) return previous;
    if ((command.type === 'acquire_text' || command.type === 'acquire_pdf') && previous.lastMaterialRequestId === command.requestId && previous.materials.some(source =>
      source.id === command.materialId && source.kind === (command.type === 'acquire_pdf' ? 'pdf' : 'markdown') && source.input.kind === 'upload' && source.input.assetId === command.assetId)) return previous;
    if (command.type === 'acquire_web' && previous.lastMaterialRequestId === command.requestId && previous.materials.some(source =>
      source.id === command.materialId && source.input.kind === 'url' && source.input.url === command.url)) return previous;
    if (command.type === 'inspect_youtube' && previous.lastMaterialRequestId === command.requestId && previous.materials.some(source =>
      source.id === command.materialId && ['youtube_video', 'youtube_playlist'].includes(source.kind) && source.input.kind === 'url' && source.input.url === command.url)) return previous;
    if (command.type === 'observe_youtube' && previous.lastMaterialRequestId === command.requestId &&
      previous.youtubeSources.some(source => source.materialId === command.materialId)) return previous;
    if (command.type === 'acquire_github' && previous.lastMaterialRequestId === command.requestId && previous.materials.some(source =>
      source.id === command.materialId && source.kind === 'github' && source.input.kind === 'url' && source.input.url === command.selection.url &&
      JSON.stringify(source.input.repositoryScope) === JSON.stringify(githubRepositoryScope(command.selection)))) return previous;
    if (previous.revision !== baseRevision) throw new DraftConflict(previous);
    const next = applyCommand(previous, command);
    if (command.type === 'request_recommendations' || command.type === 'acquire_text' || command.type === 'acquire_pdf' || command.type === 'acquire_web' || command.type === 'inspect_youtube' || command.type === 'observe_youtube' || command.type === 'acquire_github') {
      const queued = await this.jobs.enqueue(owner, previous, next);
      if (!queued) throw new DraftConflict(await this.load(owner, id));
      return queued;
    }
    if ((command.type === 'cancel_recommendations' || command.type === 'cancel_material_acquisition') && next !== previous) {
      if (!await this.jobs.cancel(owner, previous, next)) throw new DraftConflict(await this.load(owner, id));
      return next;
    }
    return this.commit(owner, previous, next);
  }
}
