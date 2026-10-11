import { createServer } from 'node:http';
import { once } from 'node:events';
import { gzipSync, brotliCompressSync, deflateSync } from 'node:zlib';
import { describe, expect, it, vi } from 'vitest';
vi.mock('server-only', () => ({}));
import { GithubPublicApi } from '../materials/github-public-api';
import { NotionApi } from '../materials/notion-api';

const id = '11111111-1111-4111-8111-111111111111';
const providers = [
  { name: 'Notion', host: 'api.notion.com', read: (request: typeof fetch) => new NotionApi('local-fixture', request).getPage(id, new AbortController().signal) },
  { name: 'GitHub', host: 'api.github.com', read: (request: typeof fetch) => new GithubPublicApi(request).getRepository({ owner: 'Example', repo: 'Lessons' }, new AbortController().signal) },
];

/** Actual native fetch decoding; only the injected test transport reaches loopback. */
async function withCompressedResponse(text: string, encoding: string, compress: (bytes: Buffer) => Buffer, run: (address: string) => Promise<void>) {
  const body = compress(Buffer.from(text));
  const server = createServer((_request, response) => {
    response.writeHead(200, { 'Content-Type': 'application/json', 'Content-Encoding': encoding, 'Content-Length': body.byteLength });
    response.end(body);
  });
  server.listen(0, '127.0.0.1'); await once(server, 'listening');
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('Local fixture server unavailable');
  try { await run(`http://127.0.0.1:${address.port}`); }
  finally { server.closeAllConnections(); await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve())); }
}

describe.each(providers)('$name decoded provider bodies', ({ host, read }) => {
  it.each([['gzip', gzipSync], ['br', brotliCompressSync], ['deflate', deflateSync]] as const)('accepts complete %s JSON with compressed wire length', async (encoding, compress) => {
    const value = { text: 'Actual retained lesson text. '.repeat(100) };
    await withCompressedResponse(JSON.stringify(value), encoding, compress, async address => {
      const request: typeof fetch = async (url, options) => {
        expect(new URL(String(url)).hostname).toBe(host);
        return fetch(address, options);
      };
      await expect(read(request)).resolves.toEqual(value);
    });
  });
  it('rejects decoded oversize content even when compressed bytes fit the limit', async () => {
    await withCompressedResponse(JSON.stringify({ text: 'x'.repeat(4 * 1024 * 1024) }), 'gzip', gzipSync, async address => {
      await expect(read((_url, options) => fetch(address, options))).rejects.toMatchObject({ code: 'LIMIT_EXCEEDED' });
    });
  });
  it('rejects incomplete identity bodies even when partial content is valid JSON', async () => {
    const request: typeof fetch = async () => new Response('{}', { headers: { 'Content-Type': 'application/json', 'Content-Length': '100', 'Content-Encoding': 'identity' } });
    await expect(read(request)).rejects.toThrow('incomplete response');
  });
});
