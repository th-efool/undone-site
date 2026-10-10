import 'server-only';
import { createHash } from 'node:crypto';
import { z } from 'zod';
import { learningIntentSchema } from '@/src/shared/cohort-creation/contracts';
import { retainedObjectRefSchema } from '@/src/shared/cohort-creation/materials';
import type { CreationArtifactRepository } from '@/src/server/infrastructure/storage/creation.store';
import { CreationStorageError, type StorageScope, type ArtifactOptions } from '@/src/server/infrastructure/storage/creation.contracts';
import { discoveryCandidateSchema, discoverySelectionSchema, groundedSearchSchema, DISCOVERY_LIMITS,
  validateDiscoverySelection, validateGroundedSearch, type ResourceDiscovery } from './discovery.contracts';
import type { DiscoverySourceObserver } from './discovery-observer';

export const discoveryRequestSchema = z.strictObject({ requestId: z.uuid(), inputRevision: z.number().int().nonnegative(), intent: learningIntentSchema });
export type DiscoveryRequest = z.infer<typeof discoveryRequestSchema>;
const artifactRef = retainedObjectRefSchema.extend({ kind: z.literal('artifact') });
export const discoveryCheckpointSchema = z.strictObject({ phase: z.literal('discovery_sources'), requestId: z.uuid(),
  inputRevision: z.number().int().nonnegative(), inputFingerprint: z.string().regex(/^[a-f0-9]{64}$/),
  searchArtifact: artifactRef, observationArtifact: artifactRef.nullable(), selectionArtifact: artifactRef.nullable(),
  processed: z.number().int().nonnegative().max(DISCOVERY_LIMITS.citations), total: z.number().int().nonnegative().max(DISCOVERY_LIMITS.citations),
}).refine(value => value.processed <= value.total && (!value.processed || !!value.observationArtifact) &&
  (!value.selectionArtifact || !!value.observationArtifact && value.processed === value.total), 'Invalid discovery progress');
export type DiscoveryCheckpoint = z.infer<typeof discoveryCheckpointSchema>;
const searchReceiptSchema = z.strictObject({ schemaVersion: z.literal(1), request: discoveryRequestSchema, search: groundedSearchSchema });
const failureSchema = z.strictObject({ citationId: z.string().min(1).max(256), code: z.enum(['INVALID_INPUT', 'LIMIT_EXCEEDED', 'UNAVAILABLE']),
  message: z.string().min(1).max(300) });
const observationsSchema = z.strictObject({ schemaVersion: z.literal(1), searchArtifact: artifactRef,
  processedIds: z.array(z.string().min(1).max(256)).max(DISCOVERY_LIMITS.citations),
  candidates: z.array(discoveryCandidateSchema).max(DISCOVERY_LIMITS.candidates), failures: z.array(failureSchema).max(DISCOVERY_LIMITS.citations) });
const selectionReceiptSchema = z.strictObject({ schemaVersion: z.literal(1), observationArtifact: artifactRef, selection: discoverySelectionSchema });
export const discoveryFingerprint = (request: DiscoveryRequest) => createHash('sha256').update(JSON.stringify(discoveryRequestSchema.parse(request))).digest('hex');
const sameRef = (first: z.infer<typeof artifactRef>, second: z.infer<typeof artifactRef>) => first.id === second.id && first.checksum === second.checksum && first.byteLength === second.byteLength;
const integrity = (): never => { throw new CreationStorageError('INTEGRITY', 'Retained discovery evidence does not match its request and progress.'); };

/** Proposes private artifacts/checkpoints. Only the fenced application repository may accept them. */
export class DiscoveryService {
  constructor(private readonly ai: ResourceDiscovery, private readonly observer: Pick<DiscoverySourceObserver, 'observe'>,
    private readonly artifacts: Pick<CreationArtifactRepository, 'putJSON' | 'getJSON' | 'ref'>) {}
  private async read<T extends z.ZodType>(scope: StorageScope, reference: z.infer<typeof artifactRef>, options: ArtifactOptions<T>): Promise<z.output<T>> {
    const actual = artifactRef.parse(await this.artifacts.ref(scope, reference.id));
    if (!sameRef(actual, reference)) integrity();
    return this.artifacts.getJSON(scope, reference.id, options);
  }
  async run(scope: StorageScope, value: DiscoveryRequest, signal: AbortSignal,
    save: (checkpoint: DiscoveryCheckpoint) => Promise<void>, saved?: DiscoveryCheckpoint) {
    const request = discoveryRequestSchema.parse(value); const inputFingerprint = discoveryFingerprint(request); signal.throwIfAborted();
    let checkpoint: DiscoveryCheckpoint; let search: z.infer<typeof groundedSearchSchema>;
    if (saved) {
      checkpoint = discoveryCheckpointSchema.parse(saved);
      if (checkpoint.requestId !== request.requestId || checkpoint.inputRevision !== request.inputRevision || checkpoint.inputFingerprint !== inputFingerprint) integrity();
      const receipt = await this.read(scope, checkpoint.searchArtifact, { artifactType: 'discovery-search', schemaVersion: 1,
        inputFingerprint, schema: searchReceiptSchema, signal });
      if (discoveryFingerprint(receipt.request) !== inputFingerprint) integrity();
      search = validateGroundedSearch(receipt.search); if (checkpoint.total !== search.citations.length) integrity();
    } else {
      search = validateGroundedSearch(await this.ai.search(request.intent, signal)); signal.throwIfAborted();
      const searchArtifact = await this.artifacts.putJSON(scope, { schemaVersion: 1, request, search }, { artifactType: 'discovery-search',
        schemaVersion: 1, inputFingerprint, schema: searchReceiptSchema, signal });
      checkpoint = discoveryCheckpointSchema.parse({ phase: 'discovery_sources', requestId: request.requestId, inputRevision: request.inputRevision,
        inputFingerprint, searchArtifact, observationArtifact: null, selectionArtifact: null, processed: 0, total: search.citations.length });
      await save(checkpoint);
    }
    let observations: z.infer<typeof observationsSchema> = { schemaVersion: 1, searchArtifact: checkpoint.searchArtifact, processedIds: [], candidates: [], failures: [] };
    if (checkpoint.observationArtifact) {
      observations = await this.read(scope, checkpoint.observationArtifact, { artifactType: 'discovery-observations', schemaVersion: 1,
        inputFingerprint, schema: observationsSchema, signal });
      if (!sameRef(observations.searchArtifact, checkpoint.searchArtifact) || observations.processedIds.length !== checkpoint.processed ||
        observations.processedIds.some((id, index) => id !== search.citations[index]?.id) ||
        new Set(observations.candidates.map(candidate => candidate.key)).size !== observations.candidates.length) integrity();
      const accounted = [...observations.candidates.flatMap(candidate => candidate.citationIds), ...observations.failures.map(failure => failure.citationId)];
      if (new Set(accounted).size !== accounted.length || accounted.length !== observations.processedIds.length || accounted.some(id => !observations.processedIds.includes(id))) integrity();
    }
    for (const citation of search.citations.slice(checkpoint.processed)) {
      signal.throwIfAborted();
      if (observations.candidates.length >= DISCOVERY_LIMITS.candidates) {
        observations.failures.push({ citationId: citation.id, code: 'LIMIT_EXCEEDED', message: 'The 20-candidate observation limit was reached. Narrow the goal to inspect additional resources.' });
      } else {
        try {
          const candidate = discoveryCandidateSchema.parse(await this.observer.observe(citation, signal));
          if (candidate.citationIds.length !== 1 || candidate.citationIds[0] !== citation.id || candidate.observation.requestedUrl !== citation.url) integrity();
          const existing = observations.candidates.find(item => item.key === candidate.key);
          if (existing) {
            if (existing.url !== candidate.url || existing.kind !== candidate.kind) integrity();
            existing.citationIds.push(citation.id);
          } else observations.candidates.push(candidate);
        } catch (error) {
          signal.throwIfAborted();
          if (error instanceof CreationStorageError && error.code === 'INTEGRITY') throw error;
          observations.failures.push({ citationId: citation.id,
            code: error instanceof CreationStorageError && ['INVALID_INPUT', 'LIMIT_EXCEEDED'].includes(error.code) ? error.code as 'INVALID_INPUT' | 'LIMIT_EXCEEDED' : 'UNAVAILABLE',
            message: 'This cited source could not be observed within its public access and size limits. Select another source or retry discovery.' });
        }
      }
      observations.processedIds.push(citation.id); signal.throwIfAborted();
      const observationArtifact = await this.artifacts.putJSON(scope, observations, { artifactType: 'discovery-observations', schemaVersion: 1,
        inputFingerprint, schema: observationsSchema, signal });
      checkpoint = { ...checkpoint, observationArtifact: artifactRef.parse(observationArtifact), processed: observations.processedIds.length }; await save(checkpoint);
    }
    // Zero-result search still has a real, empty observation receipt; no fabricated work count.
    if (!checkpoint.observationArtifact) {
      checkpoint = { ...checkpoint, observationArtifact: artifactRef.parse(await this.artifacts.putJSON(scope, observations, { artifactType: 'discovery-observations',
        schemaVersion: 1, inputFingerprint, schema: observationsSchema, signal })) }; await save(checkpoint);
    }
    const observationArtifact = checkpoint.observationArtifact;
    if (!observationArtifact) return integrity();
    let selection: z.infer<typeof discoverySelectionSchema>;
    if (checkpoint.selectionArtifact) {
      const receipt = await this.read(scope, checkpoint.selectionArtifact, { artifactType: 'discovery-selection', schemaVersion: 1,
        inputFingerprint, schema: selectionReceiptSchema, signal });
      if (!sameRef(receipt.observationArtifact, observationArtifact)) integrity();
      selection = validateDiscoverySelection(receipt.selection, observations.candidates);
    } else {
      selection = observations.candidates.length ? validateDiscoverySelection(await this.ai.select(request.intent, observations.candidates, signal), observations.candidates) : { selected: [] };
      signal.throwIfAborted();
      checkpoint = { ...checkpoint, selectionArtifact: artifactRef.parse(await this.artifacts.putJSON(scope, { schemaVersion: 1, observationArtifact, selection },
        { artifactType: 'discovery-selection', schemaVersion: 1, inputFingerprint, schema: selectionReceiptSchema, signal })) }; await save(checkpoint);
    }
    signal.throwIfAborted(); return { checkpoint, candidates: observations.candidates, failures: observations.failures, selection };
  }
}
