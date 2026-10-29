import { sha256 } from '@/src/shared/cohort-builder/hash';
import type { ClientSourceExtraction } from '@/src/shared/cohort-builder/contracts';

export interface GithubRepoInfo {
  owner: string;
  repo: string;
  ref?: string;
}

export function parseGithubUrl(rawUrl: string): GithubRepoInfo | null {
  try {
    const trimmed = rawUrl.trim();
    // Shorthand owner/repo
    if (/^[a-zA-Z0-9_.-]+\/[a-zA-Z0-9_.-]+$/.test(trimmed)) {
      const [owner, repo] = trimmed.split('/');
      return { owner, repo: repo.replace(/\.git$/, ''), ref: 'main' };
    }

    const url = new URL(trimmed.startsWith('http') ? trimmed : `https://${trimmed}`);
    if (!url.hostname.includes('github.com')) return null;

    const parts = url.pathname.split('/').filter(Boolean);
    if (parts.length < 2) return null;

    return {
      owner: parts[0],
      repo: parts[1].replace(/\.git$/, ''),
      ref: parts[3] || 'main',
    };
  } catch {
    return null;
  }
}

const RELEVANT_EXTENSIONS = ['.md', '.markdown', '.txt', '.json', '.ts', '.tsx', '.js', '.py'];
const IGNORED_PATHS = [
  'node_modules',
  'dist',
  'build',
  'package-lock.json',
  'yarn.lock',
  'pnpm-lock.yaml',
  '.git',
  '.github',
];

export async function extractGithubRepoClient(
  repoUrl: string,
  options: { ref?: string; maxFiles?: number; maxChars?: number } = {}
): Promise<ClientSourceExtraction> {
  const parsed = parseGithubUrl(repoUrl);
  if (!parsed) throw new Error('Invalid GitHub repository URL');

  const owner = parsed.owner;
  const repo = parsed.repo;
  const ref = options.ref || parsed.ref || 'main';
  const maxFiles = options.maxFiles ?? 20;
  const maxChars = options.maxChars ?? 200_000;

  // Direct browser CORS request to GitHub Trees API
  const treeUrl = `https://api.github.com/repos/${owner}/${repo}/git/trees/${encodeURIComponent(ref)}?recursive=1`;
  const treeRes = await fetch(treeUrl, {
    headers: { Accept: 'application/vnd.github.v3+json' },
  });

  if (!treeRes.ok) {
    if (treeRes.status === 404) {
      // Retry with 'master' branch if 'main' was 404
      if (ref === 'main') {
        return extractGithubRepoClient(repoUrl, { ...options, ref: 'master' });
      }
      throw new Error(`Repository or branch "${ref}" not found on GitHub.`);
    }
    if (treeRes.status === 403) {
      throw new Error('GitHub API rate limit exceeded on your IP. Please try again later.');
    }
    throw new Error(`GitHub API returned status ${treeRes.status}`);
  }

  const treeData = await treeRes.json();
  const treeItems: Array<{ path: string; type: string; size?: number }> = treeData.tree ?? [];

  // Filter and prioritize docs, README, and key code files
  const eligibleFiles = treeItems
    .filter((item) => item.type === 'blob')
    .filter((item) => !IGNORED_PATHS.some((p) => item.path.includes(p)))
    .filter((item) => RELEVANT_EXTENSIONS.some((ext) => item.path.toLowerCase().endsWith(ext)))
    .sort((a, b) => {
      // Prioritize root README
      const aIsReadme = /^readme/i.test(a.path);
      const bIsReadme = /^readme/i.test(b.path);
      if (aIsReadme && !bIsReadme) return -1;
      if (!aIsReadme && bIsReadme) return 1;

      // Prioritize markdown files
      const aIsMd = a.path.endsWith('.md');
      const bIsMd = b.path.endsWith('.md');
      if (aIsMd && !bIsMd) return -1;
      if (!aIsMd && bIsMd) return 1;

      return a.path.localeCompare(b.path);
    })
    .slice(0, maxFiles);

  let fullText = `# Repository: ${owner}/${repo} (${ref})\n\n`;
  const locations: Array<{ start: number; end: number; filePath: string }> = [];

  for (const file of eligibleFiles) {
    try {
      const rawFileUrl = `https://raw.githubusercontent.com/${owner}/${repo}/${ref}/${file.path}`;
      const rawRes = await fetch(rawFileUrl);
      if (!rawRes.ok) continue;

      const fileContent = await rawRes.text();
      if (!fileContent.trim()) continue;

      const fileHeader = `### File: ${file.path}\n\n`;
      const start = fullText.length;
      fullText += fileHeader + fileContent.trim() + '\n\n';
      const end = fullText.length;

      locations.push({
        start,
        end,
        filePath: file.path,
      });

      if (fullText.length >= maxChars) {
        fullText = fullText.slice(0, maxChars);
        locations[locations.length - 1].end = fullText.length;
        break;
      }
    } catch {
      // Skip file if download fails
    }
  }

  if (locations.length === 0) {
    fullText = `# Repository: ${owner}/${repo}\n\nNo readable text or markdown files found in branch "${ref}".`;
    locations.push({ start: 0, end: fullText.length, filePath: 'README.md' });
  }

  const checksum = sha256(fullText);

  return {
    text: fullText,
    locations,
    checksum,
    provenance: {
      parserVersion: 'github-client-v1',
      rawChecksum: checksum,
      scope: 'selected_files',
      repoUrl: `https://github.com/${owner}/${repo}`,
      ref,
      fileCount: locations.length,
    },
  };
}
