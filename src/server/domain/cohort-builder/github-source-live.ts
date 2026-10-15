import {
  GITHUB_SOURCE_LIMITS,
  isValidGithubFilePath,
} from '@/src/shared/cohort-builder/github-source';
import type { GithubSourceProvider } from './github-source';

export interface LiveGithubSourceProviderOptions {
  id?: string;
  version?: string;
  token?: string;
  fetchFn?: typeof fetch;
}

/** Official non-billing GitHub repository source provider querying public GitHub REST API. */
export class LiveGithubSourceProvider implements GithubSourceProvider {
  readonly id: string;
  readonly version: string;
  readonly billing = 'none' as const;
  private readonly token?: string;
  private readonly fetchFn: typeof fetch;

  constructor(options?: LiveGithubSourceProviderOptions) {
    this.id = options?.id ?? process.env.INTERACTION_GITHUB_PROVIDER_ID ?? 'github-source-live';
    this.version = options?.version ?? process.env.INTERACTION_GITHUB_PROVIDER_VERSION ?? '1';
    this.token = options?.token ?? process.env.INTERACTION_GITHUB_TOKEN ?? process.env.GITHUB_TOKEN;
    this.fetchFn = options?.fetchFn ?? globalThis.fetch;
  }

  async resolveRef(repo: { owner: string; repo: string }, ref: string, signal: AbortSignal): Promise<{ commitSha: string }> {
    if (signal.aborted) throw new Error('GITHUB_CANCELED');
    if (/^[a-f0-9]{40}$/i.test(ref)) {
      return { commitSha: ref.toLowerCase() };
    }

    const headers: Record<string, string> = {
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': 'SideQuestHQ-CohortBuilder/1.0',
    };
    if (this.token) {
      headers.Authorization = `Bearer ${this.token}`;
    }

    const url = `https://api.github.com/repos/${encodeURIComponent(repo.owner)}/${encodeURIComponent(repo.repo)}/commits/${encodeURIComponent(ref)}`;
    let response: Response;
    try {
      response = await this.fetchFn(url, { headers, signal });
    } catch (err) {
      if (signal.aborted) throw new Error('GITHUB_CANCELED');
      throw new Error('GITHUB_PROVIDER_FAILURE');
    }

    if (response.status === 404) {
      throw new Error('FOREIGN_GITHUB_REF');
    }
    if (response.status === 403 || response.status === 429) {
      throw new Error('GITHUB_PROVIDER_FAILURE');
    }
    if (!response.ok) {
      throw new Error('GITHUB_PROVIDER_FAILURE');
    }

    let data: any;
    try {
      data = await response.json();
    } catch {
      throw new Error('GITHUB_PROVIDER_FAILURE');
    }

    if (!data || typeof data !== 'object' || typeof data.sha !== 'string' || !/^[a-f0-9]{40}$/.test(data.sha)) {
      throw new Error('INVALID_COMMIT_SHA');
    }

    return { commitSha: data.sha };
  }

  async fetchFiles(
    repo: { owner: string; repo: string },
    commitSha: string,
    paths: string[],
    signal: AbortSignal
  ): Promise<Array<{ path: string; content: Uint8Array }>> {
    if (signal.aborted) throw new Error('GITHUB_CANCELED');
    if (!paths.length) throw new Error('NO_FILES_FETCHED');

    const headers: Record<string, string> = {
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': 'SideQuestHQ-CohortBuilder/1.0',
    };
    if (this.token) {
      headers.Authorization = `Bearer ${this.token}`;
    }

    const results: Array<{ path: string; content: Uint8Array }> = [];
    let totalBytes = 0;

    for (const p of paths) {
      if (signal.aborted) throw new Error('GITHUB_CANCELED');
      if (!isValidGithubFilePath(p)) {
        throw new Error('FILE_NOT_FOUND_IN_SOURCE');
      }

      const encodedPath = p.split('/').map(encodeURIComponent).join('/');
      const url = `https://api.github.com/repos/${encodeURIComponent(repo.owner)}/${encodeURIComponent(repo.repo)}/contents/${encodedPath}?ref=${encodeURIComponent(commitSha)}`;
      let response: Response;
      try {
        response = await this.fetchFn(url, { headers, signal });
      } catch (err) {
        if (signal.aborted) throw new Error('GITHUB_CANCELED');
        throw new Error('GITHUB_PROVIDER_FAILURE');
      }

      if (response.status === 404) {
        throw new Error('FILE_NOT_FOUND_IN_SOURCE');
      }
      if (!response.ok) {
        throw new Error('GITHUB_PROVIDER_FAILURE');
      }

      let data: any;
      try {
        data = await response.json();
      } catch {
        throw new Error('SOURCE_MALFORMED');
      }

      if (!data || typeof data !== 'object') {
        throw new Error('SOURCE_MALFORMED');
      }

      if (data.type !== 'file' || typeof data.content !== 'string') {
        throw new Error('BINARY_FILE_REJECTED');
      }

      const encoding = data.encoding;
      let fileBytes: Uint8Array;
      if (encoding === 'base64') {
        const cleanB64 = data.content.replace(/\r?\n/g, '');
        fileBytes = new Uint8Array(Buffer.from(cleanB64, 'base64'));
      } else {
        fileBytes = new TextEncoder().encode(data.content);
      }

      if (fileBytes.byteLength > GITHUB_SOURCE_LIMITS.fileBytes) {
        throw new Error('SOURCE_SIZE_LIMIT');
      }
      totalBytes += fileBytes.byteLength;
      if (totalBytes > GITHUB_SOURCE_LIMITS.totalBytes) {
        throw new Error('SOURCE_SIZE_LIMIT');
      }

      results.push({ path: p, content: fileBytes });
    }

    return results;
  }
}
