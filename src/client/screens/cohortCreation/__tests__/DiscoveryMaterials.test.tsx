// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { DiscoveryMaterials } from '../components/DiscoveryMaterials';
import { initialSnapshot } from '@/src/shared/cohort-creation/flow';
import { draftId, requestId } from '@/src/shared/cohort-creation/__tests__/fixtures';
import type { CreationSnapshot } from '@/src/shared/cohort-creation/contracts';

afterEach(cleanup);
const ref = { id: draftId, kind: 'artifact' as const, byteLength: 500, checksum: 'a'.repeat(64) };
const candidate = { key: 'b'.repeat(64), citationIds: ['citation'], url: 'https://docs.example.org/lesson', title: 'Observed learning page',
  kind: 'web' as const, observedAt: new Date().toISOString(), observation: { method: 'public_http' as const, requestedUrl: 'https://docs.example.org/lesson',
    redirects: [], titleOrigin: 'observed' as const, contentRetained: false as const } };
function snapshot(complete = false): CreationSnapshot {
  const checkpoint = { phase: 'discovery_sources' as const, requestId, inputRevision: 1, inputFingerprint: 'c'.repeat(64),
    searchArtifact: ref, observationArtifact: complete ? ref : null, selectionArtifact: complete ? ref : null, processed: complete ? 1 : 0, total: 1 };
  return { ...initialSnapshot(draftId), startingPoint: 'find_material', status: complete ? 'succeeded' : 'running', activeRequestId: complete ? null : requestId,
    discovery: { requestId, inputRevision: 1, checkpoint, result: complete ? { checkpoint, candidates: [candidate], failures: [],
      selection: { selected: [{ candidateKey: candidate.key, reason: 'Relevant observed resource' }] } } : null } };
}
describe('grounded source confirmation workspace', () => {
  it('queues one explicit search and blocks duplicate submissions', async () => {
    let resolve!: (value: boolean) => void; const onFind = vi.fn(() => new Promise<boolean>(done => { resolve = done; }));
    render(<DiscoveryMaterials snapshot={initialSnapshot(draftId)} disabled={false} onFind={onFind} onAcquire={vi.fn()} onGithub={vi.fn()} onCancel={vi.fn()} />);
    const button = screen.getByRole('button', { name: 'Find sources' }); fireEvent.click(button); fireEvent.click(button);
    expect(onFind).toHaveBeenCalledOnce(); resolve(false); await waitFor(() => expect((button as HTMLButtonElement).disabled).toBe(false));
  });
  it('shows known progress and isolated attribution without claiming acquisition success', () => {
    const onCancel = vi.fn(); render(<DiscoveryMaterials snapshot={snapshot()} disabled={false} onFind={vi.fn()} onAcquire={vi.fn()} onGithub={vi.fn()} onCancel={onCancel} />);
    expect(screen.getByText('Observed or accounted for 0 of 1 cited resources.')).toBeTruthy();
    const iframe = screen.getByTitle('Google Search attribution'); expect(iframe.getAttribute('sandbox')).toBe('allow-popups');
    expect(iframe.getAttribute('src')).toContain(`/drafts/${draftId}/discovery-attribution?search=${draftId}`);
    fireEvent.click(screen.getByRole('button', { name: 'Cancel discovery' })); expect(onCancel).toHaveBeenCalledOnce();
  });
  it('requires explicit source acquisition and preserves observed metadata and selected reasons', async () => {
    const onAcquire = vi.fn().mockResolvedValue(true);
    render(<DiscoveryMaterials snapshot={snapshot(true)} disabled={false} onFind={vi.fn()} onAcquire={onAcquire} onGithub={vi.fn()} onCancel={vi.fn()} />);
    expect(screen.getByText(candidate.title)).toBeTruthy(); expect(screen.getByText('Relevant observed resource')).toBeTruthy(); expect(onAcquire).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Acquire source 1' })); await waitFor(() => expect(onAcquire).toHaveBeenCalledExactlyOnceWith(candidate));
    expect(screen.getByText(/A source becomes ready only after actual content acquisition succeeds/)).toBeTruthy();
  });
});
