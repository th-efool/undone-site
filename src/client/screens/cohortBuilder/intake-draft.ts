import { cohortIntakeSchema, type CohortIntake, type CohortIntakeInput } from '@/src/shared/cohort-builder/intake';
const key = 'undone:cohort-intake';
export function saveIntakeDraft(body: CohortIntakeInput, ownerId: string | null) {
  const validated = cohortIntakeSchema.parse(body);
  try {
    const prior = JSON.parse(sessionStorage.getItem(key) ?? 'null');
    if (prior?.ownerId === ownerId && Date.now() - prior.createdAt < 3_600_000 &&
      prior.body.prompt === validated.prompt && (prior.body.source?.text === validated.source?.text && prior.body.source?.label === validated.source?.label)) validated.requestId = prior.body.requestId;
  } catch { /* Corrupt local drafts are replaced by validated input. */ }
  try {
    sessionStorage.setItem(key, JSON.stringify({ body: validated, ownerId, createdAt: Date.now() }));
  } catch {
    try {
      const { sources: _dropped, ...lightweight } = validated;
      sessionStorage.setItem(key, JSON.stringify({ body: lightweight, ownerId, createdAt: Date.now() }));
    } catch {
      /* Silently ignore if storage quota is completely exhausted */
    }
  }
}
export function readIntakeDraft(ownerId?: string | null): CohortIntake | null {
  try {
    const saved = JSON.parse(sessionStorage.getItem(key) ?? 'null');
    if (!saved || Date.now() - saved.createdAt > 3_600_000 || (saved.ownerId !== null && ownerId !== undefined && ownerId !== null && saved.ownerId !== ownerId)) {
      sessionStorage.removeItem(key); return null;
    }
    return cohortIntakeSchema.parse(saved.body);
  } catch { sessionStorage.removeItem(key); return null; }
}
export function clearIntakeDraft() { sessionStorage.removeItem(key); }
