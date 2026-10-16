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
    if (scope.ownerId && scope.ownerId.startsWith('workspace:')) {
      const scopeWorkspaceId = scope.ownerId.slice('workspace:'.length);
      if (scopeWorkspaceId !== this.workspaceId) {
        throw new CreationStorageError('NOT_FOUND', 'Stored content was not found for workspace.');
      }
    }
  }

  async putJSON<T extends z.ZodType>(
    scope: StorageScope,
    value: z.input<T>,
    options: ArtifactOptions<T>
  ): Promise<CreationObjectRef> {
    options.signal?.throwIfAborted();
    this.validateScopeTenant(scope);
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
      `SELECT "id", "checksum", "byteLength"
       FROM "cohort_text_artifacts"
       WHERE "workspaceId" = $1 AND "id" = $2`,
      [this.workspaceId, id]
    );
    const row = result.rows[0];
    if (!row) {
      throw new CreationStorageError('NOT_FOUND', 'Stored content was not found.');
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
    const rawBody = row.body;
    const bytes = Buffer.isBuffer(rawBody)
      ? rawBody
      : rawBody instanceof Uint8Array
      ? Buffer.from(rawBody)
      : typeof rawBody === 'string'
      ? Buffer.from(rawBody, 'utf8')
      : Buffer.from(rawBody as ArrayBuffer);

    // Verify byteLength
    if (row.byteLength !== undefined && row.byteLength !== null) {
      if (bytes.byteLength !== Number(row.byteLength)) {
        throw new CreationStorageError(
          'INTEGRITY',
          `ARTIFACT_LENGTH_MISMATCH: Stored length ${row.byteLength} !== actual length ${bytes.byteLength}`
        );
      }
    }

    // Verify checksum
    if (row.checksum) {
      const computedChecksum = createHash('sha256').update(bytes).digest('hex');
      if (computedChecksum !== String(row.checksum)) {
        throw new CreationStorageError(
          'INTEGRITY',
          `ARTIFACT_CHECKSUM_MISMATCH: Stored checksum ${row.checksum} !== computed checksum ${computedChecksum}`
        );
      }
    }

    let envelope: any;
    try {
      envelope = JSON.parse(bytes.toString('utf8'));
    } catch {
      throw new CreationStorageError('INTEGRITY', 'ARTIFACT_CORRUPT_JSON: Failed to parse stored artifact JSON');
    }

    if (!envelope || typeof envelope !== 'object') {
      throw new CreationStorageError('INTEGRITY', 'ARTIFACT_INVALID_ENVELOPE: Stored artifact is not an object');
    }

    if (options.artifactType && envelope.artifactType && envelope.artifactType !== options.artifactType) {
      throw new CreationStorageError(
        'INTEGRITY',
        `ARTIFACT_TYPE_MISMATCH: Expected ${options.artifactType} but found ${envelope.artifactType}`
      );
    }

    const valueToValidate = 'value' in envelope ? envelope.value : envelope;
    return options.schema.parse(valueToValidate);
  }
}

function createInMemoryArtifactStore(
  workspaceId: string
): Pick<CreationArtifactRepository, 'putJSON' | 'getJSON' | 'ref'> {
  const artifacts = new Map<string, { checksum: string; byteLength: number; body: Buffer }>();
  function validateScope(scope: StorageScope): void {
    if (scope.ownerId && scope.ownerId.startsWith('workspace:')) {
      const scopeWorkspaceId = scope.ownerId.slice('workspace:'.length);
      if (scopeWorkspaceId !== workspaceId) {
        throw new CreationStorageError('NOT_FOUND', 'Stored content was not found for workspace.');
      }
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
      artifacts.set(id, { checksum, byteLength: bytes.length, body: bytes });
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
      const parsed = JSON.parse(found.body.toString('utf8'));
      const val = parsed && typeof parsed === 'object' && 'value' in parsed ? parsed.value : parsed;
      return options.schema.parse(val);
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

  const inputFingerprint = discoveryFingerprint(request);
  const checkpointKey = `checkpoint:${inputFingerprint}`;
  let savedCheckpoint: DiscoveryCheckpoint | undefined;

  if (deps?.sql) {
    try {
      const existing = await deps.sql.query(
        `SELECT "body", "checksum", "byteLength" FROM "cohort_text_artifacts"
         WHERE "workspaceId" = $1 AND "kind" = 'discovery' AND "inputFingerprint" = $2
         ORDER BY "createdAt" DESC LIMIT 1`,
        [workspaceId, checkpointKey]
      );
      if (existing.rows.length > 0) {
        const row = existing.rows[0];
        const raw = row.body;
        const bytes = Buffer.isBuffer(raw)
          ? raw
          : raw instanceof Uint8Array
          ? Buffer.from(raw)
          : typeof raw === 'string'
          ? Buffer.from(raw, 'utf8')
          : Buffer.from(raw as ArrayBuffer);

        if (row.byteLength !== undefined && row.byteLength !== null && bytes.byteLength !== Number(row.byteLength)) {
          throw new Error(`DISCOVERY_CHECKPOINT_CORRUPT: Byte length mismatch (${bytes.byteLength} vs ${row.byteLength})`);
        }

        if (row.checksum) {
          const actualChecksum = createHash('sha256').update(bytes).digest('hex');
          if (actualChecksum !== String(row.checksum)) {
            throw new Error(`DISCOVERY_CHECKPOINT_CORRUPT: Checksum mismatch (${actualChecksum} vs ${row.checksum})`);
          }
        }

        let parsed: any;
        try {
          parsed = JSON.parse(bytes.toString('utf8'));
        } catch {
          throw new Error('DISCOVERY_CHECKPOINT_CORRUPT: Checkpoint body contains invalid JSON');
        }

        const value = parsed?.value ?? parsed;
        const valid = discoveryCheckpointSchema.safeParse(value);
        if (!valid.success) {
          throw new Error(`DISCOVERY_CHECKPOINT_CORRUPT: Checkpoint schema validation failed: ${valid.error.message}`);
        }
        if (valid.data.inputFingerprint === inputFingerprint) {
          savedCheckpoint = valid.data;
        }
      }
    } catch (err: unknown) {
      if (err instanceof Error && err.message.startsWith('DISCOVERY_CHECKPOINT_CORRUPT')) {
        throw err;
      }
      throw creationFailure(
        'DATA_UNAVAILABLE',
        `DISCOVERY_STORAGE_READ_FAILED: ${(err as Error).message || String(err)}`,
        true
      );
    }
  }

  const effectiveSignal = signal ?? new AbortController().signal;

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
