import { z } from 'zod';
import { MATERIAL_LIMITS, retainedObjectRefSchema, materialManifestSchema } from './materials';
import { sourceLocationSchema, githubPathSchema, githubRepositoryScopeSchema } from './contracts';
export { githubPathSchema } from './contracts';

export const githubShaSchema = z.string().regex(/^[a-f0-9]{40}$/);
export const githubSelectionSchema = githubRepositoryScopeSchema.safeExtend({ url: z.url().max(2048) });
export type GithubSelection = z.infer<typeof githubSelectionSchema>;
export const githubSnapshotSchema = z.strictObject({ schemaVersion: z.literal(1), sourceUrl: z.url().max(2048),
  owner: z.string().min(1).max(100), repo: z.string().min(1).max(100), commit: githubShaSchema, tree: githubShaSchema,
  requestedPaths: z.array(githubPathSchema).min(1).max(100), fetchedAt: z.iso.datetime(), access: z.literal('public'),
  files: z.array(z.strictObject({ path: githubPathSchema, blobSha: githubShaSchema,
    byteLength: z.number().int().positive().max(MATERIAL_LIMITS.extractedTextBytes),
    text: z.string().min(1).max(MATERIAL_LIMITS.extractedTextBytes) })).min(1).max(100),
  skipped: z.array(z.strictObject({ path: githubPathSchema, reason: z.enum(['binary', 'symlink', 'submodule', 'empty']) })).max(2000),
  coverage: z.literal('selected_paths'),
}).superRefine((snapshot, ctx) => {
  const paths = [...snapshot.files, ...snapshot.skipped].map(file => file.path);
  if (new Set(paths).size !== paths.length || snapshot.files.reduce((sum, file) => sum + file.byteLength, 0) > MATERIAL_LIMITS.extractedTextBytes ||
    snapshot.files.some(file => new TextEncoder().encode(file.text).byteLength !== file.byteLength) ||
    paths.some(path => !snapshot.requestedPaths.some(root => path === root || path.startsWith(`${root}/`))) ||
    snapshot.sourceUrl !== `https://github.com/${snapshot.owner}/${snapshot.repo}`) ctx.addIssue({ code: 'custom', message: 'Invalid retained GitHub text or selection coverage' });
});
export type GithubSnapshot = z.infer<typeof githubSnapshotSchema>;

export const GITHUB_PARSER_VERSION = 'github-commit-text-lines-v1';
const checksum = z.string().regex(/^[a-f0-9]{64}$/);
const artifactRef = retainedObjectRefSchema.extend({ kind: z.literal('artifact') });
export const githubReceiptSchema = z.strictObject({ schemaVersion: z.literal(1), materialId: z.uuid(), inputRevision: z.number().int().nonnegative(),
  parserVersion: z.literal(GITHUB_PARSER_VERSION), selection: githubSelectionSchema, snapshot: githubSnapshotSchema })
  .superRefine((receipt, ctx) => {
    if (receipt.selection.url !== receipt.snapshot.sourceUrl || JSON.stringify(receipt.selection.paths) !== JSON.stringify(receipt.snapshot.requestedPaths) ||
      receipt.selection.ref && /^[a-f0-9]{40}$/.test(receipt.selection.ref) && receipt.selection.ref !== receipt.snapshot.commit) {
      ctx.addIssue({ code: 'custom', message: 'GitHub receipt does not match its selected source' });
    }
  });
// Job checkpoints contain only bounded metadata and private references, never repository text.
export const retainedGithubCheckpointSchema = z.strictObject({ phase: z.literal('retained_github'), materialId: z.uuid(),
  inputRevision: z.number().int().nonnegative(), selection: githubSelectionSchema, commit: githubShaSchema,
  files: z.array(z.strictObject({ path: githubPathSchema, blobSha: githubShaSchema,
    byteLength: z.number().int().positive().max(MATERIAL_LIMITS.extractedTextBytes) })).min(1).max(100),
  artifact: artifactRef, inputFingerprint: checksum }).superRefine((retained, ctx) => {
    if (new Set(retained.files.map(file => file.path)).size !== retained.files.length ||
      retained.files.reduce((sum, file) => sum + file.byteLength, 0) > MATERIAL_LIMITS.extractedTextBytes ||
      retained.files.some(file => !retained.selection.paths.some(path => file.path === path || file.path.startsWith(`${path}/`))) ||
      retained.selection.ref && /^[a-f0-9]{40}$/.test(retained.selection.ref) && retained.selection.ref !== retained.commit) {
      ctx.addIssue({ code: 'custom', message: 'Invalid GitHub checkpoint file scope' });
    }
  });
export type RetainedGithubCheckpoint = z.infer<typeof retainedGithubCheckpointSchema>;
export const githubExtractionArtifactSchema = z.strictObject({ schemaVersion: z.literal(1), materialId: z.uuid(), sourceArtifact: artifactRef,
  version: checksum, commit: githubShaSchema, contentOrigin: z.literal('external'),
  coverage: z.strictObject({ scope: z.literal('selected_paths'), completeSelectedText: z.literal(true), skipped: githubSnapshotSchema.shape.skipped }),
  files: z.array(z.strictObject({ unitId: checksum, path: githubPathSchema, blobSha: githubShaSchema,
    text: z.string().min(1).max(MATERIAL_LIMITS.extractedTextBytes), byteLength: z.number().int().positive().max(MATERIAL_LIMITS.extractedTextBytes),
    segments: z.array(z.strictObject({ id: checksum, text: z.string().min(1).max(4096), location: sourceLocationSchema })).min(1).max(20_000),
  })).min(1).max(100),
}).superRefine((artifact, ctx) => {
  const paths = new Set<string>(); const units = new Set<string>(); const segments = new Set<string>(); let size = 0;
  for (const file of artifact.files) {
    size += file.byteLength;
    if (paths.has(file.path) || units.has(file.unitId) || new TextEncoder().encode(file.text).byteLength !== file.byteLength ||
      file.segments.map(segment => segment.text).join('') !== file.text) { ctx.addIssue({ code: 'custom', message: 'Invalid GitHub file coverage' }); return; }
    paths.add(file.path); units.add(file.unitId); let line = 1;
    for (const segment of file.segments) {
      const anchor = segment.location.anchor; const endLine = line + (segment.text.slice(0, -1).match(/\n/g)?.length ?? 0);
      if (segments.has(segment.id) || segment.location.materialId !== artifact.materialId || segment.location.unitId !== file.unitId ||
        segment.location.segmentId !== segment.id || anchor.kind !== 'file' || anchor.commit !== artifact.commit || anchor.path !== file.path ||
        anchor.startLine !== line || anchor.endLine !== endLine) { ctx.addIssue({ code: 'custom', message: 'Invalid GitHub line provenance' }); return; }
      segments.add(segment.id); line += segment.text.match(/\n/g)?.length ?? 0;
    }
  }
  if (size > MATERIAL_LIMITS.extractedTextBytes || segments.size > 20_000 || artifact.coverage.skipped.some(file => paths.has(file.path))) {
    ctx.addIssue({ code: 'custom', message: 'Invalid GitHub extraction scope' });
  }
});
export type GithubExtractionArtifact = z.infer<typeof githubExtractionArtifactSchema>;
export const githubMaterialManifestSchema = materialManifestSchema.safeExtend({ github: retainedGithubCheckpointSchema })
  .superRefine((manifest, ctx) => {
    const retained = manifest.github;
    if (manifest.source.kind !== 'github' || manifest.source.input.kind !== 'url' || manifest.source.input.url !== retained.selection.url ||
      manifest.source.id !== retained.materialId || manifest.inputRevision !== retained.inputRevision ||
      manifest.retainedSource.id !== retained.artifact.id || manifest.retainedSource.checksum !== retained.artifact.checksum ||
      manifest.retainedSource.byteLength !== retained.artifact.byteLength || manifest.retainedSource.kind !== 'artifact' ||
      manifest.source.selectedUnitIds.length !== retained.files.length || manifest.parserVersion !== GITHUB_PARSER_VERSION ||
      manifest.extraction.extractionKind !== 'text' || !manifest.extraction.complete || manifest.extraction.selectionScope !== 'selected_paths') {
      ctx.addIssue({ code: 'custom', message: 'Invalid GitHub material manifest provenance or scope' });
    }
  });
export type GithubMaterialManifest = z.infer<typeof githubMaterialManifestSchema>;
