import 'server-only';
import { generatedCurriculumSchema, type GeneratedCurriculum } from '@/src/shared/cohort-creation/artifacts';
import { reviewWorkspaceSchema, type ReviewWorkspace } from '@/src/shared/cohort-creation/review';

/** Rebase keeps every user edit; orphaned edits remain visible until explicitly resolved. */
export function rebaseReview(input: GeneratedCurriculum, previous: ReviewWorkspace | null): ReviewWorkspace {
  const curriculum = generatedCurriculumSchema.parse(input);
  const lessonIds = curriculum.seasons.flatMap(season => season.lessons.map(lesson => lesson.id));
  return reviewWorkspaceSchema.parse({ title: previous?.title ?? curriculum.title.value, description: previous?.description ?? curriculum.description.value,
    buildFingerprint: curriculum.version, editRevision: (previous?.editRevision ?? -1) + 1,
    lessonIds, lessonEdits: previous?.lessonEdits ?? [], orphanedLessonIds: (previous?.lessonEdits ?? []).filter(edit => !lessonIds.includes(edit.lessonId)).map(edit => edit.lessonId),
    visibility: previous?.visibility ?? 'PRIVATE', chatEnabled: previous?.chatEnabled ?? true, eventsEnabled: previous?.eventsEnabled ?? true,
    invalidated: ['preview', 'publication'], request: null, proposal: null });
}
/** Applies only validated user-approved copy; retained chunks, source evidence and delivery IDs never change. */
export function projectReview(input: GeneratedCurriculum, value: ReviewWorkspace): GeneratedCurriculum {
  const curriculum = generatedCurriculumSchema.parse(input); const review = reviewWorkspaceSchema.parse(value);
  if (review.buildFingerprint !== curriculum.version) throw new Error('Review no longer matches the accepted curriculum');
  const ids = curriculum.seasons.flatMap(season => season.lessons.map(lesson => lesson.id));
  if (JSON.stringify(ids) !== JSON.stringify(review.lessonIds)) throw new Error('Review lesson inventory changed');
  const edits = new Map(review.lessonEdits.map(edit => [edit.lessonId, edit]));
  const user = <T>(value: T) => ({ value, origin: 'user' as const, acceptedRevision: review.editRevision });
  return generatedCurriculumSchema.parse({ ...curriculum, title: user(review.title), description: user(review.description),
    seasons: curriculum.seasons.map(season => ({ ...season, lessons: season.lessons.map(lesson => {
      const edit = edits.get(lesson.id); return { ...lesson, ...(edit?.title ? { title: user(edit.title) } : {}),
        ...(edit?.objectives ? { objectives: user(edit.objectives) } : {}) };
    }) })) });
}
