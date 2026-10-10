import { z } from 'zod';
import { MATERIAL_LIMITS } from './materials';

export const githubShaSchema = z.string().regex(/^[a-f0-9]{40}$/);
export const githubPathSchema = z.string().min(1).max(1024).refine(path =>
  !/[\u0000-\u001f\u007f\\]/.test(path) && path.split('/').every(part => part && part !== '.' && part !== '..'), 'Select a repository-relative path');
export const githubSelectionSchema = z.strictObject({ url: z.url().max(2048), ref: z.string().min(1).max(255).nullable().default(null),
  paths: z.array(githubPathSchema).min(1).max(100) }).superRefine((selection, ctx) => {
  if (selection.paths.some((path, index) => selection.paths.some((other, otherIndex) => otherIndex !== index &&
    (path === other || path.startsWith(`${other}/`))))) ctx.addIssue({ code: 'custom', message: 'Select distinct, non-overlapping paths' });
});
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
