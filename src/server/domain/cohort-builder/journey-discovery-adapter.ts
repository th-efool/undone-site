import { createHash, randomUUID } from 'node:crypto';
import { z } from 'zod';
import type { LanguageModel } from 'ai';
import {
  cohortDiscoveryItemSchema,
  type CohortDiscoveryItem,
  type CohortWorkspace,
} from '@/src/shared/cohort-builder/contracts';
import type { CreationArtifactRepository } from '@/src/server/infrastructure/storage/creation.store';
import {
  CreationStorageError,
  type StorageScope,
  type ArtifactOptions,
  type CreationObjectRef,
} from '@/src/server/infrastructure/storage/creation.contracts';
import {
  putTextArtifact,
  type TextArtifactSql,
} from './text-artifacts';
import type {
  DiscoveryService as DiscoveryServiceType,
  DiscoveryRequest,
} from '../cohort-creation/discovery.service';
import {
  type ResourceDiscovery,
} from '../cohort-creation/discovery.contracts';
import type { DiscoverySourceObserver } from '../cohort-creation/discovery-observer';
import {
  learningIntentSchema,
} from '@/src/shared/cohort-creation/contracts';
import {
  discoveryCheckpointSchema,
  type DiscoveryCheckpoint,
  type DiscoveryResult,
} from '@/src/shared/cohort-creation/discovery';
import { CreationFailure, creationFailure } from '../cohort-creation/errors';

export interface DiscoveryAdapterDeps {
  ai?: ResourceDiscovery;
  observer?: Pick<DiscoverySourceObserver, 'observe'>;
  storage?: Pick<CreationArtifactRepository, 'putJSON' | 'getJSON' | 'ref'>;
  sql?: TextArtifactSql;
  workspaceId?: string;
  jobKey?: string;
  dependencyFingerprint?: string;
  attempt?: number;
  model?: LanguageModel;
  __allowInMemoryStorage?: boolean;
  skipPauseCheck?: boolean;
}

function isAccountingError(err: unknown): boolean {
  if (!err) return false;
  const msg = err instanceof Error ? err.message : String(err);
  return (
    msg.includes('OWNER_REQUIRED') ||
    msg.includes('WORKSPACE_REQUIRED') ||
    msg.includes('ACCOUNTING_STORAGE_UNAVAILABLE') ||
    msg.includes('MODEL_CALLS_PAUSED') ||
    msg.includes('BUDGET_EXHAUSTED') ||
    (err as any)?.code === 'BUDGET_EXHAUSTED' ||
    (err as any)?.name === 'UserBudgetExceededError'
  );
}

export class WorkspaceArtifactStoreAdapter
  implements Pick<CreationArtifactRepository, 'putJSON' | 'getJSON' | 'ref'>
{
  constructor(
    private readonly sql: TextArtifactSql,
    private readonly workspaceId: string
  ) {}

  private validateScopeTenant(scope: StorageScope): void {
    const expectedOwnerId = `workspace:${this.workspaceId}`;
    if (!scope || typeof scope.ownerId !== 'string' || scope.ownerId !== expectedOwnerId) {
      throw new CreationStorageError('NOT_FOUND', 'Stored content was not found for workspace.');
    }
  }

  async putJSON<T extends z.ZodType>(
    scope: StorageScope,
    value: z.input<T>,
    options: ArtifactOptions<T>
  ): Promise<CreationObjectRef> {
    options.signal?.throwIfAborted();
    this.validateScopeTenant(scope);
    if (!options.artifactType || typeof options.artifactType !== 'string') {
      throw new CreationStorageError('INVALID_INPUT', 'ARTIFACT_MISSING_TYPE: artifactType is required');
    }
    if (typeof options.schemaVersion !== 'number' || !Number.isInteger(options.schemaVersion)) {
      throw new CreationStorageError('INVALID_INPUT', 'ARTIFACT_MISSING_SCHEMA_VERSION: schemaVersion is required');
    }
    if (!options.inputFingerprint || typeof options.inputFingerprint !== 'string') {
      throw new CreationStorageError('INVALID_INPUT', 'ARTIFACT_MISSING_FINGERPRINT: inputFingerprint is required');
    }
    const validated = options.schema.parse(value);
    const envelope = {
      artifactType: options.artifactType,
      schemaVersion: options.schemaVersion,
      inputFingerprint: options.inputFingerprint,
      value: validated,
    };
    const serialized = JSON.stringify(envelope);
    const bytes = Buffer.from(serialized, 'utf8');

    const ref = await putTextArtifact(this.sql, {
      workspaceId: this.workspaceId,
      kind: 'discovery',
      inputFingerprint: options.inputFingerprint,
      bytes,
    });

    return {
      id: ref.id,
      kind: 'artifact',
      byteLength: ref.byteLength,
      checksum: ref.checksum,
    };
  }

  async ref(scope: StorageScope, id: string): Promise<CreationObjectRef> {
    this.validateScopeTenant(scope);
    const result = await this.sql.query(
      `SELECT "id", "checksum", "byteLength", "kind"
       FROM "cohort_text_artifacts"
       WHERE "workspaceId" = $1 AND "id" = $2`,
      [this.workspaceId, id]
    );
    const row = result.rows[0];
    if (!row) {
      throw new CreationStorageError('NOT_FOUND', 'Stored content was not found.');
    }
    if (row.kind !== undefined && row.kind !== null && String(row.kind) !== 'discovery') {
      throw new CreationStorageError(
        'INTEGRITY',
        `ARTIFACT_KIND_MISMATCH: Expected discovery artifact kind, found ${String(row.kind)}`
      );
    }
    return {
      id: String(row.id),
      kind: 'artifact',
      byteLength: Number(row.byteLength),
      checksum: String(row.checksum),
    };
  }

  async getJSON<T extends z.ZodType>(
    scope: StorageScope,
    id: string,
    options: ArtifactOptions<T>
  ): Promise<z.output<T>> {
    options.signal?.throwIfAborted();
    this.validateScopeTenant(scope);
    if (!options.artifactType || typeof options.artifactType !== 'string') {
      throw new CreationStorageError('INTEGRITY', 'ARTIFACT_MISSING_TYPE: Expected artifactType in options');
    }
    if (typeof options.schemaVersion !== 'number' || !Number.isInteger(options.schemaVersion)) {
      throw new CreationStorageError('INTEGRITY', 'ARTIFACT_MISSING_SCHEMA_VERSION: Expected integer schemaVersion in options');
    }
    if (!options.inputFingerprint || typeof options.inputFingerprint !== 'string') {
      throw new CreationStorageError('INTEGRITY', 'ARTIFACT_MISSING_FINGERPRINT: Expected inputFingerprint in options');
    }

    const result = await this.sql.query(
      `SELECT "id", "checksum", "byteLength", "body", "kind", "inputFingerprint"
       FROM "cohort_text_artifacts"
       WHERE "workspaceId" = $1 AND "id" = $2`,
      [this.workspaceId, id]
    );
    const row = result.rows[0];
    if (!row) {
      throw new CreationStorageError('NOT_FOUND', 'Stored content was not found.');
    }
    if (row.kind === undefined || row.kind === null || String(row.kind) !== 'discovery') {
      throw new CreationStorageError(
        'INTEGRITY',
        `ARTIFACT_KIND_MISMATCH: Expected discovery artifact kind, found ${String(row.kind)}`
      );
    }
    if (row.inputFingerprint === undefined || row.inputFingerprint === null || String(row.inputFingerprint) !== options.inputFingerprint) {
      throw new CreationStorageError(
        'INTEGRITY',
        `ARTIFACT_FINGERPRINT_MISMATCH: Row fingerprint ${String(row.inputFingerprint)} !== expected ${options.inputFingerprint}`
      );
    }

    const rawBody = row.body;
    const bytes = Buffer.isBuffer(rawBody)
      ? rawBody
      : rawBody instanceof Uint8Array
      ? Buffer.from(rawBody)
      : typeof rawBody === 'string'
      ? Buffer.from(rawBody, 'utf8')
      : Buffer.from(rawBody as ArrayBuffer);

    // Verify byteLength
    if (row.byteLength === undefined || row.byteLength === null || bytes.byteLength !== Number(row.byteLength)) {
      throw new CreationStorageError(
        'INTEGRITY',
        `ARTIFACT_LENGTH_MISMATCH: Stored length ${row.byteLength} !== actual length ${bytes.byteLength}`
      );
    }

    // Verify checksum
    if (!row.checksum || typeof row.checksum !== 'string') {
      throw new CreationStorageError('INTEGRITY', 'ARTIFACT_CHECKSUM_MISSING: Stored checksum is missing');
    }
    const computedChecksum = createHash('sha256').update(bytes).digest('hex');
    if (computedChecksum !== String(row.checksum)) {
      throw new CreationStorageError(
        'INTEGRITY',
        `ARTIFACT_CHECKSUM_MISMATCH: Stored checksum ${row.checksum} !== computed checksum ${computedChecksum}`
      );
    }

    let envelope: any;
    try {
      envelope = JSON.parse(bytes.toString('utf8'));
    } catch {
      throw new CreationStorageError('INTEGRITY', 'ARTIFACT_CORRUPT_JSON: Failed to parse stored artifact JSON');
    }

    if (!envelope || typeof envelope !== 'object' || Array.isArray(envelope)) {
      throw new CreationStorageError('INTEGRITY', 'ARTIFACT_INVALID_ENVELOPE: Stored artifact is not an object');
    }

    if (typeof envelope.artifactType !== 'string' || !envelope.artifactType) {
      throw new CreationStorageError('INTEGRITY', 'ARTIFACT_MISSING_TYPE: Stored envelope is missing artifactType');
    }
    if (envelope.artifactType !== options.artifactType) {
      throw new CreationStorageError(
        'INTEGRITY',
        `ARTIFACT_TYPE_MISMATCH: Expected ${options.artifactType} but found ${envelope.artifactType}`
      );
    }

    if (typeof envelope.schemaVersion !== 'number' || !Number.isInteger(envelope.schemaVersion)) {
      throw new CreationStorageError('INTEGRITY', 'ARTIFACT_MISSING_SCHEMA_VERSION: Stored envelope is missing schemaVersion');
    }
    if (envelope.schemaVersion !== options.schemaVersion) {
      throw new CreationStorageError(
        'INTEGRITY',
        `ARTIFACT_SCHEMA_VERSION_MISMATCH: Expected ${options.schemaVersion} but found ${envelope.schemaVersion}`
      );
    }

    if (typeof envelope.inputFingerprint !== 'string' || !envelope.inputFingerprint) {
      throw new CreationStorageError('INTEGRITY', 'ARTIFACT_MISSING_FINGERPRINT: Stored envelope is missing inputFingerprint');
    }
    if (envelope.inputFingerprint !== options.inputFingerprint) {
      throw new CreationStorageError(
        'INTEGRITY',
        `ARTIFACT_FINGERPRINT_MISMATCH: Envelope fingerprint ${envelope.inputFingerprint} !== expected ${options.inputFingerprint}`
      );
    }
    if (String(row.inputFingerprint) !== envelope.inputFingerprint) {
      throw new CreationStorageError(
        'INTEGRITY',
        `ARTIFACT_FINGERPRINT_MISMATCH: Row fingerprint ${String(row.inputFingerprint)} !== envelope ${envelope.inputFingerprint}`
      );
    }

    if (!('value' in envelope)) {
      throw new CreationStorageError('INTEGRITY', 'ARTIFACT_INVALID_ENVELOPE: Stored envelope is missing value property');
    }

    try {
      return options.schema.parse(envelope.value);
    } catch (err) {
      throw new CreationStorageError(
        'INTEGRITY',
        `ARTIFACT_SCHEMA_INVALID: ${(err as Error).message || String(err)}`
      );
    }
  }
}

function createInMemoryArtifactStore(
  workspaceId: string
): Pick<CreationArtifactRepository, 'putJSON' | 'getJSON' | 'ref'> {
  const artifacts = new Map<string, { checksum: string; byteLength: number; body: Buffer; kind: string; inputFingerprint: string }>();
  function validateScope(scope: StorageScope): void {
    const expectedOwnerId = `workspace:${workspaceId}`;
    if (!scope || typeof scope.ownerId !== 'string' || scope.ownerId !== expectedOwnerId) {
      throw new CreationStorageError('NOT_FOUND', 'Stored content was not found for workspace.');
    }
  }
  return {
    async putJSON(scope, value, options) {
      options.signal?.throwIfAborted();
      validateScope(scope);
      const validated = options.schema.parse(value);
      const envelope = {
        artifactType: options.artifactType,
        schemaVersion: options.schemaVersion,
        inputFingerprint: options.inputFingerprint,
        value: validated,
      };
      const serialized = JSON.stringify(envelope);
      const bytes = Buffer.from(serialized, 'utf8');
      const id = randomUUID();
      const checksum = createHash('sha256').update(bytes).digest('hex');
      artifacts.set(id, {
        checksum,
        byteLength: bytes.length,
        body: bytes,
        kind: 'discovery',
        inputFingerprint: options.inputFingerprint,
      });
      return { id, kind: 'artifact' as const, byteLength: bytes.length, checksum };
    },
    async ref(scope, id) {
      validateScope(scope);
      const found = artifacts.get(id);
      if (!found) {
        throw new CreationStorageError('NOT_FOUND', 'Stored content was not found.');
      }
      return { id, kind: 'artifact' as const, byteLength: found.byteLength, checksum: found.checksum };
    },
    async getJSON(scope, id, options) {
      options.signal?.throwIfAborted();
      validateScope(scope);
      const found = artifacts.get(id);
      if (!found) {
        throw new CreationStorageError('NOT_FOUND', 'Stored content was not found.');
      }
      if (found.kind !== 'discovery') {
        throw new CreationStorageError('INTEGRITY', `ARTIFACT_KIND_MISMATCH: Expected discovery, found ${found.kind}`);
      }
      if (found.inputFingerprint !== options.inputFingerprint) {
        throw new CreationStorageError(
          'INTEGRITY',
          `ARTIFACT_FINGERPRINT_MISMATCH: Expected ${options.inputFingerprint}, found ${found.inputFingerprint}`
        );
      }
      if (found.body.byteLength !== found.byteLength) {
        throw new CreationStorageError(
          'INTEGRITY',
          `ARTIFACT_LENGTH_MISMATCH: Expected ${found.byteLength} !== actual ${found.body.byteLength}`
        );
      }
      const actualChecksum = createHash('sha256').update(found.body).digest('hex');
      if (actualChecksum !== found.checksum) {
        throw new CreationStorageError(
          'INTEGRITY',
          `ARTIFACT_CHECKSUM_MISMATCH: Stored ${found.checksum} !== computed ${actualChecksum}`
        );
      }
      let envelope: any;
      try {
        envelope = JSON.parse(found.body.toString('utf8'));
      } catch {
        throw new CreationStorageError('INTEGRITY', 'ARTIFACT_CORRUPT_JSON: Failed to parse stored artifact JSON');
      }
      if (!envelope || typeof envelope !== 'object' || Array.isArray(envelope)) {
        throw new CreationStorageError('INTEGRITY', 'ARTIFACT_INVALID_ENVELOPE: Stored artifact is not an object');
      }
      if (envelope.artifactType !== options.artifactType) {
        throw new CreationStorageError('INTEGRITY', `ARTIFACT_TYPE_MISMATCH: Expected ${options.artifactType} !== ${envelope.artifactType}`);
      }
      if (envelope.schemaVersion !== options.schemaVersion) {
        throw new CreationStorageError('INTEGRITY', `ARTIFACT_SCHEMA_VERSION_MISMATCH: Expected ${options.schemaVersion} !== ${envelope.schemaVersion}`);
      }
      if (envelope.inputFingerprint !== options.inputFingerprint) {
        throw new CreationStorageError('INTEGRITY', `ARTIFACT_FINGERPRINT_MISMATCH: Expected ${options.inputFingerprint} !== ${envelope.inputFingerprint}`);
      }
      if (!('value' in envelope)) {
        throw new CreationStorageError('INTEGRITY', 'ARTIFACT_INVALID_ENVELOPE: Missing value in envelope');
      }
      try {
        return options.schema.parse(envelope.value);
      } catch (err) {
        throw new CreationStorageError('INTEGRITY', `ARTIFACT_SCHEMA_INVALID: ${(err as Error).message}`);
      }
    },
  };
}

async function loadDefaultAi(
  model?: LanguageModel,
  beforeCall?: () => Promise<void | ((settlement?: {
    actualUsage?: { promptTokens?: number; completionTokens?: number; totalTokens?: number; stepsCount?: number };
    error?: unknown;
  }) => Promise<void>)>
): Promise<ResourceDiscovery> {
  if (!model && process.env.INTERACTION_LOCAL_MODEL_FIXTURE === '1') {
    const { localDiscoveryAiFixture } = await import('@/src/server/infrastructure/ai/localSourceFixture');
    const fixture = localDiscoveryAiFixture({ beforeCall });
    if (fixture) return fixture;
  }
  const [{ createCohortModel }, { VercelResourceDiscovery }] = await Promise.all([
    import('@/src/server/infrastructure/ai/modelRegistry'),
    import('@/src/server/infrastructure/ai/vercelResourceDiscovery'),
  ]);
  const resolvedModel = model ?? createCohortModel();
  return new VercelResourceDiscovery(resolvedModel, {
    beforeCall: beforeCall ?? (async () => {}),
  });
}

async function loadDefaultObserver(): Promise<DiscoverySourceObserver> {
  const [
    { DiscoverySourceObserver },
    { YoutubeMetadataReader },
    { GithubPublicApi },
  ] = await Promise.all([
    import('../cohort-creation/discovery-observer'),
    import('../cohort-creation/materials/youtube-metadata'),
    import('../cohort-creation/materials/github-public-api'),
  ]);
  return new DiscoverySourceObserver(new YoutubeMetadataReader(), new GithubPublicApi());
}

function deterministicUuid(seed: string): string {
  const hash = createHash('sha256').update(seed).digest('hex');
  return `${hash.slice(0, 8)}-${hash.slice(8, 12)}-4${hash.slice(13, 16)}-a${hash.slice(17, 20)}-${hash.slice(20, 32)}`;
}

async function loadDiscoveryService(): Promise<{
  DiscoveryService: typeof DiscoveryServiceType;
  discoveryRequestSchema: typeof import('../cohort-creation/discovery.service').discoveryRequestSchema;
  discoveryFingerprint: typeof import('../cohort-creation/discovery.service').discoveryFingerprint;
}> {
  const { DiscoveryService, discoveryRequestSchema, discoveryFingerprint } = await import(
    '../cohort-creation/discovery.service'
  );
  return { DiscoveryService, discoveryRequestSchema, discoveryFingerprint };
}

export class DiscoveryAdapter {
  constructor(private readonly deps?: DiscoveryAdapterDeps) {}

  async executeCohortDiscovery(
    workspace: CohortWorkspace,
    depsOrSignal?: DiscoveryAdapterDeps | AbortSignal,
    maybeSignal?: AbortSignal
  ): Promise<{ items: CohortDiscoveryItem[]; rawResult?: unknown }> {
    let effectiveDeps = this.deps;
    let signal: AbortSignal | undefined;

    if (
      depsOrSignal instanceof AbortSignal ||
      (depsOrSignal && typeof (depsOrSignal as AbortSignal).aborted === 'boolean')
    ) {
      signal = depsOrSignal as AbortSignal;
    } else {
      effectiveDeps = { ...this.deps, ...depsOrSignal };
      signal = maybeSignal;
    }

    return executeCohortDiscovery(workspace, effectiveDeps, signal);
  }
}

export const JourneyDiscoveryAdapter = DiscoveryAdapter;
export type JourneyDiscoveryAdapter = DiscoveryAdapter;

export function createJourneyDiscoveryAdapter(
  deps?: DiscoveryAdapterDeps
): DiscoveryAdapter {
  return new DiscoveryAdapter(deps);
}

export async function executeCohortDiscovery(
  workspace: CohortWorkspace,
  deps?: DiscoveryAdapterDeps,
  signal?: AbortSignal
): Promise<{ items: CohortDiscoveryItem[]; rawResult?: unknown }> {
  signal?.throwIfAborted();

  const workspaceId = deps?.workspaceId ?? 'workspace-discovery';

  let storage = deps?.storage;
  if (!storage) {
    if (deps?.sql) {
      storage = new WorkspaceArtifactStoreAdapter(deps.sql, workspaceId);
    } else if (deps?.__allowInMemoryStorage || process.env.NODE_ENV === 'test') {
      storage = createInMemoryArtifactStore(workspaceId);
    } else {
      throw creationFailure(
        'DATA_UNAVAILABLE',
        'Durable SQL storage required for discovery artifacts; in-memory store prohibited in production',
        false
      );
    }
  }

  const inputRevision = workspace.journey?.intentVersion ?? 0;
  const generation = workspace.discovery?.generation ?? 0;

  let ai = deps?.ai;
  if (!ai) {
    let beforeCall: (() => Promise<void | ((settlement?: {
      actualUsage?: { promptTokens?: number; completionTokens?: number; totalTokens?: number; stepsCount?: number };
      error?: unknown;
    }) => Promise<void>)>) | undefined;
    if (deps?.sql) {
      const targetWorkspaceId = deps.workspaceId ?? (workspace as any).workspaceId ?? workspaceId;
      if (!targetWorkspaceId) {
        throw new Error('WORKSPACE_REQUIRED: Workspace ID is required for discovery accounting');
      }
      const { createDurableProviderCallHook } = await import('./budget-policy');
      beforeCall = createDurableProviderCallHook({
        sql: deps.sql,
        workspaceId: targetWorkspaceId,
        jobKey: deps.jobKey ?? `journey:discovery:${inputRevision}:${generation}`,
        dependencyFingerprint: deps.dependencyFingerprint,
        operation: 'discovery_ai',
        generation,
        attempt: deps.attempt ?? 0,
        skipPauseCheck: deps.skipPauseCheck,
      });
    } else {
      throw new Error('ACCOUNTING_STORAGE_UNAVAILABLE: Durable SQL connection required for discovery provider accounting');
    }

    try {
      ai = await loadDefaultAi(deps?.model, beforeCall);
    } catch (error) {
      if (isAccountingError(error)) throw error;
      ai = {
        search: async () => {
          throw (error instanceof CreationFailure ? error : creationFailure('AI_UNAVAILABLE', 'Resource discovery AI unavailable'));
        },
        select: async () => {
          throw (error instanceof CreationFailure ? error : creationFailure('AI_UNAVAILABLE', 'Resource discovery AI selection unavailable'));
        },
      };
    }
  }

  let observer = deps?.observer;
  if (!observer) {
    try {
      observer = await loadDefaultObserver();
    } catch {
      observer = {
        observe: async () => {
          throw creationFailure('DATA_UNAVAILABLE', 'Discovery source observer unavailable');
        },
      };
    }
  }

  const { DiscoveryService, discoveryRequestSchema, discoveryFingerprint } = await loadDiscoveryService();
  const service = new DiscoveryService(ai, observer, storage);
  const rawIntent = workspace.intent.trim() || 'General Learning';
  const topicValue = rawIntent.slice(0, 160);
  const rawQuery = rawIntent.length >= 3 ? rawIntent.slice(0, 2000) : `${rawIntent} Learning`;

  const isUuid =
    typeof workspace.discovery?.requestId === 'string' &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      workspace.discovery.requestId
    );
  const requestId = isUuid
    ? workspace.discovery!.requestId
    : deterministicUuid(`discovery:req:${workspaceId}:${inputRevision}:${generation}`);

  const intent = learningIntentSchema.parse({
    id: deterministicUuid(`discovery:intent:${workspaceId}:${inputRevision}:${generation}`),
    rawQuery,
    revision: inputRevision,
    topic: {
      value: topicValue,
      origin: 'user',
      acceptedRevision: inputRevision,
    },
    outcomes: {
      value: ['Grounded learning resources'],
      origin: 'user',
      acceptedRevision: inputRevision,
    },
    level: null,
    language: null,
    searchTerms: [],
    uncertainties: [],
  });

  const request: DiscoveryRequest = discoveryRequestSchema.parse({
    requestId,
    inputRevision,
    intent,
  });

  const scope: StorageScope = {
    ownerId: `workspace:${workspaceId}`,
    draftId: deterministicUuid(`discovery:scope:${workspaceId}:${inputRevision}:${generation}`),
  };

  const effectiveSignal = signal ?? new AbortController().signal;
  const inputFingerprint = discoveryFingerprint(request);
  const checkpointKey = `checkpoint:${inputFingerprint}`;
  let savedCheckpoint: DiscoveryCheckpoint | undefined;

  if (deps?.sql) {
    let checkpointRowId: string | undefined;
    try {
      const existing = await deps.sql.query(
        `SELECT "id" FROM "cohort_text_artifacts"
         WHERE "workspaceId" = $1 AND "kind" = 'discovery' AND "inputFingerprint" = $2
         ORDER BY "createdAt" DESC LIMIT 1`,
        [workspaceId, checkpointKey]
      );
      if (existing.rows.length > 0) {
        checkpointRowId = String(existing.rows[0].id);
      }
    } catch (err: unknown) {
      throw creationFailure(
        'DATA_UNAVAILABLE',
        `DISCOVERY_STORAGE_READ_FAILED: ${(err as Error).message || String(err)}`,
        true
      );
    }

    if (checkpointRowId) {
      try {
        const checkpointData = await storage.getJSON(scope, checkpointRowId, {
          artifactType: 'discovery-checkpoint',
          schemaVersion: 1,
          inputFingerprint: checkpointKey,
          schema: discoveryCheckpointSchema,
          signal: effectiveSignal,
        });
        if (checkpointData.inputFingerprint !== inputFingerprint) {
          throw new Error(
            `DISCOVERY_CHECKPOINT_CORRUPT: Checkpoint inputFingerprint mismatch (${checkpointData.inputFingerprint} !== ${inputFingerprint})`
          );
        }
        savedCheckpoint = checkpointData;
      } catch (err: unknown) {
        if (err instanceof Error && err.message.startsWith('DISCOVERY_CHECKPOINT_CORRUPT')) {
          throw err;
        }
        if (err instanceof CreationStorageError && err.code === 'INTEGRITY') {
          throw new Error(`DISCOVERY_CHECKPOINT_CORRUPT: ${err.message}`);
        }
        throw creationFailure(
          'DATA_UNAVAILABLE',
          `DISCOVERY_STORAGE_READ_FAILED: ${(err as Error).message || String(err)}`,
          true
        );
      }
    }
  }

  let result: DiscoveryResult;
  try {
    result = await service.run(
      scope,
      request,
      effectiveSignal,
      async (cp: DiscoveryCheckpoint) => {
        try {
          await storage.putJSON(scope, cp, {
            artifactType: 'discovery-checkpoint',
            schemaVersion: 1,
            inputFingerprint: checkpointKey,
            schema: discoveryCheckpointSchema,
            signal: effectiveSignal,
          });
        } catch (err: unknown) {
          effectiveSignal.throwIfAborted();
          throw new Error(`DISCOVERY_CHECKPOINT_WRITE_FAILED: ${(err as Error).message || String(err)}`);
        }
      },
      savedCheckpoint
    );
  } catch (error) {
    effectiveSignal.throwIfAborted();
    if (isAccountingError(error)) throw error;
    if (
      error instanceof Error &&
      (error.message.startsWith('DISCOVERY_CHECKPOINT_WRITE_FAILED') ||
       error.message.startsWith('DISCOVERY_CHECKPOINT_CORRUPT') ||
       error.message.startsWith('DISCOVERY_STORAGE_READ_FAILED'))
    ) {
      throw error;
    }
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw error;
    }
    if (error instanceof CreationFailure) {
      throw creationFailure(error.detail.code, error.detail.code, error.detail.retryable);
    }
    if (error instanceof CreationStorageError) {
      if (error.code === 'INTEGRITY') {
        throw creationFailure('DATA_UNAVAILABLE', error.message, false);
      }
      const mappedCode = error.code === 'INVALID_INPUT' ? 'INVALID_REQUEST' : 'DATA_UNAVAILABLE';
      throw creationFailure(mappedCode, error.code, false);
    }
    const message = error instanceof Error ? error.message : 'DISCOVERY_PROVIDER_FAILURE';
    const code = /^[A-Z_]+$/.test(message) ? (message as 'AI_UNAVAILABLE') : 'AI_UNAVAILABLE';
    throw creationFailure(code, message, true);
  }

  const items: CohortDiscoveryItem[] = [];
  for (const candidate of result.candidates) {
    if (candidate.kind !== 'web') {
      continue;
    }
    const candidateId = candidate.key
      ? String(candidate.key).slice(0, 200)
      : createHash('sha256').update(candidate.url).digest('hex').slice(0, 200);
    const candidateItem = {
      id: candidateId,
      label: String(candidate.title || 'Untitled Resource').trim().slice(0, 300),
      kind: 'web' as const,
      url: candidate.url,
    };
    const parsed = cohortDiscoveryItemSchema.safeParse(candidateItem);
    if (parsed.success) {
      items.push(parsed.data);
      if (items.length >= 20) break;
    }
  }

  const validatedItems = z.array(cohortDiscoveryItemSchema).max(20).parse(items);
  return { items: validatedItems, rawResult: result };
}
