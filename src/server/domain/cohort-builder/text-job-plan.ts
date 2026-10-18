import { createHash } from 'node:crypto';
import type { CohortWorkspace } from '@/src/shared/cohort-builder/contracts';
import { PDF_PARSER_VERSION } from '../cohort-creation/materials/pdf-identity';
import { WEB_PARSER_VERSION } from '../cohort-creation/materials/web-identity';
import { YOUTUBE_TRANSCRIPT_VERSION } from '@/src/shared/cohort-builder/youtube-transcript';
import { GITHUB_SOURCE_VERSION } from '@/src/shared/cohort-builder/github-source';

import { VIDEO_OBSERVATION_PARSER_VERSION } from '@/src/shared/cohort-builder/youtube-video-observation';

export type TextJobStage = 'acquisition' | 'extraction' | 'understanding' | 'chunking' | 'analysis' | 'assembly';

export interface TextJobIntent {
  jobKey: string;
  stage: TextJobStage;
  sourceId: string | null;
  sourceVersion: number | null;
  dependencyFingerprint: string;
  prerequisiteKeys: string[];
}

const algorithmVersion = 1;
const digest = (value: unknown) => createHash('sha256').update(JSON.stringify(value)).digest('hex');

/** Exact dependency keys; no current revision or unrelated workspace fields. */
export function planTextJobs(state: CohortWorkspace): TextJobIntent[] {
  if (state.journey && !state.journey.processingStarted) return [];
  const jobs: TextJobIntent[] = [];
  const analysisKeys: string[] = [];
  for (const source of [...state.sources].sort((a, b) => a.id.localeCompare(b.id))) {
    // Derived extraction projections must not change the graph that produced them.
    const sourceIdentity = [source.id, source.version, digest(source.input ?? source.text)];
    const stage = (name: Exclude<TextJobStage, 'assembly'>, inputs: unknown[], prerequisites: string[]): TextJobIntent => {
      const dependencyFingerprint = digest([name, algorithmVersion, sourceIdentity, ...inputs]);
      const intent: TextJobIntent = {
        jobKey: `text:${name}:${dependencyFingerprint}`,
        stage: name, sourceId: source.id, sourceVersion: source.version,
        dependencyFingerprint, prerequisiteKeys: prerequisites,
      };
      jobs.push(intent);
      return intent;
    };
    const acquisition = stage('acquisition', [], []);
    const parserVersion = source.input?.kind === 'pdf' ? PDF_PARSER_VERSION
      : source.input?.kind === 'web' ? WEB_PARSER_VERSION
      : source.input?.kind === 'youtube'
        ? (source.input.mode === 'video_observation' ? VIDEO_OBSERVATION_PARSER_VERSION : YOUTUBE_TRANSCRIPT_VERSION)
      : GITHUB_SOURCE_VERSION;
    const extractionVersion = source.input?.kind === 'youtube' ? 'cohort-extraction-video-metadata-v2' : 'cohort-extraction-v1';
    const retained = source.input ? stage('extraction', [extractionVersion, parserVersion, acquisition.jobKey], [acquisition.jobKey]) : acquisition;
    const understanding = stage('understanding', [retained.jobKey, 'concept-topics-v2'], [retained.jobKey]);
    const chunking = stage('chunking', [understanding.jobKey, 'timed-complete-coverage-v3'], [understanding.jobKey]);
    const analysis = stage('analysis', [chunking.jobKey, state.audience], [chunking.jobKey]);
    analysisKeys.push(analysis.jobKey);
  }

  if (analysisKeys.length > 0) {
    const overrides = state.lessons.filter(lesson => lesson.manualOverride || lesson.pinned || !lesson.id.startsWith('grounded:'))
      .map(lesson => [lesson.id, lesson.version, lesson.title, lesson.objective, lesson.pinned, lesson.sourceChunkIds]);
    // A new explicit processing generation must receive a new projection even if an old content scope returns.
    const dependencyFingerprint = digest(['assembly', algorithmVersion, state.processing.generation, analysisKeys, state.intent, state.dailyMinutes, overrides]);
    jobs.push({
      jobKey: `text:assembly:${dependencyFingerprint}`,
      stage: 'assembly', sourceId: null, sourceVersion: null,
      dependencyFingerprint, prerequisiteKeys: analysisKeys,
    });
  }
  return jobs;
}
