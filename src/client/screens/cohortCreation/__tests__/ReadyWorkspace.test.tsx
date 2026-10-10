// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { ReadyWorkspace } from '../components/ReadyWorkspace';
import { readyFixture } from './ready.fixture';
afterEach(cleanup);
function props() { return { snapshot: readyFixture(), disabled: false, onActivate: vi.fn(async () => true), onReview: vi.fn(async () => true), onBack: vi.fn(async () => true) }; }
describe('Ready workspace', () => {
  it('shows retained counts, source labels and separate private/review choices', async () => {
    const actions = props(); render(<ReadyWorkspace {...actions} />);
    expect(screen.getByText('1 source · 4 learning pieces · 3 lessons')).toBeTruthy();
    expect(screen.getByText('https://example.com/retained-material')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Review cohort' }));
    await act(async () => {}); expect(actions.onReview).toHaveBeenCalledOnce(); expect(actions.onActivate).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Back to material' }));
    await act(async () => {}); expect(actions.onBack).toHaveBeenCalledOnce();
  });
  it('blocks duplicate activation and all competing actions until acceptance', async () => {
    const actions = props(); let finish!: (value: boolean) => void;
    actions.onActivate.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
    render(<ReadyWorkspace {...actions} />); const feed = screen.getByRole('button', { name: 'Go to my feed' });
    fireEvent.click(feed); fireEvent.click(feed); fireEvent.click(screen.getByRole('button', { name: 'Review cohort' }));
    expect(actions.onActivate).toHaveBeenCalledOnce(); expect(actions.onReview).not.toHaveBeenCalled();
    await act(async () => finish(false)); expect(screen.getByRole('button', { name: 'Go to my feed' }).hasAttribute('disabled')).toBe(false);
  });
  it('does not activate an unconfirmed or incomplete build', () => {
    const actions = props(); const view = render(<ReadyWorkspace {...actions} disabled />);
    fireEvent.click(screen.getByRole('button', { name: 'Go to my feed' })); expect(actions.onActivate).not.toHaveBeenCalled();
    view.rerender(<ReadyWorkspace {...actions} snapshot={{ ...actions.snapshot, processing: null }} />);
    fireEvent.click(screen.getByRole('button', { name: 'Go to my feed' })); expect(actions.onActivate).not.toHaveBeenCalled();
    expect(screen.getByText('Build not complete')).toBeTruthy();
  });
});
