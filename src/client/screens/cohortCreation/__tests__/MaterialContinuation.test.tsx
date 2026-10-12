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
