import { afterEach, describe, expect, it, vi } from 'vitest';
import { requestRecommendations } from '../services/creationApi';
import { loadSessionDraft, saveSessionDraft } from '../services/sessionDraftStore';
import { applyCommand, applyEvent, initialSnapshot } from '@/src/shared/cohort-creation/flow';
import { draftId, requestId, result } from '@/src/shared/cohort-creation/__tests__/fixtures';

afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });
const input = { requestId, inputRevision: 1, query: result.intent.rawQuery };
function store() {
  const data = new Map<string, string>();
  return { getItem: (key: string) => data.get(key) ?? null, setItem: (key: string, value: string) => { data.set(key, value); } };
}
const running = () => applyCommand(initialSnapshot(draftId), { type: 'request_recommendations', requestId, query: result.intent.rawQuery });

describe('client transport and explicit session-only recovery', () => {
  it('uses the configured API origin and validates success responses', async () => {
    vi.stubEnv('NEXT_PUBLIC_API_ORIGIN', 'https://api.example.test/');
    const fetch = vi.fn(async () => Response.json(result)); vi.stubGlobal('fetch', fetch);
    expect(await requestRecommendations(input, new AbortController().signal)).toEqual(result);
    expect(fetch).toHaveBeenCalledWith('https://api.example.test/api/cohort-creation/recommendations', expect.objectContaining({ method: 'POST' }));
  });
  it('rejects malformed and mismatched successful responses', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => Response.json({ ...result, inputRevision: 7 })));
    await expect(requestRecommendations(input, new AbortController().signal)).rejects.toMatchObject({ detail: { code: 'AI_INVALID_OUTPUT' } });
  });
  it('does not expose unknown error payloads to the UI', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => Response.json({ secret: 'private' }, { status: 500 })));
    await expect(requestRecommendations(input, new AbortController().signal)).rejects.toMatchObject({ detail: { code: 'AI_UNAVAILABLE' } });
  });
  it('restores typed selection, rejects wrong draft IDs and expires sessions', () => {
    const storage = store();
    const accepted = applyEvent(running(), { type: 'recommendations_received', result });
    const selected = applyCommand(applyCommand(accepted, { type: 'create_own' }), { type: 'choose_starting_point', startingPoint: 'have_material' });
    expect(saveSessionDraft(selected, storage, 100)).toBe(true);
    expect(loadSessionDraft(draftId, storage, 101)).toEqual(selected);
    expect(loadSessionDraft(requestId, storage, 101)).toBeNull();
    expect(loadSessionDraft(draftId, storage, 86_400_101)).toBeNull();
  });
  it('recovers interrupted requests as canceled, not fake durable running jobs', () => {
    const storage = store(); saveSessionDraft(running(), storage, 100);
    expect(loadSessionDraft(draftId, storage, 101)).toMatchObject({ status: 'canceled', activeRequestId: null });
  });
  it('handles disabled/corrupted storage without losing in-memory functionality', () => {
    expect(saveSessionDraft(initialSnapshot(draftId), { setItem: () => { throw new Error('quota'); } })).toBe(false);
    expect(loadSessionDraft(draftId, { getItem: () => '{bad' })).toBeNull();
  });
});
