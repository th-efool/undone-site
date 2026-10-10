import 'server-only';
import { createHash } from 'node:crypto';
import { z } from 'zod';
import { githubPathSchema, githubSelectionSchema, githubShaSchema, githubSnapshotSchema, type GithubSelection } from '@/src/shared/cohort-creation/github';
import { MATERIAL_LIMITS } from '@/src/shared/cohort-creation/materials';
import { CreationStorageError } from '@/src/server/infrastructure/storage/creation.contracts';

export type GithubRepository = { owner: string; repo: string };
/** Transport responses are untrusted until parsed below. Private providers need a separate owner-scoped capability. */
export interface PublicGithubProvider {
  getRepository(repository: GithubRepository, signal: AbortSignal): Promise<unknown>;
  getCommit(repository: GithubRepository, ref: string, signal: AbortSignal): Promise<unknown>;
  getTree(repository: GithubRepository, tree: string, signal: AbortSignal): Promise<unknown>;
  getContent(repository: GithubRepository, path: string, commit: string, signal: AbortSignal): Promise<unknown>;
}
const repositorySchema = z.object({ name: z.string(), owner: z.object({ login: z.string() }), private: z.boolean(), default_branch: z.string().min(1).max(255) });
const commitSchema = z.object({ sha: githubShaSchema, commit: z.object({ tree: z.object({ sha: githubShaSchema }) }) });
const treeSchema = z.object({ sha: githubShaSchema, truncated: z.boolean(), tree: z.array(z.object({ path: githubPathSchema,
  mode: z.enum(['100644', '100755', '040000', '120000', '160000']), type: z.enum(['blob', 'tree', 'commit']),
  sha: githubShaSchema, size: z.number().int().nonnegative().optional() })).max(10_000) });
const contentSchema = z.object({ type: z.literal('file'), path: githubPathSchema, sha: githubShaSchema,
  encoding: z.literal('base64'), size: z.number().int().nonnegative().max(MATERIAL_LIMITS.extractedTextBytes), content: z.string().max(2 * MATERIAL_LIMITS.extractedTextBytes) });
const fail = (message: string): never => { throw new CreationStorageError('INVALID_INPUT', message); };
const limit = (message: string): never => { throw new CreationStorageError('LIMIT_EXCEEDED', `${message}; nothing was truncated.`); };
export function githubRepositoryUrl(input: string) {
  if (/[\u0000-\u0020\u007f\\%]/.test(input) || input.length > 2048) return fail('Provide a GitHub repository root URL.');
  let url: URL; try { url = new URL(input); } catch { return fail('Provide a GitHub repository root URL.'); }
  // Validate the original spelling before URL can normalize dot segments or empty ports.
  const match = /^https:\/\/github\.com\/([A-Za-z0-9](?:[A-Za-z0-9-]{0,38}))\/([A-Za-z0-9_.-]{1,100})\/?$/i.exec(input);
  if (url.protocol !== 'https:' || url.hostname !== 'github.com' || url.port || url.username || url.password || url.search || url.hash ||
    !match || ['.', '..'].includes(match[2])) return fail('Use https://github.com/owner/repository and select paths separately.');
  const owner = match[1]; const repo = match[2].replace(/\.git$/i, '');
  if (!repo || ['.', '..'].includes(repo)) return fail('Provide a GitHub repository name.');
  return { owner, repo, url: `https://github.com/${owner}/${repo}` };
}

/** Reads selected paths at one immutable commit. No source URL, download URL or repository code is executed. */
export class GithubMaterialReader {
  constructor(private readonly provider: PublicGithubProvider, private readonly access: 'public' | 'connected' = 'public') {}
  async read(request: GithubSelection, callerSignal?: AbortSignal, maxFiles = 100) {
    if (!Number.isSafeInteger(maxFiles) || maxFiles < 1 || maxFiles > 100) return fail('GitHub requires remaining draft unit capacity.');
    const selection = githubSelectionSchema.parse(request); const repository = githubRepositoryUrl(selection.url);
    if (this.access !== (selection.connection ? 'connected' : 'public')) return fail('The selected GitHub connection does not match this acquisition.');
    const signal = AbortSignal.any([...(callerSignal ? [callerSignal] : []), AbortSignal.timeout(60_000)]);
    signal.throwIfAborted(); let calls = 0;
    const call = async <T extends z.ZodType>(schema: T, operation: () => Promise<unknown>): Promise<z.output<T>> => {
      signal.throwIfAborted(); if (++calls > 250) return limit('GitHub traversal exceeds 250 requests. Select fewer paths');
      const value = await operation(); signal.throwIfAborted(); const parsed = schema.safeParse(value);
      if (!parsed.success) return fail('GitHub returned incomplete or unsupported content. Select a smaller text scope.');
      return parsed.data;
    };
    const info = await call(repositorySchema, () => this.provider.getRepository(repository, signal));
    if (info.private && this.access === 'public' || info.owner.login.toLowerCase() !== repository.owner.toLowerCase() || info.name.toLowerCase() !== repository.repo.toLowerCase()) {
      return fail('Select a public repository. Private repositories require your own connected account.');
    }
    const commit = await call(commitSchema, () => this.provider.getCommit(repository, selection.ref ?? info.default_branch, signal));
    if (selection.ref && /^[a-f0-9]{40}$/.test(selection.ref) && selection.ref !== commit.sha) return fail('GitHub returned a different commit.');
    const files: z.infer<typeof githubSnapshotSchema>['files'] = []; const skipped: z.infer<typeof githubSnapshotSchema>['skipped'] = [];
    const found = new Set<string>(); let totalBytes = 0; let visited = 0;
    const walk = async (treeSha: string, prefix: string, depth: number): Promise<void> => {
      signal.throwIfAborted(); if (depth > 20) return limit('GitHub path nesting exceeds 20 levels. Select a shallower path');
      const tree = await call(treeSchema, () => this.provider.getTree(repository, treeSha, signal));
      if (tree.sha !== treeSha || tree.truncated || new Set(tree.tree.map(entry => entry.path)).size !== tree.tree.length || tree.tree.some(entry => entry.path.includes('/'))) {
        return fail('GitHub returned a truncated or inconsistent directory. Select a smaller repository.');
      }
      for (const entry of tree.tree.sort((left, right) => left.path < right.path ? -1 : left.path > right.path ? 1 : 0)) {
        signal.throwIfAborted(); if (++visited > 10_000) return limit('GitHub traversal exceeds 10,000 entries. Select fewer paths');
        const path = prefix ? `${prefix}/${entry.path}` : entry.path;
        githubPathSchema.parse(path);
        const selected = selection.paths.some(root => path === root || path.startsWith(`${root}/`));
        const ancestor = selection.paths.some(root => root.startsWith(`${path}/`));
        if (!selected && !ancestor) continue;
        if (selection.paths.includes(path)) found.add(path);
        if (entry.mode === '120000' || entry.mode === '160000') {
          if (skipped.length >= 2000) return limit('GitHub skipped-entry manifest exceeds 2,000 entries');
          skipped.push({ path, reason: entry.mode === '120000' ? 'symlink' : 'submodule' }); continue;
        }
        if (entry.type === 'tree' && entry.mode === '040000') { await walk(entry.sha, path, depth + 1); continue; }
        if (ancestor || entry.type !== 'blob' || !['100644', '100755'].includes(entry.mode)) return fail('Selected path is not a regular repository file or directory.');
        if ((entry.size ?? 0) > MATERIAL_LIMITS.extractedTextBytes) return limit('GitHub file exceeds 1 MiB. Select a smaller file');
        const content = await call(contentSchema, () => this.provider.getContent(repository, path, commit.sha, signal));
        const encoded = content.content.replace(/[\r\n]/g, '');
        const bytes = Buffer.from(encoded, 'base64');
        if (bytes.toString('base64') !== encoded) return fail('GitHub returned invalid base64 file content.');
        const blobSha = createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex');
        if (content.path !== path || content.sha !== entry.sha || blobSha !== entry.sha || bytes.length !== content.size ||
          (entry.size !== undefined && entry.size !== content.size)) return fail('GitHub file does not match its pinned tree entry.');
        let text: string | undefined;
        try { text = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(bytes); } catch { /* Retain an explicit binary omission. */ }
        if (!text?.trim() || /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(text)) {
          if (skipped.length >= 2000) return limit('GitHub skipped-entry manifest exceeds 2,000 entries');
          skipped.push({ path, reason: text?.trim() ? 'binary' : text === undefined ? 'binary' : 'empty' }); continue;
        }
        if (files.length >= maxFiles) return limit(`GitHub scope exceeds the remaining ${maxFiles} draft units. Select fewer paths`);
        totalBytes += bytes.length; if (totalBytes > MATERIAL_LIMITS.extractedTextBytes) return limit('Selected GitHub text exceeds 1 MiB. Select fewer files');
        files.push({ path, blobSha, byteLength: bytes.length, text });
      }
    };
    await walk(commit.commit.tree.sha, '', 0); signal.throwIfAborted();
    if (selection.paths.some(path => !found.has(path))) return fail('A selected GitHub path is missing or inaccessible.');
    if (!files.length) return fail('Selected paths contain no readable UTF-8 text. Choose README/docs text or upload material.');
    return githubSnapshotSchema.parse({ schemaVersion: 1, sourceUrl: repository.url, owner: repository.owner, repo: repository.repo,
      commit: commit.sha, tree: commit.commit.tree.sha, requestedPaths: selection.paths, fetchedAt: new Date().toISOString(),
      access: this.access, repositoryPrivate: info.private, files, skipped, coverage: 'selected_paths' });
  }
}
