import { cohortActionSchema, type CohortAction, type CohortSource } from '@/src/shared/cohort-builder/contracts';

/** Preserve canonical identity and retained evidence; display labels never classify media. */
export function sourceAttachmentAction(source: CohortSource): CohortAction {
  const extraction = source.text.trim() ? {
    text: source.text,
    locations: source.locations?.length ? source.locations : [{ start: 0, end: source.text.length }],
    provenance: source.provenance,
    checksum: source.checksum ?? undefined,
  } : undefined;
  const common = { sourceId: source.id, label: source.label, ...(extraction ? { extraction } : {}) };
  const input = source.input;
  let action: unknown;
  if (input?.kind === 'youtube') {
    action = { ...common, type: 'add_youtube_source', url: input.url, mode: input.mode ?? 'video_observation', ...(input.track ? { track: input.track } : {}), ...(input.scope ? { scope: input.scope } : {}) };
  } else if (input?.kind === 'github') {
    action = { ...common, type: 'add_github_source', repoUrl: input.repoUrl, ref: input.ref, ...(input.paths ? { paths: input.paths } : {}) };
  } else if (input?.kind === 'web') {
    action = { ...common, type: 'add_web_source', url: input.url };
  } else if (input?.kind === 'pdf' || source.label.toLowerCase().endsWith('.pdf') || source.provenance?.pageCount !== undefined) {
    action = { ...common, type: 'add_pdf_source', ...(input?.kind === 'pdf' ? { uploadId: input.uploadId } : {}) };
  } else if (source.provenance?.videoId) {
    action = { ...common, type: 'add_youtube_source', url: 'https://www.youtube.com/watch?v=' + source.provenance.videoId, mode: 'video_observation' };
  } else if (source.provenance?.repoUrl) {
    action = { ...common, type: 'add_github_source', repoUrl: source.provenance.repoUrl, ref: source.provenance.ref ?? 'main' };
  } else if (source.provenance?.finalUrl) {
    action = { ...common, type: 'add_web_source', url: source.provenance.finalUrl };
  } else {
    action = { ...common, type: 'add_text_source', text: source.text };
  }
  return cohortActionSchema.parse(action);
}
