import 'server-only';
import { materialSourceSchema, learningIntentSchema, type LearningIntent, type MaterialSource } from '@/src/shared/cohort-creation/contracts';
import { materialManifestSchema } from '@/src/shared/cohort-creation/materials';
import { generatedGuideArtifactSchema, GENERATED_GUIDE_VERSION } from '@/src/shared/cohort-creation/generated-guide';
import { CreationStorageError, type StorageScope } from '@/src/server/infrastructure/storage/creation.contracts';
import type { CreationArtifactRepository } from '@/src/server/infrastructure/storage/creation.store';
import { generatedGuideFingerprint, retainGeneratedGuide, type CreationGuideAuthor } from '../generated-guide';

/** Explicitly requested authored material, never an automatic substitute for a failed source. */
export class GeneratedGuideService {
  constructor(private readonly author: CreationGuideAuthor, private readonly artifacts: Pick<CreationArtifactRepository, 'putJSON'>) {}
  async acquire(scope: StorageScope, input: MaterialSource, inputRevision: number, intentInput: LearningIntent, signal: AbortSignal) {
    signal.throwIfAborted(); const source = materialSourceSchema.parse(input); const intent = learningIntentSchema.parse(intentInput);
    if (source.kind !== 'generated_guide' || source.input.kind !== 'goal' || source.input.intentId !== intent.id ||
      !Number.isSafeInteger(inputRevision) || inputRevision < intent.revision || source.discoveredFrom ||
      source.selectedUnitIds.some(id => id !== source.id) || source.selectedUnitIds.length > 1) {
      throw new CreationStorageError('INVALID_INPUT', 'Guide generation requires the accepted learning intent and explicit goal source.');
    }
    const proposal = await this.author.author(intent, signal); signal.throwIfAborted();
    const body = retainGeneratedGuide(source.id, inputRevision, intent, this.author.identity, proposal, signal);
    const fingerprint = generatedGuideFingerprint(source.id, inputRevision, intent);
    const artifact = await this.artifacts.putJSON(scope, body, { artifactType: 'generated-guide', schemaVersion: 1,
      inputFingerprint: fingerprint, schema: generatedGuideArtifactSchema, signal });
    signal.throwIfAborted();
    return materialManifestSchema.parse({ schemaVersion: 1, inputRevision,
      source: { ...source, status: 'ready', selectedUnitIds: [source.id] }, retainedSource: artifact, extractionArtifact: artifact,
      extraction: { materialId: source.id, version: body.version, checksum: artifact.checksum, artifactRef: artifact.id,
        extractionKind: 'generated_guide', segmentCount: body.segments.length, complete: true },
      parserVersion: GENERATED_GUIDE_VERSION, inputFingerprint: fingerprint, acquiredAt: new Date().toISOString() });
  }
}
