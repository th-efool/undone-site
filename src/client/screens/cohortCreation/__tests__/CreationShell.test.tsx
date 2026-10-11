// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { CreationShell, type CreationShellProps } from '../components/CreationShell';
afterEach(cleanup);
const props = { query: 'Learning goal', reply: 'Saved response', hintTitle: 'Current stage', hint: 'Bounded actions', children: 'Workspace' };
describe('bounded creation composer', () => {
  it.each([
    ['recommendations', 'Describe what you want to learn'], ['starting', 'Describe your starting point or material'],
    ['material', 'Describe your starting point or material'], ['processing', 'Ask to see saved concepts, chunks or analysis'],
    ['review', 'Request a supported curriculum refinement'],
  ] as const)('describes supported %s interaction', (variant, label) => {
    render(<CreationShell {...props} variant={variant} onMessage={vi.fn()} />);
    expect((screen.getByRole('textbox', { name: label }) as HTMLTextAreaElement).placeholder).toBe(label);
    expect(screen.queryByText('Say anything')).toBeNull();
  });
  it('serializes submit, disables competing suggestions and preserves declined text for explicit retry', async () => {
    let resolve!: (value: boolean) => void; const onMessage = vi.fn(() => new Promise<boolean>(done => { resolve = done; }));
    const action = vi.fn(); render(<CreationShell {...props} onMessage={onMessage} suggestions={[{ label: 'Choose a path', action }]} />);
    const composer = screen.getByRole('textbox') as HTMLTextAreaElement; const form = composer.closest('form')!;
    fireEvent.change(composer, { target: { value: 'My retained learning goal' } }); fireEvent.submit(form); fireEvent.submit(form);
    expect(onMessage).toHaveBeenCalledExactlyOnceWith('My retained learning goal'); expect(composer.disabled).toBe(true);
    expect((screen.getByRole('button', { name: 'Suggested action: Choose a path' }) as HTMLButtonElement).disabled).toBe(true);
    resolve(false); await waitFor(() => expect(screen.getByRole('alert').textContent).toContain('not saved'));
    expect(composer.value).toBe('My retained learning goal'); expect(composer.disabled).toBe(false);
    fireEvent.submit(form); expect(onMessage).toHaveBeenCalledTimes(2); resolve(true);
    await waitFor(() => expect(composer.value).toBe('')); expect(screen.queryByRole('alert')).toBeNull();
  });
  it('keeps rejected messages editable and honors an explicit refinement label', async () => {
    const onMessage: CreationShellProps['onMessage'] = async () => { throw new Error('Choose a supported action.'); };
    render(<CreationShell {...props} variant="review" composerLabel="Refinement request" onMessage={onMessage} />);
    const composer = screen.getByRole('textbox', { name: 'Refinement request' }) as HTMLTextAreaElement;
    fireEvent.change(composer, { target: { value: 'Unsubmitted correction' } }); fireEvent.submit(composer.closest('form')!);
    await waitFor(() => expect(screen.getByRole('alert').textContent).toContain('Choose a supported action'));
    expect(composer.value).toBe('Unsubmitted correction'); expect(composer.disabled).toBe(false);
  });
});
