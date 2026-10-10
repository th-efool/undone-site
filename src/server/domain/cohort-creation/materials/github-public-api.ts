import 'server-only';
import { githubPathSchema, githubShaSchema } from '@/src/shared/cohort-creation/github';
import { CreationStorageError } from '@/src/server/infrastructure/storage/creation.contracts';
import { githubRepositoryUrl, type GithubRepository, type PublicGithubProvider } from './github';

/** Fixed GitHub API host, bounded responses and no redirects, including authenticated reads. */
export class GithubApiTransport implements PublicGithubProvider {
  constructor(private readonly request: typeof fetch = fetch, private readonly accessToken?: string) {
    if (accessToken !== undefined && (!accessToken || accessToken.length > 4096 || /[\u0000-\u0020\u007f]/.test(accessToken))) throw new CreationStorageError('UNAVAILABLE', 'GitHub connection credentials are unavailable. Reconnect your account.');
  }
  private async json(repository: GithubRepository, suffix: string, inputSignal: AbortSignal, query?: Record<string, string>) {
    const identity = githubRepositoryUrl(`https://github.com/${repository.owner}/${repository.repo}`);
    const url = new URL(`https://api.github.com/repos/${identity.owner}/${identity.repo}${suffix}`);
    for (const [key, value] of Object.entries(query ?? {})) url.searchParams.set(key, value);
    const signal = AbortSignal.any([inputSignal, AbortSignal.timeout(30_000)]); signal.throwIfAborted();
    let response: Response;
    try {
      response = await this.request(url, { headers: { Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28',
        'User-Agent': 'SideQuestHQ-Material/1.0', ...(this.accessToken ? { Authorization: `Bearer ${this.accessToken}` } : {}) }, credentials: 'omit', redirect: 'error', cache: 'no-store', signal });
    } catch { signal.throwIfAborted(); throw new CreationStorageError('UNAVAILABLE', 'GitHub could not be reached. Retry the selected paths.'); }
    try {
      if (!response.ok) {
        const retryable = response.status === 429 || response.status >= 500 || response.status === 403 &&
          (response.headers.get('x-ratelimit-remaining') === '0' || response.headers.has('retry-after'));
        throw new CreationStorageError(retryable ? 'UNAVAILABLE' : 'INVALID_INPUT', retryable
          ? 'GitHub quota or availability is limited. Retry later; no content was fabricated.'
          : 'GitHub content is unavailable. Check the selected repository, paths and account access.');
      }
      if (!response.headers.get('content-type')?.toLowerCase().includes('json') || !response.body) throw new CreationStorageError('INVALID_INPUT', 'GitHub returned an unsupported response.');
      const maximum = 4 * 1024 * 1024; const length = response.headers.get('content-length');
      if (length && (!/^\d+$/.test(length) || Number(length) > maximum)) throw new CreationStorageError('LIMIT_EXCEEDED', 'GitHub response exceeds 4 MiB. Select a smaller scope.');
      const reader = response.body.getReader(); const chunks: Uint8Array[] = []; let bytes = 0;
      const abort = () => { void reader.cancel().catch(() => undefined); }; signal.addEventListener('abort', abort, { once: true });
      try {
        while (true) {
          signal.throwIfAborted(); const chunk = await reader.read(); if (chunk.done) break;
          bytes += chunk.value.byteLength;
          if (bytes > maximum) throw new CreationStorageError('LIMIT_EXCEEDED', 'GitHub response exceeds 4 MiB. Select a smaller scope.');
          chunks.push(chunk.value);
        }
        signal.throwIfAborted();
        try { return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(Buffer.concat(chunks))) as unknown; }
        catch { throw new CreationStorageError('INVALID_INPUT', 'GitHub returned malformed JSON.'); }
      } finally { signal.removeEventListener('abort', abort); await reader.cancel().catch(() => undefined); reader.releaseLock(); }
    } finally { if (response.body && !response.body.locked) await response.body.cancel().catch(() => undefined); }
  }
  getRepository(repository: GithubRepository, signal: AbortSignal) { return this.json(repository, '', signal); }
  getCommit(repository: GithubRepository, ref: string, signal: AbortSignal) {
    if (!ref || ref.length > 255 || /[\u0000-\u0020\u007f\\]/.test(ref) || ['.', '..'].includes(ref)) throw new CreationStorageError('INVALID_INPUT', 'Select a valid GitHub branch, tag or commit.');
    return this.json(repository, `/commits/${encodeURIComponent(ref)}`, signal);
  }
  getTree(repository: GithubRepository, tree: string, signal: AbortSignal) {
    return this.json(repository, `/git/trees/${githubShaSchema.parse(tree)}`, signal);
  }
  getContent(repository: GithubRepository, path: string, commit: string, signal: AbortSignal) {
    return this.json(repository, `/contents/${githubPathSchema.parse(path).split('/').map(encodeURIComponent).join('/')}`, signal, { ref: githubShaSchema.parse(commit) });
  }
}
/** Public reads never inherit the legacy Corsair singleton or application OAuth credentials. */
export class GithubPublicApi extends GithubApiTransport {
  constructor(request: typeof fetch = fetch) { super(request); }
}
