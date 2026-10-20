import { describe, expect, it, vi } from 'vitest';
import {
  CentrifugoRealtimeTransport,
  CentrifugoApiError,
  CentrifugoAuthError,
  CentrifugoNetworkError,
  CentrifugoTimeoutError,
} from '../centrifugo-transport';
import { type RealtimeEventEnvelope } from '@/src/server/domain/messaging/contracts';

const sampleEnvelope: RealtimeEventEnvelope = {
  eventId: 'evt-test-1',
  schemaVersion: 1,
  type: 'message.created',
  streamId: 'stream-1',
  sequence: 42,
  generation: 1,
  occurredAt: '2026-10-20T12:00:00.000Z',
  payload: { text: 'test payload' },
};

describe('CentrifugoRealtimeTransport Server API Adapter', () => {
  it('successfully publishes event to Centrifugo channel', async () => {
    let capturedUrl = '';
    let capturedOptions: any = null;

    const mockFetch = vi.fn(async (url: string, options: any) => {
      capturedUrl = url;
      capturedOptions = options;
      return new Response(JSON.stringify({ result: {} }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    });

    const transport = new CentrifugoRealtimeTransport({
      apiUrl: 'http://centrifugo.internal:8000/api',
      apiKey: 'valid-test-key-123',
      fetchFn: mockFetch as unknown as typeof fetch,
    });

    await transport.publish('community:chan-1:g1', sampleEnvelope);

    expect(capturedUrl).toBe('http://centrifugo.internal:8000/api/publish');
    expect(capturedOptions.method).toBe('POST');
    expect(capturedOptions.headers['Authorization']).toBe('apikey valid-test-key-123');
    expect(capturedOptions.headers['Content-Type']).toBe('application/json');

    const body = JSON.parse(capturedOptions.body);
    expect(body.channel).toBe('community:chan-1:g1');
    expect(body.data).toEqual(sampleEnvelope);
  });

  it('detects and throws CentrifugoApiError when HTTP status is 200 but body contains error', async () => {
    const mockFetch = vi.fn(async () => {
      return new Response(
        JSON.stringify({
          error: {
            code: 102,
            message: 'namespace not found',
          },
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    });

    const transport = new CentrifugoRealtimeTransport({
      apiUrl: 'http://localhost:8000/api',
      apiKey: 'test-key',
      fetchFn: mockFetch as unknown as typeof fetch,
    });

    await expect(transport.publish('unknown:123', sampleEnvelope)).rejects.toThrow(CentrifugoApiError);

    try {
      await transport.publish('unknown:123', sampleEnvelope);
    } catch (err: any) {
      expect(err).toBeInstanceOf(CentrifugoApiError);
      expect(err.code).toBe(102);
      expect(err.message).toContain('namespace not found');
    }
  });

  it('throws CentrifugoAuthError on HTTP 401 or 403', async () => {
    const mockFetch = vi.fn(async () => {
      return new Response('Unauthorized', { status: 401 });
    });

    const transport = new CentrifugoRealtimeTransport({
      apiUrl: 'http://localhost:8000/api',
      apiKey: 'invalid-key',
      fetchFn: mockFetch as unknown as typeof fetch,
    });

    await expect(transport.publish('community:1:g1', sampleEnvelope)).rejects.toThrow(CentrifugoAuthError);
  });

  it('throws CentrifugoAuthError immediately if apiKey is missing', async () => {
    const transport = new CentrifugoRealtimeTransport({
      apiUrl: 'http://localhost:8000/api',
      apiKey: '',
    });

    await expect(transport.publish('community:1:g1', sampleEnvelope)).rejects.toThrow(CentrifugoAuthError);
  });

  it('throws CentrifugoTimeoutError on request timeout', async () => {
    const mockFetch = vi.fn(async () => {
      const err = new Error('The operation was aborted');
      err.name = 'TimeoutError';
      throw err;
    });

    const transport = new CentrifugoRealtimeTransport({
      apiUrl: 'http://localhost:8000/api',
      apiKey: 'test-key',
      timeoutMs: 100,
      fetchFn: mockFetch as unknown as typeof fetch,
    });

    await expect(transport.publish('community:1:g1', sampleEnvelope)).rejects.toThrow(CentrifugoTimeoutError);
  });

  it('throws CentrifugoNetworkError on HTTP 500 error', async () => {
    const mockFetch = vi.fn(async () => {
      return new Response('Internal Server Error', { status: 500, statusText: 'Internal Server Error' });
    });

    const transport = new CentrifugoRealtimeTransport({
      apiUrl: 'http://localhost:8000/api',
      apiKey: 'test-key',
      fetchFn: mockFetch as unknown as typeof fetch,
    });

    await expect(transport.publish('community:1:g1', sampleEnvelope)).rejects.toThrow(CentrifugoNetworkError);
  });

  it('supports administrative commands: unsubscribe, disconnect, presence, history', async () => {
    const calledMethods: string[] = [];

    const mockFetch = vi.fn(async (url: string) => {
      const method = url.split('/').pop()!;
      calledMethods.push(method);
      if (method === 'presence') {
        return new Response(JSON.stringify({ result: { presence: { 'client-1': { user: 'user-1' } } } }));
      }
      if (method === 'history') {
        return new Response(JSON.stringify({ result: { publications: [{ offset: 1 }] } }));
      }
      return new Response(JSON.stringify({ result: {} }));
    });

    const transport = new CentrifugoRealtimeTransport({
      apiUrl: 'http://localhost:8000/api',
      apiKey: 'admin-key',
      fetchFn: mockFetch as unknown as typeof fetch,
    });

    await transport.unsubscribe('room:1:g1', 'user-1');
    await transport.disconnect('user-1');
    const presence = await transport.presence('room:1:g1');
    const history = await transport.history('room:1:g1');

    expect(calledMethods).toEqual(['unsubscribe', 'disconnect', 'presence', 'history']);
    expect(presence).toHaveProperty('presence');
    expect(history).toHaveLength(1);
  });
});
