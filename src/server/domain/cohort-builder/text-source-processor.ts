import { cohortChunkSchema, cohortWorkspaceSchema, type CohortWorkspace } from '@/src/shared/cohort-builder/contracts';
import { readTextArtifact, type CohortTextArtifactKind, type TextArtifactSql } from './text-artifacts';
import { planTextJobs, type TextJobStage } from './text-job-plan';
import type { ClaimedTextJob } from './text-jobs';
import { computeTextStage } from './text-pipeline';
import type { WebTransport } from '../cohort-creation/materials/web-fetch';
import type { YoutubeTranscriptProvider } from './youtube-transcript';
import type { GithubSourceProvider } from './github-source';
import type { CreationGuideAuthor } from '../cohort-creation/generated-guide';

type SourceStage = Exclude<TextJobStage, 'assembly'>;

const prerequisite: Partial<Record<SourceStage, { stage: SourceStage; kind: CohortTextArtifactKind }>> = {
  extraction: { stage: 'acquisition', kind: 'source_raw' },
  understanding: { stage: 'acquisition', kind: 'source_raw' },
  chunking: { stage: 'understanding', kind: 'understanding' },
  analysis: { stage: 'chunking', kind: 'chunks' },
};

function stageResult(state: CohortWorkspace, stage: Exclude<SourceStage,'extraction'>, chunks: CohortWorkspace['chunks'] = []): unknown {
  return computeTextStage({
    ...state,
    sources: state.sources.slice(0, 1),
    chunks,
    understanding: [], analyses: [],
    processing: { ...state.processing, stage },
  }).result;
}

/** Deterministic host adapter for one retained pasted-text source. Global assembly is separate. */
export function createTextSourceProcessor(input: {
  sql: TextArtifactSql;
  loadWorkspace: (workspaceId: string) => Promise<unknown>;
  webTransport?: WebTransport;
  youtubeTranscriptProvider?: YoutubeTranscriptProvider;
  videoObservationProvider?: any;
  githubSourceProvider?: GithubSourceProvider;
  guideAuthor?: CreationGuideAuthor;
  beforeModelCall?: (params: {
    kind: 'video' | 'guide';
    id: string;
    workspaceId: string;
    jobKey?: string;
    dependencyFingerprint?: string;
    attempt?: number;
    ordinal?: number;
  }) => Promise<void | ((settlement?: {
    actualUsage?: { promptTokens?: number; completionTokens?: number; totalTokens?: number; stepsCount?: number };
    error?: unknown;
  }) => Promise<void>)>;
}): (job: ClaimedTextJob, signal?: AbortSignal) => Promise<Uint8Array> {
  return async (job, signal) => {
    signal?.throwIfAborted();
    if (!job.sourceId || job.sourceVersion === null || job.stage === 'assembly') throw new Error('INVALID_SOURCE_JOB');
    const state = cohortWorkspaceSchema.parse(await input.loadWorkspace(job.workspaceId));
    const planned = planTextJobs(state).find(intent => intent.stage === job.stage && intent.sourceId === job.sourceId
      && intent.sourceVersion === job.sourceVersion && intent.dependencyFingerprint === job.dependencyFingerprint);
    if (!planned) throw new Error('STALE_SOURCE_JOB');
    const source = state.sources.find(item => item.id === job.sourceId && item.version === job.sourceVersion);
    if (!source) throw new Error('STALE_SOURCE_JOB');
    const isolated: CohortWorkspace = { ...state, sources: [source] };
    const stage = job.stage as SourceStage;
    if (stage === 'acquisition') {
      if (!source.input) return Buffer.from(source.text, 'utf8');
      const retainedId = source.retainedInputId ?? (source.input.kind === 'pdf' ? source.input.uploadId : undefined);
      if (retainedId) {
        const retained = await readTextArtifact(input.sql,job.workspaceId,retainedId);
        if (retained.ref.kind !== (source.retainedInputId ? 'source_raw' : 'source_input') ||
          (retained.ref.sourceId !== null && retained.ref.sourceId !== source.id)) throw new Error('FOREIGN_SOURCE_PREREQUISITE');
        return retained.bytes;
      }
      const jobKey = (job as { jobKey?: string }).jobKey ?? job.id;
      const attempt = (job as { attempts?: number }).attempts ?? job.fence;
      if (source.input.kind === 'generated_guide') {
        const { acquireGeneratedGuide, LiveCreationGuideAuthor } = await import('./journey-goal-adapter');
        const { createDurableProviderCallHook } = await import('./budget-policy');
        const durableHook = createDurableProviderCallHook({
          sql: input.sql,
          workspaceId: job.workspaceId,
          jobKey,
          dependencyFingerprint: job.dependencyFingerprint,
          operation: 'guide_author',
          attempt,
        });
        let customOrdinal = 0;
        const callHook = input.beforeModelCall
          ? async () => {
              customOrdinal += 1;
              return input.beforeModelCall!({
                kind: 'guide',
                id: source.id,
                workspaceId: job.workspaceId,
                jobKey,
                dependencyFingerprint: job.dependencyFingerprint,
                attempt,
                ordinal: customOrdinal,
              });
            }
          : durableHook;

        if (input.guideAuthor) {
          // Custom injected guideAuthor: wrap its author() call with single reservation boundary per call
          const wrappedAuthor: CreationGuideAuthor = {
            get identity() {
              return input.guideAuthor!.identity;
            },
            async author(intent, sig) {
              const release = await callHook();
              let errSeen: unknown;
              try {
                return await input.guideAuthor!.author(intent, sig);
              } catch (err) {
                errSeen = err;
                throw err;
              } finally {
                if (release) {
                  await release(
                    errSeen
                      ? { error: errSeen }
                      : { actualUsage: { promptTokens: 0, completionTokens: 0, totalTokens: 0, stepsCount: 1 } }
                  ).catch(() => undefined);
                }
              }
            },
          };
          const acquired = await acquireGeneratedGuide(source.input, wrappedAuthor, signal);
          return acquired.bytes;
        }

        const author = new LiveCreationGuideAuthor({
          beforeCall: callHook,
        });
        const acquired = await acquireGeneratedGuide(source.input, author, signal);
        return acquired.bytes;
      }
      if (source.input.kind === 'web') {
        const { fetchRetainedWeb } = await import('./source-adapters');
        return fetchRetainedWeb(source.input.url, input.webTransport, signal);
      }
      if (source.input.kind === 'youtube') {
        if (source.input.mode === 'video_observation') {
          const { acquireVideoObservation, LiveVideoObservationProvider } = await import('./journey-video-adapter');
          const { createDurableProviderCallHook } = await import('./budget-policy');
          const hooksByUnit = new Map<string, ReturnType<typeof createDurableProviderCallHook>>();
          let customOrdinal = 0;
          const callHookForUnit = async (unitId: string) => {
            if (input.beforeModelCall) {
              customOrdinal += 1;
              return input.beforeModelCall({
                kind: 'video',
                id: source.id,
                workspaceId: job.workspaceId,
                jobKey,
                dependencyFingerprint: job.dependencyFingerprint,
                attempt,
                ordinal: customOrdinal,
              });
            }
            let hook = hooksByUnit.get(unitId);
            if (!hook) {
              hook = createDurableProviderCallHook({
                sql: input.sql,
                workspaceId: job.workspaceId,
                jobKey,
                dependencyFingerprint: job.dependencyFingerprint,
                operation: `video_observation:${unitId}`,
                attempt,
              });
              hooksByUnit.set(unitId, hook);
            }
            return hook();
          };

          if (input.videoObservationProvider) {
            const wrappedProvider = {
              async observeVideo(metadata: any, sig: AbortSignal) {
                const release = await callHookForUnit(metadata?.videoId ?? source.id);
                let errSeen: unknown;
                try {
                  return await input.videoObservationProvider.observeVideo(metadata, sig);
                } catch (err) {
                  errSeen = err;
                  throw err;
                } finally {
                  if (release) {
                    await release(
                      errSeen
                        ? { error: errSeen }
                        : { actualUsage: { promptTokens: 0, completionTokens: 0, totalTokens: 0, stepsCount: 1 } }
                    ).catch(() => undefined);
                  }
                }
              },
            };
            const acquired = await acquireVideoObservation(source.input, wrappedProvider, signal);
            return acquired.bytes;
          }

          const provider = new LiveVideoObservationProvider({
            beforeCall: callHookForUnit,
          });
          const acquired = await acquireVideoObservation(source.input, provider, signal);
          return acquired.bytes;
        }
        if (!source.input.track) throw new Error('TRANSCRIPT_TRACK_REQUIRED');
        const { acquireYoutubeTranscript } = await import('./youtube-transcript');
        const acquired = await acquireYoutubeTranscript({ ...source.input, track: source.input.track }, input.youtubeTranscriptProvider, signal);
        return acquired.bytes;
      }
      if (source.input.kind === 'github') {
        const { acquireGithubSource } = await import('./github-source');
        const acquired = await acquireGithubSource(source.input, input.githubSourceProvider, signal);
        return acquired.bytes;
      }
      throw new Error('MISSING_RETAINED_INPUT');
    }

    const required = stage === 'understanding' && source.input ? {stage:'extraction',kind:'extraction'} as const : prerequisite[stage];
    if (!required) throw new Error('INVALID_SOURCE_JOB');
    const found = await input.sql.query(`SELECT prior."stage", prior."sourceId", prior."sourceVersion",
        prior."dependencyFingerprint", prior."resultArtifactId", artifact."checksum"
      FROM "cohort_text_job_edges" edge
      JOIN "cohort_text_jobs" prior ON prior."id" = edge."prerequisiteId" AND prior."workspaceId" = edge."workspaceId"
      JOIN "cohort_text_artifacts" artifact ON artifact."id" = prior."resultArtifactId" AND artifact."workspaceId" = prior."workspaceId"
      WHERE edge."workspaceId" = $1 AND edge."jobId" = $2 AND prior."status" = 'accepted'`,
    [job.workspaceId, job.id]);
    if (found.rows.length !== 1) throw new Error('MISSING_SOURCE_PREREQUISITE');
    const row = found.rows[0];
    if (row.stage !== required.stage || row.sourceId !== source.id || Number(row.sourceVersion) !== source.version) throw new Error('FOREIGN_SOURCE_PREREQUISITE');
    const retained = await readTextArtifact(input.sql, job.workspaceId, String(row.resultArtifactId), {
      kind: required.kind, inputFingerprint: String(row.dependencyFingerprint), checksum: String(row.checksum),
    });
    if (retained.ref.sourceId !== source.id || retained.ref.sourceVersion !== source.version) throw new Error('FOREIGN_SOURCE_PREREQUISITE');
    if (stage === 'extraction') {
      const {extractRetainedSource}=await import('./source-adapters');
      return Buffer.from(JSON.stringify(await extractRetainedSource(source,retained.ref,retained.bytes)));
    }
    if (stage === 'understanding') {
      if (source.input) {
        const {sourceExtractionSchema}=await import('./source-adapters');
        const extraction = sourceExtractionSchema.parse(JSON.parse(retained.bytes.toString('utf8')));
        if (source.extractionId !== retained.ref.id || extraction.text !== source.text ||
          JSON.stringify(extraction.locations) !== JSON.stringify(source.locations) ||
          JSON.stringify(extraction.provenance) !== JSON.stringify(source.provenance)) throw new Error('STALE_SOURCE_PREREQUISITE');
      } else if (retained.bytes.toString('utf8') !== source.text) throw new Error('STALE_SOURCE_PREREQUISITE');
      const result = cohortWorkspaceSchema.shape.understanding.parse(stageResult(isolated, stage));
      return Buffer.from(JSON.stringify(result));
    }
    if (stage === 'chunking') {
      const understood = cohortWorkspaceSchema.shape.understanding.parse(JSON.parse(retained.bytes.toString('utf8')));
      if (JSON.stringify(understood) !== JSON.stringify(stageResult(isolated, 'understanding'))) throw new Error('STALE_SOURCE_PREREQUISITE');
      const result = cohortChunkSchema.array().parse(stageResult(isolated, stage));
      return Buffer.from(JSON.stringify(result));
    }
    const chunks = cohortChunkSchema.array().parse(JSON.parse(retained.bytes.toString('utf8')));
    if (JSON.stringify(chunks) !== JSON.stringify(stageResult(isolated, 'chunking'))) throw new Error('STALE_SOURCE_PREREQUISITE');
    const result = cohortWorkspaceSchema.shape.analyses.parse(stageResult(isolated, stage, chunks));
    return Buffer.from(JSON.stringify(result));
  };
}
