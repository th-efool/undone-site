import type { BuildingContentService } from './building-content.service';
import { rebaseReview } from './review.service';
import { creationSnapshotSchema } from '@/src/shared/cohort-creation/contracts';
import type { CreationSnapshot } from '@/src/shared/cohort-creation/contracts';
import { applyCommand, creationCommandSchema, type CreationCommand } from '@/src/shared/cohort-creation/flow';
import type { DraftRepository } from '@/src/server/infrastructure/db/postgres/repositories/creationDraft.repo';
import type { CreationJobRepository } from './durable-job';
import { webSourceUrl } from './materials/web-fetch';
import { youtubeSourceUrl } from './materials/youtube-url';
import { githubRepositoryUrl } from './materials/github';
import { githubRepositoryScope } from '@/src/shared/cohort-creation/github';
import { notionPageIdentity } from './materials/notion';

export class DraftConflict extends Error {
  constructor(readonly current: CreationSnapshot) { super('Draft changed. Reload before retrying your edit.'); }
}
export class DraftNotFound extends Error {}
export class DraftService {
  constructor(private readonly repo: DraftRepository, private readonly jobs: Pick<CreationJobRepository, 'enqueue' | 'cancel'>, private readonly content?: Pick<BuildingContentService, 'load'>) {}
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
    if (command.type === 'acquire_notion') command.url = notionPageIdentity(command.url).url;
    if (command.type === 'request_recommendations' && previous.query === command.query &&
      (previous.activeRequestId === command.requestId || previous.result?.requestId === command.requestId)) return previous;
    if (command.type === 'discover_material' && previous.discovery?.requestId === command.requestId) return previous;
    if (command.type === 'understand_material' && previous.processing?.requestId === command.requestId) return previous;
    if (command.type === 'cancel_processing' && previous.stage === 'published' && previous.publication?.receipt) return previous;
    if (command.type === 'finalize_creation' && (previous.publication?.receipt?.mode === command.mode || previous.publication?.requestId === command.requestId && previous.publication.mode === command.mode)) return previous;
    if (command.type === 'refine_curriculum' && (previous.review?.request?.requestId === command.requestId || previous.review?.proposal?.requestId === command.requestId)) return previous;
    if (command.type === 'build_curriculum' && previous.processing?.building?.requestId === command.requestId) return previous;
    if (command.type === 'analyze_material' && previous.processing?.analysis?.requestId === command.requestId) return previous;
    if (command.type === 'chunk_material' && previous.processing?.chunking?.requestId === command.requestId) return previous;
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
    if (command.type === 'acquire_notion' && previous.lastMaterialRequestId === command.requestId && previous.materials.some(source =>
      source.id === command.materialId && source.kind === 'notion' && source.input.kind === 'url' && source.input.url === command.url)) return previous;
    if (previous.revision !== baseRevision) throw new DraftConflict(previous);
    if (command.type === 'open_review') {
      if (!['ready', 'review'].includes(previous.stage) || previous.status === 'running' || !this.content) throw new Error('Review is not available');
      const built = await this.content.load({ ownerId: owner, draftId: id }, previous, AbortSignal.timeout(60_000));
      const next = creationSnapshotSchema.parse({ ...previous, revision: previous.revision + 1, stage: 'review', status: 'succeeded', error: null,
        review: previous.review?.buildFingerprint === built.curriculum.version ? previous.review : rebaseReview(built.curriculum, previous.review) });
      return this.commit(owner, previous, next);
    }
    const next = applyCommand(previous, command);
    if (command.type === 'finalize_creation' || command.type === 'refine_curriculum' || command.type === 'build_curriculum' || command.type === 'analyze_material' || command.type === 'chunk_material' || command.type === 'understand_material' || command.type === 'discover_material' || command.type === 'request_recommendations' || command.type === 'acquire_text' || command.type === 'acquire_pdf' || command.type === 'acquire_web' || command.type === 'inspect_youtube' || command.type === 'observe_youtube' || command.type === 'acquire_github' || command.type === 'acquire_notion') {
      const queued = await this.jobs.enqueue(owner, previous, next);
      if (!queued) throw new DraftConflict(await this.load(owner, id));
      return queued;
    }
    if ((command.type === 'cancel_processing' || command.type === 'cancel_recommendations' || command.type === 'cancel_material_acquisition') && next !== previous) {
      if (!await this.jobs.cancel(owner, previous, next)) throw new DraftConflict(await this.load(owner, id));
      return next;
    }
    return this.commit(owner, previous, next);
  }
}
