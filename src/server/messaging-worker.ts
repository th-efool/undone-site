import 'server-only';
import { randomUUID } from 'node:crypto';
import { prisma } from './infrastructure/db/postgres/client';
import { MessagingOutboxDispatcher } from './infrastructure/realtime/dispatcher';
import { defaultRealtimeTransport, type RealtimeTransport } from './infrastructure/realtime/transport';

export interface MessagingWorkerOptions {
  workerId?: string;
  pollIntervalMs?: number;
  leaseDurationMs?: number;
  heartbeatIntervalMs?: number;
  batchSize?: number;
  transport?: RealtimeTransport;
  maxIterations?: number;
}

export async function runMessagingWorkerLoop(
  options: MessagingWorkerOptions,
  signal: AbortSignal
): Promise<void> {
  const workerId = options.workerId ?? `messaging-worker-${randomUUID()}`;
  const pollIntervalMs = options.pollIntervalMs ?? 1000;
  const heartbeatIntervalMs = options.heartbeatIntervalMs ?? 15_000;
  const leaseDurationMs = options.leaseDurationMs ?? 30_000;
  const batchSize = options.batchSize ?? 20;
  const transport = options.transport ?? defaultRealtimeTransport;

  const dispatcher = new MessagingOutboxDispatcher({
    workerId,
    batchSize,
    leaseDurationMs,
  });

  let lastHeartbeat = Date.now();
  console.log(`[messaging-worker] Started worker ${workerId}`);

  let iterations = 0;
  while (!signal.aborted && (options.maxIterations === undefined || iterations++ < options.maxIterations)) {
    try {
      const now = Date.now();
      if (now - lastHeartbeat >= heartbeatIntervalMs) {
        console.log(`[messaging-worker] Heartbeat: ${workerId} active at ${new Date().toISOString()}`);
        lastHeartbeat = now;
      }

      const result = await dispatcher.dispatchBatch(transport, { batchSize });

      if (result.claimedCount > 0) {
        // More pending work may be waiting; yield shortly without full idle poll
        await new Promise(resolve => setTimeout(resolve, 50));
        continue;
      }

      // Idle poll wait
      await new Promise((resolve, reject) => {
        const timeout = setTimeout(resolve, pollIntervalMs);
        const onAbort = () => {
          clearTimeout(timeout);
          resolve(null);
        };
        signal.addEventListener('abort', onAbort, { once: true });
      });
    } catch (loopErr) {
      if (signal.aborted) break;
      console.error('[messaging-worker] Error in worker dispatch loop:', loopErr);
      await new Promise(resolve => setTimeout(resolve, pollIntervalMs));
    }
  }

  console.log(`[messaging-worker] Worker ${workerId} shut down gracefully.`);
}

async function main() {
  if (process.argv.includes('--check')) {
    console.log('Messaging worker imports and Node server condition are valid. No database connection opened.');
    await prisma.$disconnect();
    return;
  }

  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is required for the messaging worker.');
  }

  const shutdown = new AbortController();
  const stop = () => shutdown.abort(new Error('Messaging worker shutting down'));
  process.once('SIGTERM', stop);
  process.once('SIGINT', stop);

  try {
    await runMessagingWorkerLoop({}, shutdown.signal);
  } finally {
    process.removeListener('SIGTERM', stop);
    process.removeListener('SIGINT', stop);
    await Promise.all([
      prisma.$disconnect(),
      defaultRealtimeTransport.close?.(),
    ]);
  }
}

// Only invoke automatically when run as the process entrypoint
if (typeof process !== 'undefined' && process.argv[1]?.includes('messaging-worker')) {
  void main().catch(err => {
    console.error('[messaging-worker] Fatal error:', err);
    process.exitCode = 1;
  });
}
