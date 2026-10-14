import { createHash } from 'node:crypto';
import {
  retainedGithubSourceSchema,
  singleGithubRepo,
  githubSourceInputSchema,
  GITHUB_SOURCE_LIMITS,
  GITHUB_SOURCE_VERSION,
  type GithubSourceInput,
  type RetainedGithubSource,
} from '@/src/shared/cohort-builder/github-source';
import { readTextArtifact, type TextArtifactSql } from './text-artifacts';

export interface GithubSourceProvider {
  id: string;
  version: string;
  billing: 'none' | 'paid';
  resolveRef(repo: { owner: string; repo: string }, ref: string, signal: AbortSignal): Promise<{ commitSha: string }>;
  fetchFiles(
    repo: { owner: string; repo: string },
    commitSha: string,
    paths: string[],
    signal: AbortSignal
  ): Promise<Array<{ path: string; content: Uint8Array }>>;
}

const hash = (value: Uint8Array | string) => createHash('sha256').update(value).digest('hex');

/** Pure, deterministic extraction. Evidence is retained file text with line provenance. */
export function extractGithubSource(bytes: Uint8Array, proposal: GithubSourceInput) {
  const input = githubSourceInputSchema.parse(proposal);
  if (!bytes.length || bytes.length > GITHUB_SOURCE_LIMITS.totalBytes) throw new Error('SOURCE_SIZE_LIMIT');

  let decoded: unknown;
  try {
    decoded = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
  } catch {
    throw new Error('SOURCE_MALFORMED');
  }

  const parsed = retainedGithubSourceSchema.safeParse(decoded);
  if (!parsed.success) throw new Error('SOURCE_MALFORMED');
  const retained: RetainedGithubSource = parsed.data;

  const normalized = singleGithubRepo(input.repoUrl);
  if (retained.repo.owner !== normalized.owner || retained.repo.repo !== normalized.repo) {
    throw new Error('FOREIGN_GITHUB_REPOSITORY');
  }
  if (retained.ref !== input.ref) {
    throw new Error('FOREIGN_GITHUB_REF');
  }

  const selectedPaths = input.paths ? new Set(input.paths) : null;
  const selected = retained.files.filter(file => !selectedPaths || selectedPaths.has(file.path));

  if (selectedPaths && selected.length !== selectedPaths.size) {
    throw new Error('FILE_NOT_FOUND_IN_SOURCE');
  }
  if (!selected.length) throw new Error('EMPTY_GITHUB_SCOPE');

  const rawChecksum = hash(bytes);
  let text = '';
  const locations: Array<{ start: number; end: number; filePath: string; startLine: number; endLine: number }> = [];

  for (const file of selected) {
    if (text) text += '\n\n';
    const header = `File: ${file.path}\n`;
    const start = text.length;
    text += header + file.content;
    const lines = file.content.split('\n');
    locations.push({
      start,
      end: text.length,
      filePath: file.path,
      startLine: 1,
      endLine: Math.max(1, lines.length),
    });
  }

  if (Buffer.byteLength(text) > GITHUB_SOURCE_LIMITS.extractedBytes) throw new Error('SOURCE_LIMIT_EXCEEDED');

  return {
    format: `${GITHUB_SOURCE_VERSION}-extraction` as const,
    repo: retained.repo,
    ref: retained.ref,
    commitSha: retained.commitSha,
    rawChecksum,
    offsetUnit: 'utf16' as const,
    text,
    locations,
    fileCount: selected.length,
    coverage: {
      kind: 'selected_files' as const,
      selectedFiles: selected.length,
      totalFiles: retained.files.length,
      paths: selected.map(f => f.path),
    },
  };
}

/** Injected non-billing provider acquisition. */
export async function acquireGithubSource(
  proposal: GithubSourceInput,
  provider?: GithubSourceProvider,
  callerSignal?: AbortSignal
) {
  const input = githubSourceInputSchema.parse(proposal);
  if (!provider) throw new Error('GITHUB_PROVIDER_REQUIRED');
  if (provider.billing !== 'none') throw new Error('GITHUB_PROVIDER_NOT_AUTHORIZED');
  if (callerSignal?.aborted) throw new Error('GITHUB_CANCELED');

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), GITHUB_SOURCE_LIMITS.timeoutMs);
  const signal = AbortSignal.any([controller.signal, ...(callerSignal ? [callerSignal] : [])]);

  let abort!: () => void;
  const interrupted = new Promise<never>((_resolve, reject) => {
    abort = () => reject(new Error(callerSignal?.aborted ? 'GITHUB_CANCELED' : 'GITHUB_DEADLINE'));
    signal.addEventListener('abort', abort, { once: true });
  });

  try {
    const normalized = singleGithubRepo(input.repoUrl);
    const resolved = await Promise.race([
      provider.resolveRef({ owner: normalized.owner, repo: normalized.repo }, input.ref, signal),
      interrupted,
    ]);

    if (!resolved.commitSha || !/^[a-f0-9]{40}$/.test(resolved.commitSha)) {
      throw new Error('INVALID_COMMIT_SHA');
    }

    const pathsToFetch = input.paths ?? ['README.md'];
    const fetched = await Promise.race([
      provider.fetchFiles({ owner: normalized.owner, repo: normalized.repo }, resolved.commitSha, pathsToFetch, signal),
      interrupted,
    ]);

    if (!fetched.length) throw new Error('NO_FILES_FETCHED');

    const decoder = new TextDecoder('utf-8', { fatal: true });
    let totalBytes = 0;
    const retainedFiles = fetched.map(file => {
      totalBytes += file.content.byteLength;
      if (file.content.byteLength > GITHUB_SOURCE_LIMITS.fileBytes || totalBytes > GITHUB_SOURCE_LIMITS.totalBytes) {
        throw new Error('SOURCE_SIZE_LIMIT');
      }
      let contentStr: string;
      try {
        contentStr = decoder.decode(file.content);
      } catch {
        throw new Error('BINARY_FILE_REJECTED');
      }
      return {
        path: file.path,
        content: contentStr,
        size: file.content.byteLength,
        checksum: hash(file.content),
      };
    });

    const retainedPayload: RetainedGithubSource = {
      format: GITHUB_SOURCE_VERSION,
      acquiredAt: new Date().toISOString(),
      repo: {
        owner: normalized.owner,
        repo: normalized.repo,
        url: normalized.url,
      },
      ref: input.ref,
      commitSha: resolved.commitSha,
      files: retainedFiles,
    };

    const validated = retainedGithubSourceSchema.parse(retainedPayload);
    const bytes = Buffer.from(JSON.stringify(validated), 'utf-8');
    const extraction = extractGithubSource(bytes, input);

    return { bytes, checksum: hash(bytes), extraction };
  } catch (error) {
    const code = error instanceof Error ? error.message : '';
    const safe = [
      'GITHUB_PROVIDER_REQUIRED',
      'GITHUB_PROVIDER_NOT_AUTHORIZED',
      'GITHUB_CANCELED',
      'GITHUB_DEADLINE',
      'INVALID_COMMIT_SHA',
      'NO_FILES_FETCHED',
      'BINARY_FILE_REJECTED',
      'SOURCE_SIZE_LIMIT',
      'SOURCE_MALFORMED',
      'SOURCE_LIMIT_EXCEEDED',
      'FOREIGN_GITHUB_REPOSITORY',
      'FOREIGN_GITHUB_REF',
      'FILE_NOT_FOUND_IN_SOURCE',
      'EMPTY_GITHUB_SCOPE',
    ];
    throw new Error(safe.includes(code) ? code : 'GITHUB_PROVIDER_FAILURE');
  } finally {
    clearTimeout(timer);
    signal.removeEventListener('abort', abort);
  }
}

/** Read-only boundary for owned artifact extraction. */
export async function readOwnedGithubSource(
  sql: TextArtifactSql,
  identity: { workspaceId: string; artifactId: string; sourceId: string; sourceVersion: number; inputFingerprint: string },
  input: GithubSourceInput
) {
  const retained = await readTextArtifact(sql, identity.workspaceId, identity.artifactId);
  if (
    retained.ref.kind !== 'source_raw' ||
    retained.ref.sourceId !== identity.sourceId ||
    retained.ref.sourceVersion !== identity.sourceVersion ||
    retained.ref.inputFingerprint !== identity.inputFingerprint
  ) {
    throw new Error('FOREIGN_GITHUB_ARTIFACT');
  }
  return extractGithubSource(retained.bytes, input);
}

