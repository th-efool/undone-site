import { createHash, randomUUID } from 'node:crypto';
import { vi } from 'vitest';
vi.mock('server-only', () => ({}));
import type { z } from 'zod';
import { creationSnapshotSchema } from '@/src/shared/cohort-creation/contracts';
import type { ChunkingCheckpoint } from '@/src/shared/cohort-creation/processing';
import { draftId, result } from '@/src/shared/cohort-creation/__tests__/fixtures';
import { applyCommand, applyEvent, initialSnapshot } from '@/src/shared/cohort-creation/flow';
import { CreationStorageError, type ArtifactOptions, type CreationObjectRef, type StorageScope } from '@/src/server/infrastructure/storage/creation.contracts';
import { extractRetainedText } from '../materials/text';
import { normalizeProcessingInput, partitionProcessingInput } from '../processing-input';
import { UnderstandingService } from '../understanding.service';
import { UnderstandingContentService } from '../understanding-content.service';
import type { CreationUnderstanding } from '../understanding';
import type { CreationChunking } from '../chunking';
import { ChunkingService } from '../chunking.service';

export async function chunkingFixture(text = 'a'.repeat(5000), partitionBytes = 4096) {
  const scope = { ownerId: 'owner', draftId }; const materialId = randomUUID(); const requestId = randomUUID();
  const bytes = Buffer.from(text);
  const upload = { id: randomUUID(), kind: 'upload' as const, checksum: createHash('sha256').update(bytes).digest('hex'), byteLength: bytes.length };
  const body = extractRetainedText(bytes, upload, materialId, materialId); const artifactRef = randomUUID();
  const before = creationSnapshotSchema.parse({ ...initialSnapshot(draftId), inputRevision: 2, revision: 5, query: result.intent.rawQuery,
    result, stage: 'starting_point', startingPoint: 'have_material', status: 'succeeded',
    materials: [{ id: materialId, kind: 'markdown', input: { kind: 'upload', assetId: upload.id }, selectedUnitIds: [materialId], status: 'ready' }],
    extractions: [{ materialId, version: body.version, checksum: upload.checksum, artifactRef, extractionKind: 'text', segmentCount: body.segments.length, complete: true }],
    materialRefs: [{ materialId, ids: [artifactRef] }] });
  const units = normalizeProcessingInput(before.materials[0], before.extractions[0], body); const partitions = partitionProcessingInput(units, partitionBytes);
  const load = vi.fn(async () => ({ units, partitions }));
  const rows = new Map<string, { scope: StorageScope; ref: CreationObjectRef; value: unknown; type: string; fingerprint: string }>();
  const owned = (owner: StorageScope, id: string) => { const row = rows.get(id);
    if (!row || row.scope.ownerId !== owner.ownerId || row.scope.draftId !== owner.draftId) throw new CreationStorageError('NOT_FOUND', 'Missing receipt'); return row; };
  const artifacts = {
    async putJSON<T extends z.ZodType>(owner: StorageScope, value: z.input<T>, options: ArtifactOptions<T>) {
      const parsed = options.schema.parse(value); const bytes = Buffer.from(JSON.stringify(parsed));
      const ref: CreationObjectRef = { id: randomUUID(), kind: 'artifact', checksum: createHash('sha256').update(bytes).digest('hex'), byteLength: bytes.length };
      rows.set(ref.id, { scope: owner, ref, value: parsed, type: options.artifactType, fingerprint: options.inputFingerprint }); return ref;
    },
    async getJSON<T extends z.ZodType>(owner: StorageScope, id: string, options: ArtifactOptions<T>): Promise<z.output<T>> {
      const row = owned(owner, id);
      if (row.type !== options.artifactType || row.fingerprint !== options.inputFingerprint) throw new CreationStorageError('INTEGRITY', 'Wrong receipt header');
      return options.schema.parse(row.value);
    },
    async ref(owner: StorageScope, id: string) { return owned(owner, id).ref; },
  };
  const oldAi: CreationUnderstanding = { identity: { provider: 'previous', modelId: 'previous', adapterVersion: 'previous' },
    understand: vi.fn(async (_intent, partition) => ({ summary: 'Retained section.',
      concepts: [{ label: 'Concept', summary: 'Explanation.', segmentIds: [partition.segments[0].id] }], limitations: [] })) };
  const checkpoint = await new UnderstandingService({ load }, oldAi, artifacts).run(scope, before, randomUUID(), new AbortController().signal, async () => {});
  const state = applyEvent(applyCommand(before, { type: 'understand_material', requestId: checkpoint.requestId }),
    { type: 'understanding_received', requestId: checkpoint.requestId, result: checkpoint });
  const content = new UnderstandingContentService({ load }, artifacts);
  const ai: CreationChunking = { identity: { provider: 'new', modelId: 'new', adapterVersion: 'new' },
    chunk: vi.fn(async (_intent, partition) => ({ chunks: [{ title: 'Source section', summary: 'Retained content.',
      startSegmentId: partition.segments[0].id, endSegmentId: partition.segments.at(-1)!.id, conceptIndices: [0] }] })) };
  const service = new ChunkingService(content, ai, artifacts);
  return { scope, state, requestId, checkpoint, partitions, load, rows, ai, content, service, artifacts,
    run: (saved?: ChunkingCheckpoint, save: (checkpoint: ChunkingCheckpoint) => Promise<void> = async () => {}) =>
      service.run(scope, state, requestId, new AbortController().signal, save, saved) };
}
