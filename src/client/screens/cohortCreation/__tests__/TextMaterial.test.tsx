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
  it('shows retained YouTube unit metadata without claiming extracted learning content', () => {
    const snapshot = initialSnapshot(draftId); const artifact = { id: draftId, kind: 'artifact' as const, byteLength: 500, checksum: 'a'.repeat(64) };
    render(<TextMaterial snapshot={{ ...snapshot,
      materials: [{ id: draftId, kind: 'youtube_video', input: { kind: 'url', url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ' }, selectedUnitIds: [], status: 'needs_input' }],
      materialRefs: [{ materialId: draftId, ids: [draftId] }],
      youtubeSources: [{ materialId: draftId, sourceRevision: 0, metadataArtifact: artifact, metadataFingerprint: 'b'.repeat(64), units: [{ unitId: 'dQw4w9WgXcQ', title: 'Real lighting lesson', durationSeconds: 120 }] }],
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
    expect((screen.getByRole('button', { name: 'Save and acquire material' }) as HTMLButtonElement).disabled).toBe(false);
  });
  it('allows replacing a source at the selection limit and can cancel the replacement', async () => {
    const base = initialSnapshot(draftId);
    const materials = Array.from({ length: 20 }, (_, index) => ({ id: `source-${index}`, kind: 'markdown' as const,
      input: { kind: 'upload' as const, assetId: draftId }, status: 'failed' as const, selectedUnitIds: [] }));
    const upload = vi.fn().mockResolvedValue(false);
    render(<TextMaterial snapshot={{ ...base, materials }} uploading={false} pending={false} onUpload={upload}
      onCancelUpload={vi.fn()} onCancel={vi.fn()} onRetry={vi.fn()} onRemove={vi.fn()} onWeb={vi.fn()} />);
    const submit = screen.getByRole('button', { name: 'Save and acquire material' }) as HTMLButtonElement;
    expect(submit.disabled).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: 'Replace source 1' }));
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
