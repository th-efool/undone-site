import { z } from 'zod';

export const GITHUB_SOURCE_VERSION = 'github-source-v1';
export const GITHUB_SOURCE_LIMITS = Object.freeze({
  files: 25,
  fileBytes: 500 * 1024,
  totalBytes: 2 * 1024 * 1024,
  extractedBytes: 200_000,
  timeoutMs: 15_000,
});

const DISALLOWED_EXTENSIONS = new Set([
  'exe', 'bin', 'zip', 'tar', 'gz', 'tgz', '7z', 'rar', 'iso',
  'png', 'jpg', 'jpeg', 'gif', 'webp', 'ico', 'svg', 'bmp', 'tiff',
  'mp3', 'mp4', 'mov', 'avi', 'wav', 'ogg', 'webm',
  'pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx',
  'wasm', 'pyc', 'pyo', 'class', 'o', 'obj', 'so', 'dylib', 'dll', 'a', 'lib',
  'lock',
]);

const DISALLOWED_FILENAMES = new Set([
  'package-lock.json', 'yarn.lock', 'pnpm-lock.yaml', 'cargo.lock', 'gemfile.lock', 'composer.lock', 'poetry.lock',
]);

export function singleGithubRepo(input: string): { owner: string; repo: string; url: string } {
  const invalid = () => { throw new Error('INVALID_GITHUB_REPO_URL'); };
  if (!input || input.length > 2048 || /[\u0000-\u0020\u007f\\]/.test(input)) return invalid();
  let url: URL;
  try { url = new URL(input); } catch { return invalid(); }
  if (url.protocol !== 'https:' || url.username || url.password || url.port || url.search || url.hash) return invalid();
  if (!['github.com', 'www.github.com'].includes(url.hostname)) return invalid();

  const parts = url.pathname.replace(/^\/+|\/+$/g, '').split('/');
  if (parts.length !== 2) return invalid();
  const [owner, rawRepo] = parts;
  const repo = rawRepo.endsWith('.git') ? rawRepo.slice(0, -4) : rawRepo;

  const nameRegex = /^[A-Za-z0-9_.-]+$/;
  if (!owner || !repo || !nameRegex.test(owner) || !nameRegex.test(repo)) return invalid();
  if (owner === '.' || owner === '..' || repo === '.' || repo === '..') return invalid();

  return { owner, repo, url: `https://github.com/${owner}/${repo}` };
}

export const githubRepoUrlSchema = z.string().max(2048).transform((input, ctx) => {
  try {
    return singleGithubRepo(input).url;
  } catch {
    ctx.addIssue({ code: 'custom', message: 'Use a public HTTPS GitHub repository URL (https://github.com/owner/repo)' });
    return z.NEVER;
  }
});

export const githubRefSchema = z.string().trim().min(1).max(100)
  .regex(/^[A-Za-z0-9_./-]+$/, 'Ref contains invalid characters')
  .refine(ref => !ref.startsWith('/') && !ref.endsWith('/') && !ref.includes('//') && !ref.includes('..') && !ref.startsWith('.'), 'Ref must be a valid git branch, tag, or commit');

export function isValidGithubFilePath(path: string): boolean {
  if (!path || path.length > 255 || /[\u0000-\u0020\u007f\\]/.test(path)) return false;
  if (path.startsWith('/') || path.endsWith('/') || path.includes('//') || path.includes('..')) return false;

  const parts = path.split('/');
  for (const part of parts) {
    if (!part || part === '.' || part === '..' || !/^[A-Za-z0-9_.-]+$/.test(part)) return false;
  }

  const filename = parts[parts.length - 1].toLowerCase();
  if (DISALLOWED_FILENAMES.has(filename)) return false;

  const extMatch = filename.match(/\.([a-z0-9]+)$/);
  if (extMatch && DISALLOWED_EXTENSIONS.has(extMatch[1])) return false;

  return true;
}

export const githubPathSchema = z.string().trim().min(1).max(255).refine(isValidGithubFilePath, 'Invalid or unsupported repository file path');

export const githubPathsSchema = z.array(githubPathSchema)
  .min(1, 'Select at least one file')
  .max(GITHUB_SOURCE_LIMITS.files, `Cannot select more than ${GITHUB_SOURCE_LIMITS.files} files`)
  .refine(paths => new Set(paths).size === paths.length, 'Duplicate file paths are not permitted');

export const githubSourceInputSchema = z.strictObject({
  kind: z.literal('github').optional(),
  repoUrl: githubRepoUrlSchema,
  ref: githubRefSchema.default('main'),
  commitSha: z.string().regex(/^[a-f0-9]{40}$/).optional(),
  paths: githubPathsSchema.optional(),
});
export type GithubSourceInput = z.infer<typeof githubSourceInputSchema>;

export const retainedGithubFileSchema = z.strictObject({
  path: githubPathSchema,
  content: z.string().max(GITHUB_SOURCE_LIMITS.fileBytes * 2), // allow utf-8 decoded string
  size: z.number().int().min(0).max(GITHUB_SOURCE_LIMITS.fileBytes),
  checksum: z.string().regex(/^[a-f0-9]{64}$/),
});
export type RetainedGithubFile = z.infer<typeof retainedGithubFileSchema>;

export const retainedGithubSourceSchema = z.strictObject({
  format: z.literal(GITHUB_SOURCE_VERSION),
  acquiredAt: z.iso.datetime(),
  repo: z.strictObject({
    owner: z.string().min(1).max(100),
    repo: z.string().min(1).max(100),
    url: githubRepoUrlSchema,
  }),
  ref: githubRefSchema,
  commitSha: z.string().regex(/^[a-f0-9]{40}$/),
  files: z.array(retainedGithubFileSchema).min(1).max(GITHUB_SOURCE_LIMITS.files),
}).superRefine((val, ctx) => {
  const normalized = singleGithubRepo(val.repo.url);
  if (normalized.owner !== val.repo.owner || normalized.repo !== val.repo.repo) {
    ctx.addIssue({ code: 'custom', message: 'Repository URL and owner/repo mismatch' });
  }
  const seenPaths = new Set<string>();
  let totalBytes = 0;
  for (const file of val.files) {
    if (seenPaths.has(file.path)) {
      ctx.addIssue({ code: 'custom', message: `Duplicate file path in retained source: ${file.path}` });
    }
    seenPaths.add(file.path);
    totalBytes += file.size;
  }
  if (totalBytes > GITHUB_SOURCE_LIMITS.totalBytes) {
    ctx.addIssue({ code: 'custom', message: `Total retained files size exceeds ${GITHUB_SOURCE_LIMITS.totalBytes} bytes` });
  }
});
export type RetainedGithubSource = z.infer<typeof retainedGithubSourceSchema>;
