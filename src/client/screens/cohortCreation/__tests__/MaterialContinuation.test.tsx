// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { initialSnapshot } from '@/src/shared/cohort-creation/flow';
import { draftId } from '@/src/shared/cohort-creation/__tests__/fixtures';
import { UnderstandingProgress } from '../components/UnderstandingProgress';
afterEach(cleanup);
const base = { ...initialSnapshot(draftId), stage: 'starting_point' as const };
const callbacks = { onStart: vi.fn(async () => true), onCancel: vi.fn(), onBack: vi.fn(async () => true) };
it('explains missing content and cannot start understanding', () => {
  render(<UnderstandingProgress snapshot={base} disabled={false} {...callbacks} />);
  expect(screen.getByRole('region', { name: 'Continue with material' })).toBeTruthy();
  expect(screen.queryByRole('button', { name: /Continue to understanding/ })).toBeNull();
  expect(screen.getByRole('button', { name: /Review material/ })).toBeTruthy();
});
it('starts understanding only for retained ready content and reports rejection', async () => {
  const onStart = vi.fn(async () => false);
  const snapshot = { ...base, materials: [{ id: draftId, kind: 'web' as const, input: { kind: 'url' as const, url: 'https://example.com' }, status: 'ready' as const, selectedUnitIds: [draftId] }],
    extractions: [{ materialId: draftId, version: 'a'.repeat(64), checksum: 'b'.repeat(64), artifactRef: draftId, extractionKind: 'text' as const, complete: true, segmentCount: 1 }] };
  render(<UnderstandingProgress snapshot={snapshot} disabled={false} {...callbacks} onStart={onStart} />);
  fireEvent.click(screen.getByRole('button', { name: /Continue to understanding/ }));
  await waitFor(() => expect(onStart).toHaveBeenCalledOnce());
  expect(await screen.findByRole('alert')).toBeTruthy();
});
it('reviews the unfinished source rather than an earlier ready video', () => {
  const source = { id: draftId, kind: 'youtube_video' as const, input: { kind: 'url' as const, url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ' }, status: 'ready' as const, selectedUnitIds: ['dQw4w9WgXcQ'] };
  const snapshot = { ...base, materials: [source, { ...source, id: 'unfinished', status: 'failed' as const }] };
  const { container } = render(<><div id={`creation-material-${draftId}`} /><div id="creation-material-unfinished" /><UnderstandingProgress snapshot={snapshot} disabled={false} {...callbacks} /></>);
  const readyScroll = vi.fn(); const unfinishedScroll = vi.fn();
  container.querySelector(`#creation-material-${draftId}`)!.scrollIntoView = readyScroll;
  container.querySelector('#creation-material-unfinished')!.scrollIntoView = unfinishedScroll;
  fireEvent.click(screen.getByRole('button', { name: /Review material/ }));
  expect(readyScroll).not.toHaveBeenCalled(); expect(unfinishedScroll).toHaveBeenCalledWith({ behavior: 'smooth', block: 'start' });
});
