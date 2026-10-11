// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { initialSnapshot } from '@/src/shared/cohort-creation/flow';
import { draftId } from '@/src/shared/cohort-creation/__tests__/fixtures';
import { TextMaterial } from '../components/TextMaterial';
afterEach(cleanup);
function mount() {
  const props = { snapshot: initialSnapshot(draftId), uploading: false, pending: false,
    onUpload: vi.fn().mockResolvedValue(true), onCancelUpload: vi.fn(), onCancel: vi.fn(), onRetry: vi.fn(), onRemove: vi.fn().mockResolvedValue(true), onWeb: vi.fn().mockResolvedValue(true) };
  render(<TextMaterial {...props} />); return props;
}
describe('one text material step', () => {
  it('offers file selection before showing an upload submission action', () => {
    mount();
    expect(screen.queryByRole('button', { name: 'Save and acquire material' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Choose a file' })).toBeTruthy();
    fireEvent.change(screen.getByLabelText('Choose or drop a PDF/text/Markdown file'), { target: { files: [new File(['notes'], 'notes.txt')] } });
    expect(screen.getByRole('button', { name: 'Save and acquire material' })).toBeTruthy();
  });
  it('resumes saved video observations without reinspecting or discarding partial work', async () => {
    const snapshot = initialSnapshot(draftId); const artifact = { id: draftId, kind: 'artifact' as const, byteLength: 500, checksum: 'a'.repeat(64) };
    const onObserve = vi.fn().mockResolvedValue(true); const onWeb = vi.fn();
    render(<TextMaterial snapshot={{ ...snapshot,
      materials: [{ id: draftId, kind: 'youtube_video', input: { kind: 'url', url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ' }, selectedUnitIds: ['dQw4w9WgXcQ'], status: 'failed' }],
      materialRefs: [{ materialId: draftId, ids: [draftId] }],
      youtubeSources: [{ materialId: draftId, sourceRevision: 0, metadataArtifact: artifact, metadataFingerprint: 'b'.repeat(64), observations: [],
        units: [{ unitId: 'dQw4w9WgXcQ', title: 'Real lighting lesson', durationSeconds: 120 }] }],
    }} uploading={false} pending={false} onUpload={vi.fn()} onCancelUpload={vi.fn()} onCancel={vi.fn()} onRetry={vi.fn()} onRemove={vi.fn()} onWeb={onWeb} onObserve={onObserve} />);
    expect(screen.getByText(/0 of 1 selected video observations retained/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Resume selected video observations for source 1' }));
    await waitFor(() => expect(onObserve).toHaveBeenCalledWith(draftId)); expect(onWeb).not.toHaveBeenCalled();
    expect(screen.queryByRole('button', { name: 'Retry source 1' })).toBeNull();
  });
  it('shows retained YouTube unit metadata without claiming extracted learning content', () => {
    const snapshot = initialSnapshot(draftId); const artifact = { id: draftId, kind: 'artifact' as const, byteLength: 500, checksum: 'a'.repeat(64) };
    render(<TextMaterial snapshot={{ ...snapshot,
      materials: [{ id: draftId, kind: 'youtube_video', input: { kind: 'url', url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ' }, selectedUnitIds: [], status: 'needs_input' }],
      materialRefs: [{ materialId: draftId, ids: [draftId] }],
      youtubeSources: [{ materialId: draftId, sourceRevision: 0, metadataArtifact: artifact, metadataFingerprint: 'b'.repeat(64), observations: [], units: [{ unitId: 'dQw4w9WgXcQ', title: 'Real lighting lesson', durationSeconds: 120 }] }],
    }} uploading={false} pending={false} onUpload={vi.fn()} onCancelUpload={vi.fn()} onCancel={vi.fn()} onRetry={vi.fn()} onRemove={vi.fn()} onWeb={vi.fn()} />);
    expect(screen.getByLabelText('Source 1 videos').textContent).toContain('Real lighting lesson');
    expect(screen.getByText(/Metadata retained; video observation pending/)).toBeTruthy();
    expect(screen.queryByText(/Retained text ready/)).toBeNull(); expect(screen.queryByText(/extracted segments/)).toBeNull();
  });
  it('accepts a dropped PDF using the PDF upload media type', async () => {
    const props = mount(); const drop = screen.getByLabelText('Choose or drop a PDF/text/Markdown file').parentElement!;
    fireEvent.drop(drop, { dataTransfer: { files: [new File(['%PDF-1.4'], 'lesson.pdf')] } });
    fireEvent.click(screen.getByRole('button', { name: 'Save and acquire material' }));
    await waitFor(() => expect(props.onUpload).toHaveBeenCalledOnce());
    expect(props.onUpload.mock.calls[0][0].type).toBe('application/pdf'); expect(props.onUpload.mock.calls[0][1]).toBe('lesson.pdf');
  });
  it('does not silently add a new source when a replacement target disappears', () => {
    const base = initialSnapshot(draftId);
    const source = { id: draftId, kind: 'markdown' as const, input: { kind: 'upload' as const, assetId: draftId }, status: 'failed' as const, selectedUnitIds: [] };
    const props = { uploading: false, pending: false, onUpload: vi.fn(), onCancelUpload: vi.fn(), onCancel: vi.fn(), onRetry: vi.fn(), onRemove: vi.fn(), onWeb: vi.fn() };
    const view = render(<TextMaterial {...props} snapshot={{ ...base, materials: [source] }} />);
    fireEvent.click(screen.getByRole('button', { name: 'Replace source 1' }));
    view.rerender(<TextMaterial {...props} snapshot={base} />);
    expect(screen.getByRole('alert').textContent).toContain('no longer selected');
    expect((screen.getByRole('button', { name: 'Save and acquire material' }) as HTMLButtonElement).disabled).toBe(true);
    expect(props.onUpload).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Cancel replacement' }));
    expect(screen.queryByRole('button', { name: 'Save and acquire material' })).toBeNull();
  });
  it('allows replacing a source at the selection limit and can cancel the replacement', async () => {
    const base = initialSnapshot(draftId);
    const materials = Array.from({ length: 20 }, (_, index) => ({ id: `source-${index}`, kind: 'markdown' as const,
      input: { kind: 'upload' as const, assetId: draftId }, status: 'failed' as const, selectedUnitIds: [] }));
    const upload = vi.fn().mockResolvedValue(false);
    render(<TextMaterial snapshot={{ ...base, materials }} uploading={false} pending={false} onUpload={upload}
      onCancelUpload={vi.fn()} onCancel={vi.fn()} onRetry={vi.fn()} onRemove={vi.fn()} onWeb={vi.fn()} />);
    expect(screen.queryByRole('button', { name: 'Save and acquire material' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Replace source 1' }));
    const submit = screen.getByRole('button', { name: 'Save and acquire material' }) as HTMLButtonElement;
    expect(submit.disabled).toBe(false);
    fireEvent.click(screen.getByRole('button', { name: 'Paste text' }));
    fireEvent.change(screen.getByLabelText('Learning text'), { target: { value: 'smaller source' } });
    fireEvent.click(submit);
    await waitFor(() => expect(upload).toHaveBeenCalledOnce());
    expect(upload.mock.calls[0][2]).toBe('source-0');
    fireEvent.click(screen.getByRole('button', { name: 'Cancel replacement' }));
    expect(submit.disabled).toBe(true);
  });
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
    const props = mount(); const input = screen.getByLabelText('Choose or drop a PDF/text/Markdown file');
    fireEvent.change(input, { target: { files: [new File(['# Notes'], 'lesson.md')] } });
    fireEvent.click(screen.getByRole('button', { name: 'Save and acquire material' }));
    await waitFor(() => expect(props.onUpload).toHaveBeenCalledOnce());
    expect(props.onUpload.mock.calls[0][0].type).toBe('text/markdown');
    expect(props.onUpload.mock.calls[0][1]).toBe('lesson.md');
    await waitFor(() => expect(screen.queryByText('Selected: lesson.md')).toBeNull());
  });
  it('accepts a drop and discards old selection after an invalid drop', async () => {
    const props = mount(); const drop = screen.getByLabelText('Choose or drop a PDF/text/Markdown file').parentElement!;
    fireEvent.drop(drop, { dataTransfer: { files: [new File(['notes'], 'notes.txt')] } });
    expect(screen.getByText('Selected: notes.txt')).toBeTruthy();
    fireEvent.drop(drop, { dataTransfer: { files: [new File(['pdf'], 'notes.zip')] } });
    expect(screen.queryByText('Selected: notes.txt')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Save and acquire material' })).toBeNull();
    expect(props.onUpload).not.toHaveBeenCalled();
    expect(screen.getByRole('alert').textContent).toBe('Select one .pdf, .md, .markdown or .txt file.');
  });
  it('retains pasted content after failed upload for an explicit retry', async () => {
    const props = mount(); props.onUpload.mockResolvedValue(false);
    fireEvent.click(screen.getByRole('button', { name: 'Paste text' }));
    fireEvent.change(screen.getByLabelText('Learning text'), { target: { value: 'Keep this source' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save and acquire material' }));
    await waitFor(() => expect(props.onUpload).toHaveBeenCalledOnce());
    expect((screen.getByLabelText('Learning text') as HTMLTextAreaElement).value).toBe('Keep this source');
  });
  it.each([['notes.txt', 1024 * 1024 + 1], ['lesson.pdf', 25 * 1024 * 1024 + 1], ['empty.md', 0]])('rejects invalid file sizes before upload: %s', (filename, size) => {
    const props = mount(); const file = new File(['x'], filename);
    Object.defineProperty(file, 'size', { value: size });
    fireEvent.change(screen.getByLabelText('Choose or drop a PDF/text/Markdown file'), { target: { files: [file] } });
    expect(screen.getByRole('alert').textContent).toContain('nothing was truncated');
    expect(screen.queryByText(`Selected: ${filename}`)).toBeNull();
    expect(props.onUpload).not.toHaveBeenCalled();
  });
  it('counts pasted UTF-8 bytes instead of characters for the text limit', () => {
    const props = mount(); fireEvent.click(screen.getByRole('button', { name: 'Paste text' }));
    const text = 'é'.repeat(524289);
    fireEvent.change(screen.getByLabelText('Learning text'), { target: { value: text } });
    fireEvent.click(screen.getByRole('button', { name: 'Save and acquire material' }));
    expect(screen.getByRole('alert').textContent).toContain('text up to 1 MiB');
    expect((screen.getByLabelText('Learning text') as HTMLTextAreaElement).value).toBe(text);
    expect(props.onUpload).not.toHaveBeenCalled();
  });
  it('serializes submissions and retains input after an unexpected upload failure', async () => {
    const props = mount(); let reject!: (error: Error) => void;
    props.onUpload.mockImplementation(() => new Promise((_resolve, rejectPromise) => { reject = rejectPromise; }));
    fireEvent.click(screen.getByRole('button', { name: 'Paste text' }));
    fireEvent.change(screen.getByLabelText('Learning text'), { target: { value: 'Keep these notes' } });
    const submit = screen.getByRole('button', { name: 'Save and acquire material' });
    fireEvent.submit(submit.closest('form')!); fireEvent.submit(submit.closest('form')!);
    expect(props.onUpload).toHaveBeenCalledOnce();
    expect((screen.getByRole('button', { name: 'Upload a file' }) as HTMLButtonElement).disabled).toBe(true);
    reject(new Error('storage failed'));
    await waitFor(() => expect(screen.getByRole('alert').textContent).toContain('Your input is still here'));
    expect((screen.getByLabelText('Learning text') as HTMLTextAreaElement).value).toBe('Keep these notes');
    expect((submit as HTMLButtonElement).disabled).toBe(false);
  });
});
