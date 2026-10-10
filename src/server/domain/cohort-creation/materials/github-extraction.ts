import { createHash } from 'node:crypto';
import { githubExtractionArtifactSchema, githubReceiptSchema, GITHUB_PARSER_VERSION, type GithubExtractionArtifact } from '@/src/shared/cohort-creation/github';
import type { CreationObjectRef } from '@/src/server/infrastructure/storage/creation.contracts';
import { CreationStorageError } from '@/src/server/infrastructure/storage/creation.contracts';
import { segmentRetainedText } from './text';

const hash = (value: string) => createHash('sha256').update(value).digest('hex');
export const githubReceiptFingerprint = (materialId: string, inputRevision: number, selection: unknown) =>
  hash(JSON.stringify({ materialId, inputRevision, selection, parser: GITHUB_PARSER_VERSION }));
export const githubExtractionVersion = (sourceChecksum: string) => hash(`${GITHUB_PARSER_VERSION}:${sourceChecksum}`);
export const githubUnitId = (commit: string, path: string) => hash(JSON.stringify({ commit, path }));

/** Converts retained, verified bytes to exact text segments. Line ranges are inclusive and commit-bound. */
export function extractGithubReceipt(value: unknown, artifact: CreationObjectRef, signal?: AbortSignal): GithubExtractionArtifact {
  signal?.throwIfAborted(); const receipt = githubReceiptSchema.parse(value); const version = githubExtractionVersion(artifact.checksum);
  const files = receipt.snapshot.files.map(file => {
    signal?.throwIfAborted(); const bytes = Buffer.from(file.text, 'utf8');
    if (createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex') !== file.blobSha) {
      throw new CreationStorageError('INTEGRITY', 'Retained GitHub text does not match its source blob.');
    }
    const unitId = githubUnitId(receipt.snapshot.commit, file.path); let line = 1;
    const segments = segmentRetainedText(file.text, receipt.materialId, unitId, version, signal).map(segment => {
      const startLine = line; const endLine = line + (segment.text.slice(0, -1).match(/\n/g)?.length ?? 0);
      line += segment.text.match(/\n/g)?.length ?? 0;
      return { id: segment.id, text: segment.text, location: { ...segment.location,
        anchor: { kind: 'file' as const, commit: receipt.snapshot.commit, path: file.path, startLine, endLine } } };
    });
    return { ...file, unitId, segments };
  });
  return githubExtractionArtifactSchema.parse({ schemaVersion: 1, materialId: receipt.materialId, sourceArtifact: artifact, version,
    commit: receipt.snapshot.commit, contentOrigin: 'external', files,
    coverage: { scope: 'selected_paths', completeSelectedText: true, skipped: receipt.snapshot.skipped } });
}
