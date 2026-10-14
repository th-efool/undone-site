import { parentPort, workerData } from 'node:worker_threads';
// Isolated parser only. The existing extractor enables neither scripts nor resource loading.
try {
  const { extractWebResponse } = await import('../cohort-creation/materials/web-extraction.ts');
  const result = extractWebResponse(new Uint8Array(workerData.bytes),workerData.receipt);
  parentPort.postMessage({text:result.text,scope:result.web.scope});
} catch(error) {
  parentPort.postMessage({error:error?.code==='LIMIT_EXCEEDED' ? 'SOURCE_LIMIT_EXCEEDED' : 'WEB_SOURCE_REJECTED'});
}
