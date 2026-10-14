import { cohortIntakeSchema, type CohortIntake } from '@/src/shared/cohort-builder/intake';
const key = 'undone:cohort-intake';
export function saveIntakeDraft(body: CohortIntake, ownerId: string | null) {
  sessionStorage.setItem(key, JSON.stringify({ body, ownerId, createdAt: Date.now() }));
}
export function readIntakeDraft(ownerId: string) {
  try {
    const saved = JSON.parse(sessionStorage.getItem(key) ?? 'null');
    if (!saved || Date.now() - saved.createdAt > 3_600_000 || (saved.ownerId !== null && saved.ownerId !== ownerId)) {
      sessionStorage.removeItem(key); return null;
    }
    return cohortIntakeSchema.parse(saved.body);
  } catch { sessionStorage.removeItem(key); return null; }
}
export function clearIntakeDraft() { sessionStorage.removeItem(key); }
