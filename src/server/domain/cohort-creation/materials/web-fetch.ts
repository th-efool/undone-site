import 'server-only';
import { lookup } from 'node:dns/promises';
import { Agent, request } from 'node:https';
import { BlockList, isIP } from 'node:net';
import type { IncomingHttpHeaders } from 'node:http';
import { CREATION_STORAGE_LIMITS, CreationStorageError } from '@/src/server/infrastructure/storage/creation.contracts';

type Address = { address: string; family: number };
export interface WebResponse {
  status: number; headers: IncomingHttpHeaders; bytes: AsyncIterable<Uint8Array>; close(): void;
}
export interface WebTransport {
  resolve(hostname: string): Promise<Address[]>;
  open(url: URL, address: Address, signal: AbortSignal): Promise<WebResponse>;
}
const denied = new BlockList();
for (const [address, prefix] of [
  ['0.0.0.0', 8], ['10.0.0.0', 8], ['100.64.0.0', 10], ['127.0.0.0', 8], ['169.254.0.0', 16],
  ['172.16.0.0', 12], ['192.0.0.0', 24], ['192.0.2.0', 24], ['192.88.99.0', 24], ['192.168.0.0', 16],
  ['198.18.0.0', 15], ['198.51.100.0', 24], ['203.0.113.0', 24], ['224.0.0.0', 3],
] as const) denied.addSubnet(address, prefix, 'ipv4');
// IPv6 only permits global unicast, excluding special/tunnel/documentation allocations.
const global6 = new BlockList(); global6.addSubnet('2000::', 3, 'ipv6');
for (const [address, prefix] of [['2001::', 23], ['2001:db8::', 32], ['2002::', 16], ['3fff::', 20]] as const) {
  denied.addSubnet(address, prefix, 'ipv6');
}
export function isPublicWebAddress(address: string) {
  const family = isIP(address);
  return family === 4 ? !denied.check(address, 'ipv4') : family === 6 && global6.check(address, 'ipv6') && !denied.check(address, 'ipv6');
}
function invalid(message: string): never { throw new CreationStorageError('INVALID_INPUT', message); }
export function webSourceUrl(input: string): URL {
  if (input.length > 2048 || /[\u0000-\u0020\u007f\\]/.test(input)) invalid('Provide a valid public HTTPS URL.');
  let url: URL;
  try { url = new URL(input); } catch { return invalid('Provide a valid public HTTPS URL.'); }
  if (url.protocol !== 'https:' || url.username || url.password || url.port) invalid('Use public HTTPS without credentials or custom ports.');
  const host = url.hostname.replace(/^\[|\]$/g, '');
  if (isIP(host)) { if (!isPublicWebAddress(host)) invalid('Private or reserved destinations are not supported.'); }
  else if (!host.includes('.') || /\.$/.test(host) || /(?:^|\.)(localhost|local|internal|test|invalid|example)$/.test(host)) invalid('Provide a public hostname.');
  url.hash = ''; return url;
}

export const nodeWebTransport: WebTransport = {
  resolve: hostname => lookup(hostname, { all: true, verbatim: true }),
  open(url, address, signal) {
    return new Promise((resolve, reject) => {
      const agent = new Agent({ keepAlive: false, lookup: (_hostname, options, callback) => {
        if (options.all) callback(null, [address]); else callback(null, address.address, address.family);
      } });
      const outgoing = request(url, { agent, signal, family: address.family,
        maxHeaderSize: 16 * 1024, headers: { Accept: 'text/html, text/plain, text/markdown',
          'Accept-Encoding': 'identity', 'User-Agent': 'SideQuestHQ-Material/1.0' } }, incoming => {
        const pin = new BlockList(); pin.addAddress(address.address, address.family === 4 ? 'ipv4' : 'ipv6');
        const remote = incoming.socket.remoteAddress;
        if (!remote || !pin.check(remote, isIP(remote) === 4 ? 'ipv4' : 'ipv6')) {
          incoming.destroy(); agent.destroy(); reject(new CreationStorageError('INVALID_INPUT', 'The destination address changed.')); return;
        }
        resolve({ status: incoming.statusCode ?? 0, headers: incoming.headers, bytes: incoming,
          close: () => { incoming.destroy(); outgoing.destroy(); agent.destroy(); } });
      });
      outgoing.on('error', error => { agent.destroy(); reject(error); }); outgoing.end();
    });
  },
};

async function abortable<T>(promise: Promise<T>, signal: AbortSignal): Promise<T> {
  signal.throwIfAborted();
  let abort!: () => void;
  const interrupted = new Promise<never>((_resolve, reject) => {
    abort = () => reject(signal.reason); signal.addEventListener('abort', abort, { once: true });
  });
  try { return await Promise.race([promise, interrupted]); }
  finally { signal.removeEventListener('abort', abort); }
}

/** Returns a single-use bounded stream; caller must close even if storage refuses it. */
export async function openWebSource(input: string, callerSignal?: AbortSignal, transport: WebTransport = nodeWebTransport) {
  const signal = AbortSignal.any([callerSignal ?? new AbortController().signal, AbortSignal.timeout(30_000)]);
  const requestedUrl = webSourceUrl(input).href; let url = webSourceUrl(input);
  const redirects: string[] = []; const visited = new Set<string>();
  try {
    while (true) {
      signal.throwIfAborted();
      if (visited.has(url.href)) invalid('Redirect loop detected.'); visited.add(url.href);
      const host = url.hostname.replace(/^\[|\]$/g, '');
      const addresses = isIP(host) ? [{ address: host, family: isIP(host) }] : await abortable(transport.resolve(host), signal);
      if (!addresses.length || addresses.length > 16 || addresses.some(item => isIP(item.address) !== item.family || !isPublicWebAddress(item.address))) {
        invalid('The destination resolves to an unsupported address.');
      }
      signal.throwIfAborted();
      const response = await transport.open(url, addresses[0], signal);
      try {
        if ([301, 302, 303, 307, 308].includes(response.status)) {
          if (redirects.length >= 3 || !response.headers.location) invalid('Redirect limit or missing destination.');
          url = webSourceUrl(new URL(response.headers.location, url).href); redirects.push(url.href); continue;
        }
        if (response.status !== 200) throw new CreationStorageError('UNAVAILABLE', 'The source could not be downloaded. Upload or paste accessible content.');
        const contentType = response.headers['content-type'] ?? '';
        const mediaType = contentType.split(';')[0].trim().toLowerCase();
        if (!['text/html', 'text/plain', 'text/markdown', 'text/x-markdown'].includes(mediaType)) invalid('This adapter accepts HTML, text or Markdown only.');
        const charset = /;\s*charset\s*=\s*["']?([^;"'\s]+)/i.exec(contentType)?.[1].toLowerCase();
        if (charset && !['utf-8', 'utf8', 'us-ascii'].includes(charset)) invalid('Use UTF-8 source content or upload converted text.');
        if (response.headers['content-encoding'] && response.headers['content-encoding'].toLowerCase() !== 'identity') invalid('Compressed responses are not supported. Upload or paste the source.');
        const length = response.headers['content-length'];
        if (length && (!/^\d+$/.test(length) || !Number.isSafeInteger(Number(length)))) invalid('Invalid source content length.');
        if (length && Number(length) > CREATION_STORAGE_LIMITS.fileBytes) throw new CreationStorageError('LIMIT_EXCEEDED', 'Source exceeds 25 MiB. Select a smaller source; nothing was truncated.');
        async function* bytes() {
          let count = 0;
          try {
            for await (const chunk of response.bytes) {
              signal.throwIfAborted();
              if (!(chunk instanceof Uint8Array)) throw new CreationStorageError('INTEGRITY', 'The response contains invalid byte chunks.');
              count += chunk.byteLength;
              if (count > CREATION_STORAGE_LIMITS.fileBytes) throw new CreationStorageError('LIMIT_EXCEEDED', 'Source exceeds 25 MiB. Nothing was truncated.');
              yield chunk;
            }
            signal.throwIfAborted();
            if (!count || (length !== undefined && count !== Number(length))) throw new CreationStorageError('INTEGRITY', 'The source response was empty or incomplete.');
          } catch (error) {
            signal.throwIfAborted();
            if (error instanceof CreationStorageError) throw error;
            throw new CreationStorageError('UNAVAILABLE', 'The source download was interrupted. Retry or upload accessible content.');
          } finally { response.close(); }
        }
        return { requestedUrl, finalUrl: url.href, redirects, mediaType, signal, bytes: bytes(), close: response.close };
      } catch (error) { response.close(); throw error; }
      finally { if ([301, 302, 303, 307, 308].includes(response.status)) response.close(); }
    }
  } catch (error) {
    signal.throwIfAborted();
    if (error instanceof CreationStorageError) throw error;
    throw new CreationStorageError('UNAVAILABLE', 'The source connection failed. Retry or upload accessible content.');
  }
}
