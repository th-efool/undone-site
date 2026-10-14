import type { CohortLesson } from '@/src/shared/cohort-builder/contracts';

/** Merge generated lessons without silently overwriting authored decisions. */
export function projectGeneratedLessons(existing: CohortLesson[], generated: CohortLesson[], validChunkIds: ReadonlySet<string>): CohortLesson[] {
  const authored = existing.filter(lesson => lesson.pinned || lesson.manualOverride || !lesson.id.startsWith('grounded:'))
    .map(lesson => lesson.sourceChunkIds.some(id => !validChunkIds.has(id)) ? { ...lesson, evidenceStatus: 'orphaned' as const } : { ...lesson, evidenceStatus: 'valid' as const });
  const protectedIds = new Set(authored.map(lesson => lesson.id));
  return [...authored, ...generated.filter(lesson => !protectedIds.has(lesson.id)).map(lesson => {
    const prior = existing.find(item => item.id === lesson.id);
    const changed = prior && (prior.title !== lesson.title || prior.objective !== lesson.objective
      || JSON.stringify(prior.sourceChunkIds) !== JSON.stringify(lesson.sourceChunkIds));
    return { ...lesson, version: prior ? prior.version + (changed ? 1 : 0) : lesson.version, evidenceStatus: 'valid' as const };
  })];
}
