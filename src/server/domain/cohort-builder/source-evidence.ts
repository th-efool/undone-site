import type { CohortWorkspace } from '@/src/shared/cohort-builder/contracts';
import { sha256 } from '@/src/shared/cohort-builder/hash';
import { readTextArtifact, type TextArtifactSql } from './text-artifacts';
import { planTextJobs } from './text-job-plan';

/** Re-derive external evidence from owned accepted input, never from model text. */
export async function validateRetainedSourceEvidence(sql: TextArtifactSql, workspaceId: string, state: CohortWorkspace, reparse = true) {
  if (!state.sources.some(source => source.input)) return;
  const { extractRetainedSource, sourceExtractionSchema } = await import('./source-adapters');
  const plan = planTextJobs(state);
  for (const source of state.sources.filter(item => item.input)) {
    // Client-extracted sources have ready text + locations directly without server artifact IDs
    if (!source.retainedInputId) {
      if (!source.text || !source.locations || !source.checksum) throw new Error('MISSING_RETAINED_EXTRACTION');
      if (sha256(source.text) !== source.checksum) throw new Error('FABRICATED_SOURCE_EXTRACTION');
      sourceExtractionSchema.parse({
        format: 'cohort-extraction-v1',
        text: source.text,
        locations: source.locations,
        provenance: source.provenance ?? {
          extractedAt: new Date().toISOString(),
          parserVersion: 'client-v1',
          contentOrigin: 'external',
          rawChecksum: source.checksum,
          scope: 'full_text_response',
        },
      });
      continue;
    }

    if (!source.extractionId) throw new Error('MISSING_RETAINED_EXTRACTION');
    for (const stage of ['acquisition', 'extraction'] as const) {
      const intent = plan.find(item => item.sourceId === source.id && item.stage === stage)!;
      const row = (await sql.query(`SELECT "resultArtifactId" FROM "cohort_text_jobs" WHERE "workspaceId"=$1 AND "jobKey"=$2 AND "status"='accepted'`, [workspaceId, intent.jobKey])).rows[0];
      if (row?.resultArtifactId !== (stage === 'acquisition' ? source.retainedInputId : source.extractionId)) throw new Error('FOREIGN_RETAINED_EXTRACTION');
    }
    const raw = await readTextArtifact(sql, workspaceId, source.retainedInputId);
    const extracted = await readTextArtifact(sql, workspaceId, source.extractionId);
    if (raw.ref.kind !== 'source_raw' || extracted.ref.kind !== 'extraction' ||
      [raw.ref, extracted.ref].some(ref => ref.sourceId !== source.id || ref.sourceVersion !== source.version)) throw new Error('FOREIGN_RETAINED_EXTRACTION');
    const actual = sourceExtractionSchema.parse(JSON.parse(extracted.bytes.toString('utf8')));
    // Under the canonical lock, a preflight source proof allows cheap immutable
    // artifact checks only. Never run many PDF/HTML parsers while holding it.
    const expected = reparse ? await extractRetainedSource(source, raw.ref, raw.bytes) : actual;
    if (actual.provenance.rawChecksum !== raw.ref.checksum) throw new Error('FABRICATED_SOURCE_EXTRACTION');
    if (JSON.stringify(actual) !== JSON.stringify(expected) || source.text !== expected.text ||
      JSON.stringify(source.locations) !== JSON.stringify(expected.locations) ||
      JSON.stringify(source.provenance) !== JSON.stringify(expected.provenance)) throw new Error('FABRICATED_SOURCE_EXTRACTION');
  }
}
