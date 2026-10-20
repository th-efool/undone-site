import { type RealtimeEventEnvelope } from '@/src/server/domain/messaging/contracts';
import { type RealtimeTransport } from './transport';

export class CentrifugoError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CentrifugoError';
  }
}

export class CentrifugoAuthError extends CentrifugoError {
  constructor(message = 'Unauthorized: invalid or missing Centrifugo API key') {
    super(message);
    this.name = 'CentrifugoAuthError';
  }
}

export class CentrifugoTimeoutError extends CentrifugoError {
  constructor(message = 'Centrifugo server API request timed out') {
    super(message);
    this.name = 'CentrifugoTimeoutError';
  }
}

export class CentrifugoApiError extends CentrifugoError {
  public code: number;
  constructor(code: number, message: string) {
    super(`Centrifugo API error [${code}]: ${message}`);
    this.name = 'CentrifugoApiError';
    this.code = code;
  }
}

export class CentrifugoNetworkError extends CentrifugoError {
  public status?: number;
  constructor(message: string, status?: number) {
    super(message);
    this.name = 'CentrifugoNetworkError';
    this.status = status;
  }
}

export interface CentrifugoTransportOptions {
  apiUrl?: string;
  apiKey?: string;
  timeoutMs?: number;
  fetchFn?: typeof fetch;
}

export class CentrifugoRealtimeTransport implements RealtimeTransport {
  private apiUrl: string;
  private apiKey: string;
  private timeoutMs: number;
  private fetchFn: typeof fetch;

  constructor(options: CentrifugoTransportOptions = {}) {
    this.apiUrl = (options.apiUrl ?? process.env.CENTRIFUGO_API_URL ?? 'http://localhost:8000/api').replace(/\/+$/, '');
    this.apiKey = options.apiKey ?? process.env.CENTRIFUGO_API_KEY ?? '';
    this.timeoutMs = options.timeoutMs ?? 3000;
    this.fetchFn = options.fetchFn ?? globalThis.fetch;
  }

  private async executeCommand<TResponse = unknown>(
    method: string,
    params: Record<string, unknown>
  ): Promise<TResponse> {
    if (!this.apiKey) {
      throw new CentrifugoAuthError('CENTRIFUGO_API_KEY is not configured');
    }

    const endpoint = `${this.apiUrl}/${method}`;
    let response: Response;

    try {
      response = await this.fetchFn(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `apikey ${this.apiKey}`,
        },
        body: JSON.stringify(params),
        signal: AbortSignal.timeout(this.timeoutMs),
      });
    } catch (err: any) {
      if (err.name === 'TimeoutError' || err.code === 23) {
        throw new CentrifugoTimeoutError(`Centrifugo command '${method}' timed out after ${this.timeoutMs}ms`);
      }
      throw new CentrifugoNetworkError(`Network failure communicating with Centrifugo: ${err.message}`);
    }

    if (response.status === 401 || response.status === 403) {
      throw new CentrifugoAuthError(`Centrifugo rejected API key with status ${response.status}`);
    }

    if (!response.ok) {
      throw new CentrifugoNetworkError(
        `Centrifugo returned HTTP ${response.status}: ${response.statusText}`,
        response.status
      );
    }

    let resultJson: any;
    try {
      resultJson = await response.json();
    } catch (parseErr: any) {
      throw new CentrifugoNetworkError(`Failed to parse Centrifugo JSON response: ${parseErr.message}`);
    }

    // Centrifugo protocol returns HTTP 200 with an error object on API violations
    if (resultJson && typeof resultJson === 'object' && resultJson.error) {
      const { code, message } = resultJson.error;
      throw new CentrifugoApiError(code ?? 0, message ?? 'Unknown Centrifugo API error');
    }

    return (resultJson?.result ?? resultJson) as TResponse;
  }

  /**
   * Publishes a committed event envelope to a destination channel.
   */
  async publish(destination: string, event: RealtimeEventEnvelope): Promise<void> {
    await this.executeCommand('publish', {
      channel: destination,
      data: event,
    });
  }

  /**
   * Unsubscribes a user from a specific channel across all active connections.
   */
  async unsubscribe(channel: string, user: string): Promise<void> {
    await this.executeCommand('unsubscribe', {
      channel,
      user,
    });
  }

  /**
   * Disconnects a user across all active connections (e.g. account suspension or logout).
   */
  async disconnect(user: string): Promise<void> {
    await this.executeCommand('disconnect', {
      user,
    });
  }

  /**
   * Fetches presence information for a channel.
   */
  async presence(channel: string): Promise<Record<string, unknown>> {
    return this.executeCommand('presence', { channel });
  }

  /**
   * Fetches channel history from Centrifugo short cache.
   */
  async history(channel: string, limit = 50): Promise<unknown[]> {
    const res = await this.executeCommand<{ publications?: unknown[] }>('history', {
      channel,
      limit,
    });
    return res?.publications ?? [];
  }

  async close(): Promise<void> {
    // No persistent connection pool required for HTTP server API
  }
}
