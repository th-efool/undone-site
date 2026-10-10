import { createHash } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';
vi.mock('server-only', () => ({}));
import { GithubMaterialReader, githubRepositoryUrl, type PublicGithubProvider } from '../materials/github';
import { GithubPublicApi } from '../materials/github-public-api';

const sha = (value: string) => value.repeat(40);
const blob = (text: string) => { const bytes = Buffer.from(text); return { sha: createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex'), size: bytes.length, content: bytes.toString('base64') }; };
function fixture() {
  const readme = blob('# Read me\r\nReal source text.\r\n'); const lesson = blob('## Lesson\n```ts\nconst value = 1;\n```\n');
  const provider = {
    getRepository: vi.fn(async () => ({ owner: { login: 'Example' }, name: 'Lessons', private: false, default_branch: 'main' })),
    getCommit: vi.fn(async () => ({ sha: sha('a'), commit: { tree: { sha: sha('b') } } })),
    getTree: vi.fn(async (_repository, tree) => tree === sha('b')
      ? { sha: tree, truncated: false, tree: [{ path: 'README.md', mode: '100644', type: 'blob', sha: readme.sha, size: readme.size },
        { path: 'docs', mode: '040000', type: 'tree', sha: sha('c') }, { path: 'private-code', mode: '040000', type: 'tree', sha: sha('d') }] }
      : { sha: tree, truncated: false, tree: [{ path: 'lesson.md', mode: '100644', type: 'blob', sha: lesson.sha, size: lesson.size },
        { path: 'link', mode: '120000', type: 'blob', sha: sha('e') }, { path: 'vendor', mode: '160000', type: 'commit', sha: sha('f') }] }),
    getContent: vi.fn(async (_repository, path, commit = sha('a')) => {
      expect(commit).toBe(sha('a')); return { type: 'file', path, encoding: 'base64', ...(path === 'README.md' ? readme : lesson) };
    }),
  };
  const selection = { url: 'https://github.com/Example/Lessons', ref: null, paths: ['README.md', 'docs'] };
  return { provider, selection, reader: new GithubMaterialReader(provider), readme, lesson };
}
describe('commit-pinned GitHub source content', () => {
  it('reads only selected paths at the same commit and preserves exact text plus explicit omissions', async () => {
    const f = fixture(); const result = await f.reader.read(f.selection);
    expect(result.commit).toBe(sha('a')); expect(result.files.map(file => file.path)).toEqual(['README.md', 'docs/lesson.md']);
    expect(result.files[0].text).toBe('# Read me\r\nReal source text.\r\n');
    expect(result.skipped).toEqual([{ path: 'docs/link', reason: 'symlink' }, { path: 'docs/vendor', reason: 'submodule' }]);
    expect(f.provider.getTree).toHaveBeenCalledTimes(2); expect(f.provider.getContent).toHaveBeenCalledTimes(2);
    expect(f.provider.getContent.mock.calls.every(call => call[2] === sha('a'))).toBe(true);
    expect(JSON.stringify(result)).not.toContain('private-code'); expect(result.coverage).toBe('selected_paths');
  });
  it('refuses private/mismatched repositories before retrieving content', async () => {
    const f = fixture(); f.provider.getRepository.mockResolvedValue({ owner: { login: 'Example' }, name: 'Lessons', private: true, default_branch: 'main' });
    await expect(f.reader.read(f.selection)).rejects.toThrow('your own connected account'); expect(f.provider.getCommit).not.toHaveBeenCalled();
    f.provider.getRepository.mockResolvedValue({ owner: { login: 'Other' }, name: 'Lessons', private: false, default_branch: 'main' });
    await expect(f.reader.read(f.selection)).rejects.toThrow('public repository'); expect(f.provider.getContent).not.toHaveBeenCalled();
  });
  it('rejects malformed URLs, traversal and overlapping selection before provider calls', async () => {
    const f = fixture();
    for (const url of ['https://github.com.attacker.com/a/b', 'https://github.com/a/b/blob/main/a.md', 'https://u:p@github.com/a/b', 'https://github.com/a/%2e%2e', 'http://github.com/a/b']) {
      expect(() => githubRepositoryUrl(url)).toThrow();
    }
    for (const paths of [['docs', 'docs/a.md'], ['../secret'], ['/root'], ['docs//a'], ['a', 'a']]) await expect(f.reader.read({ ...f.selection, paths })).rejects.toThrow();
    expect(f.provider.getRepository).not.toHaveBeenCalled();
  });
  it('rejects truncated/duplicate/wrong trees and missing selected paths rather than accepting partial success', async () => {
    for (const variant of ['truncated', 'duplicate', 'wrong', 'missing']) {
      const f = fixture(); const root = await f.provider.getTree({}, sha('b'));
      if (variant === 'truncated') root.truncated = true;
      if (variant === 'duplicate') root.tree.push(root.tree[0]);
      if (variant === 'wrong') root.sha = sha('f');
      if (variant === 'missing') root.tree = [];
      f.provider.getTree.mockResolvedValue(root);
      await expect(f.reader.read(f.selection)).rejects.toThrow(); expect(f.provider.getContent).not.toHaveBeenCalled();
    }
  });
  it('verifies blob hash/path/size and canonical base64 before accepting text', async () => {
    for (const variant of ['sha', 'path', 'size', 'content']) {
      const f = fixture(); const file = await f.provider.getContent({}, 'README.md');
      if (variant === 'sha') file.sha = sha('f');
      if (variant === 'path') file.path = 'elsewhere.md';
      if (variant === 'size') file.size++;
      if (variant === 'content') file.content = '*invalid*';
      f.provider.getContent.mockResolvedValue(file);
      await expect(f.reader.read({ ...f.selection, paths: ['README.md'] })).rejects.toThrow();
    }
  });
  it('records binary/empty omissions and fails an entirely unreadable selection', async () => {
    const f = fixture(); const binary = blob('\0\x01');
    f.provider.getTree.mockResolvedValue({ sha: sha('b'), truncated: false, tree: [{ path: 'README.md', mode: '100644', type: 'blob', sha: binary.sha, size: binary.size }] });
    f.provider.getContent.mockResolvedValue({ type: 'file', path: 'README.md', encoding: 'base64', ...binary });
    await expect(f.reader.read({ ...f.selection, paths: ['README.md'] })).rejects.toThrow('no readable UTF-8 text');
  });
  it('cancels before requests and rejects explicit commit substitution', async () => {
    const f = fixture(); const controller = new AbortController(); controller.abort();
    await expect(f.reader.read(f.selection, controller.signal)).rejects.toThrow(); expect(f.provider.getRepository).not.toHaveBeenCalled();
    await expect(f.reader.read({ ...f.selection, ref: sha('f') })).rejects.toThrow('different commit'); expect(f.provider.getTree).not.toHaveBeenCalled();
  });
  it('enforces aggregate text size without dropping a selected file', async () => {
    const f = fixture(); const large = blob('x'.repeat(600_000));
    const provider: PublicGithubProvider = { ...f.provider, getTree: async (_repository, tree) => ({ sha: tree, truncated: false,
      tree: ['one.md', 'two.md'].map(path => ({ path, type: 'blob', mode: '100644', sha: large.sha, size: large.size })) }),
      getContent: async (_repository, path) => ({ type: 'file', path, encoding: 'base64', ...large }) };
    await expect(new GithubMaterialReader(provider).read({ ...f.selection, paths: ['one.md', 'two.md'] })).rejects.toMatchObject({ code: 'LIMIT_EXCEEDED' });
  });
  it('respects remaining draft unit capacity before accepting a second selected file', async () => {
    const f = fixture(); await expect(f.reader.read(f.selection, undefined, 1)).rejects.toThrow('remaining 1 draft units');
    await expect(f.reader.read(f.selection, undefined, 0)).rejects.toThrow('remaining draft unit capacity');
  });
});

describe('public-only GitHub HTTP boundary', () => {
  it('uses fixed endpoints, a pinned API version and immutable ref without credentials or download URLs', async () => {
    const request = vi.fn<typeof fetch>(async () => Response.json({ type: 'file' })); const api = new GithubPublicApi(request);
    await api.getContent({ owner: 'Example', repo: 'Lessons' }, 'docs/a b.md', sha('a'), new AbortController().signal);
    const [url, options] = request.mock.calls[0];
    expect(String(url)).toBe(`https://api.github.com/repos/Example/Lessons/contents/docs/a%20b.md?ref=${sha('a')}`);
    expect(options).toMatchObject({ credentials: 'omit', redirect: 'error', cache: 'no-store', headers: { 'X-GitHub-Api-Version': '2022-11-28' } });
    expect(JSON.stringify(options)).not.toMatch(/authorization/i);
  });
  it('sanitizes provider errors, bounds JSON bytes and refuses redirects/invalid input', async () => {
    const repository = { owner: 'Example', repo: 'Lessons' }; const signal = new AbortController().signal;
    for (const response of [new Response('secret token', { status: 429 }), new Response('secret token', { status: 404 }),
      new Response('{}', { headers: { 'content-type': 'application/json', 'content-length': '5000000' } }),
      new Response('not json', { headers: { 'content-type': 'application/json' } })]) {
      const api = new GithubPublicApi(vi.fn(async () => response));
      await expect(api.getRepository(repository, signal)).rejects.not.toThrow('secret token');
    }
    const request = vi.fn(); const api = new GithubPublicApi(request);
    await expect(api.getRepository({ owner: 'a/../../b', repo: 'r' }, signal)).rejects.toThrow();
    expect(() => api.getContent(repository, '../secret', sha('a'), signal)).toThrow(); expect(request).not.toHaveBeenCalled();
  });
});
