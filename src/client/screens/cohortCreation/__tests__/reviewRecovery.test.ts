// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';
import { readReviewRecovery, writeReviewRecovery, removeReviewRecovery, type ReviewRecovery } from '../services/reviewRecovery';
import { draftId } from '@/src/shared/cohort-creation/__tests__/fixtures';
beforeEach(() => window.sessionStorage.clear());
const key = `undone:unsaved-review:v1:${draftId}`;
const fixture = (): ReviewRecovery => ({ schemaVersion: 1, draftId, buildFingerprint: 'a'.repeat(64), editRevision: 0, savedAt: Date.now(),
  metadata: { title: '', description: 'Incomplete user edit', visibility: 'PRIVATE', chatEnabled: false, eventsEnabled: false }, lessonEdits: {} });
describe('bounded tab review recovery', () => {
  it('retains incomplete edits without accepting them as canonical state, then clears explicitly', () => {
    const value = fixture(); writeReviewRecovery(value, window.sessionStorage); expect(readReviewRecovery(draftId, window.sessionStorage)).toEqual(value);
    removeReviewRecovery(draftId, window.sessionStorage); expect(readReviewRecovery(draftId, window.sessionStorage)).toBeNull();
  });
  it('rejects malformed, oversized, foreign, expired and future copies', () => {
    for (const raw of ['{', JSON.stringify({ ...fixture(), draftId: '22222222-2222-4222-8222-222222222222' }),
      JSON.stringify({ ...fixture(), savedAt: 0 }), JSON.stringify({ ...fixture(), savedAt: Date.now() + 86400000 }), 'x'.repeat(256 * 1024 + 1)]) {
      window.sessionStorage.setItem(key, raw); expect(readReviewRecovery(draftId, window.sessionStorage)).toBeNull(); expect(window.sessionStorage.getItem(key)).toBeNull();
    }
    const huge = { ...fixture(), lessonEdits: Object.fromEntries(Array.from({ length: 20 }, (_, id) => [String(id), { title: 'Title', objectives: '😀'.repeat(10000) }])) };
    expect(() => writeReviewRecovery(huge, window.sessionStorage)).toThrow('limit');
    expect(() => readReviewRecovery('../invalid', window.sessionStorage)).toThrow();
  });
});
