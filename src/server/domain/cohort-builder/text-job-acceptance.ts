import { cohortWorkspaceSchema } from '@/src/shared/cohort-builder/contracts';
import { readTextArtifact, type TextArtifactRef } from './text-artifacts';
import { planTextJobs } from './text-job-plan';
import type { TextJobTransactionPort } from './text-job-scheduler';
import { acceptTextJob, type ClaimedTextJob } from './text-jobs';
import { textJobStatus } from './text-job-status';
import { commitTextProjection } from './text-projection-commit';
import { createTextSourceProcessor } from './text-source-processor';
import type { SourceExtraction } from './source-adapters';
import { deriveCohortTitle, deriveCohortDescription } from '@/src/shared/cohort-builder/cohort-metadata';

/** Prepared cutover boundary: lock canonical workspace state before fenced result acceptance. */
export async function acceptCurrentTextJob(
  port: TextJobTransactionPort,
  job: ClaimedTextJob,
  artifact: Pick<TextArtifactRef, 'id' | 'workspaceId' | 'kind' | 'inputFingerprint' | 'checksum'>,
  now: Date
): Promise<boolean> {
  // Parsing is outside the canonical lock. The locked plan/fence/dependencies below
  // must still match before these immutable bytes can become canonical evidence.
  let extracted: SourceExtraction | undefined;
  if (job.stage === 'extraction') {
    const {sourceExtractionSchema}=await import('./source-adapters');
    extracted = await port.transaction(async tx => {
      const retained = await readTextArtifact(tx,job.workspaceId,artifact.id,{kind:'extraction',inputFingerprint:job.dependencyFingerprint,checksum:artifact.checksum});
      const expected = await createTextSourceProcessor({sql:tx,loadWorkspace:async workspaceId=>{
        const row=(await tx.query(`SELECT "snapshot" FROM "interaction_workspaces" WHERE "id"=$1 AND "lifecycle"='active' AND "domainId"='cohort'`,[workspaceId])).rows[0];
        if(!row) throw new Error('WORKSPACE_NOT_ACTIVE');return row.snapshot;
      }})(job);
      if(!retained.bytes.equals(Buffer.from(expected))) throw new Error('FABRICATED_SOURCE_EXTRACTION');
      return sourceExtractionSchema.parse(JSON.parse(retained.bytes.toString('utf8')));
    });
  }
  return port.transaction(async tx => {
    const workspace = (await tx.query(`SELECT "snapshot", "revision" FROM "interaction_workspaces"
      WHERE "id" = $1 AND "lifecycle" = 'active' AND "domainId" = 'cohort' FOR UPDATE`, [job.workspaceId])).rows[0];
    if (!workspace) return false;
    const state = cohortWorkspaceSchema.parse(typeof workspace.snapshot === 'string'
      ? JSON.parse(workspace.snapshot) : workspace.snapshot);
    const row = (await tx.query(`SELECT "jobKey", "stage", "sourceId", "sourceVersion", "dependencyFingerprint"
      FROM "cohort_text_jobs" WHERE "id" = $1 AND "workspaceId" = $2 FOR UPDATE`,
    [job.id, job.workspaceId])).rows[0];
    if (!row || row.stage !== job.stage || row.sourceId !== job.sourceId
      || (row.sourceVersion === null ? null : Number(row.sourceVersion)) !== job.sourceVersion
      || row.dependencyFingerprint !== job.dependencyFingerprint) return false;
    const current = planTextJobs(state).some(intent => intent.jobKey === row.jobKey
      && intent.stage === job.stage && intent.sourceId === job.sourceId
      && intent.sourceVersion === job.sourceVersion
      && intent.dependencyFingerprint === job.dependencyFingerprint);
    if (!current) return false;
    let next = state;
    const source = state.sources.find(item=>item.id===job.sourceId && item.version===job.sourceVersion);
    if (source?.input && job.stage === 'acquisition') {
      const retained=await readTextArtifact(tx,job.workspaceId,artifact.id,{kind:'source_raw',inputFingerprint:job.dependencyFingerprint,checksum:artifact.checksum});
      if(source.input.kind==='pdf') {
        const upload=await readTextArtifact(tx,job.workspaceId,source.input.uploadId);
        if(upload.ref.kind!=='source_input' || !upload.bytes.equals(retained.bytes)) throw new Error('FOREIGN_SOURCE_PREREQUISITE');
      } else if (source.input.kind==='web') {
        const {retainedWebSchema}=await import('./source-adapters');
        const response=retainedWebSchema.parse(JSON.parse(retained.bytes.toString('utf8')));
        if(response.requestedUrl!==source.input.url) throw new Error('FOREIGN_WEB_RESPONSE');
      } else if (source.input.kind === 'youtube') {
        if (source.input.mode === 'video_observation') {
          const { retainedVideoObservationSchema, singleYoutubeVideo } = await import('@/src/shared/cohort-builder/youtube-video-observation');
          const response = retainedVideoObservationSchema.parse(JSON.parse(retained.bytes.toString('utf8')));
          if (response.video.id !== singleYoutubeVideo(source.input.url).videoId || response.video.url !== source.input.url) {
            throw new Error('FOREIGN_VIDEO_OBSERVATION');
          }
        } else {
          const { retainedYoutubeTranscriptSchema, singleYoutubeVideo } = await import('@/src/shared/cohort-builder/youtube-transcript');
          const response = retainedYoutubeTranscriptSchema.parse(JSON.parse(retained.bytes.toString('utf8')));
          if (response.video.id !== singleYoutubeVideo(source.input.url).videoId || response.video.url !== source.input.url ||
            JSON.stringify(response.track) !== JSON.stringify(source.input.track)) throw new Error('FOREIGN_TRANSCRIPT');
        }
      } else if (source.input.kind === 'github') {
        const {retainedGithubSourceSchema,singleGithubRepo}=await import('@/src/shared/cohort-builder/github-source');
        const response=retainedGithubSourceSchema.parse(JSON.parse(retained.bytes.toString('utf8')));
        const normalized=singleGithubRepo(source.input.repoUrl);
        if(response.repo.owner!==normalized.owner || response.repo.repo!==normalized.repo || response.ref!==source.input.ref) throw new Error('FOREIGN_GITHUB_REPOSITORY');
      } else if (source.input.kind === 'generated_guide') {
        const { generatedGuideArtifactSchema } = await import('@/src/shared/cohort-creation/generated-guide');
        const artifactData = generatedGuideArtifactSchema.parse(JSON.parse(retained.bytes.toString('utf8')));
        if (artifactData.extractionKind !== 'generated_guide' || artifactData.contentOrigin !== 'ai') {
          throw new Error('FOREIGN_GENERATED_GUIDE');
        }
      } else {
        throw new Error('UNSUPPORTED_SOURCE_PREREQUISITE');
      }
      next={...state,sources:state.sources.map(item=>item.id===source.id?{...item,retainedInputId:artifact.id}:item)};
    } else if (extracted && source?.input) {
      next={...state,sources:state.sources.map(item=>item.id===source.id?{...item,text:extracted.text,
        label: /^https?:\/\//i.test(item.label) && extracted.provenance.videoTitle ? extracted.provenance.videoTitle.slice(0, 300) : item.label,
        checksum:extracted.provenance.rawChecksum,extractionId:artifact.id,locations:extracted.locations,provenance:extracted.provenance}:item)};
    } else if (source && ['understanding', 'chunking', 'analysis'].includes(job.stage)) {
      const kind = job.stage === 'understanding' ? 'understanding' : job.stage === 'chunking' ? 'chunks' : 'analysis';
      const retained = await readTextArtifact(tx, job.workspaceId, artifact.id, {
        kind, inputFingerprint: job.dependencyFingerprint, checksum: artifact.checksum,
      });
      if (retained.ref.sourceId !== source.id || retained.ref.sourceVersion !== source.version) {
        throw new Error('FOREIGN_SOURCE_PREREQUISITE');
      }
      const expected = await createTextSourceProcessor({ sql: tx, loadWorkspace: async () => state })(job);
      if (!retained.bytes.equals(Buffer.from(expected))) throw new Error('FABRICATED_SOURCE_PROJECTION');
      const value: unknown = JSON.parse(retained.bytes.toString('utf8'));
      if (job.stage === 'understanding') {
        const understanding = [
          ...state.understanding.filter(item => item.sourceId !== source.id),
          ...cohortWorkspaceSchema.shape.understanding.parse(value),
        ];
        const understood = { ...state, understanding };
        next = { ...understood, title: deriveCohortTitle(understood), description: deriveCohortDescription(understood) };
      } else if (job.stage === 'chunking') {
        const chunks = [
          ...state.chunks.filter(item => item.sourceId !== source.id),
          ...cohortWorkspaceSchema.shape.chunks.parse(value),
        ];
        const currentIds = new Set(chunks.map(item => item.id));
        next = { ...state, chunks, analyses: state.analyses.filter(item => currentIds.has(item.chunkId)) };
      } else {
        const analyses = cohortWorkspaceSchema.shape.analyses.parse(value);
        const sourceChunkIds = new Set(state.chunks.filter(item => item.sourceId === source.id).map(item => item.id));
        next = { ...state, analyses: [...state.analyses.filter(item => !sourceChunkIds.has(item.chunkId)), ...analyses] };
      }
    }
    if (!await acceptTextJob(tx, job, artifact, now)) return false;
    await commitTextProjection(tx, job.workspaceId, state, await textJobStatus(tx, job.workspaceId, next),
      Number(workspace.revision), `text-stage:${job.id}:${job.fence}`, `Source ${job.stage} accepted.`);
    return true;
  });
}
