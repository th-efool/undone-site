import 'server-only';
import { materialSourceSchema, type MaterialSource } from '@/src/shared/cohort-creation/contracts';
import { githubSelectionSchema, githubReceiptSchema, retainedGithubCheckpointSchema, githubExtractionArtifactSchema,
  githubMaterialManifestSchema, GITHUB_PARSER_VERSION, type GithubSelection, type RetainedGithubCheckpoint } from '@/src/shared/cohort-creation/github';
import { CreationStorageError, type StorageScope } from '@/src/server/infrastructure/storage/creation.contracts';
import type { CreationArtifactRepository } from '@/src/server/infrastructure/storage/creation.store';
import type { GithubMaterialReader } from './github';
import { githubRepositoryUrl } from './github';
import { githubReceiptFingerprint, githubExtractionVersion, extractGithubReceipt } from './github-extraction';

export class GithubAcquisitionService {
  constructor(private readonly reader: Pick<GithubMaterialReader, 'read'>,
    private readonly artifacts: Pick<CreationArtifactRepository, 'putJSON' | 'getJSON' | 'ref'>) {}
  async acquire(scope: StorageScope, input: MaterialSource, inputRevision: number, requested: GithubSelection,
    signal?: AbortSignal, checkpoint?: (value: RetainedGithubCheckpoint) => Promise<void>, maxUnits = 100) {
    signal?.throwIfAborted(); const { source, selection } = this.input(input, inputRevision, requested);
    const snapshot = await this.reader.read(selection, signal, maxUnits);
    this.capacity(snapshot.files.length, maxUnits);
    const receipt = githubReceiptSchema.parse({ schemaVersion: 1, materialId: source.id, inputRevision, parserVersion: GITHUB_PARSER_VERSION, selection, snapshot });
    const inputFingerprint = githubReceiptFingerprint(source.id, inputRevision, selection);
    const artifact = await this.artifacts.putJSON(scope, receipt, { artifactType: 'github-source', schemaVersion: 1,
      inputFingerprint, schema: githubReceiptSchema, signal });
    signal?.throwIfAborted(); const retained = retainedGithubCheckpointSchema.parse({ phase: 'retained_github',
      materialId: source.id, inputRevision, selection, commit: snapshot.commit,
      files: snapshot.files.map(({ path, blobSha, byteLength }) => ({ path, blobSha, byteLength })), artifact, inputFingerprint });
    await checkpoint?.(retained);
    return this.extract(scope, source, inputRevision, selection, retained, signal, maxUnits);
  }
  async extract(scope: StorageScope, input: MaterialSource, inputRevision: number, requested: GithubSelection,
    checkpoint: RetainedGithubCheckpoint, signal?: AbortSignal, maxUnits = 100) {
    signal?.throwIfAborted(); const { source, selection } = this.input(input, inputRevision, requested);
    const retained = retainedGithubCheckpointSchema.parse(checkpoint); const ref = retained.artifact;
    this.capacity(retained.files.length, maxUnits);
    const fingerprint = githubReceiptFingerprint(source.id, inputRevision, selection);
    const owned = await this.artifacts.ref(scope, ref.id);
    if (owned.kind !== 'artifact' || owned.checksum !== ref.checksum || owned.byteLength !== ref.byteLength || retained.inputFingerprint !== fingerprint) {
      throw new CreationStorageError('INTEGRITY', 'Retained GitHub source reference does not match.');
    }
    const receipt = await this.artifacts.getJSON(scope, ref.id, { artifactType: 'github-source', schemaVersion: 1,
      inputFingerprint: fingerprint, schema: githubReceiptSchema, signal });
    if (receipt.materialId !== source.id || retained.materialId !== source.id || receipt.inputRevision !== inputRevision || retained.inputRevision !== inputRevision ||
      JSON.stringify(receipt.selection) !== JSON.stringify(selection) || JSON.stringify(retained.selection) !== JSON.stringify(selection) ||
      receipt.snapshot.commit !== retained.commit || JSON.stringify(receipt.snapshot.files.map(({ path, blobSha, byteLength }) => ({ path, blobSha, byteLength }))) !== JSON.stringify(retained.files)) {
      throw new CreationStorageError('INTEGRITY', 'Retained GitHub source does not match its revision and selected paths.');
    }
    const extraction = extractGithubReceipt(receipt, ref, signal);
    const version = githubExtractionVersion(ref.checksum);
    const artifact = await this.artifacts.putJSON(scope, extraction, { artifactType: 'github-extraction', schemaVersion: 1,
      inputFingerprint: version, schema: githubExtractionArtifactSchema, signal });
    signal?.throwIfAborted();
    return githubMaterialManifestSchema.parse({ schemaVersion: 1, inputRevision,
      source: { ...source, status: 'ready', selectedUnitIds: extraction.files.map(file => file.unitId) }, retainedSource: ref,
      extraction: { materialId: source.id, version, checksum: ref.checksum, artifactRef: artifact.id, extractionKind: 'text',
        complete: true, selectionScope: 'selected_paths', segmentCount: extraction.files.reduce((sum, file) => sum + file.segments.length, 0) },
      extractionArtifact: artifact, parserVersion: GITHUB_PARSER_VERSION, inputFingerprint: version, acquiredAt: new Date().toISOString(), github: retained });
  }
  private input(input: MaterialSource, inputRevision: number, requested: GithubSelection) {
    const source = materialSourceSchema.parse(input); const selection = githubSelectionSchema.parse(requested);
    if (source.kind !== 'github' || source.input.kind !== 'url' || !Number.isSafeInteger(inputRevision) || inputRevision < 0 ||
      source.input.url !== selection.url || githubRepositoryUrl(selection.url).url !== selection.url ||
      source.input.repositoryScope && JSON.stringify(source.input.repositoryScope) !== JSON.stringify({ ref: selection.ref, paths: selection.paths })) {
      throw new CreationStorageError('INVALID_INPUT', 'Select a canonical GitHub repository and explicit paths.');
    }
    return { source, selection };
  }
  private capacity(count: number, maximum: number) {
    if (!Number.isSafeInteger(maximum) || maximum < 1 || maximum > 100 || count > maximum) throw new CreationStorageError('LIMIT_EXCEEDED', 'GitHub scope exceeds remaining draft unit capacity. Select fewer paths; nothing was truncated.');
  }
}
