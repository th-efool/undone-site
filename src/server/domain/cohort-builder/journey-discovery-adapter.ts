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
  model?: LanguageModel;
  __allowInMemoryStorage?: boolean;
}

export class WorkspaceArtifactStoreAdapter
  implements Pick<CreationArtifactRepository, 'putJSON' | 'getJSON' | 'ref'>
{
  constructor(
    private readonly sql: TextArtifactSql,
    private readonly workspaceId: string
  ) {}

  async putJSON<T extends z.ZodType>(
    scope: StorageScope,
    value: z.input<T>,
    options: ArtifactOptions<T>
  ): Promise<CreationObjectRef> {
    options.signal?.throwIfAborted();
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
    const result = await this.sql.query(
      `SELECT "id", "checksum", "byteLength", "body"
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

    const envelope = JSON.parse(bytes.toString('utf8'));
    const valueToValidate =
      envelope && typeof envelope === 'object' && 'value' in envelope
        ? envelope.value
        : envelope;
    return options.schema.parse(valueToValidate);
  }
}

function createInMemoryArtifactStore(
  workspaceId: string
): Pick<CreationArtifactRepository, 'putJSON' | 'getJSON' | 'ref'> {
  const artifacts = new Map<string, { checksum: string; byteLength: number; body: Buffer }>();
  return {
    async putJSON(scope, value, options) {
      options.signal?.throwIfAborted();
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
      const found = artifacts.get(id);
      if (!found) {
        throw new CreationStorageError('NOT_FOUND', 'Stored content was not found.');
      }
      return { id, kind: 'artifact' as const, byteLength: found.byteLength, checksum: found.checksum };
    },
    async getJSON(scope, id, options) {
      options.signal?.throwIfAborted();
      const found = artifacts.get(id);
      if (!found) {
        throw new CreationStorageError('NOT_FOUND', 'Stored content was not found.');
      }
      const parsed = JSON.parse(found.body.toString('utf8'));
      const val = parsed && typeof parsed === 'object' && 'value' in parsed ? parsed.value : parsed;
      return options.schema.parse(val);
    },
  };
}

async function loadDefaultAi(model?: LanguageModel): Promise<ResourceDiscovery> {
  const [{ createCohortModel }, { VercelResourceDiscovery }] = await Promise.all([
    import('@/src/server/infrastructure/ai/modelRegistry'),
    import('@/src/server/infrastructure/ai/vercelResourceDiscovery'),
  ]);
  const resolvedModel = model ?? createCohortModel();
  return new VercelResourceDiscovery(resolvedModel, {
    beforeCall: async () => {},
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

  let ai = deps?.ai;
  if (!ai) {
    try {
      ai = await loadDefaultAi(deps?.model);
    } catch (error) {
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

  const inputRevision = workspace.journey?.intentVersion ?? 0;
  const generation = workspace.discovery?.generation ?? 0;
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
        `SELECT "body" FROM "cohort_text_artifacts"
         WHERE "workspaceId" = $1 AND "kind" = 'discovery' AND "inputFingerprint" = $2
         ORDER BY "createdAt" DESC LIMIT 1`,
        [workspaceId, checkpointKey]
      );
      if (existing.rows.length > 0) {
        const raw = existing.rows[0].body;
        const json = Buffer.isBuffer(raw)
          ? raw.toString('utf8')
          : typeof raw === 'string'
          ? raw
          : raw instanceof Uint8Array
          ? Buffer.from(raw).toString('utf8')
          : JSON.stringify(raw);
        const parsed = JSON.parse(json);
        const value = parsed?.value ?? parsed;
        const valid = discoveryCheckpointSchema.safeParse(value);
        if (valid.success && valid.data.inputFingerprint === inputFingerprint) {
          savedCheckpoint = valid.data;
        }
      }
    } catch {
      // resume not available, start fresh
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
        } catch {
          // checkpoint failure should not block discovery progress
        }
      },
      savedCheckpoint
    );
  } catch (error) {
    effectiveSignal.throwIfAborted();
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw error;
    }
    if (error instanceof CreationFailure) {
      throw creationFailure(error.detail.code, error.detail.code, error.detail.retryable);
    }
    if (error instanceof CreationStorageError) {
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
