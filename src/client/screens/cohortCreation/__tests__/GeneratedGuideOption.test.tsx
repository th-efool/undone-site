// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { initialSnapshot } from '@/src/shared/cohort-creation/flow';
import { draftId, result } from '@/src/shared/cohort-creation/__tests__/fixtures';
import type { CreationSnapshot } from '@/src/shared/cohort-creation/contracts';
import { GeneratedGuideOption } from '../components/GeneratedGuideOption';
afterEach(cleanup);
const snapshot: CreationSnapshot = { ...initialSnapshot(draftId), startingPoint: 'have_goal', result, status: 'succeeded' };
function setup(state = snapshot, onAuthor = vi.fn(async () => true)) {
  const onCancel = vi.fn(); const view = render(<GeneratedGuideOption snapshot={state} disabled={false} onAuthor={onAuthor} onCancel={onCancel} />);
  return { ...view, onAuthor, onCancel };
}
describe('explicit goal-guide consent and recovery', () => {
  it('never generates automatically and requires explicit consent', async () => {
    const f = setup(); const button = screen.getByRole('button', { name: 'Create AI-authored guide' });
    expect((button as HTMLButtonElement).disabled).toBe(true); expect(f.onAuthor).not.toHaveBeenCalled();
    expect(screen.getByText(/not verified external source material/)).toBeTruthy();
    fireEvent.click(screen.getByRole('checkbox')); fireEvent.click(button);
    await waitFor(() => expect(f.onAuthor).toHaveBeenCalledOnce());
  });
  it('serializes saves, keeps consent on failure and permits explicit retry', async () => {
    let resolve!: (value: boolean) => void; const onAuthor = vi.fn(() => new Promise<boolean>(done => { resolve = done; }));
    setup(snapshot, onAuthor); fireEvent.click(screen.getByRole('checkbox'));
    const button = screen.getByRole('button', { name: 'Create AI-authored guide' }); fireEvent.click(button); fireEvent.click(button);
    expect(onAuthor).toHaveBeenCalledOnce(); resolve(false);
    await waitFor(() => expect(screen.getByRole('alert').textContent).toContain('not acknowledged'));
    expect((screen.getByRole('checkbox') as HTMLInputElement).checked).toBe(true);
    fireEvent.click(button); expect(onAuthor).toHaveBeenCalledTimes(2); resolve(true);
    await waitFor(() => expect((button as HTMLButtonElement).disabled).toBe(false));
  });
  it('retries the same failed source, handles unexpected failures and cancels running work', async () => {
    const source = { id: 'guide-source', kind: 'generated_guide' as const, input: { kind: 'goal' as const, intentId: result.intent.id }, selectedUnitIds: [], status: 'failed' as const };
    const onAuthor = vi.fn(async () => { throw new Error('network'); }); const f = setup({ ...snapshot, materials: [source] }, onAuthor);
    fireEvent.click(screen.getByRole('checkbox')); fireEvent.click(screen.getByRole('button', { name: 'Retry AI-authored guide' }));
    await waitFor(() => expect(screen.getByRole('alert').textContent).toContain('could not be queued'));
    expect(onAuthor).toHaveBeenCalledWith(source.id);
    f.rerender(<GeneratedGuideOption snapshot={{ ...snapshot, status: 'running', materials: [{ ...source, status: 'acquiring' }] }} disabled={false} onAuthor={onAuthor} onCancel={f.onCancel} />);
    fireEvent.click(screen.getByRole('button', { name: 'Cancel guide generation' })); expect(f.onCancel).toHaveBeenCalledOnce();
  });
  it('hides the choice outside goal-only and does not regenerate ready guides', () => {
    const f = setup({ ...snapshot, startingPoint: 'find_material' }); expect(screen.queryByRole('checkbox')).toBeNull();
    f.rerender(<GeneratedGuideOption snapshot={{ ...snapshot, materials: [{ id: draftId, kind: 'generated_guide', input: { kind: 'goal', intentId: result.intent.id }, selectedUnitIds: [draftId], status: 'ready' }] }} disabled={false} onAuthor={f.onAuthor} onCancel={f.onCancel} />);
    expect(screen.getByRole('status').textContent).toContain('guide saved'); expect(screen.queryByRole('checkbox')).toBeNull();
    expect(f.onAuthor).not.toHaveBeenCalled();
  });
});
