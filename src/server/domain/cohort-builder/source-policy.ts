import { cohortActionSchema } from '@/src/shared/cohort-builder/contracts';
import { readTextArtifact, type TextArtifactSql } from './text-artifacts';
import { textDriver } from './text-driver';
import { youtubeTranscriptReadiness } from './youtube-transcript-policy';
import { githubSourceReadiness } from './github-policy';

export const PDF_SOURCE_BYTES = 2 * 1024 * 1024;
export function sourceCapability(kind: 'pdf' | 'web' | 'youtube' | 'github') {
  if (kind === 'youtube') return process.env.INTERACTION_YOUTUBE_ENABLED === '1';
  if (kind === 'github') return process.env.INTERACTION_GITHUB_ENABLED === '1' && (githubSourceReadiness().enabled || (process.env.NODE_ENV === 'test' && process.env.INTERACTION_GITHUB_TEST_MOCK === '1') || process.env.NODE_ENV === 'development');
  return process.env[kind === 'pdf' ? 'INTERACTION_PDF_ENABLED' : 'INTERACTION_WEB_ENABLED'] === '1';
}
export async function assertSourceSchema(sql: TextArtifactSql) {
  const rows = await sql.query(`SELECT pg_get_constraintdef(oid) AS definition FROM pg_constraint
    WHERE conrelid IN ('cohort_text_jobs'::regclass,'cohort_text_artifacts'::regclass)
      AND conname IN ('cohort_text_jobs_stage_ck','cohort_text_artifacts_kind_ck')`,[]);
  if (rows.rows.length !== 2 || rows.rows.some(row => !String(row.definition).includes('extraction')) ||
    !rows.rows.some(row => String(row.definition).includes('source_input'))) throw new Error('S4B_SCHEMA_NOT_INSTALLED');
}
export async function validateSourceAction(sql: TextArtifactSql, workspaceId: string, input: unknown) {
  if (!['add_pdf_source','add_web_source','set_pdf_pages','refresh_web_source','add_youtube_source','set_youtube_scope','add_github_source','set_github_scope'].includes((input as { type?: string })?.type ?? '')) return;
  const action = cohortActionSchema.parse(input);
  if (textDriver() !== 'durable') throw new Error('DURABLE_DRIVER_REQUIRED');
  const kind = (action.type === 'add_pdf_source' || action.type === 'set_pdf_pages') ? 'pdf'
    : (action.type === 'add_youtube_source' || action.type === 'set_youtube_scope') ? 'youtube'
    : (action.type === 'add_github_source' || action.type === 'set_github_scope') ? 'github'
    : 'web';
  if (!sourceCapability(kind)) throw new Error('SOURCE_CAPABILITY_DISABLED');
  await assertSourceSchema(sql);
  if (action.type === 'add_pdf_source') {
    const artifact = await readTextArtifact(sql,workspaceId,action.uploadId);
    if (artifact.ref.kind !== 'source_input' || artifact.bytes.length > PDF_SOURCE_BYTES || artifact.bytes.subarray(0,5).toString() !== '%PDF-') throw new Error('INVALID_PDF_UPLOAD');
  }
  if (action.type === 'add_web_source' || action.type === 'refresh_web_source' && action.url) {
    const {webSourceUrl}=await import('@/src/server/domain/cohort-creation/materials/web-fetch');
    webSourceUrl(action.url!);
  }
  if (action.type === 'add_youtube_source') {
    const {singleYoutubeVideo}=await import('@/src/shared/cohort-builder/youtube-transcript');
    singleYoutubeVideo(action.url);
  }
  if (action.type === 'add_github_source') {
    const {singleGithubRepo}=await import('@/src/shared/cohort-builder/github-source');
    singleGithubRepo(action.repoUrl);
  }
}
