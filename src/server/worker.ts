import http from 'http';
import { WebSocketServer } from 'ws';
import { connectToMongoDB } from './infrastructure/db/mongodb/client';
import { runCohortVectorizationWorkflow, WorkflowInput } from './infrastructure/workflows/cohortVectorizationWorkflow';
import { hocuspocus } from './infrastructure/sync/hocuspocus';

const PORT = Number(process.env.PORT) || 4001;
const WORKER_SECRET = process.env.WORKER_SECRET || '';

async function handleRequest(req: http.IncomingMessage, res: http.ServerResponse) {
  if (req.method !== 'POST' || req.url !== '/run') {
    res.writeHead(404).end('Not found');
    return;
  }

  const auth = req.headers['authorization'] || '';
  if (WORKER_SECRET && auth !== ('Bearer ' + WORKER_SECRET)) {
    res.writeHead(401).end('Unauthorized');
    return;
  }

  let body = '';
  req.on('data', (chunk) => { body += chunk; });
  req.on('end', async () => {
    try {
      const input: WorkflowInput = JSON.parse(body);
      console.log('[Worker] Starting workflow for cohort: ' + input.cohortId);
      const result = await runCohortVectorizationWorkflow(input);
      console.log('[Worker] Done: ' + input.cohortId + ' chunks: ' + result.chunksProcessed);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(result));
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      console.error('[Worker] Failed:', message);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: message }));
    }
  });
}

async function main() {
  await connectToMongoDB();
  console.log('[Worker] MongoDB connected');
  const server = http.createServer(handleRequest);
  
  const wss = new WebSocketServer({ noServer: true });
  server.on('upgrade', (req, socket, head) => {
    if (!req.url?.startsWith('/')) {
      socket.destroy();
      return;
    }
    
    socket.on('error', (err) => console.error('[Worker] Socket error:', err));
    
    wss.handleUpgrade(req, socket, head, (ws: any) => {
      ws.on('error', (err: any) => console.error('[Worker] WS error:', err));
      const client: any = hocuspocus.handleConnection(ws, req as any);
      ws.on('message', (message: any) => client?.handleMessage?.(message));
      ws.on('close', () => client?.handleClose?.());
    });
  });

  const shutdown = async () => {
    console.log('[Worker] Shutting down, flushing stores...');
    if ((hocuspocus as any).destroy) {
      await (hocuspocus as any).destroy();
    }
    process.exit(0);
  };
  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);

  server.listen(PORT, '0.0.0.0', () => {
    console.log('[Worker] Listening on port ' + PORT);
  });
}

main().catch((err) => {
  console.error('[Worker] Fatal startup error:', err);
  process.exit(1);
});
