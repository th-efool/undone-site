/** Live public source checks; extracted bytes stay in memory, no durable storage claim. */
import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import { YoutubeMetadataReader } from '../src/server/domain/cohort-creation/materials/youtube-metadata';
import { openWebSource } from '../src/server/domain/cohort-creation/materials/web-fetch';
import { extractWebResponse } from '../src/server/domain/cohort-creation/materials/web-extraction';
import { VercelMaterialObservation } from '../src/server/infrastructure/ai/vercelMaterialObservation';
import { createCohortModel } from '../src/server/infrastructure/ai/modelRegistry';
import { webResponseReceiptSchema } from '../src/shared/cohort-creation/web';

const mode = process.argv[2] ?? 'web';
let stage = 'configuration';
async function main() {
  assert.ok(['web', 'youtube', 'video'].includes(mode));
  const signal = AbortSignal.timeout(100_000);
  if (mode === 'web') {
    stage = 'public fetch';
    const opened = await openWebSource('https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Functions', signal);
    try {
      const chunks: Uint8Array[] = [];
      for await (const chunk of opened.bytes) chunks.push(chunk);
      const bytes = Buffer.concat(chunks);
      stage = 'article extraction';
      const artifact = extractWebResponse(bytes, webResponseReceiptSchema.parse({ schemaVersion: 1, materialId: randomUUID(), inputRevision: 0,
        requestedUrl: opened.requestedUrl, finalUrl: opened.finalUrl, redirects: opened.redirects, mediaType: opened.mediaType,
        retainedSource: { id: randomUUID(), kind: 'upload', checksum: createHash('sha256').update(bytes).digest('hex'), byteLength: bytes.length },
        fetchedAt: new Date().toISOString(), fetchVersion: 'public-https-pinned-v1' }), signal);
      assert.ok(artifact.segments.length > 0);
      console.log(JSON.stringify({ mode, status: 'passed', responseBytes: bytes.length, segments: artifact.segments.length,
        scope: artifact.web.scope, provenance: artifact.contentOrigin, persistence: 'none' }));
    } finally { opened.close(); }
  } else {
    stage = 'YouTube metadata';
    // Public 19-second video keeps the optional native video observation bounded.
    const metadata = await new YoutubeMetadataReader().read('https://www.youtube.com/watch?v=jNQXAC9IVRw', signal);
    assert.equal(metadata.units.length, 1);
    assert.equal(metadata.units[0].videoId, 'jNQXAC9IVRw');
    console.log(JSON.stringify({ stage, status: 'passed', videos: metadata.units.length, durationSeconds: metadata.units[0].durationSeconds }));
    if (mode === 'video') {
      stage = 'native video observation';
      let calls = 0;
      const observer = new VercelMaterialObservation(createCohortModel(), { beforeCall: async () => { assert.ok(++calls <= 2); } });
      const result = await observer.observeVideo(metadata.units[0], signal);
      console.log(JSON.stringify({ stage, status: 'passed', observations: result.observations.length, calls, provenance: 'AI observation, not transcript', persistence: 'none' }));
    }
  }
}
main().catch(error => {
  const code = error?.detail?.code ?? error?.code ?? error?.name ?? 'UNKNOWN';
  console.error(JSON.stringify({ status: 'failed', mode, stage, code: /^[A-Za-z_]{1,40}$/.test(code) ? code : 'UNKNOWN' }));
  process.exitCode = 1;
});
