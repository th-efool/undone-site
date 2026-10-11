/** Opt-in bounded live provider check. No database writes or private material. */
import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import { APICallError } from 'ai';
import { createCohortModel } from '../src/server/infrastructure/ai/modelRegistry';
import { VercelCohortAi } from '../src/server/infrastructure/ai/vercelCohortAi';
import { VercelCreationUnderstanding } from '../src/server/infrastructure/ai/vercelCreationUnderstanding';
import { VercelCreationChunking } from '../src/server/infrastructure/ai/vercelCreationChunking';
import { VercelResourceDiscovery } from '../src/server/infrastructure/ai/vercelResourceDiscovery';
import { learningIntentSchema } from '../src/shared/cohort-creation/contracts';
import { extractRetainedText } from '../src/server/domain/cohort-creation/materials/text';
import { normalizeProcessingInput, partitionProcessingInput } from '../src/server/domain/cohort-creation/processing-input';

let stage = 'configuration';
let calls = 0;
const started = Date.now();
const mode = process.argv[2] ?? 'intent';
async function main() {
  assert.ok(['intent', 'text', 'discovery'].includes(mode), 'Expected intent, text or discovery');
  const configuredModel = createCohortModel();
  assert.ok(typeof configuredModel !== 'string');
  assert.equal(configuredModel.specificationVersion, 'v4');
  if (configuredModel.specificationVersion !== 'v4') throw new Error('Expected installed V4 provider');
  const model = new Proxy(configuredModel, { get(target, property) {
    if (property !== 'doGenerate') return Reflect.get(target, property);
    return async (...args: Parameters<typeof target.doGenerate>) => {
      try {
        const result = await target.doGenerate(args[0]);
        console.log(JSON.stringify({ stage, providerFinish: typeof result.finishReason === 'string' ? result.finishReason : result.finishReason.unified,
          usage: result.usage }));
        return result;
      } catch (error) {
        if (APICallError.isInstance(error)) {
          let categories: string[] = [];
          try {
            const message = JSON.parse(error.responseBody ?? '{}')?.error?.message ?? '';
            categories = ['schema', 'maxItems', 'minItems', 'additionalProperties', 'too many', 'nesting', 'token', 'API key', 'quota', 'model', 'unsupported', 'complex', 'temperature']
              .filter(word => typeof message === 'string' && message.toLowerCase().includes(word.toLowerCase()));
          } catch { /* Diagnostics deliberately exclude response bodies. */ }
          // These inputs are public/local smoke material only. Select the error message,
          // redact environment values and URLs, and never log request headers/bodies.
          let diagnostic = error.message;
          for (const value of Object.values(process.env)) {
            if (value && value.length >= 8) diagnostic = diagnostic.replaceAll(value, '[redacted]');
          }
          diagnostic = diagnostic.replace(/https?:\/\/\S+/g, '[url]').slice(0, 500);
          console.error(JSON.stringify({ stage, providerHttpStatus: error.statusCode, categories, diagnostic }));
        }
        throw error;
      }
    };
  } });
  const beforeCall = async () => { assert.ok(++calls <= 6, 'Live smoke call limit reached'); };
  const signal = AbortSignal.timeout(150_000);
  const query = 'Learn beginner JavaScript variables and functions using official documentation.';
  stage = 'intent';
  const proposal = mode === 'intent' ? await new VercelCohortAi(model, { maxRetries: 0, beforeCall }).interpret(query, signal) : {
    topic: 'JavaScript variables and functions', outcomes: ['Understand variables and functions'], level: 'beginner', language: 'English', searchTerms: ['JavaScript variables functions MDN'], uncertainties: [],
  };
  const field = <T>(value: T) => ({ value, origin: 'ai' as const, acceptedRevision: 0 });
  const intent = learningIntentSchema.parse({ id: randomUUID(), rawQuery: query, revision: 0,
    topic: field(proposal.topic), outcomes: field(proposal.outcomes), level: proposal.level ? field(proposal.level) : null,
    language: proposal.language ? field(proposal.language) : null, searchTerms: proposal.searchTerms, uncertainties: proposal.uncertainties });
  console.log(JSON.stringify({ stage, status: mode === 'intent' ? 'passed' : 'local smoke input', model: model.modelId, calls }));
  if (mode === 'discovery') {
    stage = 'grounded discovery';
    const result = await new VercelResourceDiscovery(model, { beforeCall }).search(intent, signal);
    assert.ok(result.citations.length > 0, 'No grounded citations returned');
    console.log(JSON.stringify({ stage, status: 'passed', citations: result.citations.length, attribution: Boolean(result.attribution), calls }));
  }
  if (mode === 'text') {
    // Explicit locally authored source: real retained bytes, no external provenance claim.
    const bytes = Buffer.from('# Variables\nUse const for a binding that is not reassigned. Use let when reassignment is needed.\n\n# Functions\nA function groups reusable statements. Parameters accept input and return supplies a result.\n');
    const materialId = randomUUID();
    const ref = { id: randomUUID(), kind: 'upload' as const, checksum: createHash('sha256').update(bytes).digest('hex'), byteLength: bytes.length };
    const body = extractRetainedText(bytes, ref, materialId, materialId);
    const units = normalizeProcessingInput({ id: materialId, kind: 'markdown', input: { kind: 'upload', assetId: ref.id }, selectedUnitIds: [materialId], status: 'ready' },
      { materialId, version: body.version, checksum: ref.checksum, artifactRef: randomUUID(), extractionKind: 'text', segmentCount: body.segments.length, complete: true }, body);
    const partition = partitionProcessingInput(units)[0];
    stage = 'understanding';
    const understanding = await new VercelCreationUnderstanding(model, { beforeCall }).understand(intent, partition, signal);
    console.log(JSON.stringify({ stage, status: 'passed', concepts: understanding.concepts.length, calls }));
    stage = 'chunking';
    const chunking = await new VercelCreationChunking(model, { beforeCall }).chunk(intent, partition, understanding, signal);
    console.log(JSON.stringify({ stage, status: 'passed', chunks: chunking.chunks.length, calls }));
  }
  console.log(JSON.stringify({ status: 'passed', mode, calls, elapsedMs: Date.now() - started, persistence: 'none' }));
}
main().catch(error => {
  // Never emit raw SDK errors: they can contain credentials, prompts and response bodies.
  const code = error?.detail?.code ?? error?.name ?? 'UNKNOWN';
  console.error(JSON.stringify({ status: 'failed', stage, mode, calls, elapsedMs: Date.now() - started,
    code: /^[A-Z_a-z]{1,40}$/.test(code) ? code : 'UNKNOWN' }));
  process.exitCode = 1;
});
