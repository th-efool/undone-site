import { EventEmitter } from 'node:events';
import { Readable } from 'node:stream';
import type { RequestOptions, Agent } from 'node:https';
import { afterEach, describe, expect, it, vi } from 'vitest';
const { networkRequest } = vi.hoisted(() => ({ networkRequest: vi.fn() }));
vi.mock('server-only', () => ({}));
vi.mock('node:https', async original => ({ ...await original<typeof import('node:https')>(), request: networkRequest }));
import { nodeWebTransport } from '../materials/web-fetch';
afterEach(() => vi.resetAllMocks());
function mockResponse(remoteAddress: string) {
  const incoming = Object.assign(Readable.from([Buffer.from('lesson')]), {
    socket: { remoteAddress }, statusCode: 200, headers: { 'content-type': 'text/plain' },
  });
  const outgoing = Object.assign(new EventEmitter(), { destroy: vi.fn(), end: vi.fn() });
  networkRequest.mockImplementation((_url, _options, callback) => {
    outgoing.end.mockImplementation(() => queueMicrotask(() => callback(incoming))); return outgoing;
  });
  return { incoming, outgoing };
}
describe('Node HTTPS pinned transport', () => {
  it('pins custom lookup while retaining the original TLS hostname and abort signal', async () => {
    const f = mockResponse('93.184.215.14'); const signal = new AbortController().signal;
    const url = new URL('https://docs.example.com/lesson');
    const reply = await nodeWebTransport.open(url, { address: '93.184.215.14', family: 4 }, signal);
    const [destination, options] = networkRequest.mock.calls[0] as [URL, RequestOptions];
    expect(destination).toEqual(url); expect(options).toMatchObject({ signal, family: 4, maxHeaderSize: 16384 });
    expect(options).not.toHaveProperty('rejectUnauthorized', false);
    expect(options.headers).toEqual({ Accept: 'text/html, text/plain, text/markdown', 'Accept-Encoding': 'identity', 'User-Agent': 'SideQuestHQ-Material/1.0' });
    const agent = options.agent as Agent;
    const lookup = agent.options.lookup!; const callback = vi.fn();
    lookup('docs.example.com', { all: false }, callback);
    expect(callback).toHaveBeenLastCalledWith(null, '93.184.215.14', 4);
    lookup('docs.example.com', { all: true }, callback);
    expect(callback).toHaveBeenLastCalledWith(null, [{ address: '93.184.215.14', family: 4 }]);
    const destroyAgent = vi.spyOn(agent, 'destroy'); reply.close();
    expect(f.incoming.destroyed).toBe(true); expect(f.outgoing.destroy).toHaveBeenCalled(); expect(destroyAgent).toHaveBeenCalled();
  });
  it('rejects a connected address that does not match the pin', async () => {
    const f = mockResponse('127.0.0.1');
    await expect(nodeWebTransport.open(new URL('https://docs.example.com'), { address: '93.184.215.14', family: 4 }, new AbortController().signal)).rejects.toThrow('destination address changed');
    expect(f.incoming.destroyed).toBe(true);
  });
  it('accepts equivalent IPv6 notation without bypassing pin verification', async () => {
    const f = mockResponse('2606:4700:4700::1111');
    const reply = await nodeWebTransport.open(new URL('https://docs.example.com'), { address: '2606:4700:4700:0:0:0:0:1111', family: 6 }, new AbortController().signal);
    reply.close(); expect(f.incoming.destroyed).toBe(true);
  });
});
