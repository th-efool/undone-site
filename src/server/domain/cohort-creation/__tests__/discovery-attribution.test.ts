import { randomUUID } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';
vi.mock('server-only', () => ({}));
import { discoveryAttributionHandler } from '../discovery-attribution.http';
import { DraftNotFound } from '../draft.service';
import { initialSnapshot } from '@/src/shared/cohort-creation/flow';

const draftId = randomUUID(); const searchId = randomUUID();
const checkpoint = { phase: 'discovery_sources' as const, requestId: randomUUID(), inputRevision: 1, inputFingerprint: 'a'.repeat(64),
  searchArtifact: { id: searchId, kind: 'artifact' as const, byteLength: 500, checksum: 'b'.repeat(64) },
  observationArtifact: null, selectionArtifact: null, processed: 0, total: 1 };
function fixture(owner: string | null = 'owner') {
  const load = vi.fn(async () => ({ ...initialSnapshot(draftId), discovery: { requestId: checkpoint.requestId, inputRevision: 1, checkpoint, result: null } }));
  const read = vi.fn(async () => '<style>p{color:blue}</style><p>Search evidence</p><script>malicious()</script>');
  return { load, read, handle: discoveryAttributionHandler({ load }, async () => owner, read) };
}
const request = (query = '') => new Request(`https://app.example/api/cohort-creation/drafts/${draftId}/discovery-attribution${query}`);
describe('private isolated provider attribution', () => {
  it('authorizes the draft owner before reading evidence and enforces an opaque, script-free HTML context', async () => {
    const f = fixture(); const response = await f.handle(request(`?search=${searchId}`), draftId);
    expect(response.status).toBe(200); expect(f.load).toHaveBeenCalledWith('owner', draftId);
    expect(f.read).toHaveBeenCalledWith({ ownerId: 'owner', draftId }, checkpoint, expect.any(AbortSignal));
    expect(await response.text()).toContain('<script>malicious()</script>');
    expect(response.headers.get('content-security-policy')).toContain("default-src 'none'");
    expect(response.headers.get('content-security-policy')).toContain('sandbox allow-popups');
    expect(response.headers.get('content-security-policy')).not.toContain('allow-scripts');
    expect(response.headers.get('content-security-policy')).not.toContain('allow-same-origin');
    expect(response.headers.get('cache-control')).toBe('no-store'); expect(response.headers.get('referrer-policy')).toBe('no-referrer');
  });
  it('denies unauthenticated, invalid, foreign and stale search requests before storage access', async () => {
    const anonymous = fixture(null); expect((await anonymous.handle(request(), draftId)).status).toBe(401); expect(anonymous.load).not.toHaveBeenCalled();
    const invalid = fixture(); expect((await invalid.handle(request(), 'not-a-draft')).status).toBe(404); expect(invalid.load).not.toHaveBeenCalled();
    const foreign = fixture(); foreign.load.mockRejectedValue(new DraftNotFound());
    expect((await foreign.handle(request(), draftId)).status).toBe(404); expect(foreign.read).not.toHaveBeenCalled();
    const stale = fixture(); expect((await stale.handle(request(`?search=${randomUUID()}`), draftId)).status).toBe(404); expect(stale.read).not.toHaveBeenCalled();
  });
  it('sanitizes storage failures and represents absent attribution without model-generated content', async () => {
    const f = fixture(); f.read.mockRejectedValueOnce(new Error('private connection token'));
    const failure = await f.handle(request(), draftId); expect(failure.status).toBe(503); expect(await failure.text()).not.toContain('private connection token');
    const read = vi.fn(async () => null); const handle = discoveryAttributionHandler({ load: f.load }, async () => 'owner', read);
    expect(await (await handle(request(), draftId)).text()).toBe('<p>No search attribution was returned.</p>');
  });
});
