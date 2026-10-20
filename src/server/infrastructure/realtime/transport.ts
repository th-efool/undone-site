import { type RealtimeEventEnvelope } from '@/src/server/domain/messaging/contracts';
import { CentrifugoRealtimeTransport } from './centrifugo-transport';

export interface RealtimeTransport {
  publish(destination: string, event: RealtimeEventEnvelope): Promise<void>;
  close?(): Promise<void>;
}

export class InMemoryRealtimeTransport implements RealtimeTransport {
  public published: Array<{ destination: string; event: RealtimeEventEnvelope }> = [];
  private failNextCount = 0;
  private failErrorMessage = 'Simulated transport failure';

  async publish(destination: string, event: RealtimeEventEnvelope): Promise<void> {
    if (this.failNextCount > 0) {
      this.failNextCount--;
      throw new Error(this.failErrorMessage);
    }
    this.published.push({ destination, event });
  }

  simulateFailure(times = 1, message = 'Simulated transport failure'): void {
    this.failNextCount = times;
    this.failErrorMessage = message;
  }

  getPublishedEvents(destination?: string): RealtimeEventEnvelope[] {
    if (destination) {
      return this.published.filter(p => p.destination === destination).map(p => p.event);
    }
    return this.published.map(p => p.event);
  }

  clear(): void {
    this.published = [];
    this.failNextCount = 0;
  }

  async close(): Promise<void> {
    // No-op for in-memory
  }
}

export const defaultRealtimeTransport: RealtimeTransport = new InMemoryRealtimeTransport();

export function getRealtimeTransport(): RealtimeTransport {
  if (process.env.CENTRIFUGO_API_KEY && process.env.CENTRIFUGO_API_URL) {
    return new CentrifugoRealtimeTransport();
  }
  return defaultRealtimeTransport;
}
