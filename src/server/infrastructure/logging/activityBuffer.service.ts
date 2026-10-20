export interface UserActivityEvent {
  userId: string;
  eventType: string; // e.g. 'LESSON_VIEW', 'SEARCH', 'PREF_UPDATE', 'HEARTBEAT'
  entityId: string;
  metadata?: Record<string, any>;
  timestamp?: number;
}

export type ActivitySink = (events: UserActivityEvent[]) => Promise<void> | void;

export interface ActivityBufferOptions {
  maxBufferSize?: number;
  flushIntervalMs?: number;
  debounceWindowMs?: number;
  sink?: ActivitySink;
}

export class ActivityBufferService {
  private events: UserActivityEvent[] = [];
  private eventIndexMap: Map<string, number> = new Map();
  private readonly maxBufferSize: number;
  private readonly flushIntervalMs: number;
  private readonly debounceWindowMs: number;
  private timer: NodeJS.Timeout | null = null;
  private sink?: ActivitySink;

  constructor(options: ActivityBufferOptions = {}) {
    this.maxBufferSize = options.maxBufferSize ?? 50;
    this.flushIntervalMs = options.flushIntervalMs ?? 3000;
    this.debounceWindowMs = options.debounceWindowMs ?? 3000;
    this.sink = options.sink;
  }

  public setSink(sink?: ActivitySink): void {
    this.sink = sink;
  }

  private ensureTimer(): void {
    if (!this.timer && this.flushIntervalMs > 0) {
      this.timer = setInterval(() => {
        void this.flush();
      }, this.flushIntervalMs);
      if (typeof this.timer === 'object' && 'unref' in this.timer) {
        this.timer.unref();
      }
    }
  }

  public record(event: UserActivityEvent): void {
    if (!event || !event.userId || !event.eventType || !event.entityId) {
      return;
    }

    this.ensureTimer();

    const now = event.timestamp ?? Date.now();
    const key = `${event.userId}:${event.eventType}:${event.entityId}`;
    const existingIndex = this.eventIndexMap.get(key);

    if (existingIndex !== undefined && existingIndex < this.events.length) {
      const existing = this.events[existingIndex];
      const timeDiff = Math.abs(now - (existing.timestamp ?? now));
      if (timeDiff <= this.debounceWindowMs) {
        existing.timestamp = now;
        if (event.metadata !== undefined) {
          existing.metadata = {
            ...(existing.metadata ?? {}),
            ...event.metadata,
          };
        }
        return;
      }
    }

    const storedEvent: UserActivityEvent = {
      userId: event.userId,
      eventType: event.eventType,
      entityId: event.entityId,
      metadata: event.metadata ? { ...event.metadata } : undefined,
      timestamp: now,
    };

    this.events.push(storedEvent);
    this.eventIndexMap.set(key, this.events.length - 1);

    if (this.events.length >= this.maxBufferSize) {
      void this.flush();
    }
  }

  public async flush(): Promise<number> {
    if (this.events.length === 0) {
      return 0;
    }

    const batch = this.events;
    this.events = [];
    this.eventIndexMap.clear();

    try {
      if (this.sink) {
        await this.sink(batch);
      } else {
        if (process.env.NODE_ENV !== 'production' && process.env.NODE_ENV !== 'test') {
          console.debug(`[ActivityBuffer] Flushed ${batch.length} events`);
        }
      }
      return batch.length;
    } catch (err) {
      console.error('[ActivityBuffer] Error flushing activity buffer batch:', err);
      return 0;
    }
  }

  public getBufferSize(): number {
    return this.events.length;
  }

  public getEvents(): readonly UserActivityEvent[] {
    return [...this.events];
  }

  public clear(): void {
    this.events = [];
    this.eventIndexMap.clear();
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }
}

export const activityBuffer = new ActivityBufferService();
