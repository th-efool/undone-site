import { afterEach, describe, expect, it, vi } from 'vitest';
import { draftApi, DraftApiError } from '../services/draftApi';
import { initialSnapshot } from '@/src/shared/cohort-creation/flow';
import { draftId } from '@/src/shared/cohort-creation/__tests__/fixtures';
afterEach(() => vi.unstubAllGlobals());
describe('durable draft transport', () => {
  it('loads a validated server snapshot without session storage', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => Response.json(initialSnapshot(draftId))));
    expect(await draftApi.load(draftId)).toEqual(initialSnapshot(draftId));
  });
  it('preserves the canonical server snapshot on revision conflict', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => Response.json({ current: initialSnapshot(draftId) }, { status: 409 })));
    try { await draftApi.command(draftId, 99, { type: 'create_own' }); } catch (error) {
      expect(error).toBeInstanceOf(DraftApiError);
      expect((error as DraftApiError).current).toEqual(initialSnapshot(draftId));
      return;
    }
    throw new Error('Expected conflict');
  });
});
