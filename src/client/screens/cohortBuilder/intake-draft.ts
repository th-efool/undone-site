import { cohortIntakeSchema, type CohortIntake } from '@/src/shared/cohort-builder/intake';
const key = 'undone:cohort-intake';
export function saveIntakeDraft(body: CohortIntake, ownerId: string | null) {
  const validated = cohortIntakeSchema.parse(body);
  try {
    const prior = JSON.parse(sessionStorage.getItem(key) ?? 'null');
    if (prior?.ownerId === ownerId && Date.now() - prior.createdAt < 3_600_000 &&
      prior.body.prompt === validated.prompt && JSON.stringify(prior.body.source) === JSON.stringify(validated.source)) validated.requestId = prior.body.requestId;
  } catch { /* Corrupt local drafts are replaced by validated input. */ }
  sessionStorage.setItem(key, JSON.stringify({ body: validated, ownerId, createdAt: Date.now() }));
}
export function readIntakeDraft(ownerId?: string | null) {
  try {
    const saved = JSON.parse(sessionStorage.getItem(key) ?? 'null');
    if (!saved || Date.now() - saved.createdAt > 3_600_000 || (saved.ownerId !== null && ownerId !== undefined && ownerId !== null && saved.ownerId !== ownerId)) {
      sessionStorage.removeItem(key); return null;
    }
    return cohortIntakeSchema.parse(saved.body);
  } catch { sessionStorage.removeItem(key); return null; }
}
export function clearIntakeDraft() { sessionStorage.removeItem(key); }
