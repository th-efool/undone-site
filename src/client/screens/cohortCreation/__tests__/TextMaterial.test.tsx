// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { initialSnapshot } from '@/src/shared/cohort-creation/flow';
import { draftId } from '@/src/shared/cohort-creation/__tests__/fixtures';
import { TextMaterial } from '../components/TextMaterial';
afterEach(cleanup);
function mount() {
  const props = { snapshot: initialSnapshot(draftId), uploading: false, pending: false,
    onUpload: vi.fn().mockResolvedValue(true), onCancelUpload: vi.fn(), onCancel: vi.fn(), onRetry: vi.fn() };
  render(<TextMaterial {...props} />); return props;
}
describe('one text material step', () => {
  it('submits pasted content through the same byte upload action', async () => {
    const props = mount(); fireEvent.click(screen.getByRole('button', { name: 'Paste text' }));
    fireEvent.change(screen.getByLabelText('Learning text'), { target: { value: 'Real source notes' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save and acquire material' }));
    await waitFor(() => expect(props.onUpload).toHaveBeenCalledOnce());
    expect(props.onUpload.mock.calls[0][0].size).toBe(17);
    expect(props.onUpload.mock.calls[0][1]).toBe('pasted-text.txt');
    await waitFor(() => expect((screen.getByLabelText('Learning text') as HTMLTextAreaElement).value).toBe(''));
  });
  it('accepts a Markdown file and clears the selection after acknowledgment', async () => {
    const props = mount(); const input = screen.getByLabelText('Choose or drop a text/Markdown file');
    fireEvent.change(input, { target: { files: [new File(['# Notes'], 'lesson.md')] } });
    fireEvent.click(screen.getByRole('button', { name: 'Save and acquire material' }));
    await waitFor(() => expect(props.onUpload).toHaveBeenCalledOnce());
    expect(props.onUpload.mock.calls[0][0].type).toBe('text/markdown');
    expect(props.onUpload.mock.calls[0][1]).toBe('lesson.md');
    await waitFor(() => expect(screen.queryByText('Selected: lesson.md')).toBeNull());
  });
  it('accepts a drop and discards old selection after an invalid drop', async () => {
    const props = mount(); const drop = screen.getByLabelText('Choose or drop a text/Markdown file').parentElement!;
    fireEvent.drop(drop, { dataTransfer: { files: [new File(['notes'], 'notes.txt')] } });
    expect(screen.getByText('Selected: notes.txt')).toBeTruthy();
    fireEvent.drop(drop, { dataTransfer: { files: [new File(['pdf'], 'notes.pdf')] } });
    expect(screen.queryByText('Selected: notes.txt')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Save and acquire material' }));
    expect(props.onUpload).not.toHaveBeenCalled();
    expect(screen.getByRole('alert').textContent).toBe('Choose a file first.');
  });
  it('retains pasted content after failed upload for an explicit retry', async () => {
    const props = mount(); props.onUpload.mockResolvedValue(false);
    fireEvent.click(screen.getByRole('button', { name: 'Paste text' }));
    fireEvent.change(screen.getByLabelText('Learning text'), { target: { value: 'Keep this source' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save and acquire material' }));
    await waitFor(() => expect(props.onUpload).toHaveBeenCalledOnce());
    expect((screen.getByLabelText('Learning text') as HTMLTextAreaElement).value).toBe('Keep this source');
  });
});
