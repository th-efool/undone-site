/**
 * GitHub REST Git Data API client for personal workspace synchronization.
 * Interacts with low-level Git objects (blobs, trees, commits, refs) and Contents API.
 */

export interface GitHubGitDataClientOptions {
  repoFullName: string;
  token: string;
  userAgent?: string;
  baseUrl?: string;
  maxRetries?: number;
}

export interface GitHubRepositoryInfo {
  fullName: string;
  isPrivate: boolean;
  defaultBranch: string;
}

export interface GitHubBlobResult {
  sha: string;
  byteLength: number;
  contentBase64: string;
}

export interface TreeEntryInput {
  path: string;
  mode: '100644';
  type: 'blob';
  sha: string | null;
}

export interface GitHubTreeItem {
  path: string;
  mode: string;
  type: string;
  sha: string;
  size?: number;
}

export interface GitHubCommitResult {
  sha: string;
  treeSha: string;
  parentShas: string[];
  message: string;
  committedAt: string;
}

export interface UpdateRefOptions {
  force?: boolean;
  expectedSha?: string | null;
}

export interface UpdateRefResult {
  ok: boolean;
  status: number;
  error?: string;
}

export class GitHubApiError extends Error {
  readonly status: number;
  readonly documentationUrl?: string;
  readonly responseBody?: unknown;

  constructor(message: string, status: number, documentationUrl?: string, responseBody?: unknown) {
    super(message);
    this.name = 'GitHubApiError';
    this.status = status;
    this.documentationUrl = documentationUrl;
    this.responseBody = responseBody;
  }
}

// Internal raw GitHub API response models
interface RawGitHubRepo {
  full_name: string;
  private: boolean;
  default_branch: string;
}

interface RawGitHubCommitListItem {
  sha: string;
}

interface RawGitHubContentsCommit {
  commit: {
    sha: string;
  };
}

interface RawGitHubBlob {
  sha: string;
  size?: number;
  content: string;
  encoding?: string;
}

interface RawGitHubTree {
  sha: string;
  tree: Array<{
    path: string;
    mode: string;
    type: string;
    sha: string;
    size?: number;
  }>;
}

interface RawGitHubCommit {
  sha: string;
  message: string;
  tree: { sha: string };
  parents: Array<{ sha: string }>;
  committer?: { date?: string };
  author?: { date?: string };
}

interface RawGitHubRef {
  ref: string;
  object?: { sha: string; type?: string };
  sha?: string;
}

interface RawGitHubError {
  message?: string;
  documentation_url?: string;
}

export class GitHubGitDataClient {
  readonly owner: string;
  readonly repo: string;
  readonly repoFullName: string;
  private readonly token: string;
  private readonly userAgent: string;
  private readonly baseUrl: string;
  private readonly maxRetries: number;

  constructor(options: GitHubGitDataClientOptions) {
    if (!options.token || typeof options.token !== 'string' || options.token.trim() === '') {
      throw new Error('GitHubGitDataClient requires a non-empty token string');
    }

    if (!options.repoFullName || typeof options.repoFullName !== 'string') {
      throw new Error('GitHubGitDataClient requires a valid repoFullName in "owner/repo" format');
    }

    const parts = options.repoFullName.trim().split('/');
    if (parts.length !== 2 || !parts[0] || !parts[1]) {
      throw new Error(
        `Invalid repoFullName "${options.repoFullName}". Expected format is "owner/repo" (e.g. "octocat/undone-data")`
      );
    }

    this.owner = parts[0];
    this.repo = parts[1];
    this.repoFullName = `${this.owner}/${this.repo}`;
    this.token = options.token.trim();
    this.userAgent = options.userAgent || 'undone-personal-workspace';
    this.baseUrl = (options.baseUrl || 'https://api.github.com').replace(/\/+$/, '');
    this.maxRetries = options.maxRetries ?? 0;
  }

  private getHeaders(): Record<string, string> {
    return {
      'Accept': 'application/vnd.github+json',
      'Authorization': `Bearer ${this.token}`,
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': this.userAgent,
    };
  }

  private normalizeRefNames(refName: string): { cleanRef: string; fullRef: string } {
    let cleanRef = refName.trim();
    if (cleanRef.startsWith('refs/')) {
      cleanRef = cleanRef.slice(5);
    }
    if (!cleanRef.startsWith('heads/') && !cleanRef.startsWith('tags/')) {
      cleanRef = `heads/${cleanRef}`;
    }
    const fullRef = `refs/${cleanRef}`;
    return { cleanRef, fullRef };
  }

  private async request<T>(
    endpoint: string,
    init: RequestInit = {}
  ): Promise<{ status: number; data: T }> {
    const url = endpoint.startsWith('http://') || endpoint.startsWith('https://')
      ? endpoint
      : `${this.baseUrl}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;

    const headers: Record<string, string> = {
      ...this.getHeaders(),
      ...(init.headers as Record<string, string> | undefined),
    };

    if (init.body && typeof init.body === 'string' && !headers['Content-Type']) {
      headers['Content-Type'] = 'application/json';
    }

    const maxRetries = this.maxRetries;
    let lastError: unknown = null;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const res = await fetch(url, {
          ...init,
          headers,
        });

        const contentType = res.headers.get('content-type') || '';
        const isJson = contentType.includes('application/json') || contentType.includes('+json');

        let rawData: unknown = null;
        if (isJson) {
          rawData = await res.json().catch(() => null);
        } else {
          const text = await res.text().catch(() => '');
          rawData = text ? { message: text } : null;
        }

        if (!res.ok) {
          const errorObj = (rawData && typeof rawData === 'object' ? rawData : {}) as RawGitHubError;
          const message =
            errorObj.message || `GitHub API request failed: ${init.method || 'GET'} ${url} returned ${res.status}`;
          throw new GitHubApiError(message, res.status, errorObj.documentation_url, rawData);
        }

        return { status: res.status, data: rawData as T };
      } catch (err) {
        if (err instanceof GitHubApiError) {
          // Do not retry API errors (e.g. 401, 404, 422)
          throw err;
        }
        lastError = err;
        if (attempt < maxRetries) {
          await new Promise((resolve) => setTimeout(resolve, 500 * (attempt + 1)));
          continue;
        }
      }
    }

    throw lastError;
  }

  /**
   * Verifies the target repository exists, is accessible with the current credentials,
   * and retrieves its metadata (privacy status and default branch).
   */
  async verifyRepository(): Promise<GitHubRepositoryInfo> {
    const { data } = await this.request<RawGitHubRepo>(`/repos/${this.owner}/${this.repo}`);

    return {
      fullName: data.full_name,
      isPrivate: Boolean(data.private),
      defaultBranch: data.default_branch,
    };
  }

  /**
   * Bootstraps an empty repository by creating an initial README via the Contents API
   * if the repository has 0 commits. If commits already exist, returns the latest commit SHA.
   */
  async bootstrapEmptyRepo(): Promise<string> {
    let isEmpty = false;
    let latestCommitSha: string | null = null;

    try {
      const { data } = await this.request<RawGitHubCommitListItem[]>(
        `/repos/${this.owner}/${this.repo}/commits?per_page=1`
      );
      if (Array.isArray(data) && data.length > 0 && data[0]?.sha) {
        latestCommitSha = data[0].sha;
      } else {
        isEmpty = true;
      }
    } catch (err) {
      if (err instanceof GitHubApiError && err.status === 409) {
        // GitHub returns 409 Conflict with "Git Repository is empty." when repo has 0 commits
        isEmpty = true;
      } else {
        throw err;
      }
    }

    if (!isEmpty && latestCommitSha) {
      return latestCommitSha;
    }

    // Repository is empty: create initial README via Contents API
    const content = Buffer.from(
      `# ${this.repo}\n\nPersonal workspace synchronized by Undone.\n`
    ).toString('base64');

    const { data } = await this.request<RawGitHubContentsCommit>(
      `/repos/${this.owner}/${this.repo}/contents/README.md`,
      {
        method: 'PUT',
        body: JSON.stringify({
          message: 'Initial workspace commit',
          content,
        }),
      }
    );

    if (!data?.commit?.sha) {
      throw new Error('Failed to bootstrap empty repository: missing commit SHA in Contents API response');
    }

    return data.commit.sha;
  }

  /**
   * Creates a Git blob object on GitHub.
   *
   * @param contentBase64 Base64-encoded raw file or note content
   * @returns Git blob SHA (40 hex characters)
   */
  async createBlob(contentBase64: string): Promise<string> {
    const { data } = await this.request<{ sha: string }>(
      `/repos/${this.owner}/${this.repo}/git/blobs`,
      {
        method: 'POST',
        body: JSON.stringify({
          content: contentBase64,
          encoding: 'base64',
        }),
      }
    );

    return data.sha;
  }

  /**
   * Retrieves a Git blob object by its SHA.
   *
   * @param sha Git blob SHA
   * @returns Blob result with clean Base64 content, or null if not found (404)
   */
  async getBlob(sha: string): Promise<GitHubBlobResult | null> {
    try {
      const { data } = await this.request<RawGitHubBlob>(
        `/repos/${this.owner}/${this.repo}/git/blobs/${encodeURIComponent(sha)}`
      );

      const cleanBase64 = (data.content || '').replace(/\r?\n/g, '');
      const byteLength =
        typeof data.size === 'number'
          ? data.size
          : Buffer.from(cleanBase64, 'base64').byteLength;

      return {
        sha: data.sha,
        byteLength,
        contentBase64: cleanBase64,
      };
    } catch (err) {
      if (err instanceof GitHubApiError && (err.status === 404 || err.status === 409)) {
        return null;
      }
      throw err;
    }
  }

  /**
   * Creates a Git tree object containing multiple entries.
   *
   * @param baseTreeSha Base tree SHA for incremental tree updates, or null for root tree
   * @param entries Array of tree entries with path, mode, type, and blob SHA
   * @returns Created Git tree SHA
   */
  async createTree(baseTreeSha: string | null, entries: TreeEntryInput[]): Promise<string> {
    const body: { base_tree?: string; tree: TreeEntryInput[] } = {
      tree: entries,
    };
    if (baseTreeSha) {
      body.base_tree = baseTreeSha;
    }

    const { data } = await this.request<{ sha: string }>(
      `/repos/${this.owner}/${this.repo}/git/trees`,
      {
        method: 'POST',
        body: JSON.stringify(body),
      }
    );

    return data.sha;
  }

  /**
   * Retrieves a Git tree object by its SHA.
   *
   * @param treeSha Git tree SHA
   * @param recursive Whether to fetch all subtrees recursively
   * @returns Array of tree entries, or null if tree does not exist (404)
   */
  async getTree(treeSha: string, recursive?: boolean): Promise<GitHubTreeItem[] | null> {
    try {
      const query = recursive ? '?recursive=1' : '';
      const { data } = await this.request<RawGitHubTree>(
        `/repos/${this.owner}/${this.repo}/git/trees/${encodeURIComponent(treeSha)}${query}`
      );

      return data.tree.map((entry) => ({
        path: entry.path,
        mode: entry.mode,
        type: entry.type,
        sha: entry.sha,
        ...(typeof entry.size === 'number' ? { size: entry.size } : {}),
      }));
    } catch (err) {
      if (err instanceof GitHubApiError && (err.status === 404 || err.status === 409)) {
        return null;
      }
      throw err;
    }
  }

  /**
   * Creates a Git commit pointing to a tree with specified parent commit SHAs.
   *
   * @param message Commit message
   * @param treeSha Git tree SHA
   * @param parentShas Array of parent commit SHAs
   * @returns Created Git commit SHA
   */
  async createCommit(message: string, treeSha: string, parentShas: string[]): Promise<string> {
    const { data } = await this.request<{ sha: string }>(
      `/repos/${this.owner}/${this.repo}/git/commits`,
      {
        method: 'POST',
        body: JSON.stringify({
          message,
          tree: treeSha,
          parents: parentShas,
        }),
      }
    );

    return data.sha;
  }

  /**
   * Retrieves a Git commit by its SHA.
   *
   * @param sha Git commit SHA
   * @returns Commit metadata including treeSha, parentShas, and committed timestamp, or null if 404
   */
  async getCommit(sha: string): Promise<GitHubCommitResult | null> {
    try {
      const { data } = await this.request<RawGitHubCommit>(
        `/repos/${this.owner}/${this.repo}/git/commits/${encodeURIComponent(sha)}`
      );

      return {
        sha: data.sha,
        treeSha: data.tree?.sha || '',
        parentShas: Array.isArray(data.parents) ? data.parents.map((p) => p.sha) : [],
        message: data.message,
        committedAt: data.committer?.date || data.author?.date || new Date().toISOString(),
      };
    } catch (err) {
      if (err instanceof GitHubApiError && (err.status === 404 || err.status === 409)) {
        return null;
      }
      throw err;
    }
  }

  /**
   * Retrieves the target commit SHA pointed to by a Git reference.
   *
   * @param refName Ref name (e.g. "heads/main", "heads/undone-sync", "refs/heads/main", or "main")
   * @returns Commit SHA string or null if ref does not exist
   */
  async getRef(refName: string): Promise<string | null> {
    const { cleanRef, fullRef } = this.normalizeRefNames(refName);

    try {
      const { data } = await this.request<RawGitHubRef | RawGitHubRef[]>(
        `/repos/${this.owner}/${this.repo}/git/ref/${cleanRef}`
      );

      if (Array.isArray(data)) {
        const exactMatch = data.find(
          (item) => item.ref === fullRef || item.ref.endsWith(`/${cleanRef}`)
        );
        return exactMatch?.object?.sha || exactMatch?.sha || null;
      }

      return data.object?.sha || data.sha || null;
    } catch (err) {
      if (err instanceof GitHubApiError && (err.status === 404 || err.status === 409)) {
        return null;
      }
      throw err;
    }
  }

  /**
   * Updates or creates a Git reference.
   * - If the reference does not exist yet, creates it via POST `/git/refs`.
   * - If the reference exists, updates it via PATCH `/git/refs/{refName}`.
   * - In case of a Compare-And-Swap (CAS) or non-fast-forward conflict, returns `{ ok: false, status: 422, error: ... }`.
   *
   * @param refName Ref name (e.g. "heads/main" or "refs/heads/main")
   * @param newCommitSha Commit SHA to point the reference to
   * @param options Optional configuration like force update
   * @returns UpdateRefResult with ok status, HTTP status, and optional error message
   */
  async updateRef(
    refName: string,
    newCommitSha: string,
    options?: UpdateRefOptions
  ): Promise<UpdateRefResult> {
    const { cleanRef, fullRef } = this.normalizeRefNames(refName);

    try {
      const existingSha = await this.getRef(refName);

      if (options && 'expectedSha' in options && existingSha !== options.expectedSha) {
        return { ok: false, status: 422, error: 'Remote ref no longer matches the expected commit' };
      }

      if (!existingSha) {
        // Ref does not exist yet -> create ref via POST /git/refs
        const url = `${this.baseUrl}/repos/${this.owner}/${this.repo}/git/refs`;
        const res = await fetch(url, {
          method: 'POST',
          headers: {
            ...this.getHeaders(),
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            ref: fullRef,
            sha: newCommitSha,
          }),
        });

        if (res.ok) {
          return { ok: true, status: res.status };
        }

        const errorPayload = (await res.json().catch(() => ({}))) as RawGitHubError;
        return {
          ok: false,
          status: res.status,
          error: errorPayload.message || `Failed to create ref ${fullRef} (HTTP ${res.status})`,
        };
      }

      // Ref exists -> update ref via PATCH /git/refs/{refName}
      const url = `${this.baseUrl}/repos/${this.owner}/${this.repo}/git/refs/${cleanRef}`;
      const res = await fetch(url, {
        method: 'PATCH',
        headers: {
          ...this.getHeaders(),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          sha: newCommitSha,
          force: options?.force ?? false,
        }),
      });

      if (res.ok) {
        return { ok: true, status: res.status };
      }

      const errorPayload = (await res.json().catch(() => ({}))) as RawGitHubError;
      return {
        ok: false,
        status: res.status,
        error: errorPayload.message || `Failed to update ref ${cleanRef} (HTTP ${res.status})`,
      };
    } catch (err) {
      return {
        ok: false,
        status: 500,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }
}
