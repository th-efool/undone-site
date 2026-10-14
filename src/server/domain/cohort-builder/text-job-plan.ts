import { createHash } from 'node:crypto';
import type { CohortWorkspace } from '@/src/shared/cohort-builder/contracts';

export type TextJobStage = 'acquisition' | 'understanding' | 'chunking' | 'analysis' | 'assembly';

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
  const jobs: TextJobIntent[] = [];
  const analysisKeys: string[] = [];
  for (const source of [...state.sources].sort((a, b) => a.id.localeCompare(b.id))) {
    const sourceIdentity = [source.id, source.version, digest(source.text)];
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
    const understanding = stage('understanding', [acquisition.jobKey], [acquisition.jobKey]);
    const chunking = stage('chunking', [understanding.jobKey], [understanding.jobKey]);
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
